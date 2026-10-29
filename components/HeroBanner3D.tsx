import Image from "next/image";
import type { Banner } from "@/lib/types";

/**
 * Hero da loja 3D. Se houver um banner cadastrado (com imagem), mostra a arte
 * com overlay e CTA. Sem banner, cai no hero laranja da marca com um cluster
 * de produtos flutuando à direita (`fotos`). O CTA leva ao catálogo (#catalogo).
 */
export function HeroBanner3D({
  banner,
  fotos = [],
}: {
  banner?: Banner | null;
  fotos?: string[];
}) {
  if (banner?.imagem_url) {
    return (
      <div className="pb-1.5 pt-4">
        <a
          href={banner.link ?? "/3d#catalogo"}
          className="relative flex min-h-[300px] items-end overflow-hidden rounded-[20px] bg-grafite"
        >
          <Image
            src={banner.imagem_url}
            alt={banner.titulo ?? "Loja 3D"}
            fill
            sizes="(max-width: 1180px) 100vw, 1180px"
            className="object-cover"
            priority
          />
          {(banner.titulo || banner.subtitulo) && (
            <div className="relative z-10 bg-gradient-to-t from-black/55 to-transparent p-9 text-white">
              {banner.titulo && (
                <h1 className="font-display text-3xl font-semibold sm:text-4xl">{banner.titulo}</h1>
              )}
              {banner.subtitulo && <p className="mt-2 max-w-[40ch] opacity-95">{banner.subtitulo}</p>}
            </div>
          )}
        </a>
      </div>
    );
  }

  const cluster = fotos.slice(0, 3);
  // posição/rotação de cada card do cluster (desktop)
  const cards = [
    "left-[120px] top-1/2 h-[220px] w-[220px] -translate-y-1/2 rotate-[-5deg] z-20",
    "left-[0px] top-[24px] h-[150px] w-[150px] rotate-[8deg] z-10",
    "right-[8px] bottom-[18px] h-[160px] w-[160px] rotate-[-11deg] z-10",
  ];

  return (
    <div className="pb-1.5 pt-4">
      <div
        className="relative flex min-h-[320px] items-center overflow-hidden rounded-[20px] text-white"
        style={{
          background:
            "radial-gradient(120% 140% at 12% 20%, #FFB874 0%, #F26A1C 42%, #D4540A 100%)",
        }}
      >
        <div className="relative z-10 max-w-[560px] px-6 py-10 sm:px-12 sm:py-12">
          <span className="text-xs font-bold uppercase tracking-[2px] opacity-90">
            Impressão 3D autoral
          </span>
          <h1 className="mb-3.5 mt-2.5 font-display text-[clamp(28px,5vw,46px)] font-semibold leading-[1.02]">
            Peças 3D feitas por mim, do seu jeito.
          </h1>
          <p className="mb-5 max-w-[40ch] text-base opacity-95">
            Escolhe a peça e a cor, chama no WhatsApp e a gente fecha a encomenda.
          </p>
          <a
            href="#catalogo"
            className="inline-block rounded-full bg-grafite px-7 py-3 font-display text-[15px] font-semibold text-white"
          >
            Ver a loja
          </a>
        </div>

        {cluster.length > 0 ? (
          <div className="pointer-events-none absolute right-6 top-1/2 hidden h-[260px] w-[420px] -translate-y-1/2 lg:block">
            {cluster.map((src, i) => (
              <div
                key={src}
                className={`absolute overflow-hidden rounded-2xl bg-white shadow-[0_22px_44px_-14px_rgba(0,0,0,.5)] ring-1 ring-black/10 ${cards[i]}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-[14%] -right-[6%] hidden font-display text-[230px] font-semibold leading-[0.8] text-white/10 md:block"
          >
            3D
          </span>
        )}
      </div>
    </div>
  );
}
