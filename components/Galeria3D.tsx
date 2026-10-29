"use client";
import { useState } from "react";
import Image from "next/image";

type Midia = { tipo: "foto"; url: string } | { tipo: "video"; url: string };

export function Galeria3D({
  capa,
  fotos,
  videoUrl,
  titulo,
}: {
  capa: string | null;
  fotos: string[] | null | undefined;
  videoUrl: string | null | undefined;
  titulo: string;
}) {
  const midias: Midia[] = [];
  if (capa) midias.push({ tipo: "foto", url: capa });
  for (const f of fotos ?? []) if (f && f !== capa) midias.push({ tipo: "foto", url: f });
  if (videoUrl) midias.push({ tipo: "video", url: videoUrl });

  const [ativa, setAtiva] = useState(0);
  const atual = midias[ativa];

  if (!atual) {
    return <div className="aspect-square w-full rounded-2xl bg-black/5" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white shadow-carta">
        {atual.tipo === "foto" ? (
          <Image src={atual.url} alt={titulo} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" priority />
        ) : (
          <video src={atual.url} controls playsInline className="h-full w-full object-cover" />
        )}
      </div>
      {midias.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {midias.map((m, i) => (
            <button
              key={m.url + i}
              type="button"
              onClick={() => setAtiva(i)}
              aria-label={m.tipo === "video" ? "Ver vídeo" : `Foto ${i + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                i === ativa ? "border-pirraia" : "border-transparent"
              }`}
            >
              {m.tipo === "foto" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-tinta text-xs font-bold text-white">▶</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
