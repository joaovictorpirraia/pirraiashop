import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarLegendaCarrossel } from "./conteudo";
import { slugify } from "./slug";

/** Produto mínimo pra montar o carrossel (o resto é só pra ranquear/selecionar). */
export interface ProdutoCarrossel {
  id: number;
  titulo: string;
  preco: number | string | null;
  desconto_pct: number | null;
}

interface ProdutoSel extends ProdutoCarrossel {
  categoria: string | null;
  score_ia: number | null;
  cliques: number;
  status: string;
}

/**
 * Escolhe os produtos de um carrossel automático:
 *  - só da vitrine (links ativos, não pausados, produto curado/publicado);
 *  - tira os postados nos últimos 14 dias (não repete);
 *  - prefere UMA categoria com produtos frescos suficientes (carrossel temático dá
 *    gancho + fundo lifestyle melhores); se nenhuma tiver ≥3, mistura geral;
 *  - ranqueia por score_ia > cliques > desconto.
 */
export async function selecionarProdutosAuto(
  supabase: SupabaseClient,
  n = 8,
): Promise<{ produtos: ProdutoSel[]; categoria: string | null }> {
  // postados recentemente (evita repetir)
  const desde = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentes } = await supabase
    .from("carrosseis")
    .select("produto_ids")
    .eq("status", "publicado")
    .gte("publicado_em", desde);
  const jaPostados = new Set<number>();
  for (const r of recentes ?? []) {
    for (const id of (r.produto_ids as number[]) ?? []) jaPostados.add(id);
  }

  const { data: linksRaw } = await supabase
    .from("links")
    .select("cliques, produto:produtos!inner(id, titulo, preco, desconto_pct, categoria, score_ia, status)")
    .eq("ativo", true)
    .eq("pausado", false);

  const todos: ProdutoSel[] = ((linksRaw ?? []) as unknown[])
    .map((l) => {
      const row = l as { cliques: number | null; produto: ProdutoSel | ProdutoSel[] };
      const p = Array.isArray(row.produto) ? row.produto[0] : row.produto;
      return p ? { ...p, cliques: row.cliques ?? 0 } : null;
    })
    .filter(
      (p): p is ProdutoSel =>
        Boolean(p) && ["curado", "publicado"].includes(p!.status) && !jaPostados.has(p!.id),
    );

  const rank = (a: ProdutoSel, b: ProdutoSel) =>
    (b.score_ia ?? -1) - (a.score_ia ?? -1) ||
    (b.cliques ?? 0) - (a.cliques ?? 0) ||
    (b.desconto_pct ?? 0) - (a.desconto_pct ?? 0);

  // agrupa por categoria e escolhe a maior lista fresca (≥3)
  const porCat = new Map<string, ProdutoSel[]>();
  for (const p of todos) {
    const c = p.categoria || "outros";
    const arr = porCat.get(c);
    if (arr) arr.push(p);
    else porCat.set(c, [p]);
  }
  let melhorCat: string | null = null;
  let melhorLista: ProdutoSel[] = [];
  for (const [c, lista] of porCat) {
    if (lista.length >= 3 && lista.length > melhorLista.length) {
      melhorCat = c;
      melhorLista = lista;
    }
  }

  const base = melhorLista.length >= 3 ? melhorLista : todos;
  const produtos = [...base].sort(rank).slice(0, n);
  return { produtos, categoria: melhorLista.length >= 3 ? melhorCat : null };
}

