import type { SupabaseClient } from "@supabase/supabase-js";
import { type ProdutoOferta, paraProduto } from "./shopee";

export interface ResultadoIngestao {
  recebidas: number;
  gravadas: number;
  erros: number;
  detalhe?: string;
}

/**
 * Normaliza ofertas da Shopee e faz upsert na tabela `produtos`.
 *
 * Regra crítica: o upsert NÃO inclui `status`. Assim:
 *  - produto novo  → cai como 'novo' (default do banco), entra na fila de curadoria;
 *  - produto que já existe → atualiza preço/estoque/imagem/etc, mas o status atual
 *    ('curado', 'descartado', 'publicado') é PRESERVADO. Re-ingest nunca des-cura.
 *
 * Dedup é pelo unique (origem, item_id, shop_id) do schema.
 */
export async function ingerirOfertas(
  supabase: SupabaseClient,
  ofertas: ProdutoOferta[],
): Promise<ResultadoIngestao> {
  if (ofertas.length === 0) {
    return { recebidas: 0, gravadas: 0, erros: 0 };
  }

  // tira `status` do payload: no insert vira o default 'novo', no update fica preservado
  const linhas = ofertas.map((o) => {
    const { status: _status, ...resto } = paraProduto(o);
    return resto;
  });

  const { data, error } = await supabase
    .from("produtos")
    .upsert(linhas, { onConflict: "origem,item_id,shop_id" })
    .select("id");

  if (error) {
    return {
      recebidas: ofertas.length,
      gravadas: 0,
      erros: ofertas.length,
      detalhe: error.message,
    };
  }

  return { recebidas: ofertas.length, gravadas: data?.length ?? 0, erros: 0 };
}
