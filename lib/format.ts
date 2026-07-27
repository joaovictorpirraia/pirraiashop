const brlFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata um valor (string ou number vindo do Supabase) como BRL. */
export function brl(v: string | number | null | undefined): string {
  if (v == null) return "";
  return brlFmt.format(Number(v));
}

/** Nota de avaliação com uma casa: 4.9 -> "4,9". */
export function nota(v: string | number | null | undefined): string | null {
  if (v == null) return null;
  return Number(v).toFixed(1).replace(".", ",");
}
