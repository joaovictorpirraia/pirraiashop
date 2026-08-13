import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { atualizarPrecosShopee } from "@/lib/precos";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 180;

/**
 * Cron (opcional): verifica e atualiza preços dos produtos Shopee da vitrine pela API
 * de afiliado. Processa os `?n=` mais antigos (default 40). Um cron diário mantém a
 * vitrine com preço em dia sozinho. Protegido por CRON_SECRET (header x-cron-key).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const n = Math.min(Math.max(Number(request.nextUrl.searchParams.get("n")) || 40, 1), 80);
  const inicio = Date.now();
  const supabase = supabaseAdmin();
  try {
    const res = await atualizarPrecosShopee(supabase, n);
    await supabase.from("execucoes").insert({
      job: "precos_shopee",
      ok: true,
      itens: res.atualizados,
      detalhe: { origem: "cron", ...res, mudancas: res.mudancas.slice(0, 30) },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: true, ...res, mudancas: res.mudancas.slice(0, 30) });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "precos_shopee",
      ok: false,
      itens: 0,
      detalhe: { origem: "cron", erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: false, erro: msg });
  }
}
