/** Três banners de categoria em destaque (Natal / Sensoriais / Colecionáveis). */
export function BannersCategoria3D({
  fotos = {},
}: {
  fotos?: Record<string, string | undefined>;
}) {
  return (
    <section className="py-8 pt-2">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-[18px] px-4 md:grid-cols-3">
        <Feat
          href="/3d?cat=Natal#catalogo"
          eyebrow="Especial"
          titulo="Natal Pirraia"
          texto="Presépio, enfeites e chaveiros pro fim de ano."
          cta="Ver tudo de Natal"
          fundo="linear-gradient(160deg, #0F7B3E, #0a5c2d)"
          foto={fotos["Natal"]}
        />
        <Feat
          href="/3d?cat=Sensoriais#catalogo"
          eyebrow="Mais queridos"
          titulo="Linha Sensorial"
          texto="Fidgets e flexíveis que viciam — alívio do estresse."
          cta="Ver sensoriais"
          fundo="linear-gradient(160deg, #7C3AED, #5b22b8)"
          foto={fotos["Sensoriais"]}
        />
        <Feat
          href="/3d?cat=Colecion%C3%A1veis#catalogo"
          eyebrow="Peças únicas"
          titulo="Colecionáveis"
          texto="Estátuas e peças grandes, super detalhadas."
          cta="Ver colecionáveis"
          fundo="linear-gradient(160deg, #18161A, #2b2630)"
          foto={fotos["Colecionáveis"]}
        />
      </div>
    </section>
  );
}

function Feat({
  href,
  eyebrow,
  titulo,
  texto,
  cta,
  fundo,
  foto,
}: {
  href: string;
  eyebrow: string;
  titulo: string;
  texto: string;
  cta: string;
  fundo: string;
  foto?: string;
}) {
  return (
    <a
      href={href}
      className="relative flex min-h-[230px] flex-col justify-end overflow-hidden rounded-[18px] p-6 text-white"
      style={{ background: fundo }}
    >
      {foto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={foto}
          alt=""
          className="pointer-events-none absolute -right-2 -top-3 h-[150px] w-[150px] rotate-[-5deg] object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,.45)]"
        />
      )}
      <span className="relative text-[11px] font-bold uppercase tracking-[2px] opacity-85">{eyebrow}</span>
      <h3 className="relative mb-1.5 mt-1.5 font-display text-2xl font-semibold">{titulo}</h3>
      <p className="relative mb-3.5 max-w-[28ch] text-[13.5px] opacity-90">{texto}</p>
      <span className="relative self-start border-b-2 border-white/60 pb-0.5 text-[13.5px] font-semibold">
        {cta}
      </span>
    </a>
  );
}
