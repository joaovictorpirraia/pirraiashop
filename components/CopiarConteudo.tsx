"use client";

import { useState } from "react";

/**
 * Botão que copia um texto pro clipboard. Tenta navigator.clipboard e, se falhar
 * (ex.: contexto não-seguro enquanto o SSL não está emitido), cai num fallback
 * com textarea + execCommand, que funciona em http/https sem cert válido.
 */
export function CopiarConteudo({
  texto,
  rotulo = "Copiar",
  variante = "primario",
}: {
  texto: string;
  rotulo?: string;
  variante?: "primario" | "secundario";
}) {
  const [copiado, setCopiado] = useState(false);

  function feito() {
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  function fallback() {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      feito();
    } catch {
      /* ignora */
    }
    document.body.removeChild(ta);
  }

  function copiar() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(texto).then(feito).catch(fallback);
    } else {
      fallback();
    }
  }

  if (variante === "secundario") {
    return (
      <button
        type="button"
        onClick={copiar}
        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
          copiado
            ? "border-emerald-300 text-emerald-700"
            : "border-black/10 text-tinta hover:bg-areia"
        }`}
      >
        {copiado ? "Copiado ✓" : rotulo}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
        copiado
          ? "bg-emerald-600 text-white"
          : "bg-pirraia text-white hover:bg-pirraia-dark"
      }`}
    >
      {copiado ? "Copiado ✓" : rotulo}
    </button>
  );
}
