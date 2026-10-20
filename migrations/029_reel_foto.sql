-- 029 — reel gerado da FOTO (Remotion), distinto de video_reel_url (reel do video cru)
alter table produtos add column if not exists reel_foto_url text;
comment on column produtos.reel_foto_url is
  'Reel 9:16 gerado da foto do produto via Remotion (render local). Distinto de video_reel_url (reel do video cru pelo ffmpeg).';
