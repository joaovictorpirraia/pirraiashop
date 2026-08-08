"use client";

import { useState } from "react";
import { gerarLegendaProduto } from "@/app/admin/actions";

/**
 * Botão "Copiar legenda" do card do admin: pede a legenda + hashtags do produto
 * (IA, canal feed — reusa rascunho existente se houver) e copia pronto pra colar
 * no Instagram. A 1ª vez gera (uns segundos); depois reusa o rascunho salvo.
 */
export function CopiarLegenda({ produtoId }: { produtoId: number }) {
  const [estado, setEstado] = useState<"idle" | "carregando" | "copiado" | "erro">("idle");

  async function copiar() {
    setEstado("carregando");
    const r = await gerarLegendaProduto(produtoId);
    if (!r.ok) {
      setEstado("erro");
      setTimeout(() => setEstado("idle"), 2500);
      return;
    }
    const texto = r.hashtags.length
      ? `${r.legenda}\n\n${r.hashtags.map((h) => `#${h}`).join(" ")}`
      : r.legenda;
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
    } catch {
      setEstado("erro");
    }
    setTimeout(() => setEstado("idle"), 2000);
  }

  const label =
    estado === "carregando"
      ? "Gerando…"
      : estado === "copiado"
        ? "Legenda copiada!"
        : estado === "erro"
          ? "Erro, tenta de novo"
          : "Copiar legenda";

  return (
    <button
      type="button"
      onClick={copiar}
      disabled={estado === "carregando"}
      className={`flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
        estado === "copiado"
          ? "bg-emerald-100 text-emerald-700"
          : estado === "erro"
            ? "bg-red-50 text-red-600"
            : "border border-black/10 text-tinta hover:bg-areia"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      {label}
    </button>
  );
}
