// CSP em Report-Only de propósito: só reporta violações, não bloqueia — assim não
// quebra o pixel do Meta nem o otimizador do next/image. Vira enforcing (header
// Content-Security-Policy) só depois de observar os reports e ajustar as fontes.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  // o snippet do pixel do Meta injeta script inline e carrega connect.facebook.net
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  // next/image (data:) + CDNs de produto + banners do Supabase Storage
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.facebook.com https://connect.facebook.net https://*.supabase.co",
  "frame-src https://www.facebook.com",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
