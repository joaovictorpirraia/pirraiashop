import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AliexpressAfiliado } from "@/lib/aliexpress";
import { ingerirItensAli } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/**
 * Ingestão da AliExpress: busca produtos por palavra-chave (API de afiliado),
 * normaliza e faz upsert em `produtos` (novos entram como 'novo' na fila). Com
 * ALIEXPRESS_TRACKING_ID definido, cada item já vem com o link de afiliado
 * (promotion_link) pré-preenchido — não precisa de passo manual.
 *
 * Protegida por CRON_SECRET (agendador externo). Gate de credencial: sem
 * ALIEXPRESS_APP_KEY/SECRET responde ok:false com a mensagem.
 *
 * Requer a migration 008_aliexpress.sql aplicada (senão o check de origem rejeita).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key =
    request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  if (!appKey || !appSecret) {
    return NextResponse.json({
      ok: false,
      erro: "ALIEXPRESS_APP_KEY/ALIEXPRESS_APP_SECRET ausentes no servidor",
    });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) {
    // status 200 + ok:false: o EasyPanel mascara 5xx; assim a mensagem chega.
    return NextResponse.json({ ok: false, erro: "faltou ?q= (palavra-chave da busca)" });
  }
  const limite = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 50);

  const inicio = Date.now();
  const supabase = supabaseAdmin();

  try {
    const ali = new AliexpressAfiliado({
      appKey,
      appSecret,
      trackingId: process.env.ALIEXPRESS_TRACKING_ID,
    });
    const itens = await ali.buscarProdutos({ keywords: q, pageSize: limite });
    const res = await ingerirItensAli(supabase, itens);

    await supabase.from("execucoes").insert({
      job: "ingest_aliexpress",
      ok: res.erros === 0,
      itens: res.gravadas,
      detalhe: { q, ...res },
      duracao_ms: Date.now() - inicio,
    });

    return NextResponse.json({ ok: res.erros === 0, q, ...res });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "ingest_aliexpress",
      ok: false,
      itens: 0,
      detalhe: { q, erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: false, erro: msg });
  }
}
