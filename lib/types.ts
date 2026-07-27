/** Uma linha da view `vitrine` — o que a home consome. */
export interface VitrineItem {
  slug: string;
  destaque: boolean;
  ordem: number | null;
  titulo: string;
  categoria: string | null;
  // numeric volta como string no supabase-js; formate sempre com Number()
  preco: string | number | null;
  preco_antigo: string | number | null;
  desconto_pct: number | null;
  imagem_url: string | null;
  loja_nome: string | null;
  avaliacao: string | number | null;
  origem: string;
}
