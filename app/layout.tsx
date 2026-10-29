import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fredoka } from "next/font/google";
import "./globals.css";
import { MetaPixel } from "@/components/MetaPixel";

// Fonte arredondada da loja 3D, exposta como CSS var (--font-fredoka).
// Só é aplicada nos títulos/logo da loja 3D via classe `font-display`; o
// corpo do app continua com a fonte padrão.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pirraia — achadinhos",
  description: "Os achadinhos garimpados da @pirraiashop.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O middleware marca a área de admin; lá não disparamos o pixel de conversão.
  const noAdmin = headers().get("x-pirraia-area") === "admin";

  return (
    <html lang="pt-BR" className={fredoka.variable}>
      <body>
        {!noAdmin && <MetaPixel pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} />}
        {children}
      </body>
    </html>
  );
}
