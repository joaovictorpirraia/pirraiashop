import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ordenação inteligente da vitrine.
 *
 * Mistura performance real (cliques) com potencial (score_ia da curadoria):
 *  - cliques entram em escala log (um viral não domina tudo);
 *  - score_ia entra normalizado 0–1 e vale como "prior" — no cold start, quando
 *    ainda não há clique, é a IA que ordena; conforme o clique chega, ele assume.
 *
 * Escreve o resultado em links.ordem. A view `vitrine` já ordena por
 * (destaque desc, ordem, ...), então o `destaque` continua sendo o pin manual no
 * topo e o resto se reorganiza sozinho. Ordem manual (setas do admin) vale até a
 * próxima rodada — isto é um job que você dispara (botão no admin ou cron).
 */

const IA_PESO = 2.5; // um produto com IA 100 e zero clique rende ~11 cliques de "vantagem"

export interface ItemRanking {
  id: number;
  cliques: number;
  score_ia: number | null;
}

/** Pura e testável: devolve o mapa link_id -> nova ordem (0 = melhor). */
export function calcularRanking(itens: ItemRanking[]): Map<number, number> {
  const pontuado = itens.map((i) => {
    const cliquesScore = Math.log1p(Math.max(0, i.cliques ?? 0));
    const iaScore = (i.score_ia ?? 50) / 100; // default 50 pra quem ainda não foi pontuado
    return { id: i.id, rank: cliquesScore + iaScore * IA_PESO };
  });
  // desc por rank; empate desempata por id (determinístico)
  pontuado.sort((a, b) => b.rank - a.rank || a.id - b.id);

  const mapa = new Map<number, number>();
  pontuado.forEach((p, idx) => mapa.set(p.id, idx));
  return mapa;
}

/** Busca os links ativos, calcula o ranking e grava links.ordem. */
export async function reordenarVitrine(
  supabase: SupabaseClient,
): Promise<{ reordenados: number }> {
  const { data, error } = await supabase
    .from("links")
    .select("id, cliques, produto:produtos!inner(score_ia, status)")
    .eq("ativo", true);
  if (error) throw new Error(error.message);

  const itens: ItemRanking[] = ((data ?? []) as unknown[])
    .map((l) => {
      const row = l as {
        id: number;
        cliques: number;
        produto: { score_ia: number | null; status: string } | { score_ia: number | null; status: string }[];
      };
      const produto = Array.isArray(row.produto) ? row.produto[0] : row.produto;
      return { id: row.id, cliques: row.cliques, produto };
    })
    .filter((r) => r.produto && ["curado", "publicado"].includes(r.produto.status))
    .map((r) => ({ id: r.id, cliques: r.cliques, score_ia: r.produto.score_ia }));

  const ranking = calcularRanking(itens);
  for (const [id, ordem] of ranking) {
    await supabase.from("links").update({ ordem }).eq("id", id);
  }
  return { reordenados: ranking.size };
}
