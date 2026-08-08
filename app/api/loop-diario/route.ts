import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { rodarLoopDiario } from "@/lib/loop";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 180;

/**
 * Loop diário (pra um agendador chamar 1x/dia): importa produtos Shopee do tema da
 * vez, monta o rascunho de carrossel com os melhores e faz a faxina dos expirados.
 * Fica como RASCUNHO — o dono revisa e publica (aí os produtos entram na vitrine).
 *
 * Protegida por CRON_SECRET. Gate em SHOPEE_APP_ID/SECRET (import) e OPENAI_API_KEY
 * (legenda). ?n= define quantos produtos (default 8, teto 9).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  if (!process.env.SHOPEE_APP_ID || !process.env.SHOPEE_SECRET) {
    return NextResponse.json({ ok: false, erro: "SHOPEE_APP_ID/SECRET ausentes no servidor" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, erro: "OPENAI_API_KEY ausente — legenda não configurada" });
  }

  const n = Math.min(Math.max(Number(request.nextUrl.searchParams.get("n")) || 12, 2), 12);
  // slot separa os 2 posts do dia (temas diferentes): ex. 0 = noite, 1 = madrugada
  const slot = Math.min(Math.max(Number(request.nextUrl.searchParams.get("slot")) || 0, 0), 1);
  const inicio = Date.now();
  const supabase = supabaseAdmin();

  try {
    const res = await rodarLoopDiario(supabase, n, undefined, slot);
    await supabase.from("execucoes").insert({
      job: "loop_diario",
      ok: true,
      itens: res.importados,
      detalhe: { origem: "cron", ...res },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "loop_diario",
      ok: false,
      itens: 0,
      detalhe: { origem: "cron", erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: false, erro: msg });
  }
}
