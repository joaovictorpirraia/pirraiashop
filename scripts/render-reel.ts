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

async function idPorSlug(slug: string): Promise<number | null> {
  const { data } = await supabase.from("links").select("produto_id").eq("slug", slug).eq("ativo", true).maybeSingle();
  return data?.produto_id ?? null;
}

/** ids de produtos na vitrine (link ativo, não pausado) ainda SEM reel_foto_url. */
async function idsNovos(): Promise<number[]> {
  const { data } = await supabase
    .from("links")
    .select("produto_id, produto:produtos!inner(id, reel_foto_url, imagem_url, status)")
    .eq("ativo", true)
    .eq("pausado", false)
    .limit(300);
  const vistos = new Set<number>();
  const ids: number[] = [];
  for (const l of (data ?? []) as any[]) {
    const p = Array.isArray(l.produto) ? l.produto[0] : l.produto;
    if (!p || vistos.has(p.id)) continue;
    vistos.add(p.id);
    if (p.imagem_url && !p.reel_foto_url && ["curado", "publicado"].includes(p.status)) ids.push(p.id);
  }
  return ids;
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

async function renderVarios(ids: number[]) {
  let ok = 0;
  let err = 0;
  for (const id of ids) {
    try {
      const u = await renderProduto(id);
      console.log(`OK ${id}:`, u);
      ok++;
    } catch (e: any) {
      console.error(`ERRO ${id}:`, e.message);
      err++;
    }
  }
  console.log(`\nResumo: ${ok} ok · ${err} erro(s).`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--novos") {
    const ids = await idsNovos();
    if (!ids.length) return console.log("Nada novo: todos os produtos da vitrine já têm reel.");
    console.log(`Renderizando ${ids.length} produto(s) sem reel…`);
    await renderVarios(ids);
    return;
  }
  if (args[0] === "--slug") {
    const id = await idPorSlug(String(args[1] ?? ""));
    if (!id) throw new Error(`slug não encontrado: ${args[1]}`);
    console.log("OK:", await renderProduto(id));
    return;
  }
  if (args[0] === "--regerar") {
    const id = Number(args[1]);
    if (!Number.isFinite(id)) throw new Error("uso: npm run reel -- --regerar <id>");
    console.log("OK:", await renderProduto(id));
    return;
  }
  const id = Number(args[0]);
  if (!Number.isFinite(id)) {
    console.error("uso: npm run reel -- <id> | --slug <slug> | --novos | --regerar <id>");
    process.exit(1);
  }
  console.log("OK:", await renderProduto(id));
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
