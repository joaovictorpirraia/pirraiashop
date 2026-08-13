import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { trocarCodigo, infoUsuario, salvarToken, tiktokConfigurado } from "@/lib/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Callback do OAuth do TikTok. O dono é mandado pra cá depois de autorizar. Valida o
 * state (anti-CSRF, casado com o cookie que a action de conectar setou), troca o code
 * por token, lê o perfil e guarda. Rota aberta, mas o state protege contra abuso.
 */
export async function GET(req: NextRequest) {
  const destino = (q: string) => NextResponse.redirect(new URL(`/admin/videos?${q}`, req.url));

  if (!tiktokConfigurado()) return destino("tiktok_erro=" + encodeURIComponent("TikTok não configurado no servidor"));

  const params = req.nextUrl.searchParams;
  const erro = params.get("error");
  if (erro) return destino("tiktok_erro=" + encodeURIComponent(params.get("error_description") || erro));

  const code = params.get("code");
  const state = params.get("state");
  const cookieState = cookies().get("tiktok_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return destino("tiktok_erro=" + encodeURIComponent("autorização inválida (state) — tenta conectar de novo"));
  }

  try {
    const token = await trocarCodigo(code);
    const perfil = await infoUsuario(token.access_token);
    await salvarToken(supabaseAdmin(), { ...token, open_id: perfil.open_id }, perfil.display_name);
    cookies().delete("tiktok_oauth_state");
    return destino("tiktok=conectado");
  } catch (e) {
    return destino("tiktok_erro=" + encodeURIComponent((e as Error).message));
  }
}
