import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// robôs de prévia/scan — não contam como visita
const BOT = /bot|crawler|spider|whatsapp|facebookexternalhit|preview|headless|monitor/i;

/**
 * Registra uma visita à home. Chamada pelo beacon do navegador (VisitaTracker),
 * então robôs (que não rodam JS) já não caem aqui; mesmo assim filtra UA de bot.
 * utm_source/medium e o referrer vêm do cliente (query). Insere via service role.
 */
export async function POST(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  if (BOT.test(ua)) return new NextResponse(null, { status: 204 });

  const p = request.nextUrl.searchParams;
  try {
    await supabaseAdmin().from("visitas").insert({
      visitante_id: p.get("vid")?.slice(0, 60) || null,
      referer: p.get("ref")?.slice(0, 300) || null,
      utm_source: p.get("utm_source")?.slice(0, 120) || null,
      utm_medium: p.get("utm_medium")?.slice(0, 120) || null,
    });
  } catch {
    /* contador é best-effort: nunca quebra a página */
  }
  return new NextResponse(null, { status: 204 });
}
