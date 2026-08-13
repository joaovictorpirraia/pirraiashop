import { spawn } from "node:child_process";
import { readFile, writeFile, unlink, mkdtemp, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Processa o vídeo cru que o dono subiu pra um produto: normaliza pra 4:5 (o que o
 * Instagram exige em carrossel) e QUEIMA o texto (marca + nome + preço) com ffmpeg.
 * Roda no servidor do EasyPanel (ffmpeg instalado via nixpacks). Guarda o resultado
 * em videos/prod-{id}.mp4 (público) e grava a URL em produtos.video_url.
 */

const FONT = join(process.cwd(), "app", "api", "og", "OpenSans-ExtraBold.ttf");
const W = 1080;
const H = 1350; // 4:5
const MAX_SEG = 30; // corta em 30s (IG aceita 3–60s; 30 mantém ágil)

function brl(n: number): string {
  return `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Quebra o título em até 2 linhas de ~22 caracteres (drawtext não quebra sozinho). */
function quebrarTitulo(titulo: string): string {
  const t = titulo.length > 46 ? `${titulo.slice(0, 46).trimEnd()}…` : titulo;
  const palavras = t.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    if ((`${atual} ${p}`).trim().length > 22 && atual) {
      linhas.push(atual);
      atual = p;
    } else {
      atual = (`${atual} ${p}`).trim();
    }
    if (linhas.length === 2) break;
  }
  if (atual && linhas.length < 2) linhas.push(atual);
  return linhas.slice(0, 2).join("\n");
}

/** Escapa o que o filtergraph do ffmpeg trata como especial num path/valor. */
function escFiltro(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function rodarFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => {
      err += d.toString();
    });
    p.on("error", (e) => reject(new Error(`ffmpeg não rodou: ${e.message}`)));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg falhou: ${err.slice(-400)}`))));
  });
}

export async function processarVideoProduto(
  supabase: SupabaseClient,
  produtoId: number,
  rawPath: string, // path no bucket "videos" do arquivo cru (ex: "raw/123-169....mp4")
): Promise<string> {
  const { data: prod } = await supabase
    .from("produtos")
    .select("titulo, preco")
    .eq("id", produtoId)
    .maybeSingle();
  if (!prod) throw new Error("produto não encontrado");

  // baixa o vídeo cru do Storage
  const { data: blob, error: dlErr } = await supabase.storage.from("videos").download(rawPath);
  if (dlErr || !blob) throw new Error(`não achei o vídeo enviado: ${dlErr?.message ?? ""}`);
  const buf = Buffer.from(await blob.arrayBuffer());

  const dir = await mkdtemp(join(tmpdir(), "pv-"));
  const inp = join(dir, "in");
  const out = join(dir, "out.mp4");
  const tituloTxt = join(dir, "titulo.txt");
  const precoTxt = join(dir, "preco.txt");
  const limpar = async () => {
    await Promise.all([inp, out, tituloTxt, precoTxt].map((f) => unlink(f).catch(() => {})));
    await rmdir(dir).catch(() => {});
  };

  try {
    await writeFile(inp, buf);
    await writeFile(tituloTxt, quebrarTitulo(String(prod.titulo)));
    await writeFile(precoTxt, brl(Number(prod.preco)));

    const vf = [
      // corta-preenche pra 4:5 exato, centralizado
      `scale=${W}:${H}:force_original_aspect_ratio=increase`,
      `crop=${W}:${H}`,
      `setsar=1`,
      // scrims (topo pro nome, base pro preço)
      `drawbox=x=0:y=0:w=${W}:h=300:color=black@0.45:t=fill`,
      `drawbox=x=0:y=${H - 300}:w=${W}:h=300:color=black@0.45:t=fill`,
      // marca d'água
      `drawtext=fontfile='${escFiltro(FONT)}':text='pirraiashop':x=(w-tw)/2:y=42:fontsize=30:fontcolor=white@0.7`,
      // nome (2 linhas) e preço
      `drawtext=fontfile='${escFiltro(FONT)}':textfile='${escFiltro(tituloTxt)}':x=54:y=112:fontsize=52:fontcolor=white:line_spacing=10`,
      `drawtext=fontfile='${escFiltro(FONT)}':textfile='${escFiltro(precoTxt)}':x=54:y=${H - 205}:fontsize=112:fontcolor=white`,
      `drawtext=fontfile='${escFiltro(FONT)}':text='link na bio':x=w-tw-54:y=${H - 92}:fontsize=34:fontcolor=0xff8fc4`,
    ].join(",");

    await rodarFfmpeg([
      "-y",
      "-t", String(MAX_SEG),
      "-i", inp,
      "-vf", vf,
      "-r", "30",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      out,
    ]);

    const final = await readFile(out);
    const destino = `prod-${produtoId}.mp4`;
    const { error: upErr } = await supabase.storage
      .from("videos")
      .upload(destino, final, { contentType: "video/mp4", upsert: true });
    if (upErr) throw new Error(`falha ao subir o vídeo pronto: ${upErr.message}`);

    const publicUrl = supabase.storage.from("videos").getPublicUrl(destino).data.publicUrl;
    await supabase.from("produtos").update({ video_url: publicUrl }).eq("id", produtoId);
    // GUARDA O ORIGINAL em raw-{id}.mp4 (pra gerar o 9:16 do TikTok com texto limpo),
    // e limpa o upload temporário com timestamp
    await supabase.storage.from("videos").upload(`raw-${produtoId}.mp4`, buf, { contentType: "video/mp4", upsert: true }).catch(() => {});
    await supabase.storage.from("videos").remove([rawPath]).catch(() => {});
    return publicUrl;
  } finally {
    await limpar();
  }
}

