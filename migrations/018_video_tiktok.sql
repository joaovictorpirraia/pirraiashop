-- ============================================================
-- 018 — vídeo 9:16 do TikTok (com texto custom)
-- No TikTok Shop o preço difere da Shopee, então o dono digita o texto que vai
-- queimado no vídeo. Guardamos o resultado 9:16 aqui. O original de cada upload
-- passa a ser mantido em videos/raw-{id}.mp4 pra gerar o 9:16 limpo.
-- ============================================================

alter table produtos add column if not exists video_tiktok_url text;
comment on column produtos.video_tiktok_url is 'Video 9:16 gerado pro TikTok, com texto custom (preco do TikTok difere da Shopee).';
