"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Dispara um evento do pixel no mount (ex.: ViewContent na home).
 * Se o pixel não estiver carregado (sem ID), vira no-op. Como o script base
 * é afterInteractive, pode não existir ainda no primeiro tick — então esperamos
 * o fbq aparecer por um curto intervalo antes de desistir.
 */
export function PixelTrack({
  event,
  params,
}: {
  event: string;
  params?: Record<string, unknown>;
}) {
  useEffect(() => {
    let tentativas = 0;
    const id = setInterval(() => {
      if (typeof window.fbq === "function") {
        window.fbq("track", event, params);
        clearInterval(id);
      } else if (++tentativas > 15) {
        // ~3s sem pixel: provavelmente não há ID configurado. Desiste quieto.
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return null;
}
