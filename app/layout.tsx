import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { MetaPixel } from "@/components/MetaPixel";

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
    <html lang="pt-BR">
      <body>
        {!noAdmin && <MetaPixel pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} />}
        {children}
      </body>
    </html>
  );
}
