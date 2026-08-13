import type { SupabaseClient } from "@supabase/supabase-js";
import { ShopeeAffiliate, paraProduto } from "./shopee";

/**
 * Verifica e atualiza o preço dos produtos SHOPEE da vitrine pela API de afiliado
 * (consulta por item_id — sem scraping). Preço da Shopee muda direto (promo/estoque),
 * então isso mantém a vitrine honesta. Processa os `limite` mais antigos (preco_visto_em
 * asc, nulos primeiro) — clica/roda de novo pra cobrir o resto. Só toca os campos de
 * preço/comissão (não mexe em título/imagem). Gated em SHOPEE_APP_ID/SECRET.
 */
export interface ResultadoPrecos {
  verificados: number;
  atualizados: number;
  naoEncontrados: number;
  totalShopee: number;
  mudancas: Array<{ id: number; titulo: string; de: number; para: number }>;
}

export async function atualizarPrecosShopee(
  supabase: SupabaseClient,
  limite = 40,
): Promise<ResultadoPrecos> {
  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_SECRET;
  if (!appId || !secret) throw new Error("Shopee não configurada (SHOPEE_APP_ID/SECRET)");
  const shopee = new ShopeeAffiliate({ appId, secret });

  // produtos Shopee da vitrine (com item_id)
  const { data: linksRaw } = await supabase
    .from("links")
    .select("produto:produtos!inner(id, item_id, titulo, preco, origem, status, preco_visto_em)")
    .eq("ativo", true)
    .eq("pausado", false)
    .limit(1000);

  const vistos = new Set<number>();
  type P = { id: number; item_id: number; titulo: string; preco: string | number | null; origem: string; status: string; preco_visto_em: string | null };
  const shopeeProds = ((linksRaw ?? []) as unknown[])
    .map((l) => {
      const p = (l as { produto: P | P[] }).produto;
      return Array.isArray(p) ? p[0] : p;
    })
    .filter((p): p is P => Boolean(p) && p.origem === "shopee" && Boolean(p.item_id) && ["curado", "publicado"].includes(p.status))
    .filter((p) => (vistos.has(p.id) ? false : vistos.add(p.id)));

  const totalShopee = shopeeProds.length;
  const fila = [...shopeeProds]
    .sort((a, b) => {
      const av = a.preco_visto_em ? new Date(a.preco_visto_em).getTime() : 0;
      const bv = b.preco_visto_em ? new Date(b.preco_visto_em).getTime() : 0;
      return av - bv; // mais antigos (e nunca vistos = 0) primeiro
    })
    .slice(0, limite);

  let verificados = 0;
  let atualizados = 0;
  let naoEncontrados = 0;
  const mudancas: ResultadoPrecos["mudancas"] = [];

  for (const p of fila) {
    try {
      const pg = await shopee.buscarOfertas({ itemId: Number(p.item_id), limit: 1 });
      verificados++;
      const node = pg.nodes?.[0];
      if (!node) {
        naoEncontrados++;
        await supabase.from("produtos").update({ preco_visto_em: new Date().toISOString() }).eq("id", p.id);
        continue;
      }
      const norm = paraProduto(node);
      const patch: Record<string, unknown> = { preco_visto_em: new Date().toISOString() };
      const precoAntes = Number(p.preco);
      if (Number.isFinite(norm.preco) && norm.preco > 0 && Math.abs(norm.preco - precoAntes) >= 0.01) {
        patch.preco = norm.preco;
        patch.preco_antigo = norm.preco_antigo;
        patch.desconto_pct = norm.desconto_pct;
        patch.comissao_pct = norm.comissao_pct;
        patch.comissao_valor = norm.comissao_valor;
        mudancas.push({ id: p.id, titulo: p.titulo, de: precoAntes, para: norm.preco });
        atualizados++;
      }
      await supabase.from("produtos").update(patch).eq("id", p.id);
    } catch {
      /* falhou esse — NÃO marca visto, tenta de novo na próxima rodada */
    }
    await new Promise((r) => setTimeout(r, 200)); // throttle leve (rate limit da Shopee)
  }

  return { verificados, atualizados, naoEncontrados, totalShopee, mudancas };
}
