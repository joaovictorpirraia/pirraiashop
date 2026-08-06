"use client";

import { useEffect, useRef } from "react";

/**
 * Beacon de visita: dispara uma vez por carga da home e grava em /api/visita
 * (utm da URL + referrer + id do visitante). O id vem de um cookie próprio (1 ano),
 * pra contar VISITANTE ÚNICO — recarregar/voltar não conta de novo. Robôs (sem JS)
 * não caem aqui. Não renderiza nada.
 */
function idVisitante(): string {
  const m = document.cookie.match(/(?:^|;\s*)pv=([^;]+)/);
  if (m) return m[1];
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  document.cookie = `pv=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  return id;
}

export function VisitaTracker() {
  const enviado = useRef(false);

  useEffect(() => {
    if (enviado.current) return; // evita o duplo-disparo do StrictMode
    enviado.current = true;

    const atual = new URLSearchParams(window.location.search);
    const params = new URLSearchParams();
    params.set("vid", idVisitante());
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
