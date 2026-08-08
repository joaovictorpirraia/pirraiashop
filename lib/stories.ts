import type { SupabaseClient } from "@supabase/supabase-js";
import { publicarStory } from "./instagram";
import { curarProdutosParaVitrine } from "./carrossel";

/**
 * Escolhe o próximo produto pra story: prioriza a VITRINE curada (melhor score),
 * e cai na FILA (import fresco) quando a vitrine acaba. `excluir` tira os já
 * escolhidos/postados recentemente. Devolve foraVitrine=true quando veio da fila
 * (aí precisa curar pra vitrine, pra o "link na bio" achar pelo nome).
 */
async function proximoProdutoStory(
  supabase: SupabaseClient,
  excluir: Set<number>,
): Promise<{ id: number; foraVitrine: boolean } | null> {
  const { data: vit } = await supabase
    .from("links")
    .select("produto:produtos!inner(id, score_ia, status)")
    .eq("ativo", true)
    .eq("pausado", false)
    .limit(80);
  const vitProds = ((vit ?? []) as unknown[])
    .map((l) => {
      const p = (l as { produto: { id: number; score_ia: number | null; status: string } | { id: number; score_ia: number | null; status: string }[] }).produto;
      return Array.isArray(p) ? p[0] : p;
    })
    .filter((p) => p && ["curado", "publicado"].includes(p.status) && !excluir.has(p.id))
    .sort((a, b) => (b.score_ia ?? -1) - (a.score_ia ?? -1));
  if (vitProds[0]) return { id: vitProds[0].id, foraVitrine: false };

  const { data: fila } = await supabase
    .from("produtos")
    .select("id, vendas")
    .eq("status", "novo")
    .order("vendas", { ascending: false, nullsFirst: false })
    .limit(80);
  const filaP = ((fila ?? []) as { id: number }[]).filter((p) => !excluir.has(p.id));
  if (filaP[0]) return { id: filaP[0].id, foraVitrine: true };
  return null;
}

/**
 * Posta `qtd` stories automáticos: seleciona produtos (sem repetir os postados nos
 * últimos 2 dias), gera a arte 9:16 (aquece no Storage), publica no story e registra.
 * Produto vindo da fila é curado pra vitrine (15d) pra ficar buscável pelo nome.
 */
export async function postarStoryAuto(
  supabase: SupabaseClient,
  qtd = 1,
): Promise<{ postados: number; erros: number; detalhe: Array<Record<string, unknown>> }> {
  const desde = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentes } = await supabase.from("stories").select("produto_id").gte("criado_em", desde);
  const excluir = new Set<number>((recentes ?? []).map((r) => r.produto_id as number));

  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://pirraiashop.com.br";
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supaUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente no servidor");

  let postados = 0;
  let erros = 0;
  const detalhe: Array<Record<string, unknown>> = [];

  for (let i = 0; i < qtd; i++) {
    const sel = await proximoProdutoStory(supabase, excluir);
    if (!sel) break; // acabaram os produtos disponíveis
    excluir.add(sel.id);
    try {
      // fila → vai pra vitrine (com validade) pra o "link na bio" achar pelo nome
      if (sel.foraVitrine) await curarProdutosParaVitrine(supabase, [sel.id], 15);
      // aquece a arte no Storage e publica
      await fetch(`${base}/api/story/${sel.id}`, { redirect: "manual", cache: "no-store" }).catch(() => {});
      const imageUrl = `${supaUrl}/storage/v1/object/public/criativos/story-${sel.id}.jpg`;
      const { id: mediaId } = await publicarStory({ imageUrl });
      await supabase.from("stories").insert({ produto_id: sel.id, ig_media_id: mediaId, ok: true });
      postados++;
      detalhe.push({ produto: sel.id, ok: true });
    } catch (e) {
      const msg = (e as Error).message;
      await supabase.from("stories").insert({ produto_id: sel.id, ok: false, erro: msg });
      erros++;
      detalhe.push({ produto: sel.id, erro: msg });
    }
  }

  return { postados, erros, detalhe };
}
