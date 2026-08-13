import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { processarVideoProduto } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Cron (opcional): processa os vídeos pendentes (raw subido pelo script, sem 4:5
 * ainda). Gera o 4:5 de até `?n=` por rodada. Protegido por CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const n = Math.min(Math.max(Number(request.nextUrl.searchParams.get("n")) || 8, 1), 15);
  const supabase = supabaseAdmin();
  let processados = 0;
  let erros = 0;
  try {
    const { data: pend } = await supabase
      .from("produtos")
      .select("id")
      .not("video_raw_em", "is", null)
      .is("video_url", null)
      .order("video_raw_em", { ascending: true })
      .limit(n);
    for (const p of pend ?? []) {
      try {
        await processarVideoProduto(supabase, p.id as number, `raw-${p.id}.mp4`);
        processados++;
      } catch {
        erros++;
      }
    }
    return NextResponse.json({ ok: true, processados, erros });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message });
  }
}
