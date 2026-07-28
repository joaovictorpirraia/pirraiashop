import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buscarItens } from "@/lib/mercadolivre";
import { ingerirItensML } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/**
 * Ingestão do Mercado Livre: busca itens públicos por palavra-chave, normaliza e
 * faz upsert em `produtos` (novos entram como 'novo' na fila de curadoria). O link
 * de afiliado entra manual no /admin — o ML não expõe API pública de shortlink.
 *
 * Protegida por CRON_SECRET, pra um agendador externo chamar. A busca do ML é
 * pública (sem OAuth), então não há gate de credencial aqui — só o segredo do cron.
 *
 * Requer a migration 002_mercadolivre.sql aplicada (senão o check de origem
 * rejeita e volta em erros>0 com a mensagem do banco).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key =
    request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
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
    const itens = await buscarItens({ q, limit: limite });
    const res = await ingerirItensML(supabase, itens);

    await supabase.from("execucoes").insert({
      job: "ingest_ml",
      ok: res.erros === 0,
      itens: res.gravadas,
      detalhe: { q, ...res },
      duracao_ms: Date.now() - inicio,
    });

    return NextResponse.json({ ok: res.erros === 0, q, ...res });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "ingest_ml",
      ok: false,
      itens: 0,
      detalhe: { q, erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: false, erro: msg });
  }
}
