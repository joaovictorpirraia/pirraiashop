import type { Metadata } from "next";
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
  return (
    <html lang="pt-BR">
      <body>
        <MetaPixel pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} />
        {children}
      </body>
    </html>
  );
}
