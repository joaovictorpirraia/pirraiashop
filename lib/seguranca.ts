import type { NextRequest } from "next/server";

/**
 * Comparação de segredos em tempo constante.
 *
 * Em JS puro de propósito: o middleware roda no Edge runtime, onde
 * `node:crypto.timingSafeEqual` não está disponível. Esta versão percorre sempre
 * o maior comprimento e dobra a diferença de tamanho no acumulador, então não
 * vaza (por timing) nem o conteúdo nem o tamanho do segredo. Serve tanto no
 * middleware (Edge) quanto nas rotas de cron (Node).
 */
export function compararSegredo(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Autoriza uma rota de cron pelo CRON_SECRET. Aceita o segredo no header
 * `x-cron-key` (preferido) OU na query `?key=` (mantido: há crons em produção
 * que ainda usam a query — tirar quebraria). A comparação é timing-safe.
 */
export function cronAutorizado(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const key = request.headers.get("x-cron-key") ?? request.nextUrl.searchParams.get("key");
  return compararSegredo(key, secret);
}
