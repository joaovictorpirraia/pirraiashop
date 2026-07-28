/**
 * Cliente do Mercado Livre — parte de DADOS (busca de produto).
 *
 * Situação (validado em produção jul/2026):
 *  - Busca de produto (`/sites/MLB/search`): o ML FECHOU o acesso anônimo. Sem token
 *    volta 403 "forbidden" (confirmado com chamada real). Precisa de um access token
 *    de app do ML. Este módulo resolve isso sozinho: com `MERCADOLIVRE_CLIENT_ID` +
 *    `MERCADOLIVRE_CLIENT_SECRET` no env, ele pega/renova um token via grant
 *    `client_credentials`. Também aceita token cru (`MERCADOLIVRE_TOKEN`) ou por
 *    parâmetro, pra teste rápido.
 *  - Link de afiliado: NÃO há API pública limpa de geração de shortlink de afiliado.
 *    O programa "Mercado Livre Afiliados" gera o link pela UI. Ou seja: ingerir o
 *    produto, curar no /admin e colar o link manual.
 *
 * O resto do pipeline (upsert na fila, curadoria, dedup) está em lib/ingest.ts.
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

// Token de app cacheado em memória (o processo do EasyPanel é longo, então dura
// pela validade real). Renova quando falta < 1 min. Some se o container reiniciar
// — sem problema, é só pedir de novo.
let tokenCache: { token: string; exp: number } | null = null;

/**
 * Pega um access token de app via `client_credentials` (sem login de usuário).
 * Retorna null se as credenciais não estiverem no env — aí o chamador decide.
 */
export async function tokenApp(): Promise<string | null> {
  const clientId = process.env.MERCADOLIVRE_CLIENT_ID;
  const clientSecret = process.env.MERCADOLIVRE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;

  const resp = await fetch(`${ENDPOINT}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Mercado Livre token ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await resp.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("Mercado Livre não devolveu access_token (client_credentials)");
  }
  tokenCache = {
    token: json.access_token,
    exp: Date.now() + (json.expires_in ?? 21600) * 1000, // default 6h
  };
  return json.access_token;
}

/**
 * Busca itens no site do ML (MLB = Brasil). O ML fechou o acesso anônimo — sem
 * token volta 403. Ordem do token: parâmetro > MERCADOLIVRE_TOKEN (cru) >
 * client_credentials (MERCADOLIVRE_CLIENT_ID/SECRET, automático).
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

  const token =
    opts.accessToken ?? process.env.MERCADOLIVRE_TOKEN ?? (await tokenApp()) ?? undefined;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(`${ENDPOINT}/sites/MLB/search?${params}`, { headers });
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(
        token
          ? `Mercado Livre recusou o token (${resp.status}) — o app pode não ter acesso ao catálogo; confira os scopes/credenciais`
          : `Mercado Livre exige token e não há credencial: defina MERCADOLIVRE_CLIENT_ID + MERCADOLIVRE_CLIENT_SECRET (app do ML) no env`,
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
