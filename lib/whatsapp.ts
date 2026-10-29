/**
 * Acrescenta " Cor: {label}." ao parâmetro text de uma URL wa.me.
 * Usado no /r/[slug] quando o visitante escolheu uma cor na página do produto.
 * No-op se não houver cor, se a URL não for wa.me, ou se já tiver "Cor:".
 */
export function anexarCor(shortUrl: string, corLabel: string | null | undefined): string {
  if (!corLabel) return shortUrl;
  let u: URL;
  try {
    u = new URL(shortUrl);
  } catch {
    return shortUrl;
  }
  if (!u.hostname.includes("wa.me")) return shortUrl;
  const texto = u.searchParams.get("text") ?? "";
  if (texto.includes("Cor:")) return shortUrl;
  u.searchParams.set("text", `${texto} Cor: ${corLabel}.`.trim());
  return u.toString();
}
