"use server";

import JSZip from "jszip";

/**
 * Baixa as mídias de um produto (URLs coletadas pelo bookmarklet na página da
 * Shopee) e devolve um .zip em base64 pro cliente salvar. Só busca do CDN da
 * Shopee (susercontent.com) — allowlist de host pra o servidor não virar proxy
 * de URL arbitrária. O CDN de imagem não é bloqueado (ao contrário da API).
 */
const HOST_OK = /(^|\.)susercontent\.com$/i;

function extDe(ct: string): string {
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("mp4")) return "mp4";
  const g = ct.split("/")[1]?.split(";")[0]?.trim();
  return g || "bin";
}

export async function baixarMidia(
  urls: string[],
  nome: string,
): Promise<{ ok: boolean; zipBase64?: string; arquivo?: string; total?: number; erro?: string }> {
  const lista = (Array.isArray(urls) ? urls : [])
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter(Boolean)
    .filter((u) => {
      try {
        return HOST_OK.test(new URL(u).hostname);
      } catch {
        return false;
      }
    });
  if (lista.length === 0) return { ok: false, erro: "Nenhuma mídia válida da Shopee." };

  // busca tudo em paralelo; ignora o que falhar ou não for imagem/vídeo (ex.: m3u8)
  const baixados = await Promise.all(
    lista.map(async (u, idx) => {
      try {
        const resp = await fetch(u, { cache: "no-store" });
        if (!resp.ok) return null;
        const ct = resp.headers.get("content-type") || "";
        if (!/^image\/|^video\//.test(ct)) return null;
        const buf = Buffer.from(await resp.arrayBuffer());
        if (buf.length === 0) return null;
        return { idx, ct, buf };
      } catch {
        return null;
      }
    }),
  );

  const validos = baixados.filter(
    (x): x is { idx: number; ct: string; buf: Buffer } => x !== null,
  );
  if (validos.length === 0) return { ok: false, erro: "Não consegui baixar nenhuma mídia." };
  validos.sort((a, b) => a.idx - b.idx);

  const zip = new JSZip();
  let foto = 0;
  let video = 0;
  for (const r of validos) {
    const ext = extDe(r.ct);
    const arq = r.ct.startsWith("video")
      ? `video-${String(++video).padStart(2, "0")}.${ext}`
      : `foto-${String(++foto).padStart(2, "0")}.${ext}`;
    zip.file(arq, r.buf);
  }

  const zipBase64 = await zip.generateAsync({ type: "base64" });
  const slug =
    (nome || "pirraia")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "produto";

  return { ok: true, zipBase64, arquivo: `${slug}.zip`, total: validos.length };
}
