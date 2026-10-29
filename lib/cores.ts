/** Palette fixo de cores de filamento. Produto guarda só as chaves em cores[]. */
export interface Cor {
  label: string;
  hex: string;
}

export const PALETTE: Record<string, Cor> = {
  vermelho: { label: "Vermelho", hex: "#DC2626" },
  azul: { label: "Azul", hex: "#2563EB" },
  verde: { label: "Verde", hex: "#16A34A" },
  amarelo: { label: "Amarelo", hex: "#F59E0B" },
  roxo: { label: "Roxo", hex: "#7C3AED" },
  laranja: { label: "Laranja", hex: "#EA580C" },
  preto: { label: "Preto", hex: "#111827" },
  rosa: { label: "Rosa", hex: "#EC4899" },
  branco: { label: "Branco", hex: "#F8FAFC" },
  cinza: { label: "Cinza", hex: "#6B7280" },
};

export function corLabel(chave: string): string {
  return PALETTE[chave]?.label ?? chave;
}

/** Normaliza as chaves de cor de um produto em objetos renderizáveis (ordem preservada). */
export function coresDoProduto(
  chaves: string[] | null | undefined,
): Array<{ chave: string; label: string; hex: string }> {
  if (!chaves) return [];
  return chaves
    .filter((c) => c in PALETTE)
    .map((c) => ({ chave: c, label: PALETTE[c].label, hex: PALETTE[c].hex }));
}
