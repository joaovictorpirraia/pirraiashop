-- ============================================================
-- 006 — contador de visitas na home
-- Aplicada em produção em ago/2026. O beacon do navegador (VisitaTracker)
-- chama POST /api/visita, que insere aqui (service role). RLS ligada.
-- ============================================================

create table if not exists visitas (
  id         bigserial primary key,
  criado_em  timestamptz not null default now(),
  referer    text,
  utm_source text,
  utm_medium text
);
alter table visitas enable row level security;
create index if not exists idx_visitas_criado on visitas (criado_em desc);
