import { z } from "zod";
import { lojaDeUrl } from "../lib/loja";

export const reelProps = z.object({
  titulo: z.string(),
  preco: z.number(),
  precoAntigo: z.number().nullable(),
  descontoPct: z.number().nullable(),
  imagem: z.string(), // data URI (JPEG/PNG) já tratado por lib/imagem.ts
  loja: z.enum(["shopee", "aliexpress", "mercadolivre", "tiktok", "whatsapp"]),
  categoria: z.string().nullable(),
});

export type ReelProps = z.infer<typeof reelProps>;

/** Linha mínima vinda do banco (produtos + short_url do link). */
export interface RowProduto {
  id: number;
  titulo: string;
  preco: string | number | null;
  preco_antigo: string | number | null;
  desconto_pct: number | null;
  imagem_url: string | null;
  categoria: string | null;
  short_url: string | null;
}

const num = (v: string | number | null): number => Number(v ?? 0) || 0;

/** Converte a row do banco + a foto já tratada (data URI) em props validáveis. */
export function montarProps(row: RowProduto, imagemDataUri: string): ReelProps {
  return {
    titulo: String(row.titulo ?? ""),
    preco: num(row.preco),
    precoAntigo: row.preco_antigo == null ? null : num(row.preco_antigo),
    descontoPct: row.desconto_pct == null ? null : Number(row.desconto_pct),
    imagem: imagemDataUri,
    loja: lojaDeUrl(row.short_url),
    categoria: row.categoria ?? null,
  };
}
