"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { slugify } from "@/lib/slug";
import { reordenarVitrine } from "@/lib/ranking";
import { pontuarPendentes } from "@/lib/curadoria";
import { buscarItens } from "@/lib/mercadolivre";
import { ingerirItensML, ingerirOfertas } from "@/lib/ingest";
import { ShopeeAffiliate } from "@/lib/shopee";

function revalidar() {
  revalidatePath("/admin");
  revalidatePath("/"); // a home muda quando um produto entra/sai da vitrine
}

/**
 * Importa ofertas da Shopee por palavra-chave pra fila (status 'novo') via Open API.
 * O offerLink já vem como link de afiliado e pré-preenche o Curar. Gated em
 * SHOPEE_APP_ID/SECRET. Volta pro /admin com ?shopee=<gravadas> (ou ?shopee_erro).
 */
export async function importarShopee(formData: FormData) {
  const q = String(formData.get("q") ?? "").trim();
  if (!q) redirect("/admin?shopee_erro=vazio");

  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_SECRET;
  if (!appId || !secret) {
    redirect("/admin?shopee_erro=" + encodeURIComponent("SHOPEE_APP_ID/SECRET ausentes no servidor"));
  }

  const supabase = supabaseAdmin();
  const inicio = Date.now();
  let destino: string;
  try {
    const shopee = new ShopeeAffiliate({ appId: appId!, secret: secret! });
    const pg = await shopee.buscarOfertas({ keyword: q, limit: 50, page: 1 });
    const res = await ingerirOfertas(supabase, pg.nodes);
    await supabase.from("execucoes").insert({
      job: "ingest_shopee",
      ok: res.erros === 0,
      itens: res.gravadas,
      detalhe: { q, origem: "admin", ...res },
      duracao_ms: Date.now() - inicio,
    });
    destino =
      res.erros > 0
        ? `/admin?shopee_erro=${encodeURIComponent(res.detalhe ?? "1")}`
        : `/admin?shopee=${res.gravadas}`;
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "ingest_shopee",
      ok: false,
      itens: 0,
      detalhe: { q, origem: "admin", erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    destino = `/admin?shopee_erro=${encodeURIComponent(msg)}`;
  }

  revalidar();
  redirect(destino);
}

/**
 * Importa itens do Mercado Livre por palavra-chave pra fila de curadoria (status
 * 'novo'). O link de afiliado entra depois, manual, na hora de curar. Requer a
 * migration 002_mercadolivre.sql aplicada. Volta pro /admin com ?ml=<gravadas>
 * (ou ?ml_erro=1) pra dar um retorno visível.
 */
export async function importarML(formData: FormData) {
  const q = String(formData.get("q") ?? "").trim();
  if (!q) redirect("/admin?ml_erro=vazio");

  const supabase = supabaseAdmin();
  const inicio = Date.now();
  let destino: string;
  try {
    const itens = await buscarItens({ q, limit: 50 });
    const res = await ingerirItensML(supabase, itens);
    await supabase.from("execucoes").insert({
      job: "ingest_ml",
      ok: res.erros === 0,
      itens: res.gravadas,
      detalhe: { q, origem: "admin", ...res },
      duracao_ms: Date.now() - inicio,
    });
    destino =
      res.erros > 0
        ? `/admin?ml_erro=${encodeURIComponent(res.detalhe ?? "1")}`
        : `/admin?ml=${res.gravadas}`;
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "ingest_ml",
      ok: false,
      itens: 0,
      detalhe: { q, origem: "admin", erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    destino = `/admin?ml_erro=${encodeURIComponent(msg)}`;
  }

  revalidar();
  redirect(destino); // fora do try: o NEXT_REDIRECT não é engolido pelo catch
}

/** Reordena a vitrine por performance (cliques) + potencial (score_ia). */
export async function reordenarPorPerformance() {
  await reordenarVitrine(supabaseAdmin());
  revalidar();
}

/** Pontua com IA os produtos da vitrine (curado/publicado) que ainda não têm score. */
export async function pontuarVitrine() {
  const supabase = supabaseAdmin();
  const inicio = Date.now();
  try {
    const res = await pontuarPendentes(supabase, ["curado", "publicado"]);
    await supabase.from("execucoes").insert({
      job: "pontuar_vitrine",
      ok: true,
      itens: res.gravados,
      detalhe: res,
      duracao_ms: Date.now() - inicio,
    });
  } catch (e) {
    await supabase.from("execucoes").insert({
      job: "pontuar_vitrine",
      ok: false,
      itens: 0,
      detalhe: { erro: (e as Error).message },
      duracao_ms: Date.now() - inicio,
    });
  }
  revalidar();
}

/**
 * Captura um produto vindo do bookmarklet (página da Shopee aberta no navegador
 * do dono). Cai na fila como 'novo' — o link de afiliado entra depois, na curadoria.
 * Sem status no payload: novo vira 'novo' (default); se já existir (mesmo item),
 * atualiza preço/imagem mas preserva o status. Dedup por (origem,item_id,shop_id):
 * o shopid/itemid é extraído da URL do produto quando dá.
 */
export async function capturarProduto(dados: {
  titulo?: string;
  preco?: number;
  preco_antigo?: number | null;
  imagem_url?: string;
  url_produto?: string;
  categoria?: string | null;
  loja_nome?: string | null;
  origem?: string;
  short_url?: string;
}): Promise<{ ok: boolean; id?: number; titulo?: string; erro?: string }> {
  const titulo = String(dados.titulo ?? "").trim();
  const imagemUrl = String(dados.imagem_url ?? "").trim();
  const preco = Number(dados.preco);
  if (!titulo || !imagemUrl || !Number.isFinite(preco) || preco <= 0) {
    return { ok: false, erro: "faltou título, imagem ou preço válido" };
  }

  // link de afiliado capturado (ex.: meli.la da janela "Compartilhar" do ML) — opcional
  const linkBruto = String(dados.short_url ?? "").trim();
  const linkAfiliado = /^https?:\/\//i.test(linkBruto) ? linkBruto : null;

  const url = String(dados.url_produto ?? "").trim();
  // detecta a fonte pela origem enviada ou pelo host da URL
  const ehML = dados.origem === "mercadolivre" || /mercadoli(vre|bre)\.com/i.test(url);
  let origem = "shopee";
  let shopId = 0;
  let itemId = Date.now();
  if (ehML) {
    // ML: id do produto/catálogo (MLB\d+) da URL, pra dedup. Sem shop_id → 0.
    origem = "mercadolivre";
    const m = url.match(/MLB-?(\d+)/i);
    itemId = m ? Number(m[1]) : Date.now();
  } else {
    // Shopee: shopid/itemid em várias formas de URL.
    const m =
      url.match(/-i\.(\d+)\.(\d+)/) ||
      url.match(/\/product\/(\d+)\/(\d+)/) ||
      url.match(/\/(\d{6,})\/(\d{6,})(?:[/?#]|$)/);
    shopId = m ? Number(m[1]) : 0;
    itemId = m ? Number(m[2]) : Date.now();
  }

  const precoAntigo =
    dados.preco_antigo != null && Number(dados.preco_antigo) > preco
      ? Number(dados.preco_antigo)
      : null;
  const desconto = precoAntigo ? Math.round((1 - preco / precoAntigo) * 100) : null;

  // só inclui link_afiliado quando veio um: re-captura sem link não apaga o que já tinha
  const row: Record<string, unknown> = {
    origem,
    item_id: itemId,
    shop_id: shopId,
    titulo,
    categoria: dados.categoria?.trim() || null,
    preco,
    preco_antigo: precoAntigo,
    desconto_pct: desconto,
    imagem_url: imagemUrl,
    url_produto: url || null,
    loja_nome: dados.loja_nome?.trim() || null,
  };
  if (linkAfiliado) row.link_afiliado = linkAfiliado;

  const { data, error } = await supabaseAdmin()
    .from("produtos")
    .upsert(
      {
        ...row,
        // sem `status`: insert vira 'novo' (fila); update preserva o status atual
      },
      { onConflict: "origem,item_id,shop_id" },
    )
    .select("id")
    .single();

  if (error) {
    console.error("[admin] capturar produto:", error.message);
    return { ok: false, erro: error.message };
  }
  revalidar();
  return { ok: true, id: data?.id, titulo };
}

/**
 * Adiciona um produto manualmente já na vitrine (fase manual, antes da ingestão).
 * Cria o produto como 'curado' + o link de afiliado num passo. Redireciona pro
 * /admin no fim; se algum campo obrigatório faltar, volta pro form com ?erro=1.
 */
export async function adicionarProduto(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const imagemUrl = String(formData.get("imagem_url") ?? "").trim();
  const preco = Number(formData.get("preco"));
  const precoAntigoRaw = String(formData.get("preco_antigo") ?? "").trim();
  const precoAntigo = precoAntigoRaw ? Number(precoAntigoRaw) : null;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const loja = String(formData.get("loja_nome") ?? "").trim() || null;
  const shortUrl = String(formData.get("short_url") ?? "").trim();
  const slugBase = slugify(String(formData.get("slug") ?? "") || titulo);

  const invalido =
    !titulo ||
    !imagemUrl ||
    !Number.isFinite(preco) ||
    preco <= 0 ||
    !shortUrl ||
    !/^https?:\/\//i.test(shortUrl);
  if (invalido) redirect("/admin/novo?erro=1");

  const supabase = supabaseAdmin();

  const desconto =
    precoAntigo && precoAntigo > preco
      ? Math.round((1 - preco / precoAntigo) * 100)
      : null;

  const { data: prod, error: e1 } = await supabase
    .from("produtos")
    .insert({
      origem: "manual",
      item_id: Date.now(),
      titulo,
      categoria,
      preco,
      preco_antigo: precoAntigo,
      desconto_pct: desconto,
      imagem_url: imagemUrl,
      loja_nome: loja,
      status: "curado",
    })
    .select("id")
    .single();
  if (e1 || !prod) {
    console.error("[admin] adicionar produto:", e1?.message);
    redirect("/admin/novo?erro=1");
  }

  // slug único
  let slug = slugBase || `produto-${prod.id}`;
  const raiz = slug;
  for (let i = 2; i < 60; i++) {
    const { data: existe } = await supabase
      .from("links")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existe) break;
    slug = `${raiz}-${i}`;
  }
  const { data: ult } = await supabase
    .from("links")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = (ult?.ordem ?? -1) + 1;

  await supabase.from("links").insert({
    produto_id: prod.id,
    slug,
    short_url: shortUrl,
    ativo: true,
    ordem,
  });

  revalidar();
  redirect("/admin");
}

/** Edita um produto da vitrine (produto + link) num passo. */
export async function editarProduto(formData: FormData) {
  const produtoId = Number(formData.get("produtoId"));
  const linkId = Number(formData.get("linkId"));
  const titulo = String(formData.get("titulo") ?? "").trim();
  const imagemUrl = String(formData.get("imagem_url") ?? "").trim();
  const preco = Number(formData.get("preco"));
  const precoAntigoRaw = String(formData.get("preco_antigo") ?? "").trim();
  const precoAntigo = precoAntigoRaw ? Number(precoAntigoRaw) : null;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const loja = String(formData.get("loja_nome") ?? "").trim() || null;
  const shortUrl = String(formData.get("short_url") ?? "").trim();
  const slugBase = slugify(String(formData.get("slug") ?? "") || titulo);

  const invalido =
    !produtoId ||
    !linkId ||
    !titulo ||
    !imagemUrl ||
    !Number.isFinite(preco) ||
    preco <= 0 ||
    !shortUrl ||
    !/^https?:\/\//i.test(shortUrl);
  if (invalido) redirect(`/admin/editar/${produtoId}?erro=1`);

  const supabase = supabaseAdmin();
  const desconto =
    precoAntigo && precoAntigo > preco
      ? Math.round((1 - preco / precoAntigo) * 100)
      : null;

  await supabase
    .from("produtos")
    .update({
      titulo,
      categoria,
      preco,
      preco_antigo: precoAntigo,
      desconto_pct: desconto,
      imagem_url: imagemUrl,
      loja_nome: loja,
    })
    .eq("id", produtoId);

  // slug único, excluindo o próprio link
  let slug = slugBase || `produto-${produtoId}`;
  const raiz = slug;
  for (let i = 2; i < 60; i++) {
    const { data: existe } = await supabase
      .from("links")
      .select("id")
      .eq("slug", slug)
      .neq("id", linkId)
      .maybeSingle();
    if (!existe) break;
    slug = `${raiz}-${i}`;
  }
  await supabase.from("links").update({ slug, short_url: shortUrl }).eq("id", linkId);

  revalidar();
  redirect("/admin");
}

/**
 * Cura um produto 'novo': cria o link de afiliado (com o short_url colado
 * manualmente, já que a Shopee Open API ainda não gera shortlink) e marca
 * o produto como 'curado' — aí ele passa a aparecer na vitrine.
 */
export async function curarProduto(formData: FormData) {
  const produtoId = Number(formData.get("produtoId"));
  const shortUrl = String(formData.get("shortUrl") ?? "").trim();
  const slugBase = slugify(String(formData.get("slug") ?? ""));
  const categoria = String(formData.get("categoria") ?? "").trim();

  if (!produtoId || !shortUrl || !/^https?:\/\//i.test(shortUrl)) return;

  const supabase = supabaseAdmin();

  // slug único: se já existir, sufixa -2, -3...
  let slug = slugBase || `produto-${produtoId}`;
  const raiz = slug;
  for (let i = 2; i < 60; i++) {
    const { data: existe } = await supabase
      .from("links")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existe) break;
    slug = `${raiz}-${i}`;
  }

  // ordem = fim da fila (max + 1)
  const { data: ult } = await supabase
    .from("links")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = (ult?.ordem ?? -1) + 1;

  const { error } = await supabase.from("links").insert({
    produto_id: produtoId,
    slug,
    short_url: shortUrl,
    ativo: true,
    ordem,
  });
  if (error) {
    console.error("[admin] curar (link):", error.message);
    return;
  }

  // marca curado e grava a categoria escolhida (se veio) num passo só
  const patch: { status: string; categoria?: string } = { status: "curado" };
  if (categoria) patch.categoria = categoria;
  await supabase.from("produtos").update(patch).eq("id", produtoId);
  revalidar();
}

/**
 * Limpa os produtos de exemplo do seed inicial (some da vitrine e da fila).
 * Marcador seguro: `url_produto` de placeholder `https://shopee.com.br/produto-<n>`
 * — os produtos reais cadastrados pelo `+ Produto` têm url_produto nula, então
 * não batem no filtro. Descarte reversível (status 'descartado' + link inativo),
 * não apaga de vez.
 */
const MARCADOR_EXEMPLO = "https://shopee.com.br/produto-%";

export async function limparExemplos() {
  const supabase = supabaseAdmin();
  const { data: exemplos } = await supabase
    .from("produtos")
    .select("id")
    .like("url_produto", MARCADOR_EXEMPLO)
    .neq("status", "descartado");
  const ids = (exemplos ?? []).map((p) => p.id);
  if (ids.length === 0) return;

  // desativa os links (some da vitrine) e descarta os produtos (some da fila)
  await supabase.from("links").update({ ativo: false }).in("produto_id", ids);
  await supabase.from("produtos").update({ status: "descartado" }).in("id", ids);
  revalidar();
}

/** Descarta um produto da fila (não volta a aparecer). */
export async function descartarProduto(formData: FormData) {
  const produtoId = Number(formData.get("produtoId"));
  if (!produtoId) return;
  await supabaseAdmin()
    .from("produtos")
    .update({ status: "descartado" })
    .eq("id", produtoId);
  revalidar();
}

/** Liga/desliga o destaque de um item da vitrine. */
export async function alternarDestaque(formData: FormData) {
  const linkId = Number(formData.get("linkId"));
  const destaque = formData.get("destaque") === "true";
  if (!linkId) return;
  await supabaseAdmin().from("links").update({ destaque }).eq("id", linkId);
  revalidar();
}

/** Move um item pra cima/baixo trocando a ordem com o vizinho. */
export async function moverLink(formData: FormData) {
  const linkId = Number(formData.get("linkId"));
  const direcao = String(formData.get("direcao"));
  if (!linkId) return;

  const supabase = supabaseAdmin();
  const { data: links } = await supabase
    .from("links")
    .select("id, ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  if (!links) return;

  const idx = links.findIndex((l) => l.id === linkId);
  if (idx < 0) return;
  const alvo = direcao === "cima" ? idx - 1 : idx + 1;
  if (alvo < 0 || alvo >= links.length) return;

  const a = links[idx];
  const b = links[alvo];
  await supabase.from("links").update({ ordem: b.ordem }).eq("id", a.id);
  await supabase.from("links").update({ ordem: a.ordem }).eq("id", b.id);
  revalidar();
}

/** Tira o item da vitrine: desativa o link e descarta o produto. */
export async function removerDaVitrine(formData: FormData) {
  const linkId = Number(formData.get("linkId"));
  const produtoId = Number(formData.get("produtoId"));
  if (!linkId) return;

  const supabase = supabaseAdmin();
  await supabase.from("links").update({ ativo: false }).eq("id", linkId);
  if (produtoId) {
    await supabase.from("produtos").update({ status: "descartado" }).eq("id", produtoId);
  }
  revalidar();
}
