import { INSTA_URL, INSTA_HANDLE } from "@/lib/contato3d";
import type { MidiaIG } from "@/lib/instagramFeed";

/**
 * Seção Instagram do @pirraia3d. Com `midias` (fotos reais via Graph API), mostra a
 * grade com thumbnails linkando pro post. Sem elas (API fora/erro), cai no fallback:
 * quadrados com gradiente que levam ao perfil.
 */
export function Instagram3D({ midias = [] }: { midias?: MidiaIG[] }) {
  const reais = midias.slice(0, 6);
  return (
    <section className="border-y border-linha bg-white py-8">
      <div className="mx-auto max-w-[1180px] px-4">
        <div className="mb-4 text-center">
          <h2 className="font-display text-[26px] font-semibold">No Instagram</h2>
          <p className="mt-1.5 text-fumo">
            Siga <b className="text-laranja">{INSTA_HANDLE}</b> e veja os lançamentos do dia
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {reais.length > 0
            ? reais.map((m) => (
                <a
                  key={m.id}
                  href={m.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={m.legenda ? m.legenda.slice(0, 80) : `Abrir ${INSTA_HANDLE} no Instagram`}
                  className="aspect-square overflow-hidden rounded-[10px] bg-areia"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                </a>
              ))
            : Array.from({ length: 6 }).map((_, i) => (
                <a
                  key={i}
                  href={INSTA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${INSTA_HANDLE} no Instagram`}
                  className="aspect-square rounded-[10px] bg-gradient-to-br from-[#FBE7D6] to-[#EAE6FB]"
                />
              ))}
        </div>
      </div>
    </section>
  );
}
