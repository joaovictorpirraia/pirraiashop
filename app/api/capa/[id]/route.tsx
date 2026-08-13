import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { PNG } from "pngjs";
import { encode as encodeJpeg } from "jpeg-js";
import { supabaseAdmin } from "@/lib/supabase";
import { buscarFundoPexels } from "@/lib/fundos";
import { imgDataUri } from "@/lib/imagem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Capa do carrossel (1º slide) — a que segura o scroll. Estilo achadinho: FOTO VIVA
 * (sem tarja escura), gancho grande com CONTORNO (legível em qualquer foto) e a
 * palavra-chave destacada numa PÍLULA colorida (marca-texto). Fonte Poppins (moderna).
 * Fundo = foto lifestyle do Pexels (por tema) travada, senão a foto do 1º produto.
 * Gera JPEG (next/og PNG → pngjs+jpeg-js) no bucket "criativos" como capa-<id>.jpg.
 */
const FONT_DIR = join(process.cwd(), "app", "api", "og");
const poppins = readFileSync(join(FONT_DIR, "Poppins-ExtraBold.ttf"));
const openSans = readFileSync(join(FONT_DIR, "OpenSans-Regular.ttf"));

/** Contorno escuro (8 direções) pra o texto branco ler em qualquer foto — sem tarja. */
const COR_CONTORNO = "rgba(18,14,12,0.92)";
function contorno(px: number): string {
  const c = COR_CONTORNO;
  return [
    `${px}px 0 0 ${c}`, `-${px}px 0 0 ${c}`, `0 ${px}px 0 ${c}`, `0 -${px}px 0 ${c}`,
    `${px}px ${px}px 0 ${c}`, `-${px}px -${px}px 0 ${c}`, `${px}px -${px}px 0 ${c}`, `-${px}px ${px}px 0 ${c}`,
  ].join(", ");
}

/** Tamanho do gancho conforme o comprimento (Satori não tem auto-fit). */
function tamGancho(n: number): number {
  if (n <= 22) return 108;
  if (n <= 38) return 90;
  if (n <= 56) return 74;
  return 62;
}

/** Índice da palavra a destacar: keyword forte, senão a última palavra significativa. */
function idxDestaque(palavras: string[]): number {
  const limpa = (w: string) => w.replace(/[^\p{L}]/gu, "");
  const kw = palavras.findIndex((w) => /shopee|achadinh|barat|gr[aá]tis|descont|promo|viral/i.test(limpa(w)));
  if (kw >= 0) return kw;
  for (let i = palavras.length - 1; i >= 0; i--) {
    if (limpa(palavras[i]).length > 3) return i;
  }
  return palavras.length - 1;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return new NextResponse("id inválido", { status: 400 });
  const preview = new URL(req.url).searchParams.has("preview");

  const supabase = supabaseAdmin();
  const { data: c } = await supabase
    .from("carrosseis")
    .select("gancho, produto_ids, tema_fundo, fundo_url")
    .eq("id", id)
    .maybeSingle();
  if (!c) return new NextResponse("carrossel não encontrado", { status: 404 });

  const gancho = String(c.gancho || "achados do dia").trim();
  const palavras = gancho.split(/\s+/).filter(Boolean);
  const tam = tamGancho(gancho.length);
  const ids = (c.produto_ids as number[]) ?? [];

  // Caixa Alta e baixa (Title Case) — cada palavra com inicial maiúscula
  const tc = (w: string) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w);
  // destaca 2 palavras numa pílula só: a palavra-chave + a anterior
  const idxKey = idxDestaque(palavras);
  const hStart = Math.max(0, idxKey - 1);
  const hEnd = idxKey;
  type Tok = { pill: boolean; texto: string };
  const tokens: Tok[] = [];
  for (let i = 0; i < palavras.length; i++) {
    if (i === hStart) {
      tokens.push({ pill: true, texto: palavras.slice(hStart, hEnd + 1).map(tc).join(" ") });
      i = hEnd;
    } else {
      tokens.push({ pill: false, texto: tc(palavras[i]) });
    }
  }

  // fundo lifestyle travado; senão Pexels; senão foto do produto
  let fundo = (c.fundo_url as string) || "";
  if (!fundo) {
    const escolhido = await buscarFundoPexels(String(c.tema_fundo || ""));
    if (escolhido) {
      fundo = escolhido;
      await supabase.from("carrosseis").update({ fundo_url: fundo }).eq("id", id);
    }
  }
  if (!fundo && ids[0]) {
    const { data: p } = await supabase.from("produtos").select("imagem_url").eq("id", ids[0]).maybeSingle();
    if (p?.imagem_url) fundo = await imgDataUri(p.imagem_url as string);
  }

  const resp = new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "#241d1a", fontFamily: "Poppins" }}>
        {fundo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fundo} width={1080} height={1350} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} alt="" />
        )}

        {/* conteúdo — SEM tarja escura; legibilidade vem do contorno do texto */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", position: "absolute", top: 0, left: 0, width: 1080, height: 1350, padding: "70px 60px" }}>
          {/* selo da marca */}
          <div style={{ display: "flex", background: "linear-gradient(90deg,#e11d74,#7c3aed)", color: "#fff", fontSize: 27, letterSpacing: 3, padding: "11px 28px", borderRadius: 999 }}>
            ACHADINHOS
          </div>

          {/* gancho: palavras em flex-wrap; a palavra-chave (2 palavras) vira pílula laranja */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", rowGap: 14, columnGap: 16, maxWidth: 960, flex: 1, alignContent: "center" }}>
            {tokens.map((t, i) =>
              t.pill ? (
                <div key={i} style={{ display: "flex", background: "linear-gradient(90deg,#ff7a3c,#ee4d2d)", color: "#fff", fontSize: tam, lineHeight: 1, padding: "6px 22px", borderRadius: 18 }}>
                  {t.texto}
                </div>
              ) : (
                <div key={i} style={{ display: "flex", color: "#fff", fontSize: tam, lineHeight: 1, textShadow: contorno(Math.round(tam / 22)) }}>
                  {t.texto}
                </div>
              ),
            )}
          </div>

          {/* CTA */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 38, color: "#fff", textShadow: contorno(2) }}>arrasta pro lado →</div>
            <div style={{ display: "flex", fontFamily: "Open Sans", fontSize: 24, color: "#fff", marginTop: 10, textShadow: contorno(2) }}>
              pirraiashop.com.br
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: "Poppins", data: poppins, weight: 800, style: "normal" },
        { name: "Open Sans", data: openSans, weight: 400, style: "normal" },
      ],
    },
  );

  const png = PNG.sync.read(Buffer.from(await resp.arrayBuffer()));
  const bytes = encodeJpeg({ data: png.data, width: png.width, height: png.height }, 82).data;

  if (preview) {
    return new NextResponse(bytes, { headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
  }

  const caminho = `capa-${id}.jpg`;
  const publicUrl = supabase.storage.from("criativos").getPublicUrl(caminho).data.publicUrl;
  try {
    await supabase.storage.from("criativos").upload(caminho, bytes, { contentType: "image/jpeg", upsert: true });
    return NextResponse.redirect(publicUrl, 302);
  } catch {
    return new NextResponse(bytes, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600" } });
  }
}
