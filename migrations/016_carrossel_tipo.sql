-- ============================================================
-- 016 — tipo do carrossel (imagem | video)
-- 'imagem' (default) = carrossel de fotos (criativos gerados).
-- 'video'  = capa imagem + vídeos dos produtos (upload do dono, processados 4:5).
-- ============================================================

alter table carrosseis add column if not exists tipo text not null default 'imagem';
comment on column carrosseis.tipo is 'imagem = carrossel de fotos (criativos); video = capa imagem + videos dos produtos';
