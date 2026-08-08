-- ============================================================
-- 013 — fundo lifestyle da capa
-- tema_fundo: query (em inglês) que a IA escolhe pro tema do carrossel
--   (ex.: "cozy modern living room"), usada pra buscar a foto de fundo no Pexels.
-- fundo_url: a foto escolhida (travada na 1ª geração da capa, pra prévia e
--   publicação usarem a mesma imagem).
-- ============================================================

alter table carrosseis add column if not exists tema_fundo text not null default '';
alter table carrosseis add column if not exists fundo_url text;
