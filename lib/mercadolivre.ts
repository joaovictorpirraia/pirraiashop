/**
 * Cliente do Mercado Livre — SCAFFOLD, ainda não validado contra a API real.
 *
 * Situação (pesquisado em jul/2026):
 *  - Dados de produto: a API pública do ML existe e é documentada
 *    (https://api.mercadolibre.com). A busca por site funciona sem OAuth pra
 *    leitura básica; recursos avançados pedem um app (client_id/secret).
 *  - Link de afiliado: NÃO há API pública limpa de geração de shortlink de
 *    afiliado. O programa "Mercado Livre Afiliados" gera o link pela UI, e o
 *    acesso programático é restrito a alto volume. Ou seja: mesmo modelo da
 *    Shopee hoje — ingerir o produto, curar no /admin e colar o link manual.
 *
 * Por isso este arquivo cobre só a parte de DADOS. Quando for ligar de verdade:
 *  1. rodar migrations/002_mercadolivre.sql (adiciona 'mercadolivre' ao enum origem)
 *  2. validar o shape de `buscarItens` contra a resposta real (os campos abaixo
 *     seguem a doc, mas confirme antes de confiar)
 *  3. reusar lib/ingest.ts: paraProdutoML() já devolve o formato de `produtos`,
 *     então ingerirOfertas() serve com um pequeno adaptador de tipo.
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

/** Busca itens no site do ML (MLB = Brasil). Leitura básica; sem OAuth. */
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

  const headers: Record<string, string> = {};
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;

  const resp = await fetch(`${ENDPOINT}/sites/MLB/search?${params}`, { headers });
  if (!resp.ok) {
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
