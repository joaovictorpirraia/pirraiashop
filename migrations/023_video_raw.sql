-- ============================================================
-- 023 — vídeo original subido pelo script (pendente de processar)
-- O baixador local sobe o vídeo cru direto pro Storage (raw-{id}.mp4) e marca aqui.
-- "Processar pendentes" gera o 4:5 (com texto) dos que têm raw mas ainda sem video_url.
-- ============================================================

alter table produtos add column if not exists video_raw_em timestamptz;
comment on column produtos.video_raw_em is 'Quando o script subiu o video original (raw-{id}.mp4). Pendente = video_raw_em not null e video_url null.';
