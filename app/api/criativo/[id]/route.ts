import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/**
 * Serve a foto de um produto como JPEG 1080x1080 (fundo branco), por URL pública.
 * É o que o Instagram Graph API busca na hora de publicar (a API exige JPEG, e as
 * fotos do CDN vêm em webp). Também padroniza o criativo no quadrado do feed.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return new NextResponse("id inválido", { status: 400 });

  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("produtos")
    .select("imagem_url")
    .eq("id", id)
    .maybeSingle();

  const src = data?.imagem_url;
  if (!src) return new NextResponse("produto sem imagem", { status: 404 });

  try {
    const resp = await fetch(src, { cache: "no-store" });
    if (!resp.ok) return new NextResponse("imagem indisponível", { status: 502 });
    const buf = Buffer.from(await resp.arrayBuffer());

    const jpg = await sharp(buf)
      .resize(1080, 1080, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 88 })
      .toBuffer();

    return new NextResponse(jpg, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new NextResponse(`falha ao gerar criativo: ${(e as Error).message}`, { status: 500 });
  }
}
