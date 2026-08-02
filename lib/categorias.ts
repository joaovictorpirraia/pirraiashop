/**
 * Categorias canônicas da vitrine. O filtro da home (components/Grade.tsx) agrupa
 * pelo texto exato de `produtos.categoria`, então uma lista fixa evita fragmentar
 * ("Casa" vs "casa" vs "Casa e Cozinha"). Usada no seletor da curadoria.
 * Pode crescer — só manter nomes consistentes.
 */
export const CATEGORIAS: string[] = [
  "Casa e Cozinha",
  "Organização",
  "Beleza",
  "Eletrônicos",
  "Celular e Acessórios",
  "Áudio e Vídeo",
  "Moda",
  "Fitness e Esporte",
  "Pet",
  "Infantil",
  "Utilidades",
  "Ferramentas",
];
