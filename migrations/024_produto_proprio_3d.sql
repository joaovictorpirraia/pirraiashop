-- ============================================================
-- 024 — produto PRÓPRIO (3D impresso pelo dono, venda via WhatsApp)
-- Mistura a vitrine de afiliado com produtos que o dono vende direto: aba /3d,
-- botão "Comprar no WhatsApp", sem link de afiliado. proprio=true separa do resto.
-- A view vitrine ganha 'whatsapp' na loja + os campos proprio/descricao (no FIM,
-- pra o create-or-replace aceitar).
-- ============================================================

alter table produtos add column if not exists proprio boolean not null default false;
alter table produtos add column if not exists descricao text;
comment on column produtos.proprio is 'Produto proprio (3D impresso pelo dono), vendido via WhatsApp — nao e afiliado.';

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
  p.descricao
from links l
join produtos p on p.id = l.produto_id
where l.ativo = true and p.status in ('curado','publicado')
  and (l.expira_em is null or l.expira_em > now())
order by l.destaque desc, l.ordem, p.score_ia desc nulls last;
