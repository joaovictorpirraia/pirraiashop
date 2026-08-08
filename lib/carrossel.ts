import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarLegendaCarrossel } from "./conteudo";

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
  const { gancho, tema_fundo, legenda, palavras, hashtags } = await gerarLegendaCarrossel(
    produtos.map((p) => ({ titulo: p.titulo, preco: p.preco, desconto_pct: p.desconto_pct })),
  );
  const partes = [legenda];
  if (hashtags.length) partes.push(hashtags.map((h) => `#${h}`).join(" "));
  if (palavras.length) partes.push(palavras.join(", "));

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
