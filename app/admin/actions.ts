"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { slugify } from "@/lib/slug";
import { reordenarVitrine } from "@/lib/ranking";

function revalidar() {
  revalidatePath("/admin");
  revalidatePath("/"); // a home muda quando um produto entra/sai da vitrine
}

/** Reordena a vitrine por performance (cliques) + potencial (score_ia). */
export async function reordenarPorPerformance() {
  await reordenarVitrine(supabaseAdmin());
  revalidar();
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

/**
 * Cura um produto 'novo': cria o link de afiliado (com o short_url colado
 * manualmente, já que a Shopee Open API ainda não gera shortlink) e marca
 * o produto como 'curado' — aí ele passa a aparecer na vitrine.
 */
export async function curarProduto(formData: FormData) {
  const produtoId = Number(formData.get("produtoId"));
  const shortUrl = String(formData.get("shortUrl") ?? "").trim();
  const slugBase = slugify(String(formData.get("slug") ?? ""));

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

  await supabase.from("produtos").update({ status: "curado" }).eq("id", produtoId);
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
