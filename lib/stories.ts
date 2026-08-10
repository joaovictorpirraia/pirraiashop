import type { SupabaseClient } from "@supabase/supabase-js";
import { publicarStory } from "./instagram";
import { curarProdutosParaVitrine } from "./carrossel";

type Cand = { id: number; foraVitrine: boolean; categoria: string | null };

/**
 * Escolhe o próximo produto pra story, RODANDO ENTRE CATEGORIAS pra não sair sempre
 * o mesmo tema. Prioriza a VITRINE curada (melhor score) e cai na FILA quando acaba.
 * Dentro de cada fonte, prefere produto de categoria AINDA NÃO usada hoje/na rodada
 * (`catUsadas`); só quando todas as categorias já saíram é que aceita repetir tema,
 * aí pega o de maior nota. `excluir` tira os já escolhidos/postados recentemente.
 * Devolve foraVitrine=true quando veio da fila (aí precisa curar pra vitrine).
 */
async function proximoProdutoStory(
  supabase: SupabaseClient,
  excluir: Set<number>,
  catUsadas: Set<string>,
): Promise<Cand | null> {
  const escolher = (lista: Cand[]): Cand | null => {
    if (!lista.length) return null;
    // 1ª opção: alguém de categoria ainda não usada (já vem ordenado por nota)
    const nova = lista.find((p) => !catUsadas.has(p.categoria ?? "?"));
    return nova ?? lista[0]; // todas as categorias já saíram → repete a de maior nota
  };

  const { data: vit } = await supabase
    .from("links")
    .select("produto:produtos!inner(id, score_ia, status, categoria)")
    .eq("ativo", true)
    .eq("pausado", false)
    .limit(120);
  const vitProds: Cand[] = ((vit ?? []) as unknown[])
    .map((l) => {
      const p = (l as { produto: { id: number; score_ia: number | null; status: string; categoria: string | null } | { id: number; score_ia: number | null; status: string; categoria: string | null }[] }).produto;
      return Array.isArray(p) ? p[0] : p;
    })
    .filter((p) => p && ["curado", "publicado"].includes(p.status) && !excluir.has(p.id))
    .sort((a, b) => (b.score_ia ?? -1) - (a.score_ia ?? -1))
    .map((p) => ({ id: p.id, foraVitrine: false, categoria: p.categoria }));
  const daVitrine = escolher(vitProds);
  if (daVitrine) return daVitrine;

  const { data: fila } = await supabase
    .from("produtos")
    .select("id, vendas, categoria")
    .eq("status", "novo")
    .order("vendas", { ascending: false, nullsFirst: false })
    .limit(120);
  const filaP: Cand[] = ((fila ?? []) as { id: number; categoria: string | null }[])
    .filter((p) => !excluir.has(p.id))
    .map((p) => ({ id: p.id, foraVitrine: true, categoria: p.categoria }));
  return escolher(filaP);
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

  // categorias já postadas HOJE (BRT) — pra o rodízio continuar variando entre os crons do dia
  const diaBRT0 = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const inicioDia = new Date(`${diaBRT0}T00:00:00-03:00`).toISOString();
  const { data: hojeStories } = await supabase
    .from("stories")
    .select("produto:produtos!inner(categoria)")
    .eq("ok", true)
    .gte("criado_em", inicioDia);
  const catUsadas = new Set<string>(
    ((hojeStories ?? []) as unknown[])
      .map((s) => {
        const p = (s as { produto: { categoria: string | null } | { categoria: string | null }[] }).produto;
        return (Array.isArray(p) ? p[0]?.categoria : p?.categoria) ?? "?";
      }),
  );

  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://pirraiashop.com.br";
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supaUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente no servidor");

  // blindagem contra cron mal configurado: no máximo 10 stories/dia (BRT)
  const diaBRT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const { count: hoje } = await supabase
    .from("stories")
    .select("id", { count: "exact", head: true })
    .eq("ok", true)
    .gte("criado_em", new Date(`${diaBRT}T00:00:00-03:00`).toISOString());
  const alvo = Math.min(qtd, Math.max(0, 10 - (hoje ?? 0)));
  if (alvo === 0) {
    return { postados: 0, erros: 0, detalhe: [{ pulado: "limite diário de stories (10) atingido" }] };
  }

  let postados = 0;
  let erros = 0;
  const detalhe: Array<Record<string, unknown>> = [];

  for (let i = 0; i < alvo; i++) {
    const sel = await proximoProdutoStory(supabase, excluir, catUsadas);
    if (!sel) break; // acabaram os produtos disponíveis
    excluir.add(sel.id);
    catUsadas.add(sel.categoria ?? "?"); // marca o tema como usado → próximo story varia
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
