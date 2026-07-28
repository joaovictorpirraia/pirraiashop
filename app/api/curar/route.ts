import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { pontuarPendentes } from "@/lib/curadoria";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 120;

/**
 * Curadoria por IA: pega produtos 'novo' ainda sem score, pontua com o modelo
 * e grava score_ia/angulo_ia/tags_ia. Não muda status (publicar exige o link de
 * afiliado, que é manual) — só faz a fila do /admin priorizar os melhores.
 *
 * Protegida por CRON_SECRET (mesmo esquema da ingestão). Responde 503 até
 * OPENAI_API_KEY existir. A lógica de parsing + gravação é testada à parte.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key =
    request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    // status 200 + ok:false: o proxy do EasyPanel mascara 5xx com a página dele,
    // então erros vão como 200 pra o corpo (a mensagem real) chegar ao chamador.
    return NextResponse.json({
      ok: false,
      erro: "OPENAI_API_KEY ausente — curadoria por IA não configurada",
    });
  }

  // alvo=vitrine pontua os curado/publicado (manuais); default = fila 'novo'
  const statuses =
    request.nextUrl.searchParams.get("alvo") === "vitrine"
      ? ["curado", "publicado"]
      : ["novo"];

  const inicio = Date.now();
  const supabase = supabaseAdmin();

  try {
    const res = await pontuarPendentes(supabase, statuses);

    await supabase.from("execucoes").insert({
      job: "curadoria_ia",
      ok: true,
      itens: res.gravados,
      detalhe: res,
      duracao_ms: Date.now() - inicio,
    });

    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "curadoria_ia",
      ok: false,
      itens: 0,
      detalhe: { erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: false, erro: msg });
  }
}
