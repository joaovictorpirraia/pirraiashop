-- ============================================================
-- 017 — token OAuth do TikTok (conta do dono) pro Content Posting API
-- Guarda access/refresh token + validade, pra postar rascunho no TikTok
-- (fluxo Upload/inbox, scope video.upload). Sem policy = só service role lê.
-- ============================================================

create table if not exists tiktok_auth (
  id bigint generated always as identity primary key,
  open_id text unique not null,
  display_name text,
  access_token text not null,
  refresh_token text not null,
  expira_em timestamptz not null,
  refresh_expira_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table tiktok_auth enable row level security;
comment on table tiktok_auth is 'Token OAuth do TikTok (conta do dono) pro Content Posting API. Só service role.';
