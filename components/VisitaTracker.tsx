"use client";

import { useEffect, useRef } from "react";

/**
 * Beacon de visita: dispara uma vez por carregamento da home e grava em /api/visita
 * (utm da URL + referrer). Como roda no navegador, robôs (sem JS) não contam.
 * Não renderiza nada.
 */
export function VisitaTracker() {
  const enviado = useRef(false);

  useEffect(() => {
    if (enviado.current) return; // evita o duplo-disparo do StrictMode
    enviado.current = true;

    const atual = new URLSearchParams(window.location.search);
    const params = new URLSearchParams();
    const us = atual.get("utm_source");
    const um = atual.get("utm_medium");
    if (us) params.set("utm_source", us);
    if (um) params.set("utm_medium", um);
    if (document.referrer) params.set("ref", document.referrer);

    fetch(`/api/visita?${params.toString()}`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, []);

  return null;
}
