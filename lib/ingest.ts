import type { SupabaseClient } from "@supabase/supabase-js";
import { type ProdutoOferta, paraProduto } from "./shopee";
import { type ItemML, paraProdutoML } from "./mercadolivre";
import { type ProdutoAli, paraProdutoAli } from "./aliexpress";

export interface ResultadoIngestao {
  recebidas: number;
  gravadas: number;
  erros: number;
  detalhe?: string;
}

/**
 * Faz upsert de linhas já normalizadas na tabela `produtos`.
 *
 * Regra crítica: o upsert NÃO inclui `status`. Assim:
 *  - produto novo  → cai como 'novo' (default do banco), entra na fila de curadoria;
 *  - produto que já existe → atualiza preço/estoque/imagem/etc, mas o status atual
 *    ('curado', 'descartado', 'publicado') é PRESERVADO. Re-ingest nunca des-cura.
 *
 * Dedup é pelo unique (origem, item_id, shop_id) do schema. Shopee usa o shop_id
 * real; o ML não tem loja com id, então usa shop_id 0 fixo (ver paraProdutoML).
 */
async function upsertNormalizados(
  supabase: SupabaseClient,
  linhas: Array<Record<string, unknown>>,
): Promise<ResultadoIngestao> {
  if (linhas.length === 0) {
    return { recebidas: 0, gravadas: 0, erros: 0 };
  }

  // tira `status` do payload: no insert vira o default 'novo', no update fica preservado
  const semStatus = linhas.map((l) => {
    const { status: _status, ...resto } = l;
    return resto;
  });

  const { data, error } = await supabase
    .from("produtos")
    .upsert(semStatus, { onConflict: "origem,item_id,shop_id" })
    .select("id");

  if (error) {
    return {
      recebidas: linhas.length,
      gravadas: 0,
      erros: linhas.length,
      detalhe: error.message,
    };
  }

  return { recebidas: linhas.length, gravadas: data?.length ?? 0, erros: 0 };
}

/** Normaliza ofertas da Shopee e faz upsert em `produtos` (fila de curadoria). */
export async function ingerirOfertas(
  supabase: SupabaseClient,
  ofertas: ProdutoOferta[],
): Promise<ResultadoIngestao> {
  return upsertNormalizados(supabase, ofertas.map(paraProduto));
}

/** Normaliza itens do Mercado Livre e faz upsert em `produtos` (mesma fila). */
export async function ingerirItensML(
  supabase: SupabaseClient,
  itens: ItemML[],
): Promise<ResultadoIngestao> {
  return upsertNormalizados(supabase, itens.map(paraProdutoML));
}

/** Normaliza produtos da AliExpress e faz upsert em `produtos` (mesma fila). */
export async function ingerirItensAli(
  supabase: SupabaseClient,
  itens: ProdutoAli[],
): Promise<ResultadoIngestao> {
  return upsertNormalizados(supabase, itens.map(paraProdutoAli));
}
