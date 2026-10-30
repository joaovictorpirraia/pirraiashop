import type { ReactNode } from "react";
import { FloatWhatsApp3D } from "@/components/FloatWhatsApp3D";

/** Layout da loja 3D: mantém o botão de WhatsApp flutuante em todas as páginas de /3d. */
export default function Layout3D({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FloatWhatsApp3D />
    </>
  );
}
