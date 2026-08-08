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
 * Capa do carrossel (1º slide) — a que segura o scroll: foto de fundo + scrim
 * escuro + GANCHO grande na frente (ex.: "COISAS DE CASA QUE PARECEM CARAS").
 * O gancho vem do registro do carrossel (IA, editável). Fundo = foto do 1º produto.
 * Gera JPEG (next/og PNG → pngjs+jpeg-js) no bucket "criativos" como capa-<id>.jpg.
 */
const FONT_DIR = join(process.cwd(), "app", "api", "og");
const fonteRegular = readFileSync(join(FONT_DIR, "OpenSans-Regular.ttf"));
const fonteBold = readFileSync(join(FONT_DIR, "OpenSans-ExtraBold.ttf"));

function jpegDe(url: string): string {
  if (/mlstatic\.com/i.test(url)) return url.replace(/\.webp(\?.*)?$/i, ".jpg");
  if (/susercontent\.com/i.test(url)) {
    if (/\/file\//.test(url)) return url.replace(/\.webp$/i, "");
    return url.replace(/susercontent\.com\//i, "susercontent.com/file/").replace(/\.webp$/i, "");
  }
  return url;
}

/** Tamanho da fonte do gancho conforme o comprimento (não tem auto-fit no Satori). */
function tamGancho(n: number): number {
  if (n <= 24) return 104;
  if (n <= 40) return 86;
  if (n <= 58) return 72;
  return 60;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return new NextResponse("id inválido", { status: 400 });

  const supabase = supabaseAdmin();
  const { data: c } = await supabase
    .from("carrosseis")
    .select("gancho, produto_ids")
    .eq("id", id)
    .maybeSingle();
  if (!c) return new NextResponse("carrossel não encontrado", { status: 404 });

  const gancho = (String(c.gancho || "achados do dia")).toUpperCase();
  const ids = (c.produto_ids as number[]) ?? [];
  let fundo = "";
  if (ids[0]) {
    const { data: p } = await supabase.from("produtos").select("imagem_url").eq("id", ids[0]).maybeSingle();
    if (p?.imagem_url) fundo = jpegDe(p.imagem_url as string);
  }

  const resp = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          background: "#2b2320",
          fontFamily: "Open Sans",
        }}
      >
        {fundo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fundo}
            width={1080}
            height={1350}
            style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
            alt=""
          />
        )}
        {/* scrim escuro pro texto pop */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: 1080,
            height: 1350,
            background: "linear-gradient(180deg, rgba(15,12,10,0.62) 0%, rgba(15,12,10,0.5) 45%, rgba(15,12,10,0.78) 100%)",
          }}
        />
        {/* conteúdo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            position: "absolute",
            top: 0,
            left: 0,
            width: 1080,
            height: 1350,
            padding: "72px 66px",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "#e11d74",
              color: "#fff",
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: 3,
              padding: "12px 30px",
              borderRadius: 999,
            }}
          >
            ACHADINHOS
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              width: "100%",
            }}
          >
            <div
              style={{
                fontSize: tamGancho(gancho.length),
                fontWeight: 800,
                color: "#fff",
                textAlign: "center",
                lineHeight: 1.12,
                maxWidth: 940,
              }}
            >
              {gancho}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 900, color: "#fff" }}>
              arrasta pro lado →
            </div>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#ffffffcc", marginTop: 10 }}>
              pirraiashop.com.br
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
  const bytes = encodeJpeg({ data: png.data, width: png.width, height: png.height }, 82).data;
  const caminho = `capa-${id}.jpg`;
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
