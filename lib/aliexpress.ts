/**
 * Cliente da AliExpress Open Platform — API de Afiliado (`aliexpress.affiliate.*`).
 *
 * Gateway : https://api-sg.aliexpress.com/sync  (POST form-urlencoded, sempre)
 * Auth    : app-level (App Key + App Secret assinam a requisição). Afiliado NÃO
 *           precisa de OAuth/token de usuário — só busca de dados e geração de link.
 * Assinatura (sign_method=sha256):
 *   base = concat de (chave+valor) de TODOS os params (menos `sign`, menos vazios),
 *          com as chaves em ordem ASCII, sem separador nenhum.
 *   sign = HMAC_SHA256(secret, base) em HEX MAIÚSCULO.
 *   (o `method` entra como um param comum na base — no gateway /sync não se prefixa.)
 * timestamp = epoch em MILISSEGUNDOS (13 dígitos).
 *
 * Localização: manda ship_to_country=BR, target_currency=BRL, target_language=PT
 * pra vir preço/BR correto. tracking_id (do painel de afiliado) é o "sub-id": atribui
 * a comissão e é obrigatório pra gerar link. Requer Node 18+ (fetch nativo).
 *
 * Detalhes cruzados com dois SDKs abertos (ae_sdk TS / python-aliexpress-api) porque
 * a doc oficial da AliExpress é SPA e desatualiza sem aviso.
 */

import { createHmac } from "node:crypto";

const GATEWAY = "https://api-sg.aliexpress.com/sync";

export interface AliexpressConfig {
  appKey: string;
  appSecret: string;
  /** tracking_id do painel de afiliado — atribui a comissão; obrigatório p/ gerar link */
  trackingId?: string;
  /** timeout por requisição, em ms */
  timeoutMs?: number;
}

/** Produto como a API de afiliado devolve (campos que a gente usa). */
export interface ProdutoAli {
  product_id: number | string;
  product_title: string;
  product_main_image_url: string;
  product_video_url?: string;
  product_detail_url: string;
  promotion_link?: string;
  // preços já convertidos pra target_currency (use estes)
  target_sale_price?: string;
  target_original_price?: string;
  // fallback (moeda da conta)
  sale_price?: string;
  original_price?: string;
  app_sale_price?: string;
  discount?: string; // "50%"
  commission_rate?: string; // "8.0%"
  evaluate_rate?: string; // "90.0%"
  lastest_volume?: number;
  shop_id?: number | string;
  first_level_category_id?: number;
  second_level_category_id?: number;
}

export class AliexpressError extends Error {
  constructor(
    message: string,
    readonly code?: string | number,
    readonly detalhe?: unknown,
  ) {
    super(message);
    this.name = "AliexpressError";
  }
}

export class AliexpressAfiliado {
  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly trackingId?: string;
  private readonly timeoutMs: number;

  constructor(cfg: AliexpressConfig) {
    if (!cfg.appKey || !cfg.appSecret) {
      throw new AliexpressError(
        "appKey e appSecret são obrigatórios. Pegue os dois no painel da AliExpress Open Platform.",
      );
    }
    this.appKey = cfg.appKey;
    this.appSecret = cfg.appSecret;
    this.trackingId = cfg.trackingId;
    this.timeoutMs = cfg.timeoutMs ?? 20_000;
  }

  /** Assina os params: base = chaves ASCII ordenadas → "chavevalor..." → HMAC-SHA256 HEX maiúsculo. */
  private assinar(params: Record<string, string>): string {
    const base = Object.keys(params)
      .filter((k) => k !== "sign" && params[k] != null && params[k] !== "")
      .sort()
      .map((k) => k + params[k])
      .join("");
    return createHmac("sha256", this.appSecret).update(base, "utf8").digest("hex").toUpperCase();
  }

