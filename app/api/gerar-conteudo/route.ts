import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  gerarConteudo,
  salvarRascunho,
  type Canal,
  type ProdutoParaConteudo,
} from "@/lib/conteudo";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 300;

const CANAIS: Canal[] = ["instagram_feed", "instagram_story", "tiktok", "whatsapp"];

/**
 * Gera rascunhos de conteúdo (legenda/hashtags/roteiro) para produtos curados
 * que ainda não têm rascunho. Grava em posts como 'rascunho' — o admin aprova
 * antes de usar. Protegida por CRON_SECRET; 503 até OPENAI_API_KEY existir.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key =
    request.nextUrl.searchParams.get("key") ?? request.headers.get("x-cron-key");
  if (!secret || key !== secret) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { erro: "OPENAI_API_KEY ausente — geração de conteúdo não configurada" },
      { status: 503 },
    );
  }

  const canalParam = request.nextUrl.searchParams.get("canal") as Canal | null;
  const canal: Canal = canalParam && CANAIS.includes(canalParam) ? canalParam : "instagram_feed";

  const inicio = Date.now();
  const supabase = supabaseAdmin();

  try {
    // produtos publicáveis + o link ativo deles
    const { data: linksRaw, error: e1 } = await supabase
      .from("links")
      .select(
        "id, produto_id, produto:produtos!inner(id, titulo, categoria, preco, preco_antigo, desconto_pct, loja_nome, angulo_ia, tags_ia, status)",
      )
      .eq("ativo", true);
    if (e1) throw new Error(e1.message);

    // quais produtos já têm rascunho, pra não duplicar
    const { data: rascunhos, error: e2 } = await supabase
      .from("posts")
      .select("produto_id")
      .eq("status", "rascunho");
    if (e2) throw new Error(e2.message);
    const jaTem = new Set((rascunhos ?? []).map((r) => r.produto_id));

    type Row = {
      id: number;
      produto_id: number;
      produto:
        | (ProdutoParaConteudo & { status: string })
        | (ProdutoParaConteudo & { status: string })[];
    };
    const candidatos = ((linksRaw ?? []) as Row[])
      .map((l) => ({
        linkId: l.id,
        produto: Array.isArray(l.produto) ? l.produto[0] : l.produto,
      }))
      .filter(
        (c) =>
          c.produto &&
          ["curado", "publicado"].includes(c.produto.status) &&
          !jaTem.has(c.produto.id),
      )
      .slice(0, 10); // teto por execução

    let gerados = 0;
    for (const c of candidatos) {
      const conteudo = await gerarConteudo(c.produto as ProdutoParaConteudo);
      if (!conteudo) continue;
      const ok = await salvarRascunho(supabase, {
        produtoId: c.produto.id,
        linkId: c.linkId,
        canal,
        conteudo,
      });
      if (ok) gerados++;
    }

    const res = { candidatos: candidatos.length, gerados, canal };
    await supabase.from("execucoes").insert({
      job: "gerar_conteudo",
      ok: true,
      itens: gerados,
      detalhe: res,
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json(res);
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "gerar_conteudo",
      ok: false,
      itens: 0,
      detalhe: { erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    return NextResponse.json({ erro: msg }, { status: 502 });
  }
}
