/**
 * Cliente da Shopee Affiliate Open API (Brasil).
 *
 * Endpoint : https://open-api.affiliate.shopee.com.br/graphql
 * Método   : sempre POST, inclusive para leitura
 * Auth     : Authorization: SHA256 Credential={appId}, Timestamp={ts}, Signature={sig}
 *            sig = sha256(appId + timestamp + payload + secret)
 *            timestamp em segundos (Unix)
 *
 * Requer Node 18+ (fetch nativo).
 *
 * ATENÇÃO: a Shopee versiona os campos do GraphQL sem aviso. Se um campo vier
 * null ou a query der erro de schema, confira a doc oficial em
 * https://open-api.affiliate.shopee.com.br antes de sair debugando.
 */

import { createHash } from "node:crypto";

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

export interface ShopeeConfig {
  appId: string;
  secret: string;
  /** timeout por requisição, em ms */
  timeoutMs?: number;
}

export interface ProdutoOferta {
  itemId: number;
  shopId: number;
  productName: string;
  imageUrl: string;
  price: string;
  priceMin: string;
  priceMax: string;
  priceDiscountRate: number;
  commissionRate: string;
  commission: string;
  sellerCommissionRate: string;
  shopeeCommissionRate: string;
  sales: number;
  ratingStar: string;
  shopName: string;
  productLink: string;
  offerLink: string;
  productCatIds: number[];
}

export interface Pagina<T> {
  nodes: T[];
  hasNextPage: boolean;
  scrollId: string | null;
}

export class ShopeeAffiliateError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly detalhe?: unknown,
  ) {
    super(message);
    this.name = "ShopeeAffiliateError";
  }
}

export class ShopeeAffiliate {
  private readonly appId: string;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor(cfg: ShopeeConfig) {
    if (!cfg.appId || !cfg.secret) {
      throw new ShopeeAffiliateError(
        "appId e secret são obrigatórios. Pegue os dois na aba Open API do painel de afiliado.",
      );
    }
    this.appId = cfg.appId;
    this.secret = cfg.secret;
    this.timeoutMs = cfg.timeoutMs ?? 20_000;
  }

  /** Monta o header Authorization no formato exigido pela Shopee. */
  private assinar(payload: string): string {
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHash("sha256")
      .update(this.appId + ts + payload + this.secret)
      .digest("hex");
    return `SHA256 Credential=${this.appId}, Timestamp=${ts}, Signature=${sig}`;
  }

