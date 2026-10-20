export interface OpcoesQuebra {
  maxChars: number;
  maxLinhas: number;
  limiteTotal?: number;
}

/** Quebra um texto em linhas de ~maxChars, até maxLinhas; trunca com … no limiteTotal. */
export function quebrarEmLinhas(texto: string, opc: OpcoesQuebra): string[] {
  const base = (texto ?? "").trim();
  if (!base) return [];
  const t =
    opc.limiteTotal && base.length > opc.limiteTotal
      ? `${base.slice(0, opc.limiteTotal).trimEnd()}…`
      : base;

  const linhas: string[] = [];
  let atual = "";
  for (const p of t.split(/\s+/)) {
    if ((`${atual} ${p}`).trim().length > opc.maxChars && atual) {
      linhas.push(atual);
      atual = p;
    } else {
      atual = (`${atual} ${p}`).trim();
    }
    if (linhas.length === opc.maxLinhas) break;
  }
  if (atual && linhas.length < opc.maxLinhas) linhas.push(atual);
  return linhas.slice(0, opc.maxLinhas);
}
