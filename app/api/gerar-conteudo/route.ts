import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { gerarRascunhosPendentes, type Canal } from "@/lib/conteudo";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 300;

const CANAIS: Canal[] = ["instagram_feed", "instagram_story", "tiktok", "whatsapp"];

/**
 * Gera rascunhos de conteúdo (legenda/hashtags/roteiro) para produtos curados
 * que ainda não têm rascunho. Grava em posts como 'rascunho' — o admin aprova
 * antes de usar. Protegida por CRON_SECRET; 503 até OPENAI_API_KEY existir.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key =
    request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  if (!process.env.OPENAI_API_KEY) {
    // status 200 + ok:false: o EasyPanel mascara 5xx; assim a mensagem chega.
    return NextResponse.json({
      ok: false,
      erro: "OPENAI_API_KEY ausente — geração de conteúdo não configurada",
    });
  }

  const canalParam = request.nextUrl.searchParams.get("canal") as Canal | null;
  const canal: Canal = canalParam && CANAIS.includes(canalParam) ? canalParam : "instagram_feed";

  const inicio = Date.now();
  const supabase = supabaseAdmin();

  try {
    const res = await gerarRascunhosPendentes(supabase, canal);
    await supabase.from("execucoes").insert({
      job: "gerar_conteudo",
      ok: true,
      itens: res.gerados,
      detalhe: res,
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "gerar_conteudo",
      ok: false,
      itens: 0,
      detalhe: { erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: false, erro: msg });
  }
}
