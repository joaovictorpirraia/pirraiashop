"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Trilho horizontal deslizável com setas (só no desktop; no celular arrasta).
 * Recebe os cards como `children` (renderizados no servidor) — só a rolagem é client.
 * As setas aparecem/somem conforme dá pra rolar pra cada lado.
 */
export function CarrosselDeslizavel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pode, setPode] = useState({ esq: false, dir: false });

  const medir = () => {
    const el = ref.current;
    if (!el) return;
    const noFim = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setPode({
      // > 24 ignora o offset do padding/snap no início (senão a seta esq aparece parada)
      esq: el.scrollLeft > 24,
      dir: !noFim && el.scrollWidth > el.clientWidth + 24,
    });
  };

  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const rolar = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 400), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={medir}
        className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5"
      >
        {children}
      </div>

      {pode.esq && (
        <button
          type="button"
          aria-label="Anterior"
          onClick={() => rolar(-1)}
          className="absolute left-0 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-linha bg-white/95 text-tinta shadow-md md:flex"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {pode.dir && (
        <button
          type="button"
          aria-label="Próximo"
          onClick={() => rolar(1)}
          className="absolute right-0 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-linha bg-white/95 text-tinta shadow-md md:flex"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