  /**
   * Executa uma operação GraphQL, com RETRY em erro transitório da Shopee.
   * A Shopee solta "System Error [10000]" e 5xx de vez em quando (soluço do
   * lado deles) — sem retry, um soluço às 8h perde o carrossel do dia inteiro.
   * Só retenta o que é transitório; erro de auth/schema estoura de primeira.
   */
  async executar<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const maxTentativas = 3;
    let ultimo: ShopeeAffiliateError | undefined;
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        return await this.executarUma<T>(query, variables);
      } catch (e) {
        const err = e as ShopeeAffiliateError;
        ultimo = err;
        if (tentativa === maxTentativas || !this.ehTransitorio(err)) throw err;
        await new Promise((r) => setTimeout(r, tentativa * 1500)); // 1,5s → 3s
      }
    }
    throw ultimo ?? new ShopeeAffiliateError("Falha desconhecida na Shopee");
  }

  /** Erros que valem retentar: System Error, 5xx, timeout, falha de rede. */
  private ehTransitorio(err: ShopeeAffiliateError): boolean {
    if (err.code === 10000) return true; // "System Error" do GraphQL
    if (typeof err.code === "number" && err.code >= 500) return true; // HTTP 5xx
    return /Timeout|Falha de rede/i.test(err.message);
  }

  /** Executa uma operação GraphQL crua (1 tentativa). */
  private async executarUma<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    // O payload assinado precisa ser byte a byte igual ao corpo enviado.
    const payload = JSON.stringify(variables ? { query, variables } : { query });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);

    let resp: Response;
    try {
      resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.assinar(payload),
        },
        body: payload,
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new ShopeeAffiliateError(
        ctrl.signal.aborted
          ? `Timeout de ${this.timeoutMs}ms na Shopee`
          : `Falha de rede ao chamar a Shopee: ${(e as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      throw new ShopeeAffiliateError(
        `HTTP ${resp.status} da Shopee`,
        resp.status,
        await resp.text().catch(() => null),
      );
    }

    const json = (await resp.json()) as {
      data?: T;
      errors?: Array<{ message: string; extensions?: { code?: number } }>;
    };

    if (json.errors?.length) {
      const primeiro = json.errors[0];
      throw new ShopeeAffiliateError(
        `Shopee recusou: ${primeiro.message}`,
        primeiro.extensions?.code,
        json.errors,
      );
    }

    if (!json.data) {
      throw new ShopeeAffiliateError("Resposta sem campo data", undefined, json);
    }

    return json.data;
  }

  /**
   * Busca ofertas de produto. Sem keyword, devolve o catálogo geral de ofertas.
   *
   * listType e sortType aceitam valores numéricos definidos pela Shopee —
   * confira a doc antes de fixar um valor, porque eles mudam.
   */
  async buscarOfertas(opts: {
    keyword?: string;
    /** busca uma oferta específica pelo itemId (produto único) */
    itemId?: number;
    limit?: number;
    page?: number;
    listType?: number;
    sortType?: number;
    /** filtra por categoria da Shopee */
    productCatId?: number;
  } = {}): Promise<Pagina<ProdutoOferta>> {
    const args: string[] = [];
    if (opts.keyword) args.push(`keyword:"${escaparGraphQL(opts.keyword)}"`);
    if (opts.itemId) args.push(`itemId:${opts.itemId}`);
    if (opts.productCatId) args.push(`productCatId:${opts.productCatId}`);
    args.push(`limit:${Math.min(opts.limit ?? 50, 50)}`);
    args.push(`page:${opts.page ?? 1}`);
    if (opts.listType !== undefined) args.push(`listType:${opts.listType}`);
    if (opts.sortType !== undefined) args.push(`sortType:${opts.sortType}`);

    const query = `{
      productOfferV2(${args.join(",")}) {
        nodes {
          itemId shopId productName imageUrl
          price priceMin priceMax priceDiscountRate
          commissionRate commission sellerCommissionRate shopeeCommissionRate
          sales ratingStar shopName
          productLink offerLink productCatIds
        }
        pageInfo { page limit hasNextPage scrollId }
      }
    }`;

    const data = await this.executar<{
      productOfferV2: {
        nodes: ProdutoOferta[];
        pageInfo: { hasNextPage: boolean; scrollId: string | null };
      };
    }>(query);

    return {
      nodes: data.productOfferV2.nodes ?? [],
      hasNextPage: data.productOfferV2.pageInfo?.hasNextPage ?? false,
      scrollId: data.productOfferV2.pageInfo?.scrollId ?? null,
    };
  }

  /**
   * Transforma qualquer URL da Shopee num shortlink rastreável.
   * Máximo de 5 subIds — use-os, é o seu único jeito de saber
   * qual post trouxe qual venda.
   */
  async gerarShortLink(
    originUrl: string,
    subIds: string[] = [],
  ): Promise<string> {
    if (subIds.length > 5) {
      throw new ShopeeAffiliateError("A Shopee aceita no máximo 5 subIds");
    }

    const subs = subIds.map((s) => `"${escaparGraphQL(s)}"`).join(",");
    const query = `mutation {
      generateShortLink(input:{
        originUrl:"${escaparGraphQL(originUrl)}",
        subIds:[${subs}]
      }) { shortLink }
    }`;

    const data = await this.executar<{
      generateShortLink: { shortLink: string };
    }>(query);

    return data.generateShortLink.shortLink;
  }

  /**
   * Relatório de conversões. Janela máxima costuma ser de 30 dias.
   * Datas em segundos (Unix).
   */
  async relatorioConversoes(opts: {
    inicio: Date;
    fim: Date;
    limit?: number;
    scrollId?: string;
  }): Promise<{ nodes: unknown[]; scrollId: string | null; hasNextPage: boolean }> {
    const args = [
      `purchaseTimeStart:${Math.floor(opts.inicio.getTime() / 1000)}`,
      `purchaseTimeEnd:${Math.floor(opts.fim.getTime() / 1000)}`,
      `limit:${Math.min(opts.limit ?? 100, 500)}`,
    ];
    if (opts.scrollId) args.push(`scrollId:"${escaparGraphQL(opts.scrollId)}"`);

    const query = `{
      conversionReport(${args.join(",")}) {
        nodes {
          purchaseTime clickTime conversionId orderStatus
          utmContent linkedProductCount totalCommission
        }
        pageInfo { hasNextPage scrollId }
      }
    }`;

    const data = await this.executar<{
      conversionReport: {
        nodes: unknown[];
        pageInfo: { hasNextPage: boolean; scrollId: string | null };
      };
    }>(query);

    return {
      nodes: data.conversionReport.nodes ?? [],
      scrollId: data.conversionReport.pageInfo?.scrollId ?? null,
      hasNextPage: data.conversionReport.pageInfo?.hasNextPage ?? false,
    };
  }
}

/** Escapa aspas e quebras pra interpolação inline no GraphQL. */
function escaparGraphQL(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Normaliza uma oferta da Shopee pro formato da tabela `produtos`.
 */
export function paraProduto(o: ProdutoOferta) {
  const preco = Number(o.price ?? o.priceMin ?? 0);
  const desconto = Number(o.priceDiscountRate ?? 0);

  return {
    origem: "shopee" as const,
    item_id: o.itemId,
    shop_id: o.shopId,
    titulo: o.productName,
    cat_ids: o.productCatIds ?? [],
    preco,
    preco_antigo: desconto > 0 ? Number((preco / (1 - desconto / 100)).toFixed(2)) : null,
    desconto_pct: desconto || null,
    comissao_pct: Number(o.commissionRate ?? 0) * 100,
    comissao_valor: Number(o.commission ?? 0),
    imagem_url: o.imageUrl,
    url_produto: o.offerLink || o.productLink,
    // offerLink já é o link de afiliado rastreável → pré-preenche o Curar
    link_afiliado: o.offerLink || null,
    loja_nome: o.shopName,
    vendas: o.sales ?? 0,
    avaliacao: o.ratingStar ? Number(o.ratingStar) : null,
    status: "novo" as const,
    visto_em: new Date().toISOString(),
  };
}
