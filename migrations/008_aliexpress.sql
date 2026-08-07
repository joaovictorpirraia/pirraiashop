-- 008 — habilita AliExpress como origem de produto
--
-- A API de afiliado da AliExpress (aliexpress.affiliate.*) é pública: busca produto
-- E gera link de afiliado (diferente de Shopee/ML). A ingestão cai na mesma fila
-- `novo`, com dedup pelo unique (origem, item_id, shop_id) — shop_id 0 fixo, já que
-- a AliExpress não expõe loja por item.
--
-- Idempotente: pode rodar de novo sem quebrar.

alter table produtos drop constraint if exists produtos_origem_check;
alter table produtos add constraint produtos_origem_check
  check (origem in ('shopee','tiktok','manual','mercadolivre','aliexpress'));
