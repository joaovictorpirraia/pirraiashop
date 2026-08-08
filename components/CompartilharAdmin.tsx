"use client";

import { useState } from "react";

/**
 * Botão "Compartilhar" pro admin: pega o link rastreável do produto
 * (`<origin>/r/<slug>`) e, no celular, abre a folha de compartilhar nativa
 * (WhatsApp/Instagram/etc); no desktop, copia pra área de transferência.
 * O link é o /r/ — que conta o clique e gera a prévia grande no WhatsApp.
 */
export function CompartilharAdmin({ slug, titulo }: { slug: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function compartilhar() {
    const url = `${window.location.origin}/r/${slug}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: titulo, url });
      } catch {
        /* usuário cancelou a folha de compartilhar */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard bloqueado (raro em https) — sem ação */
    }
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      aria-label="Compartilhar link do produto"
      className={`flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
        copiado
          ? "bg-emerald-100 text-emerald-700"
          : "border border-black/10 text-tinta hover:bg-areia"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
      </svg>
      {copiado ? "Copiado!" : "Compartilhar"}
    </button>
  );
}
