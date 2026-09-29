-- ============================================================
-- 026 — canal 'instagram_3d' pros posts das peças 3D próprias.
-- A legenda das peças 3D tem framing próprio (encomenda/WhatsApp, não achadinho),
-- então ganha um canal separado pra não misturar com os rascunhos de achadinho no
-- /admin/conteudo. Aplicada em prod.
-- ============================================================

alter table posts drop constraint if exists posts_canal_check;
alter table posts add constraint posts_canal_check
  check (canal = any (array['instagram_feed','instagram_story','tiktok','whatsapp','instagram_3d']));
