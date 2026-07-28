"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { gerarRascunhosPendentes } from "@/lib/conteudo";

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

/** Descarta um rascunho: apaga a linha (libera o produto pra gerar de novo). */
export async function descartarPost(formData: FormData) {
  const postId = Number(formData.get("postId"));
  if (!postId) return;
  await supabaseAdmin().from("posts").delete().eq("id", postId);
  revalidatePath("/admin/conteudo");
}
