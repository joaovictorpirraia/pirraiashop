import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente do TikTok Content Posting API — fluxo de RASCUNHO (Upload/inbox).
 *
 * O dono conecta a própria conta (OAuth, scopes user.info.basic + video.upload).
 * A gente manda o vídeo pro INBOX dele (/v2/post/publish/inbox/video/init/, FILE_UPLOAD):
 * o vídeo cai como rascunho no app do TikTok e o dono finaliza/publica na mão. Isso NÃO
 * precisa da auditoria de conteúdo (a restrição SELF_ONLY vale pro post-direto por API).
 *
 * Gated em TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET.
 */

const AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";
const API = "https://open.tiktokapis.com/v2";
const SCOPES = "user.info.basic,video.upload";

export function tiktokConfigurado(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://pirraiashop.com.br";
  return `${base}/api/tiktok/callback`;
}

/** URL pra onde mandar o dono autorizar. `state` é o anti-CSRF (validado no callback). */
export function urlAutorizacao(state: string): string {
  const p = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
    scope: SCOPES,
    response_type: "code",
    redirect_uri: redirectUri(),
    state,
  });
  return `${AUTH_BASE}?${p.toString()}`;
}

interface TokenResp {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  open_id: string;
  scope: string;
}

async function pedirToken(params: Record<string, string>): Promise<TokenResp> {
  const resp = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
      ...params,
    }),
  });
  const json = (await resp.json().catch(() => ({}))) as TokenResp & { error?: string; error_description?: string };
  if (json.error || !json.access_token) {
    throw new Error(`TikTok OAuth: ${json.error_description || json.error || `HTTP ${resp.status}`}`);
  }
  return json;
}

/** Troca o code do callback por access/refresh token. */
export function trocarCodigo(code: string): Promise<TokenResp> {
  return pedirToken({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
}

/** Renova o access token pelo refresh token. */
export function renovarToken(refreshToken: string): Promise<TokenResp> {
  return pedirToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/** Lê o perfil básico (pra mostrar qual conta está conectada). */
export async function infoUsuario(accessToken: string): Promise<{ open_id: string; display_name: string }> {
  const resp = await fetch(`${API}/user/info/?fields=open_id,display_name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await resp.json().catch(() => ({}))) as { data?: { user?: { open_id: string; display_name: string } } };
  const u = json?.data?.user;
  if (!u?.open_id) throw new Error("TikTok: não consegui ler o perfil da conta");
  return { open_id: u.open_id, display_name: u.display_name ?? "" };
}

/** Salva/atualiza o token no banco (upsert por open_id). */
export async function salvarToken(supabase: SupabaseClient, t: TokenResp, displayName: string): Promise<void> {
  const agora = Date.now();
  await supabase.from("tiktok_auth").upsert(
    {
      open_id: t.open_id,
      display_name: displayName,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expira_em: new Date(agora + t.expires_in * 1000).toISOString(),
      refresh_expira_em: new Date(agora + t.refresh_expires_in * 1000).toISOString(),
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "open_id" },
  );
}

/** Conta conectada (ou null). Sem expor token — só pra UI. */
export async function contaConectada(supabase: SupabaseClient): Promise<{ display_name: string } | null> {
  const { data } = await supabase
    .from("tiktok_auth")
    .select("display_name")
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { display_name: (data.display_name as string) || "conta TikTok" } : null;
}

/** Devolve um access token válido (renova se estiver perto de vencer). null se não conectado. */
export async function accessTokenValido(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("tiktok_auth")
    .select("*")
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const venceEm = new Date(data.expira_em as string).getTime();
  if (venceEm - Date.now() > 120_000) return data.access_token as string; // ainda válido (> 2 min)

  // renova
  const t = await renovarToken(data.refresh_token as string);
  await salvarToken(supabase, t, (data.display_name as string) || "");
  return t.access_token;
}

/**
 * Manda o vídeo pro INBOX (rascunho) da conta conectada. FILE_UPLOAD em 1 chunk
 * (nossos vídeos são pequenos). Retorna o publish_id. O dono finaliza no app.
 */
export async function enviarInbox(accessToken: string, videoBytes: Buffer): Promise<string> {
  const size = videoBytes.length;

  const initResp = await fetch(`${API}/post/publish/inbox/video/init/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 },
    }),
  });
  const initJson = (await initResp.json().catch(() => ({}))) as {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  };
  if (initJson.error && initJson.error.code && initJson.error.code !== "ok") {
    throw new Error(`TikTok init: ${initJson.error.message || initJson.error.code}`);
  }
  const uploadUrl = initJson.data?.upload_url;
  const publishId = initJson.data?.publish_id;
  if (!uploadUrl || !publishId) throw new Error("TikTok: init não devolveu upload_url");

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": "video/mp4",
      "content-length": String(size),
      "content-range": `bytes 0-${size - 1}/${size}`,
    },
    body: videoBytes,
  });
  if (!put.ok) throw new Error(`TikTok: upload do vídeo falhou (HTTP ${put.status})`);

  return publishId;
}