/** Gera capa/legenda (IA) e insere um rascunho de carrossel. Retorna o id. */
export async function inserirRascunhoCarrossel(
  supabase: SupabaseClient,
  produtos: ProdutoCarrossel[],
): Promise<number> {
  if (produtos.length < 2) throw new Error("produtos insuficientes pra montar o carrossel");
  const { gancho, tema_fundo, legenda, hashtags } = await gerarLegendaCarrossel(
    produtos.map((p) => ({ titulo: p.titulo, preco: p.preco, desconto_pct: p.desconto_pct })),
  );
  // legenda LEVE enquanto a conta é nova: só legenda + poucas hashtags. Sem o
  // paredão de palavras-chave (é o sinal mais "spam" pro robô da Meta). Dá pra
  // voltar ao "modo cheio" quando a conta tiver histórico.
  const partes = [legenda];
  if (hashtags.length) partes.push(hashtags.slice(0, 8).map((h) => `#${h}`).join(" "));

  const { data, error } = await supabase
    .from("carrosseis")
    .insert({
      produto_ids: produtos.map((p) => p.id),
      gancho,
      tema_fundo,
      legenda: partes.join("\n\n"),
      status: "rascunho",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "falha ao inserir o carrossel");
  return data.id as number;
}

/** Monta um rascunho automático: seleciona os produtos do dia e insere. */
export async function montarRascunhoAuto(
  supabase: SupabaseClient,
  n = 8,
): Promise<{ id: number; categoria: string | null; n: number }> {
  const { produtos, categoria } = await selecionarProdutosAuto(supabase, n);
  if (produtos.length < 2) {
    throw new Error("não há produtos frescos suficientes na vitrine (todos já foram postados nos últimos 14 dias?)");
  }
  const id = await inserirRascunhoCarrossel(supabase, produtos);
  return { id, categoria, n: produtos.length };
}

/**
 * Cura os produtos de um carrossel PRA VITRINE, com validade (default 15 dias).
 * Só cria link pra quem ainda não tem um ativo (produto evergreen cadastrado à mão
 * fica intocado). Chamado na PUBLICAÇÃO — assim o público só vê o que você aprovou,
 * e o item some sozinho depois da validade. short_url = link de afiliado do produto.
 */
export async function curarProdutosParaVitrine(
  supabase: SupabaseClient,
  ids: number[],
  diasValidade = 15,
): Promise<void> {
  if (!ids.length) return;
  const expira = new Date(Date.now() + diasValidade * 24 * 60 * 60 * 1000).toISOString();
  const { data: ult } = await supabase
    .from("links")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  let ordem = (ult?.ordem ?? -1) + 1;

  for (const pid of ids) {
    const { data: existe } = await supabase
      .from("links")
      .select("id")
      .eq("produto_id", pid)
      .eq("ativo", true)
      .maybeSingle();
    if (existe) continue; // já está na vitrine — não mexe

    const { data: prod } = await supabase
      .from("produtos")
      .select("titulo, link_afiliado, url_produto")
      .eq("id", pid)
      .maybeSingle();
    if (!prod) continue;
    const shortUrl = (prod.link_afiliado as string) || (prod.url_produto as string);
    if (!shortUrl) continue;

    let slug = slugify(String(prod.titulo)).slice(0, 60) || `produto-${pid}`;
    const raiz = slug;
    for (let i = 2; i < 60; i++) {
      const { data: dup } = await supabase.from("links").select("id").eq("slug", slug).maybeSingle();
      if (!dup) break;
      slug = `${raiz}-${i}`;
    }

    await supabase.from("links").insert({
      produto_id: pid,
      slug,
      short_url: shortUrl,
      ativo: true,
      ordem: ordem++,
      expira_em: expira,
    });
    await supabase.from("produtos").update({ status: "curado" }).eq("id", pid);
  }
}

/**
 * Faxina da vitrine: nos links já EXPIRADOS (validade venceu), quem teve 0 clique é
 * removido (link inativo + produto descartado); quem teve clique VIRA PERMANENTE
 * (tira a validade) — ganhou o lugar. Mantém a vitrine enxuta e só com o que performa.
 */
export async function faxinaExpirados(
  supabase: SupabaseClient,
): Promise<{ removidos: number; promovidos: number }> {
  const agora = new Date().toISOString();
  const { data: expirados } = await supabase
    .from("links")
    .select("id, produto_id, cliques")
    .eq("ativo", true)
    .not("expira_em", "is", null)
    .lt("expira_em", agora);

  let removidos = 0;
  let promovidos = 0;
  for (const l of expirados ?? []) {
    if ((l.cliques ?? 0) === 0) {
      await supabase.from("links").update({ ativo: false }).eq("id", l.id);
      await supabase.from("produtos").update({ status: "descartado" }).eq("id", l.produto_id);
      removidos++;
    } else {
      await supabase.from("links").update({ expira_em: null }).eq("id", l.id);
      promovidos++;
    }
  }
  return { removidos, promovidos };
}
