-- ============================================================
-- 022 — verificação/atualização de preço da Shopee
-- Preço da Shopee muda muito (promo relâmpago, estoque). Guardamos quando o preço
-- foi verificado pela última vez, pra o botão/cron reprocessar os mais antigos primeiro.
-- ============================================================

alter table produtos add column if not exists preco_visto_em timestamptz;
comment on column produtos.preco_visto_em is 'Ultima vez que o preco foi verificado/atualizado pela API da Shopee.';
