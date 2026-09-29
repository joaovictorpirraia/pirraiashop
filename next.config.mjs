/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // CDN da Shopee (produção)
      { protocol: "https", hostname: "cf.shopee.com.br" },
      { protocol: "https", hostname: "down-br.img.susercontent.com" },
      { protocol: "https", hostname: "**.susercontent.com" },
      // CDN do Mercado Livre
      { protocol: "https", hostname: "**.mlstatic.com" },
      // CDN da AliExpress
      { protocol: "https", hostname: "**.alicdn.com" },
      { protocol: "https", hostname: "**.aliexpress-media.com" },
      // MakerWorld (capa og dos modelos 3D — via bookmarklet)
      { protocol: "https", hostname: "makerworld.bblmw.com" },
      { protocol: "https", hostname: "**.bblmw.com" },
      // Supabase Storage (fotos dos produtos 3D enviadas do PC, bucket criativos)
      { protocol: "https", hostname: "wxrmjkxiuflvbqspauao.supabase.co" },
      // placeholder dos produtos falsos do seed — remover quando entrar catálogo real
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
