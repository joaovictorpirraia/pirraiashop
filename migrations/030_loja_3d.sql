-- ============================================================
-- 030 — Loja 3D: galeria (fotos[]), cores (cores[]), banners da home.
-- A view vitrine ganha fotos/cores/video_url no FIM (p/ o create-or-replace aceitar).
-- ============================================================

alter table produtos add column if not exists fotos text[] not null default '{}';
alter table produtos add column if not exists cores text[] not null default '{}';
comment on column produtos.fotos is 'Galeria de fotos do produto (URLs). imagem_url continua sendo a capa.';
comment on column produtos.cores is 'Chaves de cor disponiveis (ver lib/cores.ts).';

create table if not exists banners (
  id bigint generated always as identity primary key,
  imagem_url text,
  titulo text,
  subtitulo text,
  link text,
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
comment on table banners is 'Banners/hero da home do /3d. MVP usa 1 ativo.';

alter table banners enable row level security;
-- leitura pública só dos banners ativos (igual filosofia da vitrine)
drop policy if exists banners_leitura_publica on banners;
create policy banners_leitura_publica on banners for select using (ativo = true);

create or replace view vitrine as
select
  l.slug, l.destaque, l.ordem,
  p.titulo, p.categoria, p.preco, p.preco_antigo, p.desconto_pct,
  p.imagem_url, p.loja_nome, p.avaliacao, p.origem,
  case
    when p.proprio then 'whatsapp'
    when l.short_url ilike '%shopee%' then 'shopee'
    when l.short_url ilike '%meli.la%' or l.short_url ilike '%mercadoli%' then 'mercadolivre'
    when l.short_url ilike '%tiktok%' then 'tiktok'
    else p.origem
  end as loja,
  p.proprio,
  p.descricao,
  p.criado_em,
  p.fotos,
  p.cores,
  p.video_url
from links l
join produtos p on p.id = l.produto_id
where l.ativo = true and p.status in ('curado','publicado')
  and (l.expira_em is null or l.expira_em > now())
order by l.destaque desc, l.ordem, p.score_ia desc nulls last;
