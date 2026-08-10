"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { slugify } from "@/lib/slug";
import { reordenarVitrine } from "@/lib/ranking";
import { pontuarPendentes, classificarCategoria, categorizarProdutos } from "@/lib/curadoria";
import { gerarConteudo, salvarRascunho, type ProdutoParaConteudo } from "@/lib/conteudo";
import { publicarCarrossel as publicarCarrosselIG, publicarReel, instagramConfigurado } from "@/lib/instagram";
import { inserirRascunhoCarrossel, montarRascunhoAuto, curarProdutosParaVitrine } from "@/lib/carrossel";
import { rodarLoopDiario } from "@/lib/loop";
import { postarStoryAuto } from "@/lib/stories";
import { buscarItens } from "@/lib/mercadolivre";
import { ingerirItensML, ingerirOfertas, ingerirItensAli } from "@/lib/ingest";
import { ShopeeAffiliate, paraProduto } from "@/lib/shopee";
import { AliexpressAfiliado, idProdutoAli, paraProdutoAli } from "@/lib/aliexpress";

/** Instancia o cliente da AliExpress a partir do env; null se faltar credencial. */
function aliClient(): AliexpressAfiliado | null {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  if (!appKey || !appSecret) return null;
  return new AliexpressAfiliado({
    appKey,
    appSecret,
    trackingId: process.env.ALIEXPRESS_TRACKING_ID,
  });
}

function revalidar() {
  revalidatePath("/admin");
  revalidatePath("/admin/instagram"); // rascunhos/capa mudam com as actions do carrossel
  revalidatePath("/"); // a home muda quando um produto entra/sai da vitrine
}

/**
 * Pré-gera o banner OG (foto grande pro WhatsApp) e guarda no Storage, pra o
 * primeiro compartilhamento já vir com a imagem. Fire-and-forget (não trava o
 * Curar); no Node persistente do EasyPanel a chamada completa.
 */
