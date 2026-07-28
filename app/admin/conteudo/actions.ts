"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import {
  gerarRascunhosPendentes,
  gerarConteudo,
  type ProdutoParaConteudo,
} from "@/lib/conteudo";

/** Normaliza um campo de hashtags digitado (espaço/vírgula, com ou sem #). */
function parseHashtags(bruto: string): string[] {
  return bruto
    .split(/[\s,]+/)
    .map((h) => h.replace(/^#+/, "").toLowerCase().trim())
    .filter(Boolean)
    .slice(0, 12);
}

/** Gera rascunhos pros produtos curados sem rascunho (botão do admin). */
export async function gerarConteudoAgora() {
  try {
    await gerarRascunhosPendentes(supabaseAdmin());
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

/** Descarta um post: apaga a linha (libera o produto pra gerar de novo). */
export async function descartarPost(formData: FormData) {
  const postId = Number(formData.get("postId"));
  if (!postId) return;
  await supabaseAdmin().from("posts").delete().eq("id", postId);
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
    .select("produto_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post?.produto_id) return;

  const { data: p } = await supabase
    .from("produtos")
    .select("id, titulo, categoria, preco, preco_antigo, desconto_pct, loja_nome, angulo_ia, tags_ia")
    .eq("id", post.produto_id)
    .maybeSingle();
  if (!p) return;

  try {
    const novo = await gerarConteudo(p as ProdutoParaConteudo);
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
