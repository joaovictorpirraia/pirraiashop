"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

function revalidar() {
  revalidatePath("/admin/categorias");
  revalidatePath("/admin"); // o seletor do Curar lê a mesma lista
}

/** Adiciona uma categoria no fim da ordem. Nome único. */
export async function adicionarCategoria(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) redirect("/admin/categorias?erro=Digite%20um%20nome");

  const supabase = supabaseAdmin();
  const { data: ult } = await supabase
    .from("categorias")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("categorias")
    .insert({ nome, ordem: (ult?.ordem ?? 0) + 1 });

  revalidar();
  redirect(
    error
      ? `/admin/categorias?erro=${encodeURIComponent(
          /duplicate|unique/i.test(error.message) ? "Essa categoria já existe" : error.message,
        )}`
      : "/admin/categorias",
  );
}

/** Remove uma categoria da lista. Não mexe nos produtos que já a usam. */
export async function removerCategoria(formData: FormData) {
  const id = Number(formData.get("id"));
  if (id) await supabaseAdmin().from("categorias").delete().eq("id", id);
  revalidar();
}

/** Move a categoria pra cima/baixo trocando a ordem com a vizinha. */
export async function moverCategoria(formData: FormData) {
  const id = Number(formData.get("id"));
  const direcao = String(formData.get("direcao"));
  if (!id) return;

  const supabase = supabaseAdmin();
  const { data: cats } = await supabase
    .from("categorias")
    .select("id, ordem")
    .order("ordem", { ascending: true });
  if (!cats) return;

  const idx = cats.findIndex((c) => c.id === id);
  const alvo = direcao === "cima" ? idx - 1 : idx + 1;
  if (idx < 0 || alvo < 0 || alvo >= cats.length) return;

  const a = cats[idx];
  const b = cats[alvo];
  await supabase.from("categorias").update({ ordem: b.ordem }).eq("id", a.id);
  await supabase.from("categorias").update({ ordem: a.ordem }).eq("id", b.id);
  revalidar();
}
