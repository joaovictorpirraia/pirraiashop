import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicNoCache } from "@/lib/supabase";
import { enviarLeadCapi } from "@/lib/meta-capi";

// Nunca cachear: cada acesso é um clique real que precisa ser contado.
// force-dynamic sozinho não bastou — o Next deduplicava o POST da RPC por
// corpo idêntico (mesmo slug/UTM) e perdia cliques. fetchCache force-no-store
// desliga o cache de fetch do segmento; o client também manda cache:no-store.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Redirect rastreado: /r/[slug]
 *
 * 1. chama a RPC registrar_clique (insere o clique + incrementa o contador, atômico)
 * 2. 302 pro short_url de afiliado que a RPC devolve
 * 3. slug inexistente/inativo → RPC devolve null → manda pra home
 *
 * Rápido de propósito: sem render, sem layout. A RPC é security definer,
 * então o client anon consegue executá-la sem service role.
 *
 * Dispara o Lead via CAPI (server-side) antes do 302 — num redirect sem render
 * o pixel client-side não roda. É fire-and-forget pra não atrasar o clique;
 * no Node persistente do EasyPanel a chamada completa depois do redirect.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const home = new URL("/", request.url);
  const { slug } = params;

  if (!slug) {
    return NextResponse.redirect(home, 302);
  }

  const url = request.nextUrl;
  const supabase = supabasePublicNoCache();

  const { data: shortUrl, error } = await supabase.rpc("registrar_clique", {
    p_slug: slug,
    p_referer: request.headers.get("referer"),
    p_user_agent: request.headers.get("user-agent"),
    p_utm_source: url.searchParams.get("utm_source"),
    p_utm_medium: url.searchParams.get("utm_medium"),
  });

  if (error) {
    // Falha aberta: não deixa o visitante num 500, joga pra home.
    console.error(`[r/${slug}] registrar_clique falhou:`, error.message);
    return NextResponse.redirect(home, 302);
  }

  if (!shortUrl) {
    // slug não existe ou link inativo
    return NextResponse.redirect(home, 302);
  }

  // Lead server-side (no-op se não houver Pixel ID + token da CAPI no env).
  void enviarLeadCapi({
    eventSourceUrl: url.href,
    clientIp:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
    fbp: request.cookies.get("_fbp")?.value ?? null,
    fbc: request.cookies.get("_fbc")?.value ?? null,
  });

  return NextResponse.redirect(shortUrl as string, 302);
}
