import { supabasePublic } from "@/lib/supabase";
import type { Banner } from "@/lib/types";

export async function bannerAtivo(): Promise<Banner | null> {
  const supabase = supabasePublic();
  const { data } = await supabase
    .from("banners")
    .select("id, imagem_url, titulo, subtitulo, link")
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle<Banner>();
  return data ?? null;
}
