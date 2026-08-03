-- ============================================================
-- 005 — cadastro de categorias (gerido em /admin/categorias)
-- Aplicada em produção em ago/2026. É a lista que alimenta o seletor de
-- categoria ao curar um produto. RLS ligada (só service role / admin acessa).
-- ============================================================

create table if not exists categorias (
  id        bigserial primary key,
  nome      text not null unique,
  ordem     int  not null default 0,
  criado_em timestamptz not null default now()
);
alter table categorias enable row level security;

-- seed com as 8 categorias iniciais (normalizadas em ago/2026)
insert into categorias (nome, ordem) values
  ('Casa', 1), ('Relógios', 2), ('Áudio e Vídeo', 3), ('Beleza', 4),
  ('Celular', 5), ('Eletrônicos', 6), ('Utilidades', 7), ('Moda', 8)
on conflict (nome) do nothing;
