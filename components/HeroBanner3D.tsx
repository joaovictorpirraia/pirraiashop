import Image from "next/image";
import type { Banner } from "@/lib/types";

/**
 * Hero da loja 3D. Mostra uma arte de banner cheia (texto, CTA e produtos já
 * embutidos na imagem), clicável, levando ao catálogo. Se houver um banner
 * cadastrado no admin (com imagem), ele tem prioridade; senão usa a arte padrão.
 */
export function HeroBanner3D({ banner }: { banner?: Banner | null }) {
  const src = banner?.imagem_url ?? "/banners/hero.webp";
  const href = banner?.link ?? "#catalogo";
  const alt = banner?.titulo ?? "Pirraia 3D — peças 3D feitas por mim";

  return (
    <div className="pb-1.5 pt-4">
      <a href={href} className="block overflow-hidden rounded-[20px]">
        <Image
          src={src}
          alt={alt}
          width={2000}
          height={750}
          sizes="(max-width: 1180px) 100vw, 1180px"
          className="h-auto w-full"
          priority
        />
      </a>
    </div>
  );
}
