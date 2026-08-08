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

/**
 * Classifica um produto em UMA das categorias cadastradas (a taxonomia da
 * vitrine). Usa enum no structured output pra o modelo só poder escolher uma da
 * lista. Retorna null se não configurado, sem categorias, ou se nada serviu.
 */
export async function classificarCategoria(
  titulo: string,
  categorias: string[],
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY || categorias.length === 0 || !titulo.trim()) {
    return null;
  }
  const client = new OpenAI();
  try {
    const resp = await client.chat.completions.create({
      model: MODELO,
      max_completion_tokens: 30,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "categoria",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { categoria: { type: "string", enum: [...categorias, "outra"] } },
            required: ["categoria"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Classifique o produto em UMA das categorias da lista (pelo enum). Se nenhuma servir de verdade, responda 'outra'.",
        },
        { role: "user", content: titulo },
      ],
    });
    const parsed = JSON.parse(resp.choices[0]?.message?.content ?? "{}") as {
      categoria?: string;
    };
    const c = parsed.categoria;
    return c && c !== "outra" && categorias.includes(c) ? c : null;
  } catch {
    return null; // categoria opcional: falha não trava a importação
  }
}

const semAcento = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Classifica EM LOTE os produtos 'novo' sem categoria: 1 chamada pra IA (barato),
 * mapeando cada um numa categoria AMPLA. Prefere as categorias já cadastradas; se
 * nenhuma servir, CRIA uma nova (ampla) e cadastra em `categorias`. Depois seta a
 * `categoria` em cada produto. No-op sem OPENAI_API_KEY. Não trava a importação.
 */
export async function categorizarProdutos(
  supabase: SupabaseClient,
  limite = 80,
): Promise<{ classificados: number; novas: string[] }> {
  if (!process.env.OPENAI_API_KEY) return { classificados: 0, novas: [] };

  const { data: pend } = await supabase
    .from("produtos")
    .select("id, titulo")
    .eq("status", "novo")
    .is("categoria", null)
    .limit(limite);
  if (!pend || pend.length === 0) return { classificados: 0, novas: [] };

  const { data: catsRaw } = await supabase.from("categorias").select("nome").order("ordem");
  const existentes = (catsRaw ?? []).map((c) => c.nome as string);
  const porNorm = new Map(existentes.map((n) => [semAcento(n), n]));

  const client = new OpenAI();
  let itens: Array<{ id: number; categoria: string }> = [];
  try {
    const resp = await client.chat.completions.create({
      model: MODELO,
      max_completion_tokens: 4000,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "categorias_lote",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              itens: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: { id: { type: "number" }, categoria: { type: "string" } },
                  required: ["id", "categoria"],
                },
              },
            },
            required: ["itens"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            `Categorize cada produto de e-commerce em UMA categoria AMPLA em português (1-2 palavras). ` +
            `Use PREFERENCIALMENTE uma destas já existentes: ${existentes.join(", ") || "(nenhuma ainda)"}. ` +
            `Só crie categoria nova (ampla, não específica) se nenhuma existente servir. Responda a categoria de cada id.`,
        },
        { role: "user", content: JSON.stringify(pend.map((p) => ({ id: p.id, titulo: p.titulo }))) },
      ],
    });
    itens = (JSON.parse(resp.choices[0]?.message?.content ?? "{}").itens ?? []) as typeof itens;
  } catch {
    return { classificados: 0, novas: [] };
  }

  const novasSet = new Set<string>();
  const decisao = new Map<number, string>();
  for (const it of itens) {
    const raw = String(it.categoria || "").trim();
    if (!raw || !it.id) continue;
    const existente = porNorm.get(semAcento(raw));
    let nome: string;
    if (existente) {
      nome = existente;
    } else {
      nome = raw.replace(/\s+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
      if (!porNorm.has(semAcento(nome))) {
        novasSet.add(nome);
        porNorm.set(semAcento(nome), nome);
      } else {
        nome = porNorm.get(semAcento(nome))!;
      }
    }
    decisao.set(Number(it.id), nome);
  }

  const novas = [...novasSet];
  if (novas.length) {
    const { data: ult } = await supabase
      .from("categorias")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    let ordem = (ult?.ordem ?? 0) + 1;
    await supabase.from("categorias").upsert(
      novas.map((nome) => ({ nome, ordem: ordem++ })),
      { onConflict: "nome" },
    );
  }

  let classificados = 0;
  for (const [id, nome] of decisao) {
    const { error } = await supabase.from("produtos").update({ categoria: nome }).eq("id", id);
    if (!error) classificados++;
  }
  return { classificados, novas };
}

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
