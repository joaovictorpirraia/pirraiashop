import Image from "next/image";
import type { Banner } from "@/lib/types";

export function Banner3D({ banner }: { banner: Banner }) {
  const conteudo = (
    <div className="relative aspect-[16/7] w-full overflow-hidden rounded-2xl bg-tinta sm:aspect-[21/7]">
      {banner.imagem_url && (
        <Image
          src={banner.imagem_url}
          alt={banner.titulo ?? ""}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      )}
      {(banner.titulo || banner.subtitulo) && (
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/50 to-transparent p-5 text-white">
          {banner.titulo && <h2 className="text-xl font-extrabold sm:text-3xl">{banner.titulo}</h2>}
          {banner.subtitulo && <p className="text-sm opacity-90 sm:text-base">{banner.subtitulo}</p>}
        </div>
      )}
    </div>
  );
  return banner.link ? (
    <a href={banner.link} className="block">
      {conteudo}
    </a>
  ) : (
    conteudo
  );
}
