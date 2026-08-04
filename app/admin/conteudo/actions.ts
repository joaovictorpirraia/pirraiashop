"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { publicarFotoFeed } from "@/lib/instagram";
import {
  gerarRascunhosPendentes,
  gerarConteudo,
  CANAIS,
  type Canal,
  type ProdutoParaConteudo,
} from "@/lib/conteudo";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pirraiashop.com.br";

/** Normaliza um campo de hashtags digitado (espaço/vírgula, com ou sem #). */
function parseHashtags(bruto: string): string[] {
  return bruto
    .split(/[\s,]+/)
    .map((h) => h.replace(/^#+/, "").toLowerCase().trim())
    .filter(Boolean)
    .slice(0, 12);
}

/** Gera rascunhos pros produtos curados sem rascunho no canal escolhido (botão do admin). */
export async function gerarConteudoAgora(formData: FormData) {
  const bruto = String(formData.get("canal") ?? "instagram_feed") as Canal;
  const canal: Canal = CANAIS.includes(bruto) ? bruto : "instagram_feed";
  try {
    await gerarRascunhosPendentes(supabaseAdmin(), canal);
  } catch (e) {
    console.error("[admin] gerar conteúdo:", (e as Error).message);
  }
  revalidatePath("/admin/conteudo");
}

/** Aprova um rascunho: status 'rascunho' -> 'aprovado'. */
export async function aprovarPost(formData: FormData) {
  const postId = Number(formData.get("postId"));
  if (!postId) return;
  await supabaseAdmin().from("posts").update({ status: "aprovado" }).eq("id", postId);
  revalidatePath("/admin/conteudo");
}

/** Aprova todos os rascunhos de uma vez. Reversível (é só mudar de status). */
export async function aprovarTodosRascunhos() {
  await supabaseAdmin()
    .from("posts")
    .update({ status: "aprovado" })
    .eq("status", "rascunho");
  revalidatePath("/admin/conteudo");
}

/** Descarta um post: apaga a linha (libera o produto pra gerar de novo). */
export async function descartarPost(formData: FormData) {
  const postId = Number(formData.get("postId"));
  if (!postId) return;
  await supabaseAdmin().from("posts").delete().eq("id", postId);
  revalidatePath("/admin/conteudo");
}

/**
 * Publica um post aprovado no feed do Instagram (Graph API). Usa a legenda +
 * hashtags como caption e a foto do produto (via /api/criativo, convertida pra
 * JPEG). Em sucesso marca 'publicado'. Loga em execucoes. Gated em IG_USER_ID/
 * IG_ACCESS_TOKEN — o botão só aparece quando configurado.
 */
export async function publicarNoFeed(formData: FormData) {
  const postId = Number(formData.get("postId"));
  if (!postId) return;
  const supabase = supabaseAdmin();
  const inicio = Date.now();

  const { data: post } = await supabase
    .from("posts")
    .select("id, produto_id, legenda, hashtags")
    .eq("id", postId)
    .maybeSingle();
  if (!post?.produto_id) return;

  const tags = (post.hashtags ?? []).map((h: string) => "#" + h).join(" ");
  const caption = [post.legenda?.trim(), tags].filter(Boolean).join("\n\n");
  const imageUrl = `${SITE}/api/criativo/${post.produto_id}`;

  try {
    const res = await publicarFotoFeed({ imageUrl, caption });
    await supabase
      .from("posts")
      .update({ status: "publicado", publicado_em: new Date().toISOString() })
      .eq("id", postId);
    await supabase.from("execucoes").insert({
      job: "publicar_ig",
      ok: true,
      itens: 1,
      detalhe: { postId, ig_media_id: res.id },
      duracao_ms: Date.now() - inicio,
    });
  } catch (e) {
    await supabase.from("execucoes").insert({
      job: "publicar_ig",
      ok: false,
      itens: 0,
      detalhe: { postId, erro: (e as Error).message },
      duracao_ms: Date.now() - inicio,
    });
  }
  revalidatePath("/admin/conteudo");
}

/** Marca um aprovado como publicado (tira da fila de aprovados). */
export async function marcarPublicado(formData: FormData) {
  const postId = Number(formData.get("postId"));
  if (!postId) return;
  await supabaseAdmin()
    .from("posts")
    .update({ status: "publicado", publicado_em: new Date().toISOString() })
    .eq("id", postId);
  revalidatePath("/admin/conteudo");
}

/** Salva a edição manual de um post (legenda/hashtags/roteiro). */
export async function editarPost(formData: FormData) {
  const postId = Number(formData.get("postId"));
  if (!postId) return;
  const legenda = String(formData.get("legenda") ?? "").trim();
  const roteiro = String(formData.get("roteiro") ?? "").trim();
  const hashtags = parseHashtags(String(formData.get("hashtags") ?? ""));
  await supabaseAdmin()
    .from("posts")
    .update({ legenda, hashtags, roteiro })
    .eq("id", postId);
  revalidatePath("/admin/conteudo");
  redirect("/admin/conteudo");
}

/** Regera o conteúdo de um post com a IA, substituindo o texto atual. */
export async function regerarPost(formData: FormData) {
  const postId = Number(formData.get("postId"));
  if (!postId) return;
  const supabase = supabaseAdmin();

  const { data: post } = await supabase
    .from("posts")
    .select("produto_id, canal")
    .eq("id", postId)
    .maybeSingle();
  if (!post?.produto_id) return;
  const canal: Canal = CANAIS.includes(post.canal as Canal)
    ? (post.canal as Canal)
    : "instagram_feed";

  const { data: p } = await supabase
    .from("produtos")
    .select("id, titulo, categoria, preco, preco_antigo, desconto_pct, loja_nome, angulo_ia, tags_ia")
    .eq("id", post.produto_id)
    .maybeSingle();
  if (!p) return;

  try {
    const novo = await gerarConteudo(p as ProdutoParaConteudo, canal);
    if (novo) {
      await supabase
        .from("posts")
        .update({ legenda: novo.legenda, hashtags: novo.hashtags, roteiro: novo.roteiro })
        .eq("id", postId);
    }
  } catch (e) {
    console.error("[admin] regerar:", (e as Error).message);
  }
  revalidatePath("/admin/conteudo");
}
