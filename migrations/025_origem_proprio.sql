-- ============================================================
-- 025 — libera origem='proprio' no check de produtos.origem
-- O check da 001 só aceitava shopee/tiktok/manual/mercadolivre/aliexpress.
-- O adicionarProduto3D insere origem='proprio', então TODO cadastro 3D falhava
-- em silêncio (o insert batia no check → e1 → redirect ?erro=1, banco ficava 0).
-- Aplicada direto em prod (sem deploy): o código já deployado passou a salvar.
-- ============================================================

alter table produtos drop constraint if exists produtos_origem_check;
alter table produtos add constraint produtos_origem_check
  check (origem = any (array['shopee','tiktok','manual','mercadolivre','aliexpress','proprio']));
