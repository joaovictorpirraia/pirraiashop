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

// fonte própria embutida (evita o loader de fonte padrão do @vercel/og).
const FONT_DIR = join(process.cwd(), "app", "api", "og");
const fonteRegular = readFileSync(join(FONT_DIR, "OpenSans-Regular.ttf"));
const fonteBold = readFileSync(join(FONT_DIR, "OpenSans-ExtraBold.ttf"));

function brl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Banner 1200x630 (paisagem) pro card GRANDE do WhatsApp. Gera 1x e guarda no
 * Storage (bucket público "banners"); as chamadas seguintes só redirecionam pro
 * arquivo no CDN (rápido) — o robô do WhatsApp tem timeout curto e não pode bater
 * no render de ~2s a cada acesso.
 *
 * Saída em JPEG, não PNG: o WhatsApp cai pro thumbnail PEQUENO quando a imagem
 * passa de ~300 KB, e o PNG de foto do next/og dá ~500 KB. O next/og só gera PNG,
 * então convertemos PNG→JPEG em JS puro (pngjs + jpeg-js, sem binário nativo — o
 * sharp derrubava o build do EasyPanel). JPEG de foto fica ~60-90 KB → card grande.
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  const supabase = supabaseAdmin();
  const caminho = `${slug}.jpg`;
  const publicUrl = supabase.storage.from("banners").getPublicUrl(caminho).data.publicUrl;

  // já gerado? redireciona pro CDN
  try {
    const head = await fetch(publicUrl, { method: "HEAD", cache: "no-store" });
    if (head.ok) return NextResponse.redirect(publicUrl, 302);
  } catch {
    /* segue e gera */
  }

  const { data: p } = await supabase
    .from("vitrine")
    .select("titulo, preco, preco_antigo, desconto_pct, imagem_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!p || !p.imagem_url) return new NextResponse("não encontrado", { status: 404 });

  const img = await imgDataUri(p.imagem_url as string);
  const preco = Number(p.preco);
  const antigo = p.preco_antigo != null ? Number(p.preco_antigo) : null;
  const temDesc = p.desconto_pct != null && Number(p.desconto_pct) > 0;
  const tituloBruto = String(p.titulo);
  const titulo = tituloBruto.length > 54 ? `${tituloBruto.slice(0, 54).trimEnd()}…` : tituloBruto;

  const resp = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#faf6f0",
          fontFamily: "Open Sans",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} width={630} height={630} style={{ objectFit: "cover" }} alt="" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            padding: "48px 48px",
          }}
        >
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#a89b90" }}>
            pirraiashop<span style={{ color: "#e11d74" }}>.</span>com.br
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 38,
              fontWeight: 800,
              color: "#2b2320",
              marginTop: 14,
              lineHeight: 1.15,
            }}
          >
            {titulo}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 30 }}>
            {antigo && antigo > preco && (
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  color: "#a89b90",
                  textDecoration: "line-through",
                  marginRight: 18,
                }}
              >
                {brl(antigo)}
              </div>
            )}
            {temDesc && (
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#fff",
                  background: "#e11d74",
                  padding: "6px 18px",
                  borderRadius: 999,
                }}
              >
                -{p.desconto_pct}% OFF
              </div>
            )}
          </div>
          <div style={{ display: "flex", fontSize: 80, fontWeight: 900, color: "#2b2320", marginTop: 2 }}>
            {brl(preco)}
          </div>
          <div style={{ display: "flex", fontSize: 27, fontWeight: 800, color: "#e11d74", marginTop: 30 }}>
            Ver na loja →
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Open Sans", data: fonteRegular, weight: 400, style: "normal" },
        { name: "Open Sans", data: fonteBold, weight: 800, style: "normal" },
      ],
    },
  );

  // PNG do next/og → JPEG leve (< 300 KB) pro card grande do WhatsApp
  const png = PNG.sync.read(Buffer.from(await resp.arrayBuffer()));
  const bytes = encodeJpeg({ data: png.data, width: png.width, height: png.height }, 72).data;

  // guarda no Storage e redireciona pro CDN; se o upload falhar, devolve o JPEG direto
  try {
    await supabase.storage
      .from("banners")
      .upload(caminho, bytes, { contentType: "image/jpeg", upsert: true });
    return NextResponse.redirect(publicUrl, 302);
  } catch {
    return new NextResponse(bytes, {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" },
    });
  }
}
