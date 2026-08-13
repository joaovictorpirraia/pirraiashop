"use client";

import { useState } from "react";

/**
 * Mostra um texto já pronto e um botão pra copiar. Usado pra legenda do TikTok (a
 * API de rascunho não deixa pré-preencher, então o dono copia daqui e cola no app).
 */
export function CopiarTexto({ texto, rotulo = "Copiar legenda" }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard bloqueado — o dono seleciona e copia na mão */
    }
  }

  return (
    <div className="mt-1.5 rounded-lg border border-black/10 bg-areia/40 p-2">
      <div className="max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-tinta/80">
        {texto}
      </div>
      <button
        type="button"
        onClick={copiar}
        className="mt-1.5 w-full rounded-full bg-pirraia px-2 py-1 text-[11px] font-bold text-white transition hover:opacity-90"
      >
        {copiado ? "Copiado!" : rotulo}
      </button>
    </div>
  );
}
