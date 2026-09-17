import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { gerarReelSlideshow } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * PRÉVIA do Reel-slideshow (SÓ pra ver como fica). Gera o vídeo 9:16 a partir dos
 * slides do carrossel {id} e redireciona pro mp4. NÃO posta no Instagram, NÃO liga
 * cron nenhum. Gate simples por ?key= (não faz nada sensível — só gera um preview).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== "pirraia-reel-preview") {
    return NextResponse.json({ ok: false, erro: "informe ?key=pirraia-reel-preview" }, { status: 401 });
  }
  const id = Number(params.id);
  if (!id) return NextResponse.json({ ok: false, erro: "carrossel inválido" }, { status: 400 });

  try {
    const url = await gerarReelSlideshow(supabaseAdmin(), id);
    return NextResponse.redirect(url, 302);
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message });
  }
}
