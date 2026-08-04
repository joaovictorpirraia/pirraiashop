/**
 * Publicação no feed do Instagram via Graph API (Content Publishing).
 *
 * Fluxo em 2 passos: cria um container de mídia (image_url + caption) e depois
 * publica. Gated em IG_USER_ID + IG_ACCESS_TOKEN — sem isso, o admin nem mostra
 * o botão. Precisa de conta IG Business ligada a uma Página + app com a permissão
 * `instagram_content_publish` (App Review da Meta).
 *
 * Requisitos da imagem: JPEG, por URL pública — por isso passamos a URL do nosso
 * /api/criativo/[id], que converte a foto do produto pra JPEG.
 *
 * O token: use um token de System User (Business Manager) que não expira; um
 * long-lived normal vence em ~60 dias e precisa renovar.
 */
const GRAPH = "https://graph.facebook.com/v21.0";

export function instagramConfigurado(): boolean {
  return Boolean(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN);
}

async function graphPost(path: string, params: Record<string, string>) {
  const resp = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = (await resp.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!resp.ok || !json.id) {
    throw new Error(json.error?.message || `Graph API HTTP ${resp.status}`);
  }
  return json.id;
}

/** Publica uma foto no feed. Retorna o id da mídia publicada. */
export async function publicarFotoFeed(opts: {
  imageUrl: string;
  caption: string;
}): Promise<{ id: string }> {
  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !token) {
    throw new Error("Instagram não configurado (IG_USER_ID / IG_ACCESS_TOKEN)");
  }

  // 1. container de mídia
  const creationId = await graphPost(`${igUserId}/media`, {
    image_url: opts.imageUrl,
    caption: opts.caption,
    access_token: token,
  });

  // 2. publica o container (foto processa na hora; sem polling)
  const mediaId = await graphPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });

  return { id: mediaId };
}
