-- ============================================================
-- 010 — "pausar" um item da vitrine sem descartar
-- links.pausado: link segue ativo (aparece no admin pra reativar) mas sai da
-- vitrine pública. Diferente do descarte (ativo=false + produto descartado), que
-- é pra tirar de vez. Pausar é pra "sem estoque / volta depois".
-- A view vitrine passa a excluir pausados.
-- ============================================================

alter table links add column if not exists pausado boolean not null default false;

create or replace view vitrine as
select
  l.slug, l.destaque, l.ordem, p.titulo, p.categoria, p.preco, p.preco_antigo,
  p.desconto_pct, p.imagem_url, p.loja_nome, p.avaliacao, p.origem,
  case
    when l.short_url ilike '%shopee%' then 'shopee'
    when l.short_url ilike '%meli.la%' or l.short_url ilike '%mercadoli%' then 'mercadolivre'
    when l.short_url ilike '%aliexpress%' then 'aliexpress'
    when l.short_url ilike '%tiktok%' then 'tiktok'
    else p.origem
  end as loja
from links l
join produtos p on p.id = l.produto_id
where l.ativo = true
  and l.pausado = false
  and p.status in ('curado','publicado')
  and (l.expira_em is null or l.expira_em > now())
order by l.destaque desc, l.ordem, p.score_ia desc nulls last;
