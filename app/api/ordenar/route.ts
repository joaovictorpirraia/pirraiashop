import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { reordenarVitrine } from "@/lib/ranking";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Reordena a vitrine por performance (cliques) + potencial (score_ia).
 * Não precisa de chave de IA — usa só dados que já existem. Protegida por
 * CRON_SECRET, pra um cron rodar de tempos em tempos.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key =
    request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const inicio = Date.now();
  const supabase = supabaseAdmin();
  try {
    const res = await reordenarVitrine(supabase);
    await supabase.from("execucoes").insert({
      job: "ordenar_vitrine",
      ok: true,
      itens: res.reordenados,
      detalhe: res,
      duracao_ms: Date.now() - inicio,
    });
    revalidatePath("/");
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "ordenar_vitrine",
      ok: false,
      itens: 0,
      detalhe: { erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ ok: false, erro: msg });
  }
}