function aquecerBanner(slug: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://pirraiashop.com.br";
  void fetch(`${base}/api/og/${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => {});
}

/**
 * Importa ofertas da Shopee por palavra-chave pra fila (status 'novo') via Open API.
 * O offerLink já vem como link de afiliado e pré-preenche o Curar. Gated em
 * SHOPEE_APP_ID/SECRET. Volta pro /admin com ?shopee=<gravadas> (ou ?shopee_erro).
 */
export async function importarShopee(formData: FormData) {
  const q = String(formData.get("q") ?? "").trim();
  if (!q) redirect("/admin?shopee_erro=vazio");

  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_SECRET;
  if (!appId || !secret) {
    redirect("/admin?shopee_erro=" + encodeURIComponent("SHOPEE_APP_ID/SECRET ausentes no servidor"));
  }

  const supabase = supabaseAdmin();
  const inicio = Date.now();
  let destino: string;
  try {
    const shopee = new ShopeeAffiliate({ appId: appId!, secret: secret! });
    const pg = await shopee.buscarOfertas({ keyword: q, limit: 50, page: 1 });
    const res = await ingerirOfertas(supabase, pg.nodes);
    await supabase.from("execucoes").insert({
      job: "ingest_shopee",
      ok: res.erros === 0,
      itens: res.gravadas,
      detalhe: { q, origem: "admin", ...res },
      duracao_ms: Date.now() - inicio,
    });
    destino =
      res.erros > 0
        ? `/admin?shopee_erro=${encodeURIComponent(res.detalhe ?? "1")}`
        : `/admin?shopee=${res.gravadas}`;
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "ingest_shopee",
      ok: false,
      itens: 0,
      detalhe: { q, origem: "admin", erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    destino = `/admin?shopee_erro=${encodeURIComponent(msg)}`;
  }

  revalidar();
  redirect(destino);
}

/**
 * Importa itens do Mercado Livre por palavra-chave pra fila de curadoria (status
 * 'novo'). O link de afiliado entra depois, manual, na hora de curar. Requer a
 * migration 002_mercadolivre.sql aplicada. Volta pro /admin com ?ml=<gravadas>
 * (ou ?ml_erro=1) pra dar um retorno visível.
 */
export async function importarML(formData: FormData) {
  const q = String(formData.get("q") ?? "").trim();
  if (!q) redirect("/admin?ml_erro=vazio");

  const supabase = supabaseAdmin();
  const inicio = Date.now();
  let destino: string;
  try {
    const itens = await buscarItens({ q, limit: 50 });
    const res = await ingerirItensML(supabase, itens);
    await supabase.from("execucoes").insert({
      job: "ingest_ml",
      ok: res.erros === 0,
      itens: res.gravadas,
      detalhe: { q, origem: "admin", ...res },
      duracao_ms: Date.now() - inicio,
    });
    destino =
      res.erros > 0
        ? `/admin?ml_erro=${encodeURIComponent(res.detalhe ?? "1")}`
        : `/admin?ml=${res.gravadas}`;
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "ingest_ml",
      ok: false,
      itens: 0,
      detalhe: { q, origem: "admin", erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    destino = `/admin?ml_erro=${encodeURIComponent(msg)}`;
  }

  revalidar();
  redirect(destino); // fora do try: o NEXT_REDIRECT não é engolido pelo catch
}

/**
 * Importa produtos da AliExpress por palavra-chave pra fila de curadoria ('novo').
 * Com ALIEXPRESS_TRACKING_ID definido, o promotion_link já vem e pré-preenche o
 * Curar. Gated em ALIEXPRESS_APP_KEY/SECRET. Requer a migration 008 aplicada.
 * Volta pro /admin com ?ali=<gravadas> (ou ?ali_erro).
 */
export async function importarAliexpress(formData: FormData) {
  const q = String(formData.get("q") ?? "").trim();
  if (!q) redirect("/admin?ali_erro=vazio");

  const ali = aliClient();
  if (!ali) {
    redirect("/admin?ali_erro=" + encodeURIComponent("ALIEXPRESS_APP_KEY/SECRET ausentes no servidor"));
  }

  const supabase = supabaseAdmin();
  const inicio = Date.now();
  let destino: string;
  try {
    const itens = await ali!.buscarProdutos({ keywords: q, pageSize: 50 });
    const res = await ingerirItensAli(supabase, itens);
    await supabase.from("execucoes").insert({
      job: "ingest_aliexpress",
      ok: res.erros === 0,
      itens: res.gravadas,
      detalhe: { q, origem: "admin", ...res },
      duracao_ms: Date.now() - inicio,
    });
    destino =
      res.erros > 0
        ? `/admin?ali_erro=${encodeURIComponent(res.detalhe ?? "1")}`
        : `/admin?ali=${res.gravadas}`;
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "ingest_aliexpress",
      ok: false,
      itens: 0,
      detalhe: { q, origem: "admin", erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    destino = `/admin?ali_erro=${encodeURIComponent(msg)}`;
  }

  revalidar();
  redirect(destino);
}

/**
 * Classifica em lote os produtos da fila que estão sem categoria (IA). Cria
 * categorias novas quando nenhuma existente serve. Botão "Categorizar fila".
 */
export async function categorizarFila() {
  const supabase = supabaseAdmin();
  const inicio = Date.now();
  try {
    // processa a fila inteira em lotes (categorizarProdutos faz até 80 por vez)
    let classificados = 0;
    const novas = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const res = await categorizarProdutos(supabase);
      classificados += res.classificados;
      res.novas.forEach((n) => novas.add(n));
      if (res.classificados === 0) break;
    }
    await supabase.from("execucoes").insert({
      job: "categorizar_fila",
      ok: true,
      itens: classificados,
      detalhe: { classificados, novas: [...novas] },
      duracao_ms: Date.now() - inicio,
    });
  } catch (e) {
    await supabase.from("execucoes").insert({
      job: "categorizar_fila",
      ok: false,
      itens: 0,
      detalhe: { erro: (e as Error).message },
      duracao_ms: Date.now() - inicio,
    });
  }
  revalidar();
  redirect("/admin?ver=fila");
}

/** Reordena a vitrine por performance (cliques) + potencial (score_ia). */
export async function reordenarPorPerformance() {
  await reordenarVitrine(supabaseAdmin());
  revalidar();
}

/** Pontua com IA os produtos da vitrine (curado/publicado) que ainda não têm score. */
export async function pontuarVitrine() {
  const supabase = supabaseAdmin();
  const inicio = Date.now();
  try {
    const res = await pontuarPendentes(supabase, ["curado", "publicado"]);
    await supabase.from("execucoes").insert({
      job: "pontuar_vitrine",
      ok: true,
      itens: res.gravados,
      detalhe: res,
      duracao_ms: Date.now() - inicio,
    });
  } catch (e) {
    await supabase.from("execucoes").insert({
      job: "pontuar_vitrine",
      ok: false,
      itens: 0,
      detalhe: { erro: (e as Error).message },
      duracao_ms: Date.now() - inicio,
    });
  }
  revalidar();
}

/**
 * Captura um produto vindo do bookmarklet (página aberta no navegador do dono).
 * COM link de afiliado (ex.: meli.la do "Compartilhar" do ML): classifica a
 * categoria com IA e vai DIRETO pra vitrine (curado + link). SEM link: cai na
 * fila como 'novo' pra curar depois. Dedup por (origem,item_id,shop_id).
 */
export async function capturarProduto(dados: {
  titulo?: string;
  preco?: number;
  preco_antigo?: number | null;
  imagem_url?: string;
  url_produto?: string;
  categoria?: string | null;
  loja_nome?: string | null;
  origem?: string;
  short_url?: string;
}): Promise<{ ok: boolean; id?: number; titulo?: string; curado?: boolean; erro?: string }> {
  const titulo = String(dados.titulo ?? "").trim();
  const imagemUrl = String(dados.imagem_url ?? "").trim();
  const preco = Number(dados.preco);
  if (!titulo || !imagemUrl || !Number.isFinite(preco) || preco <= 0) {
    return { ok: false, erro: "faltou título, imagem ou preço válido" };
  }

  // link de afiliado capturado (ex.: meli.la da janela "Compartilhar" do ML) — opcional
  const linkBruto = String(dados.short_url ?? "").trim();
  const linkAfiliado = /^https?:\/\//i.test(linkBruto) ? linkBruto : null;

  const url = String(dados.url_produto ?? "").trim();
  // detecta a fonte pela origem enviada ou pelo host da URL
  const ehML = dados.origem === "mercadolivre" || /mercadoli(vre|bre)\.com/i.test(url);
  let origem = "shopee";
  let shopId = 0;
  let itemId = Date.now();
  if (ehML) {
    // ML: id do produto/catálogo (MLB\d+) da URL, pra dedup. Sem shop_id → 0.
    origem = "mercadolivre";
    const m = url.match(/MLB-?(\d+)/i);
    itemId = m ? Number(m[1]) : Date.now();
  } else {
    // Shopee: shopid/itemid em várias formas de URL.
    const m =
      url.match(/-i\.(\d+)\.(\d+)/) ||
      url.match(/\/product\/(\d+)\/(\d+)/) ||
      url.match(/\/(\d{6,})\/(\d{6,})(?:[/?#]|$)/);
    shopId = m ? Number(m[1]) : 0;
    itemId = m ? Number(m[2]) : Date.now();
  }

  const precoAntigo =
    dados.preco_antigo != null && Number(dados.preco_antigo) > preco
      ? Number(dados.preco_antigo)
      : null;
  const desconto = precoAntigo ? Math.round((1 - preco / precoAntigo) * 100) : null;

  const supabase = supabaseAdmin();
  const temLink = !!linkAfiliado;

  // com link → classifica categoria (IA) pra ir pronta pra vitrine; sem link, fila
  let categoria = dados.categoria?.trim() || null;
  if (temLink && !categoria) {
    const { data: cats } = await supabase
      .from("categorias")
      .select("nome")
      .order("ordem", { ascending: true });
    categoria = await classificarCategoria(
      titulo,
      (cats ?? []).map((c) => c.nome as string),
    );
  }

  const row: Record<string, unknown> = {
    origem,
    item_id: itemId,
    shop_id: shopId,
    titulo,
    categoria,
    preco,
    preco_antigo: precoAntigo,
    desconto_pct: desconto,
    imagem_url: imagemUrl,
    url_produto: url || null,
    loja_nome: dados.loja_nome?.trim() || null,
  };
  if (linkAfiliado) row.link_afiliado = linkAfiliado;

  // com link → cura direto ('curado'); sem link → sem status (default 'novo', fila)
  const { data: prod, error } = await supabase
    .from("produtos")
    .upsert(temLink ? { ...row, status: "curado" } : { ...row }, {
      onConflict: "origem,item_id,shop_id",
    })
    .select("id")
    .single();

  if (error || !prod) {
    console.error("[admin] capturar produto:", error?.message);
    return { ok: false, erro: error?.message ?? "falha ao gravar" };
  }

  // com link → cria o link de afiliado (se ainda não tiver ativo) → vai pra vitrine
  if (temLink) {
    const { data: linkAtivo } = await supabase
      .from("links")
      .select("id")
      .eq("produto_id", prod.id)
      .eq("ativo", true)
      .maybeSingle();
    if (!linkAtivo) {
      let slug = slugify(titulo).slice(0, 60) || `produto-${prod.id}`;
      const raiz = slug;
      for (let i = 2; i < 60; i++) {
        const { data: existe } = await supabase
          .from("links")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!existe) break;
        slug = `${raiz}-${i}`;
      }
      const { data: ult } = await supabase
        .from("links")
        .select("ordem")
        .order("ordem", { ascending: false })
        .limit(1)
        .maybeSingle();
      await supabase.from("links").insert({
        produto_id: prod.id,
        slug,
        short_url: linkAfiliado!,
        ativo: true,
        ordem: (ult?.ordem ?? -1) + 1,
      });
      aquecerBanner(slug);
    }
  }

  revalidar();
  return { ok: true, id: prod.id, titulo, curado: temLink };
}

/**
 * Importa UM produto da Shopee pelo link → direto pra vitrine, curado.
 * Pega os dados pela Open API (por itemId), usa o offerLink como link de afiliado,
 * classifica a categoria com IA (nossa taxonomia) e cria produto 'curado' + link.
 * Volta com ?imp=<titulo> ou ?imp_erro=<msg>.
 */
export async function importarPorLink(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  // ML bloqueia o servidor → não dá por link colado; manda pro bookmarklet
  if (/mercadoli(vre|bre)\.com|meli\.la/i.test(url)) {
    redirect(
      "/admin?imp_erro=" +
        encodeURIComponent(
          'Pra Mercado Livre use o bookmarklet "Pirraia ML" (com o Compartilhar aberto) — o ML bloqueia o servidor, então não dá por link colado.',
        ),
    );
  }

  // Amazon: não tem API pra afiliado novo (PA-API exige 3 vendas) e a página bloqueia
  // scraping. Então joga pro + Produto com o link (do SiteStripe) já preenchido —
  // o dono completa título/preço/foto na mão.
  if (/amazon\.|amzn\.to|amzn\.eu|a\.co\//i.test(url)) {
    redirect("/admin/novo?link=" + encodeURIComponent(url));
  }

  // AliExpress: resolve o produto pela API de afiliado (detalhe + gera link se preciso)
  if (/aliexpress\.|a\.aliexpress|s\.click\.aliexpress|aliexpress-media/i.test(url)) {
    return importarLinkAliexpress(url);
  }

  const m =
    url.match(/-i\.(\d+)\.(\d+)/) ||
    url.match(/\/product\/(\d+)\/(\d+)/) ||
    url.match(/\/(\d{6,})\/(\d{6,})(?:[/?#]|$)/);
  if (!m) redirect("/admin?imp_erro=" + encodeURIComponent("Link de produto inválido"));

  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_SECRET;
  if (!appId || !secret) {
    redirect("/admin?imp_erro=" + encodeURIComponent("Shopee não configurada no servidor"));
  }

  const itemId = Number(m![2]);
  const supabase = supabaseAdmin();
  const inicio = Date.now();
  let destino: string;
  try {
    const shopee = new ShopeeAffiliate({ appId: appId!, secret: secret! });
    const pg = await shopee.buscarOfertas({ itemId, limit: 1 });
    const oferta = pg.nodes[0];
    if (!oferta) {
      throw new Error("produto não encontrado na Open API (pode não estar no programa de afiliado)");
    }

    const titulo = await curarLinhaDireta(supabase, paraProduto(oferta));

    await supabase.from("execucoes").insert({
      job: "importar_link",
      ok: true,
      itens: 1,
      detalhe: { itemId, titulo },
      duracao_ms: Date.now() - inicio,
    });
    destino = "/admin?imp=" + encodeURIComponent(titulo);
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "importar_link",
      ok: false,
      itens: 0,
      detalhe: { itemId, erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    destino = "/admin?imp_erro=" + encodeURIComponent(msg);
  }

  revalidar();
  redirect(destino);
}

/**
 * Importa um produto da AliExpress a partir do link colado: pega o detalhe pela API
 * de afiliado e, se o item ainda não trouxe promotion_link, gera um com o tracking_id.
 * Cai direto na vitrine ('curado'). Short link (s.click.aliexpress) é resolvido
 * seguindo o redirect pra extrair o product_id.
 */
async function importarLinkAliexpress(url: string) {
  const ali = aliClient();
  if (!ali) {
    redirect("/admin?imp_erro=" + encodeURIComponent("AliExpress não configurada no servidor"));
  }

  const supabase = supabaseAdmin();
  const inicio = Date.now();
  let destino: string;
  let itemId = 0;
  try {
    // extrai o id; se for short link sem id, segue o redirect pra achar a URL final
    let id = idProdutoAli(url);
    if (!id) {
      try {
        const r = await fetch(url, { redirect: "follow" });
        id = idProdutoAli(r.url);
      } catch {
        /* segue e falha com mensagem clara abaixo */
      }
    }
    if (!id) {
      throw new Error("não achei o id do produto no link — cole o link completo do item (…/item/<id>.html)");
    }
    itemId = id;

    // detalharProdutos já gera o link de afiliado real por produto (via link.generate)
    const [produto] = await ali!.detalharProdutos([id]);
    if (!produto) {
      throw new Error("produto não encontrado na API de afiliado (pode estar fora do programa)");
    }

    const titulo = await curarLinhaDireta(supabase, paraProdutoAli(produto));

    await supabase.from("execucoes").insert({
      job: "importar_link",
      ok: true,
      itens: 1,
      detalhe: { origem: "aliexpress", itemId, titulo },
      duracao_ms: Date.now() - inicio,
    });
    destino = "/admin?imp=" + encodeURIComponent(titulo);
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "importar_link",
      ok: false,
      itens: 0,
      detalhe: { origem: "aliexpress", itemId, erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    destino = "/admin?imp_erro=" + encodeURIComponent(msg);
  }

  revalidar();
  redirect(destino);
}

/**
 * Cura uma linha normalizada direto pra vitrine: classifica a categoria com IA,
 * faz upsert como 'curado' e cria o link de afiliado (com slug único) se ainda não
 * houver um ativo. Pré-aquece o banner OG. Devolve o título. Compartilhado pelos
 * importadores por link (Shopee/AliExpress) — mesma taxonomia, mesmo fluxo.
 */
async function curarLinhaDireta(
  supabase: ReturnType<typeof supabaseAdmin>,
  linha: { titulo: string; link_afiliado: string | null; url_produto: string } & Record<string, unknown>,
): Promise<string> {
  const { data: cats } = await supabase
    .from("categorias")
    .select("nome")
    .order("ordem", { ascending: true });
  const categoria = await classificarCategoria(
    linha.titulo,
    (cats ?? []).map((c) => c.nome as string),
  );

  const { status: _status, ...resto } = linha;
  const { data: prod, error: e1 } = await supabase
    .from("produtos")
    .upsert(
      { ...resto, categoria: categoria ?? null, status: "curado" },
      { onConflict: "origem,item_id,shop_id" },
    )
    .select("id")
    .single();
  if (e1 || !prod) throw new Error(e1?.message ?? "falha ao gravar o produto");

  const shortUrl = linha.link_afiliado || linha.url_produto;
  const { data: linkAtivo } = await supabase
    .from("links")
    .select("id")
    .eq("produto_id", prod.id)
    .eq("ativo", true)
    .maybeSingle();
  if (!linkAtivo && shortUrl) {
    let slug = slugify(linha.titulo).slice(0, 60) || `produto-${prod.id}`;
    const raiz = slug;
    for (let i = 2; i < 60; i++) {
      const { data: existe } = await supabase
        .from("links")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existe) break;
      slug = `${raiz}-${i}`;
    }
    const { data: ult } = await supabase
      .from("links")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    await supabase.from("links").insert({
      produto_id: prod.id,
      slug,
      short_url: shortUrl,
      ativo: true,
      ordem: (ult?.ordem ?? -1) + 1,
    });
    aquecerBanner(slug);
  }

  return linha.titulo;
}

/**
 * Adiciona um produto manualmente já na vitrine (fase manual, antes da ingestão).
 * Cria o produto como 'curado' + o link de afiliado num passo. Redireciona pro
 * /admin no fim; se algum campo obrigatório faltar, volta pro form com ?erro=1.
 */
export async function adicionarProduto(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const imagemUrl = String(formData.get("imagem_url") ?? "").trim();
  const preco = Number(formData.get("preco"));
  const precoAntigoRaw = String(formData.get("preco_antigo") ?? "").trim();
  const precoAntigo = precoAntigoRaw ? Number(precoAntigoRaw) : null;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const loja = String(formData.get("loja_nome") ?? "").trim() || null;
  const shortUrl = String(formData.get("short_url") ?? "").trim();
  const slugBase = slugify(String(formData.get("slug") ?? "") || titulo);

  const invalido =
    !titulo ||
    !imagemUrl ||
    !Number.isFinite(preco) ||
    preco <= 0 ||
    !shortUrl ||
    !/^https?:\/\//i.test(shortUrl);
  if (invalido) redirect("/admin/novo?erro=1");

  const supabase = supabaseAdmin();

  const desconto =
    precoAntigo && precoAntigo > preco
      ? Math.round((1 - preco / precoAntigo) * 100)
      : null;

  const { data: prod, error: e1 } = await supabase
    .from("produtos")
    .insert({
      origem: "manual",
      item_id: Date.now(),
      titulo,
      categoria,
      preco,
      preco_antigo: precoAntigo,
      desconto_pct: desconto,
      imagem_url: imagemUrl,
      loja_nome: loja,
      status: "curado",
    })
    .select("id")
    .single();
  if (e1 || !prod) {
    console.error("[admin] adicionar produto:", e1?.message);
    redirect("/admin/novo?erro=1");
  }

  // slug único
  let slug = slugBase || `produto-${prod.id}`;
  const raiz = slug;
  for (let i = 2; i < 60; i++) {
    const { data: existe } = await supabase
      .from("links")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existe) break;
    slug = `${raiz}-${i}`;
  }
  const { data: ult } = await supabase
    .from("links")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = (ult?.ordem ?? -1) + 1;

  await supabase.from("links").insert({
    produto_id: prod.id,
    slug,
    short_url: shortUrl,
    ativo: true,
    ordem,
  });

  revalidar();
  redirect("/admin");
}

/** Edita um produto da vitrine (produto + link) num passo. */
export async function editarProduto(formData: FormData) {
  const produtoId = Number(formData.get("produtoId"));
  const linkId = Number(formData.get("linkId"));
  const titulo = String(formData.get("titulo") ?? "").trim();
  const imagemUrl = String(formData.get("imagem_url") ?? "").trim();
  const preco = Number(formData.get("preco"));
  const precoAntigoRaw = String(formData.get("preco_antigo") ?? "").trim();
  const precoAntigo = precoAntigoRaw ? Number(precoAntigoRaw) : null;
  const categoria = String(formData.get("categoria") ?? "").trim() || null;
  const loja = String(formData.get("loja_nome") ?? "").trim() || null;
  const shortUrl = String(formData.get("short_url") ?? "").trim();
  const slugBase = slugify(String(formData.get("slug") ?? "") || titulo);

  const invalido =
    !produtoId ||
    !linkId ||
    !titulo ||
    !imagemUrl ||
    !Number.isFinite(preco) ||
    preco <= 0 ||
    !shortUrl ||
    !/^https?:\/\//i.test(shortUrl);
  if (invalido) redirect(`/admin/editar/${produtoId}?erro=1`);

  const supabase = supabaseAdmin();
  const desconto =
    precoAntigo && precoAntigo > preco
      ? Math.round((1 - preco / precoAntigo) * 100)
      : null;

  await supabase
    .from("produtos")
    .update({
      titulo,
      categoria,
      preco,
      preco_antigo: precoAntigo,
      desconto_pct: desconto,
      imagem_url: imagemUrl,
      loja_nome: loja,
    })
    .eq("id", produtoId);

  // slug único, excluindo o próprio link
  let slug = slugBase || `produto-${produtoId}`;
  const raiz = slug;
  for (let i = 2; i < 60; i++) {
    const { data: existe } = await supabase
      .from("links")
      .select("id")
      .eq("slug", slug)
      .neq("id", linkId)
      .maybeSingle();
    if (!existe) break;
    slug = `${raiz}-${i}`;
  }
  await supabase.from("links").update({ slug, short_url: shortUrl }).eq("id", linkId);

  revalidar();
  redirect("/admin");
}

/**
 * Cura um produto 'novo': cria o link de afiliado (com o short_url colado
 * manualmente, já que a Shopee Open API ainda não gera shortlink) e marca
 * o produto como 'curado' — aí ele passa a aparecer na vitrine.
 */
export async function curarProduto(formData: FormData) {
  const produtoId = Number(formData.get("produtoId"));
  const shortUrl = String(formData.get("shortUrl") ?? "").trim();
  const slugBase = slugify(String(formData.get("slug") ?? ""));
  const categoria = String(formData.get("categoria") ?? "").trim();

  if (!produtoId || !shortUrl || !/^https?:\/\//i.test(shortUrl)) return;

  const supabase = supabaseAdmin();

  // slug único: se já existir, sufixa -2, -3...
  let slug = slugBase || `produto-${produtoId}`;
  const raiz = slug;
  for (let i = 2; i < 60; i++) {
    const { data: existe } = await supabase
      .from("links")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existe) break;
    slug = `${raiz}-${i}`;
  }

  // ordem = fim da fila (max + 1)
  const { data: ult } = await supabase
    .from("links")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = (ult?.ordem ?? -1) + 1;

  const { error } = await supabase.from("links").insert({
    produto_id: produtoId,
    slug,
    short_url: shortUrl,
    ativo: true,
    ordem,
  });
  if (error) {
    console.error("[admin] curar (link):", error.message);
    return;
  }

  // marca curado e grava a categoria escolhida (se veio) num passo só
  const patch: { status: string; categoria?: string } = { status: "curado" };
  if (categoria) patch.categoria = categoria;
  await supabase.from("produtos").update(patch).eq("id", produtoId);
  revalidar();
  aquecerBanner(slug);
}

/**
 * Limpa os produtos de exemplo do seed inicial (some da vitrine e da fila).
 * Marcador seguro: `url_produto` de placeholder `https://shopee.com.br/produto-<n>`
 * — os produtos reais cadastrados pelo `+ Produto` têm url_produto nula, então
 * não batem no filtro. Descarte reversível (status 'descartado' + link inativo),
 * não apaga de vez.
 */
const MARCADOR_EXEMPLO = "https://shopee.com.br/produto-%";

export async function limparExemplos() {
  const supabase = supabaseAdmin();
  const { data: exemplos } = await supabase
    .from("produtos")
    .select("id")
    .like("url_produto", MARCADOR_EXEMPLO)
    .neq("status", "descartado");
  const ids = (exemplos ?? []).map((p) => p.id);
  if (ids.length === 0) return;

  // desativa os links (some da vitrine) e descarta os produtos (some da fila)
  await supabase.from("links").update({ ativo: false }).in("produto_id", ids);
  await supabase.from("produtos").update({ status: "descartado" }).in("id", ids);
  revalidar();
}

/** Descarta um produto da fila (não volta a aparecer). */
export async function descartarProduto(formData: FormData) {
  const produtoId = Number(formData.get("produtoId"));
  if (!produtoId) return;
  await supabaseAdmin()
    .from("produtos")
    .update({ status: "descartado" })
    .eq("id", produtoId);
  revalidar();
}

/**
 * Limpa a fila inteira de uma vez: todos os 'novo' viram 'descartado'. Reversível,
 * igual ao descarte individual — não apaga do banco. Acionada pelo botão "Limpar
 * fila" (com passo de confirmação na tela). Volta pro /admin com a contagem.
 */
export async function limparFila() {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("produtos")
    .update({ status: "descartado" })
    .eq("status", "novo")
    .select("id");
  revalidar();
  redirect(`/admin?ver=fila&fila_limpa=${data?.length ?? 0}`);
}

/** Liga/desliga o destaque de um item da vitrine. */
export async function alternarDestaque(formData: FormData) {
  const linkId = Number(formData.get("linkId"));
  const destaque = formData.get("destaque") === "true";
  if (!linkId) return;
  await supabaseAdmin().from("links").update({ destaque }).eq("id", linkId);
  revalidar();
}

/**
 * Move um item pra cima/baixo na vitrine.
 *
 * Ordena os links EXATAMENTE como a view `vitrine` mostra (destaque desc, ordem asc,
 * score_ia desc) — senão o "vizinho" que o mover troca não é o vizinho da tela (os
 * destaque e não-destaque ficam intercalados por `ordem`, e a troca cai no item
 * errado → parece que a seta não funciona). Depois de trocar as posições, renumera
 * o `ordem` de todos em sequência: fica à prova de empate e o `ordem` passa a bater
 * com a ordem exibida.
 */
export async function moverLink(formData: FormData) {
  const linkId = Number(formData.get("linkId"));
  const direcao = String(formData.get("direcao"));
  if (!linkId) return;

  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("links")
    .select("id, ordem, destaque, produtos(score_ia)")
    .eq("ativo", true);
  if (!data) return;

  const scoreDe = (l: { produtos: unknown }): number => {
    const p = l.produtos as { score_ia: number | null } | { score_ia: number | null }[] | null;
    const s = Array.isArray(p) ? p[0]?.score_ia : p?.score_ia;
    return s ?? -1;
  };

  const links = [...data].sort((a, b) => {
    if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;
    if ((a.ordem ?? 0) !== (b.ordem ?? 0)) return (a.ordem ?? 0) - (b.ordem ?? 0);
    return scoreDe(b) - scoreDe(a);
  });

  const idx = links.findIndex((l) => l.id === linkId);
  if (idx < 0) return;
  const alvo = direcao === "cima" ? idx - 1 : idx + 1;
  if (alvo < 0 || alvo >= links.length) return;

  [links[idx], links[alvo]] = [links[alvo], links[idx]];

  // renumera todos em sequência (só grava quem mudou)
  await Promise.all(
    links.map((l, i) =>
      (l.ordem ?? -1) === i ? null : supabase.from("links").update({ ordem: i }).eq("id", l.id),
    ),
  );
  revalidar();
}

/** Tira o item da vitrine: desativa o link e descarta o produto. */
export async function removerDaVitrine(formData: FormData) {
  const linkId = Number(formData.get("linkId"));
  const produtoId = Number(formData.get("produtoId"));
  if (!linkId) return;

  const supabase = supabaseAdmin();
  await supabase.from("links").update({ ativo: false }).eq("id", linkId);
  if (produtoId) {
    await supabase.from("produtos").update({ status: "descartado" }).eq("id", produtoId);
  }
  revalidar();
}

/**
 * Pausa/reativa um item da vitrine. Pausado sai da vitrine pública (a view filtra
 * pausado=false) mas o link segue ativo, então continua no admin pra reativar.
 * É pra "sem estoque / volta depois" — diferente do descarte, que tira de vez.
 */
export async function alternarPausa(formData: FormData) {
  const linkId = Number(formData.get("linkId"));
  const pausar = formData.get("pausar") === "true";
  if (!linkId) return;
  await supabaseAdmin().from("links").update({ pausado: pausar }).eq("id", linkId);
  revalidar();
}

/**
 * Gera (ou reusa) a legenda + hashtags de um produto pro feed do Instagram, pro
 * botão "Copiar legenda" do card. Reusa um post existente do canal feed se houver
 * (economiza chamada); senão gera com a IA e salva como rascunho (fica em
 * /admin/conteudo também). Chamada por um client component, devolve o texto.
 */
export async function gerarLegendaProduto(
  produtoId: number,
): Promise<{ ok: true; legenda: string; hashtags: string[] } | { ok: false; erro: string }> {
  if (!produtoId) return { ok: false, erro: "produto inválido" };
  const supabase = supabaseAdmin();

  // já existe um post do feed pra esse produto? reusa a legenda/hashtags
  const { data: existente } = await supabase
    .from("posts")
    .select("legenda, hashtags")
    .eq("produto_id", produtoId)
    .eq("canal", "instagram_feed")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existente?.legenda) {
    return {
      ok: true,
      legenda: existente.legenda as string,
      hashtags: (existente.hashtags as string[]) ?? [],
    };
  }

  const { data: p } = await supabase
    .from("produtos")
    .select("id, titulo, categoria, preco, preco_antigo, desconto_pct, loja_nome, angulo_ia, tags_ia")
    .eq("id", produtoId)
    .maybeSingle();
  if (!p) return { ok: false, erro: "produto não encontrado" };

  try {
    const conteudo = await gerarConteudo(p as ProdutoParaConteudo, "instagram_feed");
    if (!conteudo) return { ok: false, erro: "a IA não devolveu conteúdo" };
    const { data: link } = await supabase
      .from("links")
      .select("id")
      .eq("produto_id", produtoId)
      .eq("ativo", true)
      .maybeSingle();
    await salvarRascunho(supabase, {
      produtoId,
      linkId: link?.id ?? null,
      canal: "instagram_feed",
      conteudo,
    });
    revalidar();
    return { ok: true, legenda: conteudo.legenda, hashtags: conteudo.hashtags };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/**
 * Monta um rascunho de carrossel "achados do dia": recebe os produtos marcados
 * (2 a 10), gera a legenda + hashtags com a IA e grava em `carrosseis` como
 * rascunho. O dono revisa e publica depois. Volta pro /admin/instagram.
 */
export async function montarCarrossel(formData: FormData) {
  const ids = formData
    .getAll("produtoIds")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (ids.length < 2) redirect("/admin/instagram?erro=" + encodeURIComponent("marca de 2 a 9 produtos"));
  if (ids.length > 9) redirect("/admin/instagram?erro=" + encodeURIComponent("máximo de 9 produtos (a capa é o 1º slide, total 10)"));

  const supabase = supabaseAdmin();
  try {
    const { data: prods } = await supabase
      .from("produtos")
      .select("id, titulo, preco, desconto_pct")
      .in("id", ids);
    // preserva a ordem que o dono marcou
    const ordenados = ids
      .map((id) => (prods ?? []).find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (ordenados.length < 2) throw new Error("produtos não encontrados");

    await inserirRascunhoCarrossel(supabase, ordenados);
  } catch (e) {
    redirect("/admin/instagram?erro=" + encodeURIComponent((e as Error).message));
  }

  revalidar();
  redirect("/admin/instagram?ok=montado");
}

/**
 * Monta um rascunho de carrossel AUTOMÁTICO: a IA escolhe os produtos do dia
 * (temático, sem repetir os postados nos últimos 14 dias), gera capa + legenda e
 * deixa o rascunho pronto pra revisar/publicar. Botão "Montar automático" e o cron.
 */
export async function montarCarrosselAuto() {
  const supabase = supabaseAdmin();
  const inicio = Date.now();
  let destino: string;
  try {
    const res = await montarRascunhoAuto(supabase, 12);
    await supabase.from("execucoes").insert({
      job: "montar_carrossel_auto",
      ok: true,
      itens: res.n,
      detalhe: { origem: "admin", ...res },
      duracao_ms: Date.now() - inicio,
    });
    destino = "/admin/instagram?ok=montado";
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "montar_carrossel_auto",
      ok: false,
      itens: 0,
      detalhe: { origem: "admin", erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    destino = "/admin/instagram?erro=" + encodeURIComponent(msg);
  }
  revalidar();
  redirect(destino);
}

/**
 * Roda o loop do dia: importa produtos Shopee do tema da vez, monta o rascunho de
 * carrossel com os melhores e faz a faxina dos expirados. Botão no /admin/instagram
 * e a rota de cron. Os produtos só entram na vitrine quando o carrossel é publicado.
 */
export async function rodarLoopDoDia(formData?: FormData) {
  // tema escolhido no seletor (custom tem prioridade); vazio = rodízio do dia
  const custom = String(formData?.get("tema_custom") ?? "").trim();
  const sel = String(formData?.get("tema") ?? "").trim();
  const keyword = custom || sel || undefined;

  const supabase = supabaseAdmin();
  const inicio = Date.now();
  let destino: string;
  try {
    const res = await rodarLoopDiario(supabase, 12, keyword);
    await supabase.from("execucoes").insert({
      job: "loop_diario",
      ok: true,
      itens: res.importados,
      detalhe: { origem: "admin", ...res },
      duracao_ms: Date.now() - inicio,
    });
    destino = `/admin/instagram?ok=montado&tema=${encodeURIComponent(res.tema)}`;
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "loop_diario",
      ok: false,
      itens: 0,
      detalhe: { origem: "admin", erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    destino = "/admin/instagram?erro=" + encodeURIComponent(msg);
  }
  revalidar();
  redirect(destino);
}

/**
 * Publica um rascunho de carrossel no Instagram. Gera (aquece) os criativos de
 * cada produto no Storage, monta as URLs JPEG diretas e chama a Graph API. Usa a
 * legenda (possivelmente editada) do formulário. Marca publicado/erro no registro.
 */
export async function publicarCarrossel(formData: FormData) {
  const id = Number(formData.get("carrosselId"));
  const legendaEditada = String(formData.get("legenda") ?? "").trim();
  const ganchoEditado = String(formData.get("gancho") ?? "").trim();
  if (!id) redirect("/admin/instagram?erro=" + encodeURIComponent("carrossel inválido"));

  const supabase = supabaseAdmin();
  try {
    const { data: c } = await supabase
      .from("carrosseis")
      .select("id, produto_ids, legenda, gancho, status")
      .eq("id", id)
      .maybeSingle();
    if (!c) throw new Error("carrossel não encontrado");
    if (c.status === "publicado") throw new Error("esse carrossel já foi publicado");

    const todos = (c.produto_ids as number[]) ?? [];
    if (todos.length < 2) throw new Error("carrossel precisa de pelo menos 2 produtos");
    // o Instagram aceita 10 slides: capa + até 9 produtos. Se o rascunho tem mais
    // (o dono não removeu), publica os 9 primeiros.
    const ids = todos.slice(0, 9);

    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://pirraiashop.com.br";
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supaUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente no servidor");

    // aplica gancho/legenda editados ANTES de aquecer a capa (a capa lê o gancho do banco)
    const gancho = ganchoEditado || (c.gancho as string) || "";
    const caption = legendaEditada || (c.legenda as string) || "";
    await supabase.from("carrosseis").update({ gancho, legenda: caption }).eq("id", id);

    // 1º slide = CAPA (gancho + foto de fundo); depois os criativos dos produtos
    const imageUrls: string[] = [];
    await fetch(`${base}/api/capa/${id}`, { redirect: "manual", cache: "no-store" }).catch(() => {});
    imageUrls.push(`${supaUrl}/storage/v1/object/public/criativos/capa-${id}.jpg`);
    for (const pid of ids) {
      await fetch(`${base}/api/criativo/${pid}`, { redirect: "manual", cache: "no-store" }).catch(() => {});
      imageUrls.push(`${supaUrl}/storage/v1/object/public/criativos/${pid}.jpg`);
    }

    // cura os produtos pra vitrine (validade 15 dias) — assim o público acha pelo
    // nome quando o post sair; some sozinho depois. Idempotente (pula quem já tem link).
    await curarProdutosParaVitrine(supabase, ids, 15);

    const { id: mediaId } = await publicarCarrosselIG({ imageUrls, caption });

    await supabase
      .from("carrosseis")
      .update({ status: "publicado", ig_media_id: mediaId, erro: null, publicado_em: new Date().toISOString() })
      .eq("id", id);
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("carrosseis").update({ status: "erro", erro: msg }).eq("id", id);
    redirect("/admin/instagram?erro=" + encodeURIComponent(msg));
  }

  revalidar();
  redirect("/admin/instagram?ok=publicado");
}

/** Salva o gancho editado do carrossel (pra a prévia da capa atualizar). */
export async function atualizarGancho(formData: FormData) {
  const carrosselId = Number(formData.get("carrosselId"));
  const gancho = String(formData.get("gancho") ?? "").trim();
  if (!carrosselId) return;
  await supabaseAdmin().from("carrosseis").update({ gancho }).eq("id", carrosselId);
  revalidar();
  redirect("/admin/instagram");
}

/** Remove UM produto de um rascunho de carrossel (o dono tira o que não gostou). */
export async function removerDoCarrossel(formData: FormData) {
  const carrosselId = Number(formData.get("carrosselId"));
  const produtoId = Number(formData.get("produtoId"));
  if (!carrosselId || !produtoId) return;
  const supabase = supabaseAdmin();
  const { data: c } = await supabase
    .from("carrosseis")
    .select("produto_ids")
    .eq("id", carrosselId)
    .maybeSingle();
  if (!c) return;
  const novos = ((c.produto_ids as number[]) ?? []).filter((pid) => pid !== produtoId);
  await supabase.from("carrosseis").update({ produto_ids: novos }).eq("id", carrosselId);
  revalidar();
  redirect("/admin/instagram");
}

/**
 * TESTE: pega um produto AliExpress com vídeo e tenta publicar como Reel (vídeo cru,
 * sem re-encodar). Serve pra descobrir se o IG aceita o formato do vídeo do Ali.
 */
export async function postarReelTeste() {
  const supabase = supabaseAdmin();
  const inicio = Date.now();
  let destino: string;
  try {
    if (!instagramConfigurado()) throw new Error("Instagram não configurado no servidor");
    const { data: p } = await supabase
      .from("produtos")
      .select("id, titulo, video_url")
      .eq("origem", "aliexpress")
      .not("video_url", "is", null)
      .order("visto_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!p?.video_url) {
      throw new Error("nenhum produto AliExpress com vídeo na base — importe um do Ali (por palavra/link) primeiro");
    }
    const caption = `${p.titulo}\n\n🔗 tá no link da bio — é só pesquisar o nome!\n\n#achadinhos #aliexpress #achadinhosdaliexpress`;
    const { id: mediaId } = await publicarReel({ videoUrl: p.video_url as string, caption });
    await supabase.from("execucoes").insert({
      job: "reel_teste",
      ok: true,
      itens: 1,
      detalhe: { produto: p.id, mediaId },
      duracao_ms: Date.now() - inicio,
    });
    destino = "/admin/instagram?ok=reel";
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("execucoes").insert({
      job: "reel_teste",
      ok: false,
      itens: 0,
      detalhe: { erro: msg },
      duracao_ms: Date.now() - inicio,
    });
    destino = "/admin/instagram?erro=" + encodeURIComponent(msg);
  }
  revalidar();
  redirect(destino);
}

/** Posta 1 story agora (teste manual do fluxo automático). */
export async function postarStoryAgora() {
  const supabase = supabaseAdmin();
  const inicio = Date.now();
  let destino: string;
  try {
    const res = await postarStoryAuto(supabase, 1);
    await supabase.from("execucoes").insert({
      job: "story_auto",
      ok: res.erros === 0,
      itens: res.postados,
      detalhe: { origem: "admin", ...res },
      duracao_ms: Date.now() - inicio,
    });
    destino =
      res.postados > 0
        ? "/admin/instagram?ok=story"
        : "/admin/instagram?erro=" + encodeURIComponent(String(res.detalhe[0]?.erro ?? "nada pra postar"));
  } catch (e) {
    destino = "/admin/instagram?erro=" + encodeURIComponent((e as Error).message);
  }
  revalidar();
  redirect(destino);
}

/** Descarta um rascunho de carrossel (apaga o registro). */
export async function descartarCarrossel(formData: FormData) {
  const id = Number(formData.get("carrosselId"));
  if (!id) return;
  await supabaseAdmin().from("carrosseis").delete().eq("id", id);
  revalidar();
  redirect("/admin/instagram");
}
