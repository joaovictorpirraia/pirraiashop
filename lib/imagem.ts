/**
 * Imagens de produto pro Satori (next/og). Dois problemas que isso resolve:
 *  1. O Satori NÃO embute webp.
 *  2. Alguns CDNs (AliExpress) devolvem webp por negociação de conteúdo mesmo na
 *     URL ".jpg" — e o fetch interno do Satori manda Accept com webp, então recebe
 *     webp e a foto fica em branco.
 *
 * Solução: a gente busca a imagem no servidor pedindo `Accept: image/jpeg,image/png`
 * (sem webp) e embute como data URI base64. O Satori embute o data URI direto, sem o
 * fetch interno dele. Shopee/ML já vêm JPEG via jpegDe; AliExpress passa a vir JPEG/PNG.
 */

/** Reescreve a URL pra a variante JPEG/PNG conhecida (Shopee/ML/MakerWorld). */
export function jpegDe(url: string): string {
  if (/mlstatic\.com/i.test(url)) return url.replace(/\.webp(\?.*)?$/i, ".jpg");
  if (/susercontent\.com/i.test(url)) {
    if (/\/file\//.test(url)) return url.replace(/\.webp$/i, "");
    return url.replace(/susercontent\.com\//i, "susercontent.com/file/").replace(/\.webp$/i, "");
  }
  // MakerWorld (bblmw.com): o OSS da Alibaba devolve webp SEMPRE, ignorando o Accept —
  // e o Satori não decodifica webp (foto some no criativo 3D). Força /format,png (jpg o
  // OSS ignora). Mantém o resize e põe o format antes do /ignore-error.
  if (/bblmw\.com/i.test(url)) {
    try {
      const u = new URL(url);
      let proc = (u.searchParams.get("x-oss-process") || "image").replace(/\/format,[a-z0-9]+/gi, "");
      proc = /\/ignore-error/i.test(proc)
        ? proc.replace(/\/ignore-error[^/]*/i, (m) => `/format,png${m}`)
        : `${proc}/format,png`;
      u.searchParams.set("x-oss-process", proc);
      return u.toString();
    } catch {
      return url;
    }
  }
  return url;
}

/** Busca a imagem (Accept sem webp) e devolve data URI. Fallback: a URL normalizada. */
export async function imgDataUri(url?: string | null): Promise<string> {
  if (!url) return "";
  const alvo = jpegDe(url);
  try {
    const resp = await fetch(alvo, {
      headers: {
        accept: "image/jpeg,image/png",
        "user-agent": "Mozilla/5.0 (compatible; pirraiashop/1.0)",
      },
      redirect: "follow",
    });
    if (!resp.ok) return alvo;
    const ct = resp.headers.get("content-type") || "image/jpeg";
    if (/webp/i.test(ct)) return alvo; // não deu pra evitar webp — deixa a URL (raro)
    const buf = Buffer.from(await resp.arrayBuffer());
    return `data:${/^image\//.test(ct) ? ct : "image/jpeg"};base64,${buf.toString("base64")}`;
  } catch {
    return alvo;
  }
}
