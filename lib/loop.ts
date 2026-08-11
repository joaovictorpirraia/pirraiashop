import type { SupabaseClient } from "@supabase/supabase-js";
import { ShopeeAffiliate, paraProduto } from "./shopee";
import { inserirRascunhoCarrossel, faxinaExpirados, dedupVisual } from "./carrossel";
import { categorizarProdutos } from "./curadoria";

/**
 * Temas do dia, em rodízio. keyword = o que busca na Shopee; catId = a categoria
 * REAL da Shopee (L1) — usada pra filtrar só os produtos daquela categoria e matar
 * o off-theme (ex: suéter infantil não entra num post de relógio). Os IDs saíram
 * do nosso próprio catálogo (campo cat_ids do productOfferV2).
 */
export type Tema = { nome: string; keyword: string; catId?: number };
export const TEMAS: Tema[] = [
  { nome: "Relógios masculinos", keyword: "relogio masculino", catId: 100534 },
  { nome: "Relógios femininos", keyword: "relogio feminino", catId: 100534 },
  { nome: "Casa e organização", keyword: "organizador casa", catId: 100636 },
  { nome: "Limpeza esperta da casa", keyword: "limpeza casa pratico", catId: 100636 },
  { nome: "Cozinha e eletro", keyword: "utensilios cozinha", catId: 100010 },
  { nome: "Beleza e skincare", keyword: "skincare rosto", catId: 100630 },
  { nome: "Celular e gadgets", keyword: "acessorio celular", catId: 100013 },
  { nome: "Eletrônicos portáteis", keyword: "power bank carregador", catId: 100644 },
  { nome: "Fitness e academia", keyword: "acessorio academia", catId: 100637 },
  { nome: "Automotivo", keyword: "acessorio carro", catId: 102187 },
  { nome: "Áudio (fone e microfone)", keyword: "fone bluetooth", catId: 100535 },
  { nome: "Pet", keyword: "acessorio pet", catId: 100631 },
  { nome: "Bebê e maternidade", keyword: "produtos bebe", catId: 100632 },
  { nome: "Moda infantil", keyword: "roupa infantil menino", catId: 100633 },
  { nome: "Viagem e bagagem", keyword: "kit viagem organizador", catId: 100015 },
  { nome: "Suplementos", keyword: "creatina whey", catId: 100001 },
];

/**
 * Escolhe o tema por rotação determinística (data de Brasília). offset separa os
 * posts do mesmo dia: com 2 posts/dia, slot 0 e slot 1 pegam temas diferentes
 * (avança 2 por dia, cobre todos os temas ao longo dos dias).
 */
export function temaDoDia(offset = 0): Tema {
  const diaBRT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const diasDesdeEpoch = Math.floor(new Date(`${diaBRT}T00:00:00Z`).getTime() / (24 * 60 * 60 * 1000));
  return TEMAS[(diasDesdeEpoch * 2 + offset) % TEMAS.length];
}

/**
 * Loop diário: importa produtos da Shopee do tema do dia, ranqueia por vendas, monta
 * um RASCUNHO de carrossel com os melhores (fila — só entram na vitrine quando o dono
 * publica) e roda a faxina dos expirados. Gated em SHOPEE_APP_ID/SECRET.
 */
