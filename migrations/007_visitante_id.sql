-- ============================================================
-- 007 — visitante único: id de visitante (cookie) na tabela visitas
-- Aplicada em produção em ago/2026. O beacon (VisitaTracker) manda o id de um
-- cookie próprio (1 ano); as métricas contam visitante ÚNICO por dia/período.
-- Registros antigos (antes do cookie) ficam com id nulo — contados 1 por linha.
-- ============================================================

alter table visitas add column if not exists visitante_id text;
create index if not exists idx_visitas_visitante on visitas (visitante_id);
