export type Loja = "shopee" | "aliexpress" | "mercadolivre" | "tiktok" | "whatsapp";

/** Deriva a loja de destino a partir do short_url do link (espelha a view vitrine). */
export function lojaDeUrl(shortUrl: string | null | undefined): Loja {
  const u = (shortUrl ?? "").toLowerCase();
  if (u.includes("tiktok")) return "tiktok";
  if (u.includes("aliexpress")) return "aliexpress";
  if (u.includes("mercadolivre") || u.includes("mercadolibre") || u.includes("/sec/")) return "mercadolivre";
  if (u.includes("wa.me") || u.includes("whatsapp")) return "whatsapp";
  return "shopee";
}
