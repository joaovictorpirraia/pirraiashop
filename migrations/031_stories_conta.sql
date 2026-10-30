-- 031: separa stories por conta de Instagram (afiliado x @pirraia3d).
-- O rodízio de categoria, o dedup (2 dias) e o teto diário passam a ser por conta,
-- pra os stories do @pirraia3d não interferirem no autopost do afiliado e vice-versa.
alter table public.stories
  add column if not exists conta text not null default 'afiliado';

create index if not exists idx_stories_conta_criado
  on public.stories (conta, criado_em desc);
