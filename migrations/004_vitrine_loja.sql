-- ============================================================
-- 004 — view vitrine ganha o campo `loja` (derivado do link de afiliado)
-- Aplicada em produção em ago/2026. Produto 'manual' pode ter link da Shopee,
-- então a loja de destino vem do short_url, não da origem.
-- ============================================================

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
