-- ============================================================
-- 019 — legenda do TikTok (pra copiar e colar)
-- A API do TikTok NÃO deixa pré-preencher legenda no fluxo de rascunho: o vídeo
-- cai no inbox e o dono digita a legenda no app. Então a IA gera a legenda, a
-- gente guarda aqui e mostra um botão "Copiar" no admin pro dono colar no TikTok.
-- ============================================================

alter table produtos add column if not exists legenda_tiktok text;
comment on column produtos.legenda_tiktok is 'Legenda gerada pra colar no TikTok (a API de rascunho nao deixa pre-preencher).';
