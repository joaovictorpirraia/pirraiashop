import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/**
 * Serve a foto de um produto por URL pública (proxy do CDN). É o que o Instagram
 * Graph API busca na hora de publicar.
 *
 * NOTA: a Meta exige JPEG e o CDN entrega webp. Enquanto o Instagram está parkado,
 * este endpoint só faz proxy (mantém o content-type original) — sem dependência
 * nativa (o `sharp` derrubava o build do EasyPanel). Quando for ligar a publicação
 * no feed, reintroduzir a conversão pra JPEG 1080x1080 aqui (sharp com binário
 * linux certo, ou um serviço externo de imagem).
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
    return new NextResponse(buf, {
      headers: {
        "content-type": resp.headers.get("content-type") ?? "image/jpeg",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new NextResponse(`falha ao servir criativo: ${(e as Error).message}`, { status: 500 });
  }
}
