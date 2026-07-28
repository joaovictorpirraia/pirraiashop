import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Camada de curadoria por IA. O schema do banco já foi desenhado pra isso
 * (score_ia, angulo_ia, tags_ia). O objetivo NÃO é auto-publicar (isso exige o
 * link de afiliado, que é manual), e sim enriquecer os produtos 'novo' com uma
 * nota de potencial + gancho + tags, pra o admin curar os melhores primeiro
 * (a fila do /admin já ordena por score_ia desc).
 *
 * Config-gated: sem OPENAI_API_KEY vira erro claro (a rota responde 503).
 * Modelo configurável por env — default gpt-4.1-mini (barato, dá conta de pontuar
 * + escrever o ângulo curto). Pra cortar mais, dá pra usar gpt-4.1-nano.
 */
// || (não ??) de propósito: env var presente-mas-vazia deve cair no default
const MODELO = process.env.CURADORIA_MODELO || "gpt-4.1-mini";

export interface ProdutoParaScore {
  id: number;
  titulo: string;
  categoria: string | null;
  preco: number | string | null;
  preco_antigo: number | string | null;
  desconto_pct: number | null;
  loja_nome: string | null;
  vendas: number | null;
  avaliacao: number | string | null;
}

export interface ScoreIA {
  score_ia: number; // 0-100
  angulo_ia: string;
  tags_ia: string[];
}

const SYSTEM = `Você avalia produtos de afiliado (achadinhos de Shopee/TikTok Shop) para uma
vitrine brasileira cujo público chega pela bio do Instagram. Para cada produto, devolva:
- score: inteiro de 0 a 100 medindo o potencial de gerar clique/venda como "achadinho"
  (leve em conta desconto, preço de impulso, apelo visual do tipo de produto, prova social
  como vendas/avaliação). Seja criterioso: nem tudo é 90.
- angulo: um gancho curto de marketing em português do Brasil, informal, no máximo ~12 palavras,
  do jeito que apareceria numa legenda ("Isso resolve a bagunça da gaveta por menos de 20 reais").
- tags: 3 a 5 tags curtas em minúsculo (ex.: "organização", "cozinha", "presente").
Responda só no formato estruturado pedido, sem texto extra.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "integer" },
          score: { type: "integer" },
          angulo: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["id", "score", "angulo", "tags"],
      },
    },
  },
  required: ["itens"],
} as const;

/**
 * Interpreta a resposta estruturada do modelo num mapa id -> ScoreIA.
 * Função pura (sem rede) pra ser testável: clampa score em 0-100, limita a 5 tags,
 * descarta itens malformados.
 */
export function interpretarResposta(texto: string): Map<number, ScoreIA> {
  const mapa = new Map<number, ScoreIA>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(texto);
  } catch {
    return mapa;
  }
  const itens = (parsed as { itens?: unknown }).itens;
  if (!Array.isArray(itens)) return mapa;

  for (const raw of itens) {
    const it = raw as Record<string, unknown>;
    const id = Number(it.id);
    if (!Number.isInteger(id)) continue;
    const score = Math.max(0, Math.min(100, Math.round(Number(it.score))));
    if (!Number.isFinite(score)) continue;
    const angulo = typeof it.angulo === "string" ? it.angulo.trim() : "";
    const tags = Array.isArray(it.tags)
      ? it.tags
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 5)
      : [];
    mapa.set(id, { score_ia: score, angulo_ia: angulo, tags_ia: tags });
  }
  return mapa;
}

/** Chama o modelo e devolve os scores. Parte não testável sem OPENAI_API_KEY. */
export async function pontuarProdutos(
  produtos: ProdutoParaScore[],
): Promise<Map<number, ScoreIA>> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY ausente — curadoria por IA não configurada");
  }
  if (produtos.length === 0) return new Map();

  const client = new OpenAI();
  const resp = await client.chat.completions.create({
    model: MODELO,
    max_completion_tokens: 4000,
    // strict garante JSON válido no schema
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "curadoria",
        strict: true,
        schema: SCHEMA as unknown as Record<string, unknown>,
      },
    },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify(
          produtos.map((p) => ({
            id: p.id,
            titulo: p.titulo,
            categoria: p.categoria,
            preco: p.preco == null ? null : Number(p.preco),
            preco_antigo: p.preco_antigo == null ? null : Number(p.preco_antigo),
            desconto_pct: p.desconto_pct,
            loja: p.loja_nome,
            vendas: p.vendas,
            avaliacao: p.avaliacao == null ? null : Number(p.avaliacao),
          })),
        ),
      },
    ],
  });

  return interpretarResposta(resp.choices[0]?.message?.content ?? "");
}

/**
 * Pontua os produtos sem score_ia dentro dos status pedidos (teto de 40).
 * Reusada pela rota /api/curar (fila 'novo') e pelo botão do admin
 * (produtos 'curado'/'publicado' adicionados à mão). Não mexe em status.
 */
export async function pontuarPendentes(
  supabase: SupabaseClient,
  statuses: string[] = ["novo"],
): Promise<{ recebidos: number; pontuados: number; gravados: number }> {
  const { data, error } = await supabase
    .from("produtos")
    .select(
      "id, titulo, categoria, preco, preco_antigo, desconto_pct, loja_nome, vendas, avaliacao",
    )
    .in("status", statuses)
    .is("score_ia", null)
    .limit(40);
  if (error) throw new Error(error.message);

  const produtos = (data ?? []) as ProdutoParaScore[];
  const scores = await pontuarProdutos(produtos);
  const gravados = await aplicarScores(supabase, scores);
  return { recebidos: produtos.length, pontuados: scores.size, gravados };
}

/**
 * Grava os scores nos produtos. Testável com scores mock contra o banco real.
 * Escreve só score_ia/angulo_ia/tags_ia — não mexe em status.
 */
export async function aplicarScores(
  supabase: SupabaseClient,
  scores: Map<number, ScoreIA>,
): Promise<number> {
  let gravados = 0;
  for (const [id, s] of scores) {
    const { error } = await supabase
      .from("produtos")
      .update({ score_ia: s.score_ia, angulo_ia: s.angulo_ia, tags_ia: s.tags_ia })
      .eq("id", id);
    if (error) {
      console.error(`[curadoria] falha ao gravar score do produto ${id}:`, error.message);
      continue;
    }
    gravados++;
  }
  return gravados;
}
