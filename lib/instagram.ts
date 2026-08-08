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

/**
 * Publica uma foto no STORY (media_type=STORIES). Retorna o id da mídia. A API NÃO
 * deixa colocar sticker de link clicável no story automático (bloqueio da Meta) —
 * por isso a arte já traz "link na bio". image_url = JPEG público (o nosso Storage).
 */
export async function publicarStory(opts: { imageUrl: string }): Promise<{ id: string }> {
  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !token) {
    throw new Error("Instagram não configurado (IG_USER_ID / IG_ACCESS_TOKEN)");
  }
  const creationId = await graphPost(`${igUserId}/media`, {
    image_url: opts.imageUrl,
    media_type: "STORIES",
    access_token: token,
  });
  const mediaId = await graphPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  return { id: mediaId };
}

/** Espera um container ficar FINISHED antes de publicar (carrossel processa em passos). */
async function esperarPronto(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const resp = await fetch(
      `${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`,
    );
    const json = (await resp.json().catch(() => ({}))) as { status_code?: string };
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") throw new Error("Instagram: container do carrossel deu ERROR");
    await new Promise((r) => setTimeout(r, 2000));
  }
  // segue e tenta publicar; se não estiver pronto, o media_publish devolve o erro
}

/**
 * Publica um CARROSSEL no feed (2 a 10 imagens). Graph API em 3 passos:
 * 1. um container por imagem (is_carousel_item); 2. um container CAROUSEL com os
 * filhos + legenda; 3. publica (após o container ficar pronto). Retorna o id da mídia.
 */
export async function publicarCarrossel(opts: {
  imageUrls: string[];
  caption: string;
}): Promise<{ id: string }> {
  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !token) {
    throw new Error("Instagram não configurado (IG_USER_ID / IG_ACCESS_TOKEN)");
  }
  if (opts.imageUrls.length < 2 || opts.imageUrls.length > 10) {
    throw new Error("carrossel precisa de 2 a 10 imagens");
  }

  // 1. container por imagem
  const childIds: string[] = [];
  for (const url of opts.imageUrls) {
    const cid = await graphPost(`${igUserId}/media`, {
      image_url: url,
      is_carousel_item: "true",
      access_token: token,
    });
    childIds.push(cid);
  }

  // 2. container do carrossel
  const carouselId = await graphPost(`${igUserId}/media`, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: opts.caption,
    access_token: token,
  });

  // 3. espera ficar pronto e publica
  await esperarPronto(carouselId, token);
  const mediaId = await graphPost(`${igUserId}/media_publish`, {
    creation_id: carouselId,
    access_token: token,
  });
  return { id: mediaId };
}
