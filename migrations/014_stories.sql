-- ============================================================
-- 014 — stories automáticos
-- Registro dos stories publicados (produto + id da mídia) pra logar e EVITAR
-- repetir o mesmo produto em stories seguidos. Só o admin (service role) acessa.
-- ============================================================

create table if not exists stories (
  id          bigint generated always as identity primary key,
  produto_id  bigint not null,
  ig_media_id text,
  ok          boolean not null default false,
  erro        text,
  criado_em   timestamptz not null default now()
);
alter table stories enable row level security;
create index if not exists stories_produto_criado on stories (produto_id, criado_em desc);
