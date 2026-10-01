import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recebe o import EM LOTE da coleção do MakerWorld (bookmarklet "Importar coleção").
 * Fica sob /admin, então passa pela Basic Auth do middleware — o navegador do dono
 * manda a credencial já em cache. Cada item vira um produto PRÓPRIO status 'novo'
 * (rascunho SEM preço): não aparece na /3d até o dono precificar no /admin/3d.
 *
 * Form POST (não fetch) com um campo `itens` = JSON [{id,titulo,imagem_url,licenca,fonte}].
 * Dedupe por (origem='proprio', item_id). Responde com uma página simples + volta pro admin.
 */
interface Item {
  id: number | string;
  titulo?: string;
  imagem_url?: string;
  licenca?: string;
  fonte?: string;
}

function pagina(msg: string): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <body style="font-family:system-ui;max-width:520px;margin:60px auto;padding:0 20px;color:#2b2320">
    <h2 style="color:#ee4d2d">Importar coleção 3D</h2><p style="font-size:16px;line-height:1.5">${msg}</p>
    <p><a href="/admin/3d" style="display:inline-block;background:#ee4d2d;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:700">Ir pra fila de preços →</a></p></body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function POST(req: Request) {
  let itens: Item[] = [];
  try {
    const form = await req.formData();
    const bruto = String(form.get("itens") ?? "[]");
    const parsed = JSON.parse(bruto);
    if (Array.isArray(parsed)) itens = parsed as Item[];
  } catch {
    return pagina("Não consegui ler a lista. Tenta o bookmarklet de novo na página da coleção.");
  }

  // normaliza + valida
  const limpos = itens
    .map((it) => ({
      item_id: Number(it.id),
      titulo: String(it.titulo ?? "").trim(),
      imagem_url: String(it.imagem_url ?? "").trim(),
      licenca: String(it.licenca ?? "").trim() || null,
      fonte: String(it.fonte ?? "").trim() || null,
    }))
    .filter((it) => Number.isFinite(it.item_id) && it.item_id > 0 && it.titulo && /^https?:\/\//i.test(it.imagem_url))
    .slice(0, 300);

  if (!limpos.length) return pagina("Nenhum item válido veio na lista (faltou título ou foto).");

  const supabase = supabaseAdmin();

  // dedupe: quais item_id já existem como proprio
  const ids = limpos.map((i) => i.item_id);
  const { data: existentes } = await supabase
    .from("produtos")
    .select("item_id")
    .eq("origem", "proprio")
    .in("item_id", ids);
  const jaTem = new Set((existentes ?? []).map((e) => Number(e.item_id)));

  const novos = limpos
    .filter((i) => !jaTem.has(i.item_id))
    .map((i) => ({
      origem: "proprio",
      item_id: i.item_id,
      titulo: i.titulo,
      categoria: "3D",
      imagem_url: i.imagem_url,
      licenca: i.licenca,
      descricao: i.fonte ? `MakerWorld: ${i.fonte}` : null,
      proprio: true,
      status: "novo",
    }));

  let inseridos = 0;
  if (novos.length) {
    const { error, count } = await supabase.from("produtos").insert(novos, { count: "exact" });
    if (error) return pagina(`Deu erro ao salvar: ${error.message}`);
    inseridos = count ?? novos.length;
  }

  const pulados = limpos.length - novos.length;
  return pagina(
    `Importei <b>${inseridos}</b> peça(s) pra fila.${pulados ? ` ${pulados} já estavam lá (puladas).` : ""}
     Agora é só definir o preço de cada uma no /admin/3d pra elas entrarem na /3d.`,
  );
}
