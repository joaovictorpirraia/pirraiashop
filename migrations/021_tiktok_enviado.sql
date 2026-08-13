-- ============================================================
-- 021 — marca de "enviado pro TikTok" (pro envio em lote não duplicar)
-- ============================================================

alter table produtos add column if not exists tiktok_enviado_em timestamptz;
comment on column produtos.tiktok_enviado_em is 'Quando o video foi enviado pro rascunho do TikTok (evita reenvio no lote).';
