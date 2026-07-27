import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Geração de conteúdo por IA. Para um produto curado, gera legenda + hashtags +
 * roteiro e grava como rascunho na tabela `posts` (status 'rascunho'). O admin
 * aprova antes de usar — nada é publicado automaticamente aqui.
 *
 * Config-gated em ANTHROPIC_API_KEY (a rota responde 503 sem ela). Reusa o
 * angulo_ia/tags_ia da curadoria quando existem, pra dar contexto ao modelo.
 */
const MODELO = process.env.CONTEUDO_MODELO ?? "claude-opus-5";

export type Canal = "instagram_feed" | "instagram_story" | "tiktok" | "whatsapp";

export interface ProdutoParaConteudo {
  id: number;
  titulo: string;
  categoria: string | null;
  preco: number | string | null;
  preco_antigo: number | string | null;
  desconto_pct: number | null;
  loja_nome: string | null;
  angulo_ia: string | null;
  tags_ia: string[] | null;
}

export interface ConteudoGerado {
  legenda: string;
  hashtags: string[];
  roteiro: string;
}

const SYSTEM = `Você cria conteúdo para a @pirraiashop, uma vitrine brasileira de achadinhos
(Shopee/TikTok Shop) cujo público chega pela bio do Instagram. Para o produto dado, gere:
- legenda: legenda de post em português do Brasil, informal e sem forçar. Primeira linha é um
  gancho que para o scroll; depois o porquê de valer a pena; e um CTA claro pro "link na bio".
  2 a 5 linhas. Não prometa o que o produto não faz. No máximo 1 ou 2 emojis, se fizer sentido.
- hashtags: 5 a 10 hashtags minúsculas, sem o "#", misturando nicho e alcance (ex.: "achadinhos",
  "organizacao", "shopeebrasil"). Relevantes ao produto, nada genérico demais.
- roteiro: roteiro curto de reel/story, 3 a 5 cenas, uma por linha, cada linha começando com o
  que aparece na tela (ex.: "Cena 1 — close no produto na mão"). Prático de gravar com o celular.
Use o angulo e as tags se vierem. Responda só no formato estruturado, sem texto extra.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    legenda: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    roteiro: { type: "string" },
  },
  required: ["legenda", "hashtags", "roteiro"],
} as const;

/**
 * Interpreta a resposta estruturada do modelo. Pura (sem rede) e testável:
 * limpa hashtags (tira "#", minúsculo), corta a 12, valida strings.
 */
export function interpretarConteudo(texto: string): ConteudoGerado | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(texto);
  } catch {
    return null;
  }
  const o = parsed as Record<string, unknown>;
  const legenda = typeof o.legenda === "string" ? o.legenda.trim() : "";
  const roteiro = typeof o.roteiro === "string" ? o.roteiro.trim() : "";
  if (!legenda || !roteiro) return null;
  const hashtags = Array.isArray(o.hashtags)
    ? o.hashtags
        .filter((h): h is string => typeof h === "string")
        .map((h) => h.trim().replace(/^#+/, "").toLowerCase())
        .filter(Boolean)
        .slice(0, 12)
    : [];
  return { legenda, hashtags, roteiro };
}

/** Chama o modelo pra um produto. Parte não testável sem ANTHROPIC_API_KEY. */
export async function gerarConteudo(
  produto: ProdutoParaConteudo,
): Promise<ConteudoGerado | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ausente — geração de conteúdo não configurada");
  }
  const client = new Anthropic();
  const resp = await client.messages.create({
    model: MODELO,
    max_tokens: 6000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          titulo: produto.titulo,
          categoria: produto.categoria,
          preco: produto.preco == null ? null : Number(produto.preco),
          preco_antigo: produto.preco_antigo == null ? null : Number(produto.preco_antigo),
          desconto_pct: produto.desconto_pct,
          loja: produto.loja_nome,
          angulo: produto.angulo_ia,
          tags: produto.tags_ia,
        }),
      },
    ],
  });

  const txt = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return interpretarConteudo(txt);
}

/** Grava um rascunho na tabela posts. Testável com conteúdo mock. */
export async function salvarRascunho(
  supabase: SupabaseClient,
  opts: {
    produtoId: number;
    linkId: number | null;
    canal: Canal;
    conteudo: ConteudoGerado;
  },
): Promise<boolean> {
  const { error } = await supabase.from("posts").insert({
    produto_id: opts.produtoId,
    link_id: opts.linkId,
    canal: opts.canal,
    legenda: opts.conteudo.legenda,
    hashtags: opts.conteudo.hashtags,
    roteiro: opts.conteudo.roteiro,
    status: "rascunho",
  });
  if (error) {
    console.error(`[conteudo] falha ao salvar rascunho do produto ${opts.produtoId}:`, error.message);
    return false;
  }
  return true;
}
