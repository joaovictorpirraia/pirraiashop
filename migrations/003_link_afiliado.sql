-- ============================================================
-- 003 — guarda o link de afiliado capturado (opcional)
-- Aplicada em produção em ago/2026 via SQL. Aditiva, não quebra nada.
-- O bookmarklet do ML captura o meli.la da janela "Compartilhar" e grava aqui;
-- o passo Curar pré-preenche o campo a partir dela.
-- ============================================================

alter table produtos add column if not exists link_afiliado text;