/**
 * Gera o vídeo 9:16 (1080x1920) pro TikTok a partir do ORIGINAL (raw-{id}.mp4),
 * queimando o TEXTO que o dono digitou (no TikTok Shop o preço difere da Shopee).
 * Respeita as zonas do TikTok (botões à direita, legenda embaixo): texto no
 * meio-alto, marca no topo. Guarda em videos/tiktok-{id}.mp4 e grava video_tiktok_url.
 */
export async function gerarVideoTikTok(
  supabase: SupabaseClient,
  produtoId: number,
  texto: string,
): Promise<string> {
  const TW = 1080;
  const TH = 1920; // 9:16

  const { data: blob, error: dlErr } = await supabase.storage.from("videos").download(`raw-${produtoId}.mp4`);
  if (dlErr || !blob) {
    throw new Error("não achei o vídeo original desse produto — sobe o vídeo de novo em /admin/videos (agora eu guardo o original)");
  }
  const buf = Buffer.from(await blob.arrayBuffer());

  const dir = await mkdtemp(join(tmpdir(), "tk-"));
  const inp = join(dir, "in");
  const out = join(dir, "out.mp4");
  const textoTxt = join(dir, "texto.txt");
  const limpar = async () => {
    await Promise.all([inp, out, textoTxt].map((f) => unlink(f).catch(() => {})));
    await rmdir(dir).catch(() => {});
  };

  try {
    await writeFile(inp, buf);
    // quebra o texto do dono em linhas de ~18 chars, até 4 linhas
    const palavras = (texto || "").trim().split(/\s+/).filter(Boolean);
    const linhas: string[] = [];
    let atual = "";
    for (const p of palavras) {
      if ((`${atual} ${p}`).trim().length > 18 && atual) {
        linhas.push(atual);
        atual = p;
      } else {
        atual = (`${atual} ${p}`).trim();
      }
      if (linhas.length === 4) break;
    }
    if (atual && linhas.length < 4) linhas.push(atual);
    await writeFile(textoTxt, linhas.join("\n") || " ");
    const alturaBloco = Math.max(170, linhas.length * 82 + 60);
    const yBloco = 640;

    const vf = [
      `scale=${TW}:${TH}:force_original_aspect_ratio=increase`,
      `crop=${TW}:${TH}`,
      `setsar=1`,
      // marca d'água no topo (zona segura do TikTok)
      `drawtext=fontfile='${escFiltro(FONT)}':text='pirraiashop':x=(w-tw)/2:y=130:fontsize=32:fontcolor=white@0.75`,
      // tarja mais clara + texto do dono (fonte menor) com sombrinha pra ficar legível
      // em qualquer vídeo. Meio-alto, longe dos botões à direita e da legenda embaixo.
      `drawbox=x=0:y=${yBloco - 32}:w=${TW}:h=${alturaBloco}:color=black@0.26:t=fill`,
      `drawtext=fontfile='${escFiltro(FONT)}':textfile='${escFiltro(textoTxt)}':x=60:y=${yBloco}:fontsize=62:fontcolor=white:line_spacing=12:shadowcolor=black@0.55:shadowx=2:shadowy=2`,
    ].join(",");

    await rodarFfmpeg([
      "-y",
      "-t", String(MAX_SEG),
      "-i", inp,
      "-vf", vf,
      "-r", "30",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      out,
    ]);

    const final = await readFile(out);
    const destino = `tiktok-${produtoId}.mp4`;
    const { error: upErr } = await supabase.storage
      .from("videos")
      .upload(destino, final, { contentType: "video/mp4", upsert: true });
    if (upErr) throw new Error(`falha ao subir o vídeo do TikTok: ${upErr.message}`);

    const publicUrl = supabase.storage.from("videos").getPublicUrl(destino).data.publicUrl;
    // cache-busting: a URL muda a cada geração pra a prévia não pegar a versão velha
    const urlComV = `${publicUrl}?v=${final.length}`;
    await supabase.from("produtos").update({ video_tiktok_url: urlComV }).eq("id", produtoId);
    return urlComV;
  } finally {
    await limpar();
  }
}
