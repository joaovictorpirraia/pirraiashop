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
  // loja de destino, derivada do link de afiliado (shopee/mercadolivre/tiktok/whatsapp)
  loja: string;
  // produto próprio (3D do dono, vendido via WhatsApp na aba /3d)
  proprio: boolean | null;
  descricao: string | null;
  criado_em?: string | null;
  fotos?: string[] | null;
  cores?: string[] | null;
  video_url?: string | null;
}

/** Linha do banner da home do /3d. */
export interface Banner {
  id: number;
  imagem_url: string | null;
  titulo: string | null;
  subtitulo: string | null;
  link: string | null;
}
