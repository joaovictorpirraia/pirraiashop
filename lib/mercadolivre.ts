/**
 * Cliente do Mercado Livre — SCAFFOLD, ainda não validado contra a API real.
 *
 * Situação (validado em produção jul/2026):
 *  - Busca de produto (`/sites/MLB/search`): o ML FECHOU o acesso anônimo. Sem token
 *    volta 403 "forbidden" (confirmado com chamada real). Agora precisa de um access
 *    token de app do ML — passe em `opts.accessToken` ou defina `MERCADOLIVRE_TOKEN`.
 *    Mesmo modelo da Shopee: sem credencial, a ingestão não roda.
 *  - Link de afiliado: NÃO há API pública limpa de geração de shortlink de afiliado.
 *    O programa "Mercado Livre Afiliados" gera o link pela UI. Ou seja: ingerir o
 *    produto, curar no /admin e colar o link manual.
 *
 * Este arquivo cobre só a parte de DADOS. O resto do pipeline (upsert na fila,
 * curadoria, dedup) já está pronto e testado em lib/ingest.ts — falta só o token.
 */

const ENDPOINT = "https://api.mercadolibre.com";

export interface ItemML {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  thumbnail: string;
  permalink: string;
  sold_quantity?: number;
  category_id?: string;
  seller?: { nickname?: string };
}

/**
 * Busca itens no site do ML (MLB = Brasil). O ML fechou o acesso anônimo — sem
 * token volta 403. Passe `opts.accessToken` ou defina `MERCADOLIVRE_TOKEN`.
 */
export async function buscarItens(opts: {
  q?: string;
  categoria?: string;
  limit?: number;
  accessToken?: string;
} = {}): Promise<ItemML[]> {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.categoria) params.set("category", opts.categoria);
  params.set("limit", String(Math.min(opts.limit ?? 50, 50)));

  const token = opts.accessToken ?? process.env.MERCADOLIVRE_TOKEN;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(`${ENDPOINT}/sites/MLB/search?${params}`, { headers });
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(
        token
          ? `Mercado Livre recusou o token (${resp.status}) — confira MERCADOLIVRE_TOKEN`
          : `Mercado Livre exige token: busca anônima volta ${resp.status}. Defina MERCADOLIVRE_TOKEN (app do ML).`,
      );
    }
    throw new Error(`Mercado Livre HTTP ${resp.status}`);
  }
  const json = (await resp.json()) as { results?: ItemML[] };
  return json.results ?? [];
}

/**
 * Normaliza um item do ML pro formato da tabela `produtos`.
 * O `url_produto` é o permalink público — o link de afiliado entra manual no
 * /admin (não há API pública de geração de shortlink de afiliado).
 */
export function paraProdutoML(i: ItemML) {
  const preco = Number(i.price ?? 0);
  const precoAntigo = i.original_price ? Number(i.original_price) : null;
  const desconto =
    precoAntigo && precoAntigo > preco
      ? Math.round((1 - preco / precoAntigo) * 100)
      : null;

  return {
    origem: "mercadolivre" as const,
    item_id: Number(String(i.id).replace(/\D/g, "")) || 0,
    // ML não tem shop_id; usa 0 fixo pra o unique (origem,item_id,shop_id) dedupar
    shop_id: 0,
    titulo: i.title,
    categoria: null,
    cat_ids: i.category_id ? [i.category_id] : [],
    preco,
    preco_antigo: precoAntigo,
    desconto_pct: desconto,
    imagem_url: i.thumbnail,
    url_produto: i.permalink,
    loja_nome: i.seller?.nickname ?? null,
    vendas: i.sold_quantity ?? 0,
    status: "novo" as const,
    visto_em: new Date().toISOString(),
  };
}