  /** Executa um método `aliexpress.affiliate.*` e devolve o `result` de dentro do envelope. */
  private async chamar<T = unknown>(
    method: string,
    business: Record<string, string | number | undefined>,
  ): Promise<T> {
    const params: Record<string, string> = {
      method,
      app_key: this.appKey,
      sign_method: "sha256",
      timestamp: String(Date.now()), // epoch ms, 13 dígitos
      format: "json",
    };
    for (const [k, v] of Object.entries(business)) {
      if (v !== undefined && v !== null && v !== "") params[k] = String(v);
    }
    params.sign = this.assinar(params);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let resp: Response;
    try {
      resp = await fetch(GATEWAY, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams(params).toString(),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new AliexpressError(
        ctrl.signal.aborted
          ? `Timeout de ${this.timeoutMs}ms na AliExpress`
          : `Falha de rede ao chamar a AliExpress: ${(e as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      throw new AliexpressError(
        `HTTP ${resp.status} da AliExpress`,
        resp.status,
        await resp.text().catch(() => null),
      );
    }

    const json = (await resp.json()) as Record<string, unknown>;

    // erro em nível de envelope (assinatura, timestamp, permissão…)
    if (json.error_response) {
      const er = json.error_response as { code?: string; msg?: string; sub_msg?: string };
      throw new AliexpressError(
        `AliExpress recusou: ${er.sub_msg || er.msg || "erro"}`,
        er.code,
        er,
      );
    }

    // o envelope vem numa chave "<method>_response"
    const chaveResp = Object.keys(json).find((k) => k.endsWith("_response"));
    const env = (chaveResp ? json[chaveResp] : json) as Record<string, unknown>;
    const respResult = env?.resp_result as
      | { resp_code?: number; resp_msg?: string; result?: unknown }
      | undefined;

    // erro em nível de negócio
    if (respResult && respResult.resp_code != null && respResult.resp_code !== 200) {
      throw new AliexpressError(
        `AliExpress: ${respResult.resp_msg ?? "erro de negócio"}`,
        respResult.resp_code,
        respResult,
      );
    }

    return (respResult?.result ?? env?.result ?? env) as T;
  }

  /** Busca produtos por palavra-chave. Gera o link de afiliado real por produto. */
  async buscarProdutos(opts: {
    keywords?: string;
    categoryIds?: string;
    pageNo?: number;
    pageSize?: number;
    sort?: string;
    minPrecoCentavos?: number;
    maxPrecoCentavos?: number;
  }): Promise<ProdutoAli[]> {
    const result = await this.chamar<{ products?: unknown }>(
      "aliexpress.affiliate.product.query",
      {
        keywords: opts.keywords,
        category_ids: opts.categoryIds,
        page_no: opts.pageNo ?? 1,
        page_size: Math.min(opts.pageSize ?? 50, 50),
        sort: opts.sort,
        min_sale_price: opts.minPrecoCentavos,
        max_sale_price: opts.maxPrecoCentavos,
        ship_to_country: "BR",
        target_currency: "BRL",
        target_language: "PT",
        tracking_id: this.trackingId,
      },
    );
    const produtos = lista<ProdutoAli>(result.products, "product");
    await this.anexarLinksReais(produtos);
    return produtos;
  }

  /** DEBUG: devolve o `result` cru do productdetail.get (pra inspecionar os campos). */
  async detalharRaw(productIds: Array<string | number>): Promise<unknown> {
    return this.chamar("aliexpress.affiliate.productdetail.get", {
      product_ids: productIds.join(","),
      ship_to_country: "BR",
      target_currency: "BRL",
      target_language: "PT",
      tracking_id: this.trackingId,
    });
  }

  /** Detalhe de 1+ produtos por id (batch por vírgula). Gera o link de afiliado real por produto. */
  async detalharProdutos(productIds: Array<string | number>): Promise<ProdutoAli[]> {
    if (productIds.length === 0) return [];
    const result = await this.chamar<{ products?: unknown }>(
      "aliexpress.affiliate.productdetail.get",
      {
        product_ids: productIds.join(","),
        // pede explicitamente o vídeo (senão a API não devolve product_video_url)
        fields:
          "product_id,product_title,product_main_image_url,product_video_url,product_detail_url,promotion_link,target_sale_price,target_original_price,sale_price,original_price,app_sale_price,discount,commission_rate,evaluate_rate,lastest_volume,shop_id,first_level_category_id,second_level_category_id",
        ship_to_country: "BR",
        target_currency: "BRL",
        target_language: "PT",
        tracking_id: this.trackingId,
      },
    );
    const produtos = lista<ProdutoAli>(result.products, "product");
    await this.anexarLinksReais(produtos);
    return produtos;
  }

  /**
   * Gera o link de afiliado REAL por produto e grava em cada `promotion_link`.
   *
   * O `product.query`/`productdetail.get` devolvem um `promotion_link` genérico (o
   * mesmo pra todos os itens) — inútil, mandaria todo produto pro mesmo lugar. O
   * link certo sai do `link.generate` a partir da URL canônica de cada produto.
   * Em lote (≤ 50 por chamada). Zera o promotion_link antes: se a geração falhar
   * pra um item, ele fica sem link (cai como manual) em vez de herdar o genérico.
   */
  private async anexarLinksReais(produtos: ProdutoAli[]): Promise<void> {
    for (const p of produtos) p.promotion_link = undefined;
    if (!this.trackingId || produtos.length === 0) return;

    const urls = produtos.map((p) => p.product_detail_url).filter(Boolean);
    const mapa: Record<string, string> = {};
    for (let i = 0; i < urls.length; i += 50) {
      try {
        Object.assign(mapa, await this.gerarLinks(urls.slice(i, i + 50)));
      } catch {
        /* falha de um lote não derruba a ingestão; os itens ficam sem link */
      }
    }
    for (const p of produtos) {
      const gerado = mapa[p.product_detail_url];
      if (gerado) p.promotion_link = gerado;
    }
  }

  /**
   * Gera link(s) de afiliado rastreável(is) a partir de URL(s) de produto.
   * source_values aceita várias URLs por vírgula (≤ 50). tracking_id é obrigatório.
   * Devolve um mapa { urlOrigem → promotionLink }.
   */
  async gerarLinks(
    urls: string[],
    tipo: 0 | 2 = 0,
  ): Promise<Record<string, string>> {
    if (!this.trackingId) {
      throw new AliexpressError(
        "gerar link exige tracking_id (defina ALIEXPRESS_TRACKING_ID) — é o que atribui a comissão.",
      );
    }
    if (urls.length === 0) return {};
    if (urls.length > 50) throw new AliexpressError("máximo de 50 URLs por chamada");

    const result = await this.chamar<{ promotion_links?: unknown }>(
      "aliexpress.affiliate.link.generate",
      {
        promotion_link_type: tipo,
        source_values: urls.join(","),
        tracking_id: this.trackingId,
      },
    );
    const links = lista<{ source_value: string; promotion_link: string }>(
      result.promotion_links,
      "promotion_link",
    );
    const mapa: Record<string, string> = {};
    for (const l of links) {
      if (l.source_value && l.promotion_link) mapa[l.source_value] = l.promotion_link;
    }
    return mapa;
  }
}

/** Desembrulha listas no formato Taobao: `{ product: [...] }` ou array direto ou item único. */
function lista<T>(container: unknown, singular: string): T[] {
  if (!container) return [];
  if (Array.isArray(container)) return container as T[];
  const inner = (container as Record<string, unknown>)[singular];
  if (Array.isArray(inner)) return inner as T[];
  return inner ? [inner as T] : [];
}

/** "8.0%" → 8.0 ; "50%" → 50 ; undefined/lixo → 0 */
function pct(s?: string): number {
  if (!s) return 0;
  const n = parseFloat(String(s).replace("%", "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** Extrai o product_id de uma URL de produto da AliExpress (`/item/<id>.html`). */
export function idProdutoAli(url: string): number | null {
  const m =
    url.match(/\/item\/(?:[\w-]+\/)?(\d{6,})\.html/i) ||
    url.match(/[?&]productId=(\d{6,})/i) ||
    url.match(/\/(\d{9,})(?:[/?#.]|$)/);
  return m ? Number(m[1]) : null;
}

/**
 * Normaliza um produto da AliExpress pro formato da tabela `produtos`.
 * Usa os preços `target_*` (já em BRL). O promotion_link, quando presente, já é o
 * link de afiliado rastreável → pré-preenche o Curar.
 */
export function paraProdutoAli(p: ProdutoAli) {
  const preco = Number(p.target_sale_price ?? p.sale_price ?? p.app_sale_price ?? 0);
  const antigoBruto = Number(p.target_original_price ?? p.original_price ?? 0);
  const precoAntigo = antigoBruto > preco ? antigoBruto : null;
  const desconto =
    pct(p.discount) ||
    (precoAntigo ? Math.round((1 - preco / precoAntigo) * 100) : 0);
  const comissaoPct = pct(p.commission_rate);
  const avaliacao = p.evaluate_rate ? Number((pct(p.evaluate_rate) / 20).toFixed(1)) : null; // % → 0-5

  return {
    origem: "aliexpress" as const,
    item_id: Number(p.product_id) || 0,
    // AliExpress não expõe shop_id em todo item; usa 0 fixo pro unique (origem,item_id,shop_id)
    shop_id: Number(p.shop_id) || 0,
    titulo: p.product_title,
    cat_ids: [p.first_level_category_id, p.second_level_category_id]
      .filter((c): c is number => c != null)
      .map(String),
    preco,
    preco_antigo: precoAntigo,
    desconto_pct: desconto || null,
    comissao_pct: comissaoPct || null,
    comissao_valor: comissaoPct ? Number((preco * (comissaoPct / 100)).toFixed(2)) : null,
    imagem_url: p.product_main_image_url,
    video_url: p.product_video_url || null,
    // URL canônica do produto (não o link genérico) — fallback do redirect se faltar afiliado
    url_produto: p.product_detail_url,
    // promotion_link real por produto (gerado via link.generate) → pré-preenche o Curar
    link_afiliado: p.promotion_link || null,
    loja_nome: null as string | null,
    vendas: Number(p.lastest_volume) || 0,
    avaliacao,
    status: "novo" as const,
    visto_em: new Date().toISOString(),
  };
}
