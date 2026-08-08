import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { montarRascunhoAuto } from "@/lib/carrossel";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 120;

/**
 * Monta o rascunho de carrossel "achados do dia" AUTOMÁTICO (pra um agendador
 * externo chamar 1x/dia). A IA escolhe os produtos (temático, sem repetir os
 * postados nos últimos 14 dias) + capa + legenda. Fica como rascunho — o dono
 * revisa e publica (nada vai ao ar sozinho).
 *
 * Protegida por CRON_SECRET. Gate em OPENAI_API_KEY (a legenda é da IA).
 * ?n= define quantos produtos (default 8, teto 9 pela regra do carrossel).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, erro: "OPENAI_API_KEY ausente — legenda não configurada" });
  }

  const n = Math.min(Math.max(Number(request.nextUrl.searchParams.get("n")) || 12, 2), 12);
  const inicio = Date.now();
  const supabase = supabaseAdmin();

  try {
    const res = await montarRascunhoAuto(supabase, n);
    await supabase.from("execucoes").insert({
      job: "montar_carrossel_auto",
      ok: true,
      itens: res.n,
      detalhe: { origem: "cron", ...res },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "montar_carrossel_auto",
      ok: false,
      itens: 0,
      detalhe: { origem: "cron", erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: false, erro: msg });
  }
}
