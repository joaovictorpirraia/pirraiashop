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
 * Criativo de post do Instagram: 1080x1350 (4:5, o que ocupa mais tela no feed).
 * Foto do produto em cima, painel com preço/desconto embaixo — mesma linguagem do
 * banner do WhatsApp (que o dono aprovou).
 *
 * Gera JPEG em JS puro (next/og PNG → pngjs+jpeg-js), guarda no bucket "criativos"
 * e redireciona pro CDN — a mesma solução do banner, sem `sharp`/webp. O Instagram
 * Content Publishing busca essa URL pública (exige JPEG). Regenera a cada chamada
 * (preço pode mudar); é chamado poucas vezes (montar/publicar carrossel).
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
  const titulo = tituloBruto.length > 62 ? `${tituloBruto.slice(0, 62).trimEnd()}…` : tituloBruto;

  const resp = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#faf6f0",
          fontFamily: "Open Sans",
        }}
      >
        <div style={{ display: "flex", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} width={1080} height={790} style={{ objectFit: "cover" }} alt="" />
          {/* selo ACHADINHO no canto da foto */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 34,
              left: 34,
              background: "#e11d74",
              color: "#fff",
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: 2,
              padding: "12px 28px",
              borderRadius: 999,
            }}
          >
            ACHADINHO
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "44px 56px 52px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#a89b90" }}>
              pirraiashop<span style={{ color: "#e11d74" }}>.</span>com.br
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 44,
                fontWeight: 800,
                color: "#2b2320",
                marginTop: 14,
                lineHeight: 1.15,
              }}
            >
              {titulo}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              {antigo && antigo > preco && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 32,
                    color: "#a89b90",
                    textDecoration: "line-through",
                    marginRight: 20,
                  }}
                >
                  {brl(antigo)}
                </div>
              )}
              {temDesc && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#fff",
                    background: "#e11d74",
                    padding: "8px 22px",
                    borderRadius: 999,
                  }}
                >
                  -{p.desconto_pct}% OFF
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ display: "flex", fontSize: 104, fontWeight: 900, color: "#2b2320", lineHeight: 1 }}>
                {brl(preco)}
              </div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: "#e11d74", paddingBottom: 12 }}>
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

  // PNG → JPEG leve, guarda no Storage e redireciona pro CDN (URL estável pro Instagram)
  const png = PNG.sync.read(Buffer.from(await resp.arrayBuffer()));
  const bytes = encodeJpeg({ data: png.data, width: png.width, height: png.height }, 80).data;
  const caminho = `${id}.jpg`;
  const publicUrl = supabase.storage.from("criativos").getPublicUrl(caminho).data.publicUrl;
  try {
    await supabase.storage.from("criativos").upload(caminho, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
    return NextResponse.redirect(publicUrl, 302);
  } catch {
    return new NextResponse(bytes, {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600" },
    });
  }
}
