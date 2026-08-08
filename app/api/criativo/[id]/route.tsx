import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { PNG } from "pngjs";
import { encode as encodeJpeg } from "jpeg-js";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Criativo de post do Instagram (slide de produto): 1080x1350 (4:5). Foto do produto
 * em TELA CHEIA + nome e preço sobrepostos (scrim escuro pro texto pop) + marca
 * d'água @pirraiashop (anti-repost) — no estilo das contas de achadinho.
 *
 * Gera JPEG em JS puro (next/og PNG → pngjs+jpeg-js), guarda no bucket "criativos" e
 * redireciona pro CDN. O Instagram Content Publishing busca essa URL pública.
 */
const FONT_DIR = join(process.cwd(), "app", "api", "og");
const fonteRegular = readFileSync(join(FONT_DIR, "OpenSans-Regular.ttf"));
const fonteBold = readFileSync(join(FONT_DIR, "OpenSans-ExtraBold.ttf"));

/** Normaliza a imagem do produto pra JPEG (o gerador não embute webp). */
function jpegDe(url: string): string {
  if (/mlstatic\.com/i.test(url)) return url.replace(/\.webp(\?.*)?$/i, ".jpg");
  if (/susercontent\.com/i.test(url)) {
    if (/\/file\//.test(url)) return url.replace(/\.webp$/i, "");
    return url.replace(/susercontent\.com\//i, "susercontent.com/file/").replace(/\.webp$/i, "");
  }
  return url;
}

function brl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return new NextResponse("id inválido", { status: 400 });

  const supabase = supabaseAdmin();
  const { data: p } = await supabase
    .from("produtos")
    .select("titulo, preco, preco_antigo, desconto_pct, imagem_url")
    .eq("id", id)
    .maybeSingle();
  if (!p || !p.imagem_url) return new NextResponse("produto sem imagem", { status: 404 });

  const img = jpegDe(p.imagem_url as string);
  const preco = Number(p.preco);
  const antigo = p.preco_antigo != null ? Number(p.preco_antigo) : null;
  const temDesc = p.desconto_pct != null && Number(p.desconto_pct) > 0;
  const tituloBruto = String(p.titulo);
  const titulo = tituloBruto.length > 52 ? `${tituloBruto.slice(0, 52).trimEnd()}…` : tituloBruto;
  const marca = "pirraiashop   •   pirraiashop   •   pirraiashop   •   pirraiashop   •   pirraiashop";

  const resp = new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "#2b2320", fontFamily: "Open Sans" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} width={1080} height={1350} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} alt="" />

        {/* scrim topo (pro nome) e base (pro preço) */}
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: 1080, height: 440, background: "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0) 100%)" }} />
        <div style={{ display: "flex", position: "absolute", top: 850, left: 0, width: 1080, height: 500, background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 100%)" }} />

        {/* marca d'água repetida no topo */}
        <div style={{ display: "flex", position: "absolute", top: 26, left: 0, width: 1080, justifyContent: "center", overflow: "hidden", fontSize: 22, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.32)" }}>
          {marca}
        </div>

        {/* conteúdo */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", position: "absolute", top: 0, left: 0, width: 1080, height: 1350, padding: "92px 58px 64px" }}>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 800, color: "#fff", lineHeight: 1.14, maxWidth: 780 }}>
            {titulo}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              {antigo && antigo > preco && (
                <div style={{ display: "flex", fontSize: 32, color: "rgba(255,255,255,0.75)", textDecoration: "line-through", marginRight: 20 }}>
                  {brl(antigo)}
                </div>
              )}
              {temDesc && (
                <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: "#fff", background: "#e11d74", padding: "8px 22px", borderRadius: 999 }}>
                  -{p.desconto_pct}% OFF
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ display: "flex", fontSize: 108, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                {brl(preco)}
              </div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: "#ff8fc4", paddingBottom: 14 }}>
                link na bio →
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: [
      { name: "Open Sans", data: fonteRegular, weight: 400, style: "normal" },
      { name: "Open Sans", data: fonteBold, weight: 800, style: "normal" },
    ] },
  );

  const png = PNG.sync.read(Buffer.from(await resp.arrayBuffer()));
  const bytes = encodeJpeg({ data: png.data, width: png.width, height: png.height }, 80).data;
  const caminho = `${id}.jpg`;
  const publicUrl = supabase.storage.from("criativos").getPublicUrl(caminho).data.publicUrl;
  try {
    await supabase.storage.from("criativos").upload(caminho, bytes, { contentType: "image/jpeg", upsert: true });
    return NextResponse.redirect(publicUrl, 302);
  } catch {
    return new NextResponse(bytes, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600" } });
  }
}
