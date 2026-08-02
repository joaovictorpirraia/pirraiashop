/**
 * Categorias canônicas da vitrine. O filtro da home (components/Grade.tsx) agrupa
 * pelo texto exato de `produtos.categoria`, então uma lista fixa evita fragmentar
 * ("Casa" vs "casa" vs "Casa e Cozinha"). Usada no seletor da curadoria.
 * Pode crescer — só manter nomes consistentes.
 */
// Alinhada com o catálogo real (normalizado em ago/2026). Ordem ~ por peso.
export const CATEGORIAS: string[] = [
  "Casa",
  "Relógios",
  "Áudio e Vídeo",
  "Beleza",
  "Celular",
  "Eletrônicos",
  "Utilidades",
  "Moda",
];
