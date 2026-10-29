/** Dois banners de segmento (casa / presente), lado a lado no desktop. */
export function BannersSegmento3D() {
  return (
    <section className="py-8">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-[18px] px-4 md:grid-cols-2">
        <div className="flex min-h-[180px] flex-col justify-center rounded-[18px] bg-gradient-to-br from-[#FDEBDD] to-[#FBD9BE] p-8">
          <span className="text-[11px] font-bold uppercase tracking-[2px] text-laranja">
            Pra sua casa
          </span>
          <h3 className="mb-1.5 mt-2 font-display text-[26px] font-semibold">
            Decoração que é a sua cara
          </h3>
          <p className="mb-4 max-w-[30ch] text-fumo">
            Enfeites, letreiros, porta-coisas e mais, do seu jeito.
          </p>
          <a
            href="/3d?cat=Decora%C3%A7%C3%A3o#catalogo"
            className="inline-block self-start rounded-full bg-laranja px-6 py-3 font-display text-[15px] font-semibold text-white"
          >
            Ver decoração
          </a>
        </div>

        <div className="flex min-h-[180px] flex-col justify-center rounded-[18px] bg-gradient-to-br from-[#EAE6FB] to-[#DFD8F7] p-8">
          <span className="text-[11px] font-bold uppercase tracking-[2px] text-laranja">
            Pra presentear
          </span>
          <h3 className="mb-1.5 mt-2 font-display text-[26px] font-semibold">
            Presente que ninguém tem
          </h3>
          <p className="mb-4 max-w-[30ch] text-fumo">
            Chaveiros, nomes e peças personalizadas pra dar de presente.
          </p>
          <a
            href="/3d?cat=Brindes#catalogo"
            className="inline-block self-start rounded-full bg-laranja px-6 py-3 font-display text-[15px] font-semibold text-white"
          >
            Ver presentes
          </a>
        </div>
      </div>
    </section>
  );
}
