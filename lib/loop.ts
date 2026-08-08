import type { SupabaseClient } from "@supabase/supabase-js";
import { ShopeeAffiliate, paraProduto } from "./shopee";
import { inserirRascunhoCarrossel, faxinaExpirados } from "./carrossel";
import { categorizarProdutos } from "./curadoria";

/** Temas do dia, em rodízio. keyword = o que busca na Shopee. */
export const TEMAS: Array<{ nome: string; keyword: string }> = [
  { nome: "Relógios masculinos", keyword: "relogio masculino" },
  { nome: "Organização de casa", keyword: "organizador casa" },
  { nome: "Cozinha", keyword: "utensilios cozinha" },
  { nome: "Beleza e skincare", keyword: "skincare" },
  { nome: "Gadgets e tech", keyword: "gadget util" },
  { nome: "Decoração de quarto", keyword: "decoracao quarto" },
  { nome: "Itens de viagem", keyword: "kit viagem" },
  { nome: "Acessórios femininos", keyword: "acessorio feminino" },
];

/** Escolhe o tema do dia por rotação determinística (data de Brasília). */
export function temaDoDia(): { nome: string; keyword: string } {
  const diaBRT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const diasDesdeEpoch = Math.floor(new Date(`${diaBRT}T00:00:00Z`).getTime() / (24 * 60 * 60 * 1000));
  return TEMAS[diasDesdeEpoch % TEMAS.length];
}

/**
 * Loop diário: importa produtos da Shopee do tema do dia, ranqueia por vendas, monta
 * um RASCUNHO de carrossel com os melhores (fila — só entram na vitrine quando o dono
 * publica) e roda a faxina dos expirados. Gated em SHOPEE_APP_ID/SECRET.
 */
export async function rodarLoopDiario(
  supabase: SupabaseClient,
  n = 8,
): Promise<{ tema: string; keyword: string; importados: number; carrosselId: number; faxina: { removidos: number; promovidos: number } }> {
  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_SECRET;
  if (!appId || !secret) throw new Error("Shopee não configurada (SHOPEE_APP_ID/SECRET)");

  const tema = temaDoDia();
  const shopee = new ShopeeAffiliate({ appId, secret });
  const pg = await shopee.buscarOfertas({ keyword: tema.keyword, limit: 50 });
  if (!pg.nodes.length) throw new Error(`Shopee não retornou ofertas pra "${tema.keyword}"`);

  // upsert na fila (novo); status sai do payload (default 'novo', preserva o existente)
  const linhas = pg.nodes.map(paraProduto).map(({ status: _s, ...r }) => r);
  const { data: up, error } = await supabase
    .from("produtos")
    .upsert(linhas, { onConflict: "origem,item_id,shop_id" })
    .select("id, vendas, status");
  if (error) throw new Error(error.message);

  // ranqueia por vendas, tira descartados, pega os n melhores
  const ranked = (up ?? [])
    .filter((p) => p.status !== "descartado")
    .sort((a, b) => (Number(b.vendas) || 0) - (Number(a.vendas) || 0))
    .slice(0, n);
  const ids = ranked.map((r) => r.id as number);
  if (ids.length < 2) throw new Error("poucos produtos aproveitáveis no import");

  // categoriza em lote os recém-importados (não trava o loop)
  try {
    await categorizarProdutos(supabase);
  } catch {
    /* categoria é opcional */
  }

  const { data: prods } = await supabase
    .from("produtos")
    .select("id, titulo, preco, desconto_pct")
    .in("id", ids);
  const ordenados = ids
    .map((id) => (prods ?? []).find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const carrosselId = await inserirRascunhoCarrossel(supabase, ordenados);
  const faxina = await faxinaExpirados(supabase);

  return { tema: tema.nome, keyword: tema.keyword, importados: ids.length, carrosselId, faxina };
}
