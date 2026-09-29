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
 * Criativo de post do Instagram para PEÇA 3D PRÓPRIA (venda direta via WhatsApp):
 * 1080x1350 (4:5). Foto do modelo em tela cheia + selo "IMPRESSÃO 3D · SOB ENCOMENDA"
 * (laranja da marca) + nome + preço + CTA "peça na bio". Sem "link na bio" de
 * afiliado — aqui a compra é encomenda pelo WhatsApp (a bio leva pra /3d).
 *
 * Mesmo pipe do /api/criativo: next/og PNG → pngjs+jpeg-js → bucket "criativos" →
 * redirect pro CDN (o Content Publishing do IG busca essa URL pública).
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
    .select("titulo, preco, imagem_url, proprio")
    .eq("id", id)
    .maybeSingle();
  if (!p || !p.imagem_url) return new NextResponse("produto sem imagem", { status: 404 });

  const img = await imgDataUri(p.imagem_url as string);
  const preco = Number(p.preco);
  const tituloBruto = String(p.titulo);
  const titulo = tituloBruto.length > 52 ? `${tituloBruto.slice(0, 52).trimEnd()}…` : tituloBruto;
  const marca = "pirraiashop   •   pirraiashop   •   pirraiashop   •   pirraiashop   •   pirraiashop";

  const resp = new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "#2b2320", fontFamily: "Open Sans" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} width={1080} height={1350} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} alt="" />

        {/* scrim topo (marca + selo) e base (nome + preço) */}
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: 1080, height: 300, background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)" }} />
        <div style={{ display: "flex", position: "absolute", top: 820, left: 0, width: 1080, height: 530, background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.80) 100%)" }} />

        {/* marca d'água repetida no topo */}
        <div style={{ display: "flex", position: "absolute", top: 26, left: 0, width: 1080, justifyContent: "center", overflow: "hidden", fontSize: 22, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.32)" }}>
          {marca}
        </div>

        {/* selo IMPRESSÃO 3D (laranja da marca) */}
        <div style={{ display: "flex", position: "absolute", top: 84, left: 58, alignItems: "center", background: "#ee4d2d", color: "#fff", fontSize: 30, fontWeight: 800, letterSpacing: 1, padding: "14px 26px", borderRadius: 999 }}>
          IMPRESSÃO 3D · SOB ENCOMENDA
        </div>

        {/* conteúdo base: nome + preço + CTA */}
        <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 0, bottom: 0, width: 1080, padding: "0 58px 64px", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 800, color: "#fff", lineHeight: 1.12, maxWidth: 900 }}>
            {titulo}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                a partir de
              </div>
              <div style={{ display: "flex", fontSize: 112, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                {brl(preco)}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: "#ffd08a", paddingBottom: 16 }}>
              peça na bio →
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
  const caminho = `3d-${id}.jpg`;
  const publicUrl = supabase.storage.from("criativos").getPublicUrl(caminho).data.publicUrl;
  try {
    await supabase.storage.from("criativos").upload(caminho, bytes, { contentType: "image/jpeg", upsert: true });
    return NextResponse.redirect(publicUrl, 302);
  } catch {
    return new NextResponse(bytes, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600" } });
  }
}
