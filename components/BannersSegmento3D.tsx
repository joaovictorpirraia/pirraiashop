/** Dois banners de segmento (casa / presente), com produtos flutuando. */
export function BannersSegmento3D({
  fotosCasa = [],
  fotosPresente = [],
}: {
  fotosCasa?: string[];
  fotosPresente?: string[];
}) {
  return (
    <section className="py-8">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-[18px] px-4 md:grid-cols-2">
        <Segmento
          eyebrow="Pra sua casa"
          titulo="Decoração que é a sua cara"
          texto="Enfeites, letreiros, porta-coisas e mais, do seu jeito."
          cta="Ver decoração"
          href="/3d?cat=Decora%C3%A7%C3%A3o#catalogo"
          classeFundo="bg-gradient-to-br from-[#FDEBDD] to-[#FBD9BE]"
          fotos={fotosCasa}
        />
        <Segmento
          eyebrow="Pra presentear"
          titulo="Presente que ninguém tem"
          texto="Chaveiros, nomes e peças personalizadas pra dar de presente."
          cta="Ver presentes"
          href="/3d?cat=Brindes#catalogo"
          classeFundo="bg-gradient-to-br from-[#EAE6FB] to-[#DFD8F7]"
          fotos={fotosPresente}
        />
      </div>
    </section>
  );
}

function Segmento({
  eyebrow,
  titulo,
  texto,
  cta,
  href,
  classeFundo,
  fotos,
}: {
  eyebrow: string;
  titulo: string;
  texto: string;
  cta: string;
  href: string;
  classeFundo: string;
  fotos: string[];
}) {
  const cluster = fotos.slice(0, 2);
  const cards = [
    "right-3 bottom-2 h-[150px] w-[130px] rotate-[-5deg] z-20",
    "right-[104px] bottom-[46px] h-[96px] w-[90px] rotate-[9deg] z-10",
  ];
  return (
    <div className={`relative min-h-[196px] overflow-hidden rounded-[18px] ${classeFundo}`}>
      <div className="relative z-10 flex h-full flex-col justify-center p-8 sm:pr-[130px]">
        <span className="text-[11px] font-bold uppercase tracking-[2px] text-laranja">{eyebrow}</span>
        <h3 className="mb-1.5 mt-2 max-w-[18ch] font-display text-[26px] font-semibold">{titulo}</h3>
        <p className="mb-4 max-w-[26ch] text-fumo">{texto}</p>
        <a
          href={href}
          className="inline-block self-start rounded-full bg-laranja px-6 py-3 font-display text-[15px] font-semibold text-white"
        >
          {cta}
        </a>
      </div>
      {cluster.length > 0 && (
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[240px] sm:block">
          {cluster.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              className={`absolute object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,.33)] ${cards[i]}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
