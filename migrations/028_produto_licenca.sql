-- ============================================================
-- 028 — licença do modelo 3D (MakerWorld) por produto.
-- Preenchida no import em lote da coleção (/admin/importar-3d), pra o dono ver
-- se pode vender comercialmente antes de precificar. Aplicada em prod.
-- ============================================================

alter table produtos add column if not exists licenca text;
comment on column produtos.licenca is 'Licenca do modelo 3D (MakerWorld) — p/ decidir se pode vender comercialmente.';
