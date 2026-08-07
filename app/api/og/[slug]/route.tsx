import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { supabasePublic } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// fonte própria embutida (evita o loader de fonte padrão do @vercel/og, que
// quebra em alguns ambientes). Lida uma vez no carregamento do módulo.
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

/**
 * Banner 1200x630 (paisagem) pro card GRANDE do WhatsApp: foto grande à esquerda,
 * título + preço gigante à direita. Imagem quadrada não dispara o card grande —
 * por isso geramos um criativo landscape.
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const { data: p } = await supabasePublic()
    .from("vitrine")
    .select("titulo, preco, preco_antigo, desconto_pct, imagem_url")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!p || !p.imagem_url) {
    return new Response("não encontrado", { status: 404 });
  }

  const img = jpegDe(p.imagem_url as string);
  const preco = Number(p.preco);
  const antigo = p.preco_antigo != null ? Number(p.preco_antigo) : null;
  const temDesc = p.desconto_pct != null && Number(p.desconto_pct) > 0;
  const tituloBruto = String(p.titulo);
  const titulo = tituloBruto.length > 54 ? `${tituloBruto.slice(0, 54).trimEnd()}…` : tituloBruto;

  return new ImageResponse(
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
          {/* preço antigo + selo de desconto, na mesma linha */}
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
          {/* preço grande, em linha própria (não quebra) */}
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
      headers: { "cache-control": "public, max-age=86400" },
      fonts: [
        { name: "Open Sans", data: fonteRegular, weight: 400, style: "normal" },
        { name: "Open Sans", data: fonteBold, weight: 800, style: "normal" },
      ],
    },
  );
}
