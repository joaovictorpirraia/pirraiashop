import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";

export const { fontFamily: POPPINS } = loadPoppins();

export const CORES = {
  marca: "#E5126A",
  marcaEscura: "#C20E5A",
  marcaTint: "#FCE3EE",
  tinta: "#1B1512",
  areia: "#FBF9F8",
  fumo: "#8B827C",
  branco: "#FFFFFF",
};

/** Cor do badge de cada loja (combina com os botões da vitrine). */
export const COR_LOJA: Record<string, string> = {
  shopee: "#EE4D2D",
  aliexpress: "#E62E04",
  mercadolivre: "#FFE600",
  tiktok: "#000000",
  whatsapp: "#25D366",
};

export const ROTULO_LOJA: Record<string, string> = {
  shopee: "Ver na Shopee",
  aliexpress: "Ver na AliExpress",
  mercadolivre: "Ver no Mercado Livre",
  tiktok: "Ver no TikTok",
  whatsapp: "Comprar no WhatsApp",
};

export const FPS = 30;

/** Marcos em frames (10s @30fps = 300). Ajustáveis no Studio. */
export const T = {
  introIn: 0,
  introOut: 36,
  fotoIn: 24,
  tituloIn: 48,
  precoIn: 150,
  seloIn: 165,
  ctaIn: 240,
  fim: 300,
};

/** Zonas seguras do Reel/TikTok (px no canvas 1080×1920). */
export const SAFE = { topo: 120, base: 320, lateral: 60 };
