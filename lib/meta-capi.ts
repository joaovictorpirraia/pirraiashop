const API_VERSION = "v21.0";

/**
 * Envia um evento Lead pela Conversions API (server-side).
 *
 * No-op se faltar o Pixel ID ou o token (CAPI é opcional na fase 1).
 * Best-effort: timeout curto e nunca lança — o redirect não pode travar
 * nem quebrar por causa disto.
 *
 * Sem dedup com o pixel do browser porque no redirect (302) não há render,
 * então o Lead só existe pela CAPI — não há evento de browser pra duplicar.
 */
export async function enviarLeadCapi(opts: {
  eventSourceUrl: string;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return;

  const userData: Record<string, string> = {};
  if (opts.clientIp) userData.client_ip_address = opts.clientIp;
  if (opts.userAgent) userData.client_user_agent = opts.userAgent;
  if (opts.fbp) userData.fbp = opts.fbp;
  if (opts.fbc) userData.fbc = opts.fbc;

  const body = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: opts.eventSourceUrl,
        user_data: userData,
      },
    ],
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1500);
  try {
    const resp = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
        cache: "no-store",
      },
    );
    if (!resp.ok) {
      console.error(`[capi] Lead HTTP ${resp.status}:`, await resp.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[capi] Lead falhou:", (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
