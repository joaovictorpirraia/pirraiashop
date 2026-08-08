-- ============================================================
-- 011 — carrosséis "achados do dia" pro Instagram
-- Um rascunho de carrossel = um conjunto de produtos + legenda (IA). O dono aprova
-- e publica (feed, via Graph API). Guarda o id da mídia publicada e erro, se houver.
-- Só o admin (service role) acessa; RLS ligada sem policy pública.
-- ============================================================

create table if not exists carrosseis (
  id            bigint generated always as identity primary key,
  produto_ids   jsonb       not null,
  legenda       text        not null default '',
  status        text        not null default 'rascunho'
                check (status in ('rascunho','publicado','erro')),
  ig_media_id   text,
  erro          text,
  criado_em     timestamptz not null default now(),
  publicado_em  timestamptz
);

alter table carrosseis enable row level security;
-- sem policy: anon/authenticated não acessam; service role (admin) ignora RLS.
