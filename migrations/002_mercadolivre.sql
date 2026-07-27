-- ============================================================
-- 002 — habilita Mercado Livre como origem de produto
-- NÃO aplicado automaticamente. Rode no SQL Editor do Supabase quando
-- for ligar a ingestão do ML. É aditivo (não quebra nada existente).
-- ============================================================

-- adiciona 'mercadolivre' ao check de origem em produtos
alter table produtos drop constraint if exists produtos_origem_check;
alter table produtos add constraint produtos_origem_check
  check (origem in ('shopee','tiktok','manual','mercadolivre'));