export async function rodarLoopDiario(
  supabase: SupabaseClient,
  n = 8,
  keyword?: string,
  offset = 0,
): Promise<{ tema: string; keyword: string; importados: number; carrosselId: number; faxina: { removidos: number; promovidos: number } }> {
  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_SECRET;
  if (!appId || !secret) throw new Error("Shopee não configurada (SHOPEE_APP_ID/SECRET)");

  // tema escolhido (do seletor) ou o do rodízio (offset separa os 2 posts do dia)
  const kw = keyword?.trim();
  const tema = kw
    ? (TEMAS.find((t) => t.keyword === kw) ?? { nome: kw, keyword: kw })
    : temaDoDia(offset);

  // blindagem contra cron mal configurado: no máximo 1 carrossel por tema por dia (BRT).
  // Se o agendador disparar de 15 em 15 min, só o 1º do dia monta; o resto é pulado.
  const diaBRT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const inicioDiaBRT = new Date(`${diaBRT}T00:00:00-03:00`).toISOString();
  const { data: jaHoje } = await supabase
    .from("execucoes")
    .select("id")
    .eq("job", "loop_diario")
    .eq("ok", true)
    .gte("criado_em", inicioDiaBRT)
    .contains("detalhe", { keyword: tema.keyword })
    .limit(1);
  if (jaHoje && jaHoje.length) {
    throw new Error(`o carrossel de "${tema.nome}" já foi montado hoje — pulando (o cron deve rodar 1x/dia por horário, não a cada 15 min)`);
  }

  const shopee = new ShopeeAffiliate({ appId, secret });
  // sortType:2 = mais vendidos (a Shopee já devolve ordenado por vendas, não pela
  // "relevância" bagunçada) — é o que dá o pool bom em vez de saco misturado
  const pg = await shopee.buscarOfertas({ keyword: tema.keyword, limit: 50, sortType: 2 });
  if (!pg.nodes.length) throw new Error(`Shopee não retornou ofertas pra "${tema.keyword}"`);

  // upsert na fila (novo); status sai do payload (default 'novo', preserva o existente)
  const linhas = pg.nodes.map(paraProduto).map(({ status: _s, ...r }) => r);
  const { data: up, error } = await supabase
    .from("produtos")
    .upsert(linhas, { onConflict: "origem,item_id,shop_id" })
    .select("id, titulo, preco, desconto_pct, imagem_url, vendas, avaliacao, cat_ids, status");
  if (error) throw new Error(error.message);

  // ranqueia por vendas, tira descartados
  const ranked = (up ?? [])
    .filter((p) => p.status !== "descartado")
    .sort((a, b) => (Number(b.vendas) || 0) - (Number(a.vendas) || 0));

  // FILTRO DE QUALIDADE: só entra quem tem imagem + tração de vendas + boa nota.
  // Corta o lixo que a busca por keyword solta traz junto.
  const MIN_VENDAS = 100; // vendas reportadas pela Shopee
  const MIN_NOTA = 4.4; // avaliação 0-5
  let bons = ranked.filter(
    (p) =>
      p.imagem_url &&
      (Number(p.vendas) || 0) >= MIN_VENDAS &&
      (p.avaliacao == null || Number(p.avaliacao) >= MIN_NOTA),
  );

  // FILTRO DE CATEGORIA: se o tema mapeia uma categoria real da Shopee, mantém só
  // quem é DAQUELA categoria (o cat_ids que a própria Shopee marcou no produto).
  // É isso que mata o off-theme (suéter infantil não entra em "relógio", etc.).
  if (tema.catId) {
    const alvo = String(tema.catId);
    const naCat = bons.filter(
      (p) => Array.isArray(p.cat_ids) && (p.cat_ids as unknown[]).map(String).includes(alvo),
    );
    if (naCat.length >= 4) bons = naCat; // categoria tem corpo → usa só ela
    // senão mantém `bons` sem o corte de categoria (não perde o post por magreza)
  }

  // usa os bons; se vier magro demais (<2 aprovados), cai no ranqueado geral
  // pra não perder o post do dia. dedup visual (mesmo produto de vendedores diferentes).
  const base = bons.length >= 2 ? bons : ranked;
  const escolhidos = dedupVisual(
    base,
    (p) => p.imagem_url as string,
    (p) => String(p.titulo),
  ).slice(0, n);
  if (escolhidos.length < 2) throw new Error("poucos produtos aproveitáveis no import");

  // categoriza em lote os recém-importados (não trava o loop)
  try {
    await categorizarProdutos(supabase);
  } catch {
    /* categoria é opcional */
  }

  const ordenados = escolhidos.map((p) => ({
    id: p.id as number,
    titulo: String(p.titulo),
    preco: p.preco as number | string | null,
    desconto_pct: p.desconto_pct as number | null,
  }));

  const carrosselId = await inserirRascunhoCarrossel(supabase, ordenados);
  const faxina = await faxinaExpirados(supabase);

  return { tema: tema.nome, keyword: tema.keyword, importados: escolhidos.length, carrosselId, faxina };
}
