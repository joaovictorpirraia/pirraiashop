import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { PNG } from "pngjs";
import { decode as decodeJpeg, encode as encodeJpeg } from "jpeg-js";
import { supabaseAdmin } from "@/lib/supabase";
import { jpegDe } from "@/lib/imagem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Criativo de post do Instagram para PEÇA 3D PRÓPRIA (venda via WhatsApp): 1080x1350.
 * Visual moderno: fundo com a COR DOMINANTE da foto (gradiente), produto num card
 * branco com cantos arredondados, tipografia Poppins, selo "IMPRESSÃO 3D" e CTA em
 * pill laranja (cor da marca). Texto adapta claro/escuro pro fundo.
 *
 * Mesmo pipe JPEG do /api/criativo: next/og PNG → pngjs+jpeg-js → bucket "criativos".
 */
const FONT_DIR = join(process.cwd(), "app", "api", "og");
const poppinsSemi = readFileSync(join(FONT_DIR, "Poppins-SemiBold.ttf"));
const poppinsMedium = readFileSync(join(FONT_DIR, "Poppins-Medium.ttf"));
const poppinsExtra = readFileSync(join(FONT_DIR, "Poppins-ExtraBold.ttf"));

type RGB = { r: number; g: number; b: number };
const BRANCO: RGB = { r: 255, g: 255, b: 255 };
const PRETO: RGB = { r: 0, g: 0, b: 0 };

function mix(c: RGB, alvo: RGB, t: number): RGB {
  return {
    r: Math.round(c.r + (alvo.r - c.r) * t),
    g: Math.round(c.g + (alvo.g - c.g) * t),
    b: Math.round(c.b + (alvo.b - c.b) * t),
  };
}
const css = (c: RGB) => `rgb(${c.r},${c.g},${c.b})`;
const lum = (c: RGB) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;

function brl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Cor média da imagem (amostra esparsa). Aceita PNG ou JPEG; null se não decodificar. */
function corMedia(buf: Buffer, ct: string): RGB | null {
  try {
    let data: Uint8Array | Buffer, width: number, height: number;
    if (/png/i.test(ct)) {
      const png = PNG.sync.read(buf);
      data = png.data; width = png.width; height = png.height;
    } else if (/jpe?g/i.test(ct)) {
      const j = decodeJpeg(buf, { useTArray: true });
      data = j.data; width = j.width; height = j.height;
    } else {
      return null;
    }
    let r = 0, g = 0, b = 0, n = 0;
    const alvo = 5000; // ~5k amostras
    const passo = Math.max(1, Math.floor((width * height) / alvo)) * 4;
    for (let i = 0; i + 2 < data.length; i += passo) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    if (!n) return null;
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  } catch {
    return null;
  }
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

  // busca os bytes (png forçado p/ MakerWorld) e deriva a cor dominante
  let img = "";
  let cor: RGB | null = null;
  try {
    const alvo = jpegDe(p.imagem_url as string);
    const resp = await fetch(alvo, { headers: { accept: "image/png,image/jpeg", "user-agent": "Mozilla/5.0 (compatible; pirraiashop/1.0)" }, redirect: "follow" });
    if (resp.ok) {
      const ct = resp.headers.get("content-type") || "image/png";
      const buf = Buffer.from(await resp.arrayBuffer());
      if (!/webp/i.test(ct)) {
        img = `data:${/^image\//.test(ct) ? ct : "image/png"};base64,${buf.toString("base64")}`;
        cor = corMedia(buf, ct);
      }
    }
  } catch {
    /* sem foto embutida — cai no fundo neutro */
  }

  // paleta derivada da foto (fallback: neutro quente da marca)
  const base = cor ?? { r: 150, g: 134, b: 122 };
  const topo = mix(base, BRANCO, 0.42);
  const fundo = mix(base, PRETO, 0.28);
  const textoEscuro = lum(fundo) > 0.6;
  const corTexto = textoEscuro ? "#1a1713" : "#ffffff";
  const corSuave = textoEscuro ? "rgba(26,23,19,0.60)" : "rgba(255,255,255,0.74)";
  const LARANJA = "#ee4d2d";

  const tituloBruto = String(p.titulo);
  const titulo = tituloBruto.length > 60 ? `${tituloBruto.slice(0, 60).trimEnd()}…` : tituloBruto;
  const preco = Number(p.preco);

  const resp = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "52px 56px 60px",
          background: `linear-gradient(165deg, ${css(topo)} 0%, ${css(base)} 46%, ${css(fundo)} 100%)`,
          fontFamily: "Poppins",
        }}
      >
        {/* topo: marca + selo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: corSuave }}>@pirraiashop</div>
          <div style={{ display: "flex", alignItems: "center", background: LARANJA, color: "#fff", fontSize: 24, fontWeight: 600, letterSpacing: 1, padding: "12px 22px", borderRadius: 999 }}>
            IMPRESSÃO 3D
          </div>
        </div>

        {/* card do produto */}
        <div style={{ display: "flex", width: "100%", height: 772, marginTop: 30, borderRadius: 44, overflow: "hidden", background: "#fff", boxShadow: "0 30px 70px rgba(0,0,0,0.22)" }}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} width={968} height={772} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
          ) : (
            <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 40, color: "#b9afa6", fontWeight: 600 }}>
              pirraiashop 3D
            </div>
          )}
        </div>

        {/* texto embaixo */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-end", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 50, fontWeight: 600, color: corTexto, lineHeight: 1.1, letterSpacing: -0.5 }}>
            {titulo}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 500, letterSpacing: 2, color: corSuave }}>A PARTIR DE</div>
              <div style={{ display: "flex", fontSize: 90, fontWeight: 800, color: corTexto, lineHeight: 1 }}>{brl(preco)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", background: LARANJA, color: "#fff", fontSize: 29, fontWeight: 600, padding: "16px 28px", borderRadius: 999, marginBottom: 8 }}>
              peça na bio →
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: "Poppins", data: poppinsMedium, weight: 500, style: "normal" },
        { name: "Poppins", data: poppinsSemi, weight: 600, style: "normal" },
        { name: "Poppins", data: poppinsExtra, weight: 800, style: "normal" },
      ],
    },
  );

  const png = PNG.sync.read(Buffer.from(await resp.arrayBuffer()));
  const bytes = encodeJpeg({ data: png.data, width: png.width, height: png.height }, 82).data;
  const caminho = `3d-${id}.jpg`;
  const publicUrl = supabase.storage.from("criativos").getPublicUrl(caminho).data.publicUrl;
  try {
    await supabase.storage.from("criativos").upload(caminho, bytes, { contentType: "image/jpeg", upsert: true });
    return NextResponse.redirect(publicUrl, 302);
  } catch {
    return new NextResponse(bytes, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600" } });
  }
}
