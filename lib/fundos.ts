/**
 * Fundo lifestyle da capa do carrossel, via Pexels (fotos livres pra uso comercial).
 * A IA dá o tema (query em inglês); aqui a gente busca e devolve UMA foto vertical.
 * Gated em PEXELS_API_KEY — sem chave devolve null e a capa cai no fallback (foto do
 * produto). O chamador trava a escolhida em carrosseis.fundo_url pra não trocar.
 */
export async function buscarFundoPexels(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query.trim()) return null;

  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=15`,
      { headers: { Authorization: key }, cache: "no-store" },
    );
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      photos?: Array<{ src?: { large2x?: string; portrait?: string; large?: string } }>;
    };
    const fotos = (json.photos ?? [])
      .map((p) => p.src?.large2x || p.src?.portrait || p.src?.large)
      .filter((u): u is string => Boolean(u));
    if (!fotos.length) return null;
    // varia a escolha (não pega sempre a 1ª) — Math.random é ok no runtime do app
    return fotos[Math.floor(Math.random() * fotos.length)];
  } catch {
    return null;
  }
}
