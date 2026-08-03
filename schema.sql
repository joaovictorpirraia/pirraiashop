-- ============================================================
-- pirraiashop — schema base (fases 1 e 2)
-- Rode no SQL Editor do Supabase, de uma vez só.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- produtos: catálogo bruto vindo das APIs de afiliado
-- ------------------------------------------------------------
create table if not exists produtos (
  id              bigserial primary key,
  origem          text        not null default 'shopee'
                  check (origem in ('shopee','tiktok','manual')),
  item_id         bigint      not null,
  shop_id         bigint,

  titulo          text        not null,
  slug            text,
  categoria       text,
  cat_ids         bigint[],

  preco           numeric(10,2),
  preco_antigo    numeric(10,2),
  desconto_pct    int,
  moeda           text        default 'BRL',

  comissao_pct    numeric(6,3),
  comissao_valor  numeric(10,2),

  imagem_url      text,
  url_produto     text,
  loja_nome       text,
  vendas          int,
  avaliacao       numeric(3,2),

  -- preenchido pela camada Claude
  score_ia        int         check (score_ia between 0 and 100),
  angulo_ia       text,
  tags_ia         text[],

  status          text        not null default 'novo'
                  check (status in ('novo','curado','descartado','publicado')),
  visto_em        timestamptz not null default now(),
  criado_em       timestamptz not null default now(),

  unique (origem, item_id, shop_id)
);

create index if not exists idx_produtos_status   on produtos (status, score_ia desc nulls last);
create index if not exists idx_produtos_visto    on produtos (visto_em desc);
create index if not exists idx_produtos_categoria on produtos (categoria);

-- ------------------------------------------------------------
-- links: shortlink de afiliado + slug próprio pra tracking
-- ------------------------------------------------------------
create table if not exists links (
  id           bigserial primary key,
  produto_id   bigint      not null references produtos(id) on delete cascade,
  slug         text        not null unique,
  short_url    text        not null,
  sub_ids      text[]      default '{}',
  destaque     boolean     not null default false,
  ordem        int         default 0,
  ativo        boolean     not null default true,
  expira_em    timestamptz,
  cliques      int         not null default 0,
  criado_em    timestamptz not null default now()
);

create index if not exists idx_links_ativo on links (ativo, destaque desc, ordem);

-- ------------------------------------------------------------
-- cliques: seu tracking próprio (chega antes do report da Shopee)
-- ------------------------------------------------------------
create table if not exists cliques (
  id         bigserial primary key,
  link_id    bigint      not null references links(id) on delete cascade,
  referer    text,
  user_agent text,
  pais       text,
  utm_source text,
  utm_medium text,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_cliques_link on cliques (link_id, criado_em desc);
create index if not exists idx_cliques_dia  on cliques (criado_em desc);

-- incremento do contador sem race condition
create or replace function registrar_clique(
  p_slug       text,
  p_referer    text default null,
  p_user_agent text default null,
  p_utm_source text default null,
  p_utm_medium text default null
) returns text
language plpgsql security definer as $$
declare
  v_link links%rowtype;
begin
  select * into v_link from links
   where slug = p_slug and ativo = true
   limit 1;

  if not found then
    return null;
  end if;

  insert into cliques (link_id, referer, user_agent, utm_source, utm_medium)
  values (v_link.id, p_referer, p_user_agent, p_utm_source, p_utm_medium);

  update links set cliques = cliques + 1 where id = v_link.id;

  return v_link.short_url;
end;
$$;

-- ------------------------------------------------------------
-- posts: fila de conteúdo gerado
-- ------------------------------------------------------------
create table if not exists posts (
  id            bigserial primary key,
  produto_id    bigint      references produtos(id) on delete set null,
  link_id       bigint      references links(id)    on delete set null,
  canal         text        not null
                check (canal in ('instagram_feed','instagram_story','tiktok','whatsapp')),
  legenda       text,
  hashtags      text[],
  roteiro       text,
  imagem_path   text,
  agendado_para timestamptz,
  publicado_em  timestamptz,
  id_externo    text,
  erro          text,
  status        text        not null default 'rascunho'
                check (status in ('rascunho','aprovado','agendado','publicado','erro')),
  criado_em     timestamptz not null default now()
);

create index if not exists idx_posts_fila on posts (status, agendado_para);

-- ------------------------------------------------------------
-- execucoes: log dos jobs (ingestão, curadoria, publicação)
-- ------------------------------------------------------------
create table if not exists execucoes (
  id          bigserial primary key,
  job         text        not null,
  ok          boolean     not null default true,
  itens       int         default 0,
  detalhe     jsonb,
  duracao_ms  int,
  criado_em   timestamptz not null default now()
);

create index if not exists idx_execucoes_job on execucoes (job, criado_em desc);

-- ------------------------------------------------------------
-- RLS: leitura pública só do que a vitrine precisa.
-- Escrita fica exclusivamente com a service_role (jobs no backend).
-- ------------------------------------------------------------
alter table produtos  enable row level security;
alter table links     enable row level security;
alter table cliques   enable row level security;
alter table posts     enable row level security;
alter table execucoes enable row level security;

drop policy if exists leitura_vitrine_produtos on produtos;
create policy leitura_vitrine_produtos on produtos
  for select using (status in ('curado','publicado'));

drop policy if exists leitura_vitrine_links on links;
create policy leitura_vitrine_links on links
  for select using (ativo = true);

-- cliques, posts e execucoes: sem policy de select = ninguém lê com anon key.

-- ------------------------------------------------------------
-- view da vitrine: o que a home consome
-- ------------------------------------------------------------
create or replace view vitrine as
select
  l.slug,
  l.destaque,
  l.ordem,
  p.titulo,
  p.categoria,
  p.preco,
  p.preco_antigo,
  p.desconto_pct,
  p.imagem_url,
  p.loja_nome,
  p.avaliacao,
  p.origem,
  -- loja de destino, derivada do link de afiliado (produto 'manual' pode ter link Shopee)
  case
    when l.short_url ilike '%shopee%' then 'shopee'
    when l.short_url ilike '%meli.la%' or l.short_url ilike '%mercadoli%' then 'mercadolivre'
    when l.short_url ilike '%tiktok%' then 'tiktok'
    else p.origem
  end as loja
from links l
join produtos p on p.id = l.produto_id
where l.ativo = true
  and p.status in ('curado','publicado')
  and (l.expira_em is null or l.expira_em > now())
order by l.destaque desc, l.ordem, p.score_ia desc nulls last;
