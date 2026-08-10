import { NextResponse, type NextRequest } from "next/server";
import { AliexpressAfiliado } from "@/lib/aliexpress";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * DEBUG (temporário): devolve a resposta CRUA do productdetail.get da AliExpress
 * pra um product id — pra inspecionar quais campos vêm (ex.: se tem vídeo).
 * GET /api/debug-ali?key=CRON_SECRET&id=1005012618418772
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "faltou ?id=<productId>" });

  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  if (!appKey || !appSecret) return NextResponse.json({ erro: "ALIEXPRESS_APP_KEY/SECRET ausentes" });

  try {
    const ali = new AliexpressAfiliado({ appKey, appSecret, trackingId: process.env.ALIEXPRESS_TRACKING_ID });
    const raw = await ali.detalharRaw([id]);
    // devolve as CHAVES do 1º produto + o objeto inteiro (pra achar o campo de vídeo)
    const produtos = (raw as { products?: { product?: unknown[] } })?.products?.product ?? raw;
    const primeiro = Array.isArray(produtos) ? produtos[0] : produtos;
    const chaves = primeiro && typeof primeiro === "object" ? Object.keys(primeiro) : [];
    return NextResponse.json({ ok: true, chaves, primeiro });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message });
  }
}
