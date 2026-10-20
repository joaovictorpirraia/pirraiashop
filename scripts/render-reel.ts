import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer";
import { createClient } from "@supabase/supabase-js";
import { imgDataUri } from "../lib/imagem";
import { montarProps, reelProps, type RowProduto } from "../remotion/props";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (use .env.local).");
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

/** Busca a row (produtos + short_url do link ativo) por id de produto. */
async function buscarPorId(id: number): Promise<RowProduto | null> {
  const { data } = await supabase
    .from("links")
    .select("short_url, produto:produtos!inner(id, titulo, preco, preco_antigo, desconto_pct, imagem_url, categoria)")
    .eq("produto_id", id)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const p = Array.isArray((data as any).produto) ? (data as any).produto[0] : (data as any).produto;
  return p ? { ...p, short_url: (data as any).short_url } : null;
}

let servePromise: Promise<string> | null = null;
function getBundle(): Promise<string> {
  if (!servePromise) {
    servePromise = bundle({ entryPoint: join(process.cwd(), "remotion", "index.ts") });
  }
  return servePromise;
}

export async function renderProduto(id: number): Promise<string> {
  const row = await buscarPorId(id);
  if (!row) throw new Error(`produto ${id} não encontrado na vitrine (link ativo)`);
  if (!row.imagem_url) throw new Error(`produto ${id} sem imagem_url`);

  const imagem = await imgDataUri(row.imagem_url);
  const inputProps = reelProps.parse(montarProps(row, imagem));

  await ensureBrowser();
  const serveUrl = await getBundle();
  const composition = await selectComposition({ serveUrl, id: "ReelProduto", inputProps });

  const out = join(tmpdir(), `reel-foto-${id}.mp4`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 23,
    pixelFormat: "yuv420p",
    outputLocation: out,
    inputProps,
  });

  const buf = await readFile(out);
  const destino = `reel-foto-${id}.mp4`;
  const { error } = await supabase.storage.from("videos").upload(destino, buf, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (error) throw new Error(`falha ao subir: ${error.message}`);
  const publicUrl = supabase.storage.from("videos").getPublicUrl(destino).data.publicUrl;
  const urlComV = `${publicUrl}?v=${buf.length}`;
  await supabase.from("produtos").update({ reel_foto_url: urlComV }).eq("id", id);
  await unlink(out).catch(() => {});
  return urlComV;
}

async function main() {
  const args = process.argv.slice(2);
  const id = Number(args[0]);
  if (!Number.isFinite(id)) {
    console.error("uso: npm run reel -- <id-do-produto>");
    process.exit(1);
  }
  const u = await renderProduto(id);
  console.log("OK:", u);
  process.exit(0);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
