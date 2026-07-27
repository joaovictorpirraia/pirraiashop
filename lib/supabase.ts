import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Cliente público (anon). A RLS já libera só o que a vitrine precisa,
 * então é este que a home e qualquer leitura pública usam.
 */
export function supabasePublic() {
  if (!url || !anonKey) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente.",
    );
  }
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

/**
 * Cliente público SEM cache de fetch. Use em Route Handlers onde cada request
 * precisa realmente ir ao banco — ex.: o redirect /r/[slug], em que o Next
 * deduplicava o POST da RPC por corpo idêntico e perdia cliques.
 */
export function supabasePublicNoCache() {
  if (!url || !anonKey) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente.",
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

/**
 * Cliente admin (service role). Ignora RLS — use SÓ no servidor,
 * nas rotas de /admin e nos jobs. Nunca importe isto num client component.
 */
export function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente.",
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
