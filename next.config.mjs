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
      // placeholder dos produtos falsos do seed — remover quando entrar catálogo real
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
