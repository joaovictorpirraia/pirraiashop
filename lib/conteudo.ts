import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Geração de conteúdo por IA. Para um produto curado, gera legenda + hashtags +
 * roteiro e grava como rascunho na tabela `posts` (status 'rascunho'). O admin
 * aprova antes de usar — nada é publicado automaticamente aqui.
 *
 * Config-gated em OPENAI_API_KEY (a rota responde 503 sem ela). Reusa o
 * angulo_ia/tags_ia da curadoria quando existem, pra dar contexto ao modelo.
 * Default gpt-4.1 (é a copy que vai pro post — vale um modelo melhor; volume baixo).
 */
// || (não ??) de propósito: env var presente-mas-vazia deve cair no default
const MODELO = process.env.CONTEUDO_MODELO || "gpt-4.1";

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

export const CANAIS: Canal[] = [
  "instagram_feed",
  "instagram_story",
  "tiktok",
  "whatsapp",
];

const BASE = `Você cria conteúdo para a @pirraiashop, vitrine brasileira de achadinhos
(Shopee/TikTok Shop), público chega pela bio do Instagram. Português do Brasil, informal, sem
forçar. Não prometa o que o produto não faz. No máximo 1–2 emojis. Use o angulo e as tags se
vierem. Responda só no formato estruturado, sem texto extra.`;

/** Instruções por canal — o formato do conteúdo muda conforme onde vai postar. */
function systemPara(canal: Canal): string {
  switch (canal) {
    case "instagram_story":
      return `${BASE}
Formato: STORY do Instagram (vertical, rápido).
- legenda: 1 frase curta e direta que caiba num story (gancho + benefício). Story não tem legenda longa.
- hashtags: 1 a 3, minúsculas, bem específicas.
- roteiro: 2 a 3 telas de story (uma por linha) com o que aparece; a última com CTA "arrasta pra cima / link na bio".`;
    case "tiktok":
      return `${BASE}
Formato: TikTok.
- legenda: caption estilo TikTok, curta, gancho forte na 1ª frase; CTA pro link na bio.
- hashtags: 4 a 8, misturando nicho e trends de TikTok (ex.: achadosdatiktok, tiktokmefezcomprar).
- roteiro: roteiro de vídeo TikTok, 3 a 5 cenas rápidas (uma por linha), com ideia de trend/áudio se fizer sentido.`;
    case "whatsapp":
      return `${BASE}
Formato: mensagem de WhatsApp (grupo/status/lista). Aqui NÃO existe "link na bio" — o link vai na própria mensagem.
- legenda: mensagem curta e direta pra colar no WhatsApp, com gancho + benefício + CTA claro (ex.: "corre que tá com desconto 👉"). Deixe claro que é só colar o link do produto no fim.
- hashtags: deixe vazio (WhatsApp não usa hashtag).
- roteiro: 1 ou 2 linhas de dica de como mandar (ex.: melhor horário, mandar no status + grupos).`;
    default:
      return `${BASE}
Formato: post/reel de FEED do Instagram.
- legenda: 2 a 5 linhas. 1ª linha é um gancho que para o scroll; depois o porquê de valer; CTA pro "link na bio".
- hashtags: 5 a 10 minúsculas, sem "#", misturando nicho e alcance (ex.: achadinhos, organizacao, shopeebrasil).
- roteiro: roteiro curto de reel, 3 a 5 cenas (uma por linha), cada linha com o que aparece na tela. Prático de gravar no celular.`;
  }
}

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

/** Chama o modelo pra um produto num canal. Parte não testável sem OPENAI_API_KEY. */
export async function gerarConteudo(
  produto: ProdutoParaConteudo,
  canal: Canal = "instagram_feed",
): Promise<ConteudoGerado | null> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY ausente — geração de conteúdo não configurada");
  }
  const client = new OpenAI();
  const resp = await client.chat.completions.create({
    model: MODELO,
    max_completion_tokens: 6000,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "conteudo",
        strict: true,
        schema: SCHEMA as unknown as Record<string, unknown>,
      },
    },
    messages: [
      { role: "system", content: systemPara(canal) },
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

  return interpretarConteudo(resp.choices[0]?.message?.content ?? "");
}

/**
 * Gera rascunhos pros produtos curados que ainda não têm rascunho (teto de 10
 * por rodada). Reusada pela rota /api/gerar-conteudo e pelo botão do admin.
 */
export async function gerarRascunhosPendentes(
  supabase: SupabaseClient,
  canal: Canal = "instagram_feed",
): Promise<{ candidatos: number; gerados: number; canal: Canal }> {
  const { data: linksRaw, error: e1 } = await supabase
    .from("links")
    .select(
      "id, produto_id, produto:produtos!inner(id, titulo, categoria, preco, preco_antigo, desconto_pct, loja_nome, angulo_ia, tags_ia, status)",
    )
    .eq("ativo", true);
  if (e1) throw new Error(e1.message);

  // dedup por (produto, canal): um produto pode ter um rascunho por canal
  const { data: rascunhos, error: e2 } = await supabase
    .from("posts")
    .select("produto_id")
    .eq("status", "rascunho")
    .eq("canal", canal);
  if (e2) throw new Error(e2.message);
  const jaTem = new Set((rascunhos ?? []).map((r) => r.produto_id));

  type Row = {
    id: number;
    produto_id: number;
    produto:
      | (ProdutoParaConteudo & { status: string })
      | (ProdutoParaConteudo & { status: string })[];
  };
  const candidatos = ((linksRaw ?? []) as Row[])
    .map((l) => ({
      linkId: l.id,
      produto: Array.isArray(l.produto) ? l.produto[0] : l.produto,
    }))
    .filter(
      (c) =>
        c.produto &&
        ["curado", "publicado"].includes(c.produto.status) &&
        !jaTem.has(c.produto.id),
    )
    .slice(0, 10);

  let gerados = 0;
  for (const c of candidatos) {
    const conteudo = await gerarConteudo(c.produto as ProdutoParaConteudo, canal);
    if (!conteudo) continue;
    const ok = await salvarRascunho(supabase, {
      produtoId: c.produto.id,
      linkId: c.linkId,
      canal,
      conteudo,
    });
    if (ok) gerados++;
  }
  return { candidatos: candidatos.length, gerados, canal };
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
