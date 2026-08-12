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
  // espera o container ficar pronto (senão o media_publish dá "Media ID is not available")
  await esperarPronto(creationId, token);
  const mediaId = await graphPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  return { id: mediaId };
}

/**
 * Publica um REEL (vídeo). A API busca o video_url, processa (demora mais que foto)
 * e publica; share_to_feed=true também joga no feed. Retorna o id da mídia.
 * EXPERIMENTAL: o vídeo cru do produto pode não bater as specs do IG (proporção,
 * mp4/h264) — se o container der ERROR, é isso.
 */
export async function publicarReel(opts: { videoUrl: string; caption: string }): Promise<{ id: string }> {
  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !token) {
    throw new Error("Instagram não configurado (IG_USER_ID / IG_ACCESS_TOKEN)");
  }
  const creationId = await graphPost(`${igUserId}/media`, {
    media_type: "REELS",
    video_url: opts.videoUrl,
    caption: opts.caption,
    share_to_feed: "true",
    access_token: token,
  });
  await esperarPronto(creationId, token, 28); // ~85s (cabe no timeout do proxy)
  const mediaId = await graphPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  return { id: mediaId };
}

/**
 * Espera um container de mídia ficar FINISHED antes de publicar. Se estourar o tempo
 * sem ficar pronto, LANÇA com o último status (melhor que o vago "Media ID is not
 * available" do media_publish). ~45s de teto — imagem costuma ficar pronta em segundos.
 */
async function esperarPronto(containerId: string, token: string, maxTentativas = 15): Promise<void> {
  await new Promise((r) => setTimeout(r, 2000)); // dá um respiro pro IG começar a processar
  let ultimo = "?";
  for (let i = 0; i < maxTentativas; i++) {
    const resp = await fetch(
      `${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`,
    );
    const json = (await resp.json().catch(() => ({}))) as { status_code?: string };
    ultimo = json.status_code ?? ultimo;
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") throw new Error("Instagram: o container da mídia deu ERROR (imagem rejeitada)");
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Instagram: container não ficou pronto a tempo (status: ${ultimo})`);
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

/**
 * Publica um CARROSSEL MISTO: capa (imagem) + vídeos dos produtos. Graph API:
 * 1. cria os containers filhos EM PARALELO (a capa como imagem, cada produto como
 *    VIDEO); 2. espera todos ficarem prontos em paralelo (vídeo processa mais que
 *    foto — o tempo total é o do vídeo mais lento, não a soma); 3. container CAROUSEL
 *    com a capa primeiro + legenda; 4. publica. Retorna o id da mídia.
 * O trabalho pode passar do timeout do proxy — por isso a action que chama grava o
 * status no banco, e o dono vê "publicado" ao atualizar mesmo se o request cair.
 */
export async function publicarCarrosselVideo(opts: {
  capaUrl: string;
  videoUrls: string[];
  caption: string;
}): Promise<{ id: string }> {
  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !token) {
    throw new Error("Instagram não configurado (IG_USER_ID / IG_ACCESS_TOKEN)");
  }
  if (opts.videoUrls.length < 1 || opts.videoUrls.length > 9) {
    throw new Error("carrossel de vídeo precisa de 1 a 9 vídeos (mais a capa)");
  }

  // 1. containers filhos, TODOS em paralelo: capa (imagem) + cada vídeo
  const [capaId, ...videoIds] = await Promise.all([
    graphPost(`${igUserId}/media`, {
      image_url: opts.capaUrl,
      is_carousel_item: "true",
      access_token: token,
    }),
    ...opts.videoUrls.map((v) =>
      graphPost(`${igUserId}/media`, {
        media_type: "VIDEO",
        video_url: v,
        is_carousel_item: "true",
        access_token: token,
      }),
    ),
  ]);

  // 2. espera todos ficarem FINISHED (em paralelo; vídeo é o gargalo)
  await Promise.all([capaId, ...videoIds].map((cid) => esperarPronto(cid, token, 40)));

  // 3. container do carrossel (capa é o 1º slide) e publica
  const carouselId = await graphPost(`${igUserId}/media`, {
    media_type: "CAROUSEL",
    children: [capaId, ...videoIds].join(","),
    caption: opts.caption,
    access_token: token,
  });
  await esperarPronto(carouselId, token, 20);
  const mediaId = await graphPost(`${igUserId}/media_publish`, {
    creation_id: carouselId,
    access_token: token,
  });
  return { id: mediaId };
}
