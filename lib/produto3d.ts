import { supabasePublic } from "@/lib/supabase";
import type { VitrineItem } from "@/lib/types";

/** Produto próprio pela slug (só o que está na vitrine). null se não existir. */
export async function getProduto3D(slug: string): Promise<VitrineItem | null> {
  const supabase = supabasePublic();
  const { data } = await supabase
    .from("vitrine")
    .select("*")
    .eq("slug", slug)
    .eq("proprio", true)
    .maybeSingle<VitrineItem>();
  return data ?? null;
}

/** Até `limite` outras peças da mesma categoria (exclui o próprio slug). */
export async function relacionados3D(
  categoria: string | null,
  slugAtual: string,
  limite = 6,
): Promise<VitrineItem[]> {
  if (!categoria) return [];
  const supabase = supabasePublic();
  const { data } = await supabase
    .from("vitrine")
    .select("*")
    .eq("proprio", true)
    .eq("categoria", categoria)
    .neq("slug", slugAtual)
    .limit(limite)
    .returns<VitrineItem[]>();
  return data ?? [];
}
