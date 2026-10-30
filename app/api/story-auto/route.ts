import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { postarStoryAuto, type Conta } from "@/lib/stories";
import { instagramConfigurado, credsPirraia3d } from "@/lib/instagram";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 120;

/**
 * Dispara story(s) automático(s) — pra um agendador chamar em cada horário. Seleciona
 * produto (vitrine curada > fila fresca, sem repetir os últimos 2 dias), gera a arte
 * 9:16 e publica no story. ?qtd= define quantos por chamada (default 1, teto 4).
 *
 * Protegida por CRON_SECRET. Gate em IG_USER_ID/IG_ACCESS_TOKEN.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const conta: Conta = request.nextUrl.searchParams.get("conta") === "3d" ? "3d" : "afiliado";
  if (conta === "3d" && !credsPirraia3d()) {
    return NextResponse.json({ ok: false, erro: "Instagram 3D não configurado (IG_USER_ID_3D/IG_ACCESS_TOKEN_3D)" });
  }
  if (conta === "afiliado" && !instagramConfigurado()) {
    return NextResponse.json({ ok: false, erro: "Instagram não configurado (IG_USER_ID/IG_ACCESS_TOKEN)" });
  }

  const qtd = Math.min(Math.max(Number(request.nextUrl.searchParams.get("qtd")) || 1, 1), 4);
  const inicio = Date.now();
  const supabase = supabaseAdmin();

  try {
    const res = await postarStoryAuto(supabase, qtd, conta);
    await supabase.from("execucoes").insert({
      job: "story_auto",
      ok: res.erros === 0,
      itens: res.postados,
      detalhe: { origem: "cron", conta, ...res },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: res.erros === 0, conta, ...res });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "story_auto",
      ok: false,
      itens: 0,
      detalhe: { origem: "cron", conta, erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: false, erro: msg });
  }
}
