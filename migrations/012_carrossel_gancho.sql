-- ============================================================
-- 012 — gancho da CAPA do carrossel
-- carrosseis.gancho: o texto da capa (1º slide) — a frase que segura o scroll
-- (ex.: "coisas de casa que parecem caras mas são baratinhas"). A IA gera junto
-- com a legenda; o dono edita. A capa é uma imagem gerada (foto de fundo + gancho).
-- ============================================================

alter table carrosseis add column if not exists gancho text not null default '';
