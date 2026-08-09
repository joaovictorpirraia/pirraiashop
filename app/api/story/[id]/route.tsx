import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { PNG } from "pngjs";
import { encode as encodeJpeg } from "jpeg-js";
import { supabaseAdmin } from "@/lib/supabase";
import { imgDataUri } from "@/lib/imagem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Arte de STORY (1080x1920, 9:16) de um produto. Card limpo: selo ACHADINHO no
 * topo, foto do produto grande, nome + preço (SEM desconto — mesma blindagem do
 * feed), CTA "no link da bio" embaixo, marca d'água. Respeita as zonas seguras do
 * story (topo/base cobertos pela UI do IG).
 *
 * JPEG em JS puro (next/og PNG → pngjs+jpeg-js) no bucket "criativos" como
 * story-<id>.jpg. O Instagram Content Publishing busca essa URL (media_type=STORIES).
 */
const FONT_DIR = join(process.cwd(), "app", "api", "og");
const fonteRegular = readFileSync(join(FONT_DIR, "OpenSans-Regular.ttf"));
const fonteBold = readFileSync(join(FONT_DIR, "OpenSans-ExtraBold.ttf"));

function brl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return new NextResponse("id inválido", { status: 400 });

  const supabase = supabaseAdmin();
  const { data: p } = await supabase
    .from("produtos")
    .select("titulo, preco, imagem_url")
    .eq("id", id)
    .maybeSingle();
  if (!p || !p.imagem_url) return new NextResponse("produto sem imagem", { status: 404 });

  const img = await imgDataUri(p.imagem_url as string);
  const preco = Number(p.preco);
  const bruto = String(p.titulo);
  const titulo = bruto.length > 60 ? `${bruto.slice(0, 60).trimEnd()}…` : bruto;

  const resp = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: "#faf6f0",
          fontFamily: "Open Sans",
          padding: "300px 90px 300px", // zonas seguras topo/base do story
        }}
      >
        {/* selo */}
        <div
          style={{
            display: "flex",
            background: "#e11d74",
            color: "#fff",
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: 4,
            padding: "16px 44px",
            borderRadius: 999,
          }}
        >
          ACHADINHO
        </div>

        {/* foto do produto */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          width={860}
          height={860}
          style={{ objectFit: "cover", borderRadius: 32 }}
          alt=""
        />

        {/* nome + preço + CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <div
            style={{
              display: "flex",
              fontSize: 46,
              fontWeight: 800,
              color: "#2b2320",
              textAlign: "center",
              lineHeight: 1.15,
              maxWidth: 880,
            }}
          >
            {titulo}
          </div>
          <div style={{ display: "flex", fontSize: 108, fontWeight: 900, color: "#2b2320", marginTop: 22 }}>
            {brl(preco)}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 34,
              background: "#2b2320",
              color: "#fff",
              fontSize: 38,
              fontWeight: 800,
              padding: "20px 52px",
              borderRadius: 999,
            }}
          >
            no link da bio → pesquisa o nome
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#a89b90", marginTop: 24 }}>
            pirraiashop<span style={{ color: "#e11d74" }}>.</span>com.br
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts: [
      { name: "Open Sans", data: fonteRegular, weight: 400, style: "normal" },
      { name: "Open Sans", data: fonteBold, weight: 800, style: "normal" },
    ] },
  );

  const png = PNG.sync.read(Buffer.from(await resp.arrayBuffer()));
  const bytes = encodeJpeg({ data: png.data, width: png.width, height: png.height }, 80).data;
  const caminho = `story-${id}.jpg`;
  const publicUrl = supabase.storage.from("criativos").getPublicUrl(caminho).data.publicUrl;
  try {
    await supabase.storage.from("criativos").upload(caminho, bytes, { contentType: "image/jpeg", upsert: true });
    return NextResponse.redirect(publicUrl, 302);
  } catch {
    return new NextResponse(bytes, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600" } });
  }
}
