import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ShopeeAffiliate } from "@/lib/shopee";
import { ingerirOfertas } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/**
 * Ingestão da Shopee: puxa ofertas da Open API, normaliza e faz upsert em `produtos`
 * (novas entram como 'novo' na fila de curadoria). Protegida por CRON_SECRET pra um
 * agendador externo chamar (EasyPanel cron, cron-job.org, etc.).
 *
 * Enquanto SHOPEE_APP_ID/SECRET não existirem, responde 503 — a lógica de gravação
 * (lib/ingest) já é testada à parte com dados mock.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key =
    request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const appId = process.env.SHOPEE_APP_ID;
  const shopeeSecret = process.env.SHOPEE_SECRET;
  if (!appId || !shopeeSecret) {
    // status 200 + ok:false: o EasyPanel mascara 5xx; assim a mensagem chega.
    return NextResponse.json({
      ok: false,
      erro: "SHOPEE_APP_ID/SECRET ausentes — Open API ainda não configurada",
    });
  }

  const inicio = Date.now();
  const supabase = supabaseAdmin();
  const shopee = new ShopeeAffiliate({ appId, secret: shopeeSecret });

  try {
    // pagina as ofertas com um teto pra não estourar tempo/quota
    const ofertas = [];
    const maxPaginas = 5;
    for (let page = 1; page <= maxPaginas; page++) {
      const pg = await shopee.buscarOfertas({ limit: 50, page });
      ofertas.push(...pg.nodes);
      if (!pg.hasNextPage) break;
    }

    const res = await ingerirOfertas(supabase, ofertas);

    await supabase.from("execucoes").insert({
      job: "ingest_shopee",
      ok: res.erros === 0,
      itens: res.gravadas,
      detalhe: res,
      duracao_ms: Date.now() - inicio,
    });

    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "ingest_shopee",
      ok: false,
      itens: 0,
      detalhe: { erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: false, erro: msg });
  }
}
