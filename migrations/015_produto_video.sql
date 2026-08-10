-- ============================================================
-- 015 — vídeo do produto (pra Reels)
-- produtos.video_url: o vídeo principal do produto. A API de afiliado da AliExpress
-- devolve isso (product_video_url); a Shopee não expõe. Usado no experimento de
-- publicar Reel via API (media_type=REELS).
-- ============================================================

alter table produtos add column if not exists video_url text;
