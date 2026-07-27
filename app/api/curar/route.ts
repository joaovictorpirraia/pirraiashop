import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { pontuarProdutos, aplicarScores, type ProdutoParaScore } from "@/lib/curadoria";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 120;

/**
 * Curadoria por IA: pega produtos 'novo' ainda sem score, pontua com o modelo
 * e grava score_ia/angulo_ia/tags_ia. Não muda status (publicar exige o link de
 * afiliado, que é manual) — só faz a fila do /admin priorizar os melhores.
 *
 * Protegida por CRON_SECRET (mesmo esquema da ingestão). Responde 503 até
 * ANTHROPIC_API_KEY existir. A lógica de parsing + gravação é testada à parte.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key =
    request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { erro: "ANTHROPIC_API_KEY ausente — curadoria por IA não configurada" },
      { status: 503 },
    );
  }

  const inicio = Date.now();
  const supabase = supabaseAdmin();

  try {
    const { data, error } = await supabase
      .from("produtos")
      .select("id, titulo, categoria, preco, preco_antigo, desconto_pct, loja_nome, vendas, avaliacao")
      .eq("status", "novo")
      .is("score_ia", null)
      .limit(40);
    if (error) throw new Error(error.message);

    const produtos = (data ?? []) as ProdutoParaScore[];
    const scores = await pontuarProdutos(produtos);
    const gravados = await aplicarScores(supabase, scores);

    const res = { recebidos: produtos.length, pontuados: scores.size, gravados };

    await supabase.from("execucoes").insert({
      job: "curadoria_ia",
      ok: true,
      itens: gravados,
      detalhe: res,
      duracao_ms: Date.now() - inicio,
    });

    return NextResponse.json(res);
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "curadoria_ia",
      ok: false,
      itens: 0,
      detalhe: { erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ erro: msg }, { status: 502 });
  }
}
