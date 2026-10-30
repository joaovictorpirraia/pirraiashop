import Image from "next/image";

export type Promo = {
  src: string;
  href: string;
  alt: string;
  w: number;
  h: number;
};

/** Faixas promocionais de largura cheia (arte completa, com texto e CTA embutidos). */
export function BannersPromo3D({ banners }: { banners: Promo[] }) {
  if (banners.length === 0) return null;
  return (
    <section className="py-4">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-[18px] px-4">
        {banners.map((b) => (
          <a key={b.src} href={b.href} className="block overflow-hidden rounded-[18px]">
            <Image
              src={b.src}
              alt={b.alt}
              width={b.w}
              height={b.h}
              sizes="(max-width: 1180px) 100vw, 1180px"
              className="h-auto w-full"
            />
          </a>
        ))}
      </div>
    </section>
  );
}
