import { credsPirraia3d } from "./instagram";
import { INSTA_URL } from "./contato3d";

const GRAPH = "https://graph.facebook.com/v21.0";

export type MidiaIG = {
  id: string;
  permalink: string;
  thumb: string; // URL da imagem/thumbnail
  legenda: string;
};

/**
 * Últimas mídias do @pirraia3d via Graph API (conta própria, mesmo token dos stories).
 * Retorna [] se não configurado ou em erro — o componente cai no fallback (grade +
 * link-out), então nunca quebra a página. Cacheado ~1h pra não bater na API a cada hit.
 */
export async function ultimasMidias3D(limite = 6): Promise<MidiaIG[]> {
  const creds = credsPirraia3d();
  if (!creds) return [];
  const campos = "id,media_type,media_url,thumbnail_url,permalink,caption";
  const url = `${GRAPH}/${creds.igUserId}/media?fields=${campos}&limit=${limite}&access_token=${encodeURIComponent(creds.token)}`;
  try {
    const resp = await fetch(url, { next: { revalidate: 3600 } });
    if (!resp.ok) return [];
    const json = (await resp.json()) as {
      data?: Array<{
        id: string;
        media_type?: string;
        media_url?: string;
        thumbnail_url?: string;
        permalink?: string;
        caption?: string;
      }>;
    };
    return (json.data ?? [])
      .map((m) => ({
        id: m.id,
        permalink: m.permalink ?? INSTA_URL,
        // vídeo usa thumbnail_url; imagem/álbum usam media_url
        thumb: (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) ?? m.thumbnail_url ?? m.media_url ?? "",
        legenda: m.caption ?? "",
      }))
      .filter((m) => m.thumb);
  } catch {
    return [];
  }
}
