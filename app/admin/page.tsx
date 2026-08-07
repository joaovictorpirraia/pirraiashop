import { supabaseAdmin } from "@/lib/supabase";
import { slugify } from "@/lib/slug";
import { brl } from "@/lib/format";
import {
  curarProduto,
  descartarProduto,
  alternarDestaque,
  moverLink,
  removerDaVitrine,
  reordenarPorPerformance,
  pontuarVitrine,
  importarML,
  importarShopee,
  importarAliexpress,
  importarPorLink,
  limparExemplos,
} from "./actions";

export const dynamic = "force-dynamic";

interface ProdutoNovo {
  id: number;
  origem: string | null;
  titulo: string;
  categoria: string | null;
  preco: string | number | null;
  preco_antigo: string | number | null;
  desconto_pct: number | null;
  imagem_url: string | null;
  loja_nome: string | null;
  url_produto: string | null;
  link_afiliado: string | null;
  score_ia: number | null;
  comissao_pct: number | string | null;
  comissao_valor: number | string | null;
}

/** Rótulo da loja de origem pra "abrir e pegar o link de afiliado". */
const ORIGEM_ROTULO: Record<string, string> = {
  shopee: "Shopee",
  mercadolivre: "Mercado Livre",
  tiktok: "TikTok Shop",
};

/** minúsculo e sem acento — busca "contém" tolerante no português */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

interface LinkVitrine {
  id: number;
  slug: string;
  short_url: string;
  destaque: boolean;
  ordem: number | null;
  cliques: number;
  produto: {
    id: number;
    titulo: string;
    categoria: string | null;
    preco: string | number | null;
    imagem_url: string | null;
    loja_nome: string | null;
    status: string;
    comissao_pct: number | string | null;
    comissao_valor: number | string | null;
  };
}

export default async function Admin({
  searchParams,
}: {
  searchParams: {
    ml?: string;
    ml_erro?: string;
    shopee?: string;
    shopee_erro?: string;
    ali?: string;
    ali_erro?: string;
    imp?: string;
    imp_erro?: string;
    ver?: string;
    q?: string;
  };
}) {
  const supabase = supabaseAdmin();
  const ver = searchParams.ver === "vitrine" ? "vitrine" : "fila";
  const q = (searchParams.q ?? "").trim();

  // contagem total da fila (rótulo da aba, sem filtro)
  const { count: nFila } = await supabase
    .from("produtos")
    .select("id", { count: "exact", head: true })
    .eq("status", "novo");

  // dados da fila só quando a aba é fila (evita renderizar 293 cards atoa)
  let fila: ProdutoNovo[] = [];
  if (ver === "fila") {
    let fq = supabase
      .from("produtos")
      .select(
        "id, origem, titulo, categoria, preco, preco_antigo, desconto_pct, imagem_url, loja_nome, url_produto, link_afiliado, score_ia, comissao_pct, comissao_valor",
      )
      .eq("status", "novo");
    if (q) fq = fq.ilike("titulo", `%${q}%`);
    const { data } = await fq
      .order("comissao_pct", { ascending: false, nullsFirst: false })
      .order("score_ia", { ascending: false, nullsFirst: false })
      .order("visto_em", { ascending: false });
    fila = (data ?? []) as ProdutoNovo[];
  }

  const { data: linksRaw } = await supabase
    .from("links")
    .select(
      "id, slug, short_url, destaque, ordem, cliques, produto:produtos!inner(id, titulo, categoria, preco, imagem_url, loja_nome, status, comissao_pct, comissao_valor)",
    )
    .eq("ativo", true)
    .order("destaque", { ascending: false })
    .order("ordem", { ascending: true });

  // quantos produtos de exemplo (do seed) ainda existem — pra oferecer a limpeza
  const { count: nExemplos } = await supabase
    .from("produtos")
    .select("id", { count: "exact", head: true })
    .like("url_produto", "https://shopee.com.br/produto-%")
    .neq("status", "descartado");

  // lista de categorias (gerida em /admin/categorias) pro seletor do Curar
  const { data: catsRaw } = await supabase
    .from("categorias")
    .select("nome")
    .order("ordem", { ascending: true });
  const categorias = (catsRaw ?? []).map((c) => c.nome as string);

  const vitrineTodos = ((linksRaw ?? []) as unknown[])
    .map((l) => {
      const row = l as LinkVitrine & { produto: LinkVitrine["produto"] | LinkVitrine["produto"][] };
      const produto = Array.isArray(row.produto) ? row.produto[0] : row.produto;
      return { ...row, produto } as LinkVitrine;
    })
    .filter((l) => l.produto && ["curado", "publicado"].includes(l.produto.status));
  const nVitrine = vitrineTodos.length;
  const vitrine =
    ver === "vitrine" && q
      ? vitrineTodos.filter((l) => norm(l.produto.titulo).includes(norm(q)))
      : vitrineTodos;

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span>{" "}
            <span className="text-fumo">admin</span>
          </span>
          <div className="flex items-center gap-3 text-xs text-fumo">
            <span>
              {nFila ?? 0} na fila · {nVitrine} na vitrine
            </span>
            <a
              href="/admin/novo"
              className="rounded-full bg-pirraia px-3 py-1.5 font-bold text-white transition-colors hover:bg-pirraia-dark"
            >
              + Produto
            </a>
            <a
              href="/admin/conteudo"
              className="rounded-full border border-black/10 px-3 py-1.5 font-bold text-tinta transition-colors hover:bg-white"
            >
              Conteúdo
            </a>
            <a
              href="/admin/categorias"
              className="rounded-full border border-black/10 px-3 py-1.5 font-bold text-tinta transition-colors hover:bg-white"
            >
              Categorias
            </a>
            <a
              href="/admin/metricas"
              className="rounded-full bg-tinta px-3 py-1.5 font-bold text-white transition-colors hover:bg-pirraia"
            >
              Métricas
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-5 py-8">
        {/* IMPORTAR POR LINK — cola o link do produto Shopee/AliExpress → vitrine pronto */}
        <section className="rounded-2xl bg-white p-4 shadow-carta">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">
              Importar por link
            </h2>
            <span className="text-xs text-fumo">Shopee · AliExpress · vai direto pra vitrine</span>
          </div>
          <form action={importarPorLink} className="flex flex-col gap-2 sm:flex-row">
            <input
              name="url"
              required
              placeholder="cola o link do produto (Shopee ou AliExpress)…"
              className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-pirraia"
            />
            <button
              type="submit"
              className="rounded-lg bg-[#EE4D2D] px-5 py-2 text-sm font-bold text-white transition hover:brightness-95"
              title="Puxa dados + link de afiliado + categoria (IA) e joga na vitrine já curado."
            >
              Importar
            </button>
          </form>
          <p className="mt-2 text-xs text-fumo">
            Mercado Livre não entra por link (eles bloqueiam o servidor) — use o bookmarklet
            <span className="font-semibold text-tinta"> Pirraia ML</span> com o Compartilhar aberto.
          </p>
          {searchParams.imp != null && (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
              Importado pra vitrine: {searchParams.imp}
            </p>
          )}
          {searchParams.imp_erro != null && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
              Falha ao importar: {searchParams.imp_erro}
            </p>
          )}
        </section>

        {/* PRODUTOS DE EXEMPLO (seed) — some quando limpar */}
        {(nExemplos ?? 0) > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-carta sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-tinta">
              <span className="font-semibold">{nExemplos} produto(s) de exemplo</span> ainda na
              vitrine/fila (do seed inicial). Tire eles antes de mandar tráfego.
            </div>
            <form action={limparExemplos}>
              <button
                type="submit"
                className="w-full whitespace-nowrap rounded-lg bg-tinta px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-pirraia sm:w-auto"
                title="Descarta os produtos de exemplo (some da vitrine e da fila). É reversível — não apaga do banco."
              >
                Limpar exemplos
              </button>
            </form>
          </div>
        )}

        {/* SWITCHER Fila/Vitrine + busca por nome */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <a
              href={`/admin?ver=fila${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                ver === "fila" ? "bg-tinta text-white" : "bg-white text-fumo shadow-carta hover:text-tinta"
              }`}
            >
              Fila <span className="tabular-nums opacity-70">{nFila ?? 0}</span>
            </a>
            <a
              href={`/admin?ver=vitrine${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                ver === "vitrine" ? "bg-tinta text-white" : "bg-white text-fumo shadow-carta hover:text-tinta"
              }`}
            >
              Vitrine <span className="tabular-nums opacity-70">{nVitrine}</span>
            </a>
          </div>
          <form method="get" action="/admin" className="flex flex-1 items-center gap-2">
            <input type="hidden" name="ver" value={ver} />
            <input
              name="q"
              defaultValue={q}
              placeholder="buscar por nome do produto…"
              className="min-w-0 flex-1 rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm text-tinta outline-none focus:border-pirraia"
            />
            {q && (
              <a
                href={`/admin?ver=${ver}`}
                className="shrink-0 text-xs font-semibold text-fumo hover:text-tinta"
              >
                limpar
              </a>
            )}
            <button
              type="submit"
              className="shrink-0 rounded-full bg-tinta px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-pirraia"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* FILA DE CURADORIA */}
        {ver === "fila" && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">
              Fila de curadoria
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {/* Importar da Shopee por palavra-chave (Open API) */}
              <form action={importarShopee} className="flex items-center gap-1.5">
                <input
                  name="q"
                  required
                  placeholder="buscar na Shopee…"
                  className="w-40 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-tinta outline-none focus:border-pirraia"
                />
                <button
                  type="submit"
                  className="rounded-full bg-[#EE4D2D] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-95"
                  title="Busca ofertas na Shopee (Open API) e joga na fila, já com o link de afiliado."
                >
                  Importar Shopee
                </button>
              </form>
              {/* Importar da AliExpress por palavra-chave (API de afiliado) */}
              <form action={importarAliexpress} className="flex items-center gap-1.5">
                <input
                  name="q"
                  required
                  placeholder="buscar na AliExpress…"
                  className="w-40 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-tinta outline-none focus:border-pirraia"
                />
                <button
                  type="submit"
                  className="rounded-full bg-[#E62E04] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-95"
                  title="Busca produtos na AliExpress (API de afiliado) e joga na fila, já com o link de afiliado."
                >
                  Importar AliExpress
                </button>
              </form>
              {/* Importar do Mercado Livre por palavra-chave */}
              <form action={importarML} className="flex items-center gap-1.5">
                <input
                  name="q"
                  required
                  placeholder="buscar no Mercado Livre…"
                  className="w-40 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-tinta outline-none focus:border-pirraia"
                />
                <button
                  type="submit"
                  className="rounded-full bg-tinta px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-pirraia"
                  title="Busca itens no Mercado Livre e joga na fila. O link de afiliado você cola na hora de curar."
                >
                  Importar ML
                </button>
              </form>
            </div>
          </div>

          {searchParams.shopee != null && (
            <p className="mb-3 rounded-xl border border-[#EE4D2D]/20 bg-[#EE4D2D]/10 px-4 py-2.5 text-sm font-medium text-[#a8391e]">
              Shopee: {searchParams.shopee} oferta(s) na fila.
            </p>
          )}
          {searchParams.shopee_erro != null && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
              {searchParams.shopee_erro === "vazio"
                ? "Digite uma palavra-chave pra buscar na Shopee."
                : `Falha ao importar da Shopee: ${searchParams.shopee_erro}`}
            </p>
          )}

          {searchParams.ali != null && (
            <p className="mb-3 rounded-xl border border-[#E62E04]/20 bg-[#E62E04]/10 px-4 py-2.5 text-sm font-medium text-[#a8250a]">
              AliExpress: {searchParams.ali} produto(s) na fila.
            </p>
          )}
          {searchParams.ali_erro != null && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
              {searchParams.ali_erro === "vazio"
                ? "Digite uma palavra-chave pra buscar na AliExpress."
                : `Falha ao importar da AliExpress: ${searchParams.ali_erro}`}
            </p>
          )}

          {searchParams.ml != null && (
            <p className="mb-3 rounded-xl border border-pirraia/20 bg-pirraia-tint px-4 py-2.5 text-sm font-medium text-pirraia-dark">
              Mercado Livre: {searchParams.ml} item(ns) na fila.
            </p>
          )}
          {searchParams.ml_erro != null && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
              {searchParams.ml_erro === "vazio"
                ? "Digite uma palavra-chave pra buscar no Mercado Livre."
                : `Falha ao importar do Mercado Livre: ${searchParams.ml_erro}`}
            </p>
          )}

          {fila.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-fumo shadow-carta">
              {q
                ? `Nenhum produto na fila com “${q}”.`
                : "Nada novo na fila. Quando a ingestão trouxer produtos, eles caem aqui."}
            </p>
          ) : (
            <ul className="space-y-4">
              {fila.map((p) => (
                <FilaCard key={p.id} p={p} categorias={categorias} />
              ))}
            </ul>
          )}
        </section>
        )}

        {/* NA VITRINE */}
        {ver === "vitrine" && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">
              Na vitrine
            </h2>
            {nVitrine > 0 && (
              <div className="flex items-center gap-2">
                <form action={pontuarVitrine}>
                  <button
                    type="submit"
                    className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-tinta transition-colors hover:bg-white"
                    title="A IA pontua os produtos da vitrine que ainda não têm score (ex.: os que você adicionou à mão)."
                  >
                    Pontuar com IA
                  </button>
                </form>
                {nVitrine > 1 && (
                  <form action={reordenarPorPerformance}>
                    <button
                      type="submit"
                      className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-tinta transition-colors hover:bg-white"
                      title="Reordena por cliques + score da IA. O destaque continua no topo."
                    >
                      Reordenar por performance
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
          {vitrine.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-fumo shadow-carta">
              {q
                ? `Nenhum produto na vitrine com “${q}”.`
                : "Nenhum produto publicado ainda. Cure algo da fila."}
            </p>
          ) : (
            <ul className="space-y-3">
              {vitrine.map((l, i) => (
                <VitrineRow
                  key={l.id}
                  l={l}
                  primeiro={i === 0}
                  ultimo={i === vitrine.length - 1}
                />
              ))}
            </ul>
          )}
        </section>
        )}
      </main>
    </div>
  );
}

function FilaCard({ p, categorias }: { p: ProdutoNovo; categorias: string[] }) {
  return (
    <li className="overflow-hidden rounded-2xl bg-white shadow-carta">
      <div className="flex gap-4 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.imagem_url ?? ""}
          alt={p.titulo}
          className="h-24 w-24 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-fumo">
            <span>{p.categoria}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{p.loja_nome}</span>
            {p.score_ia != null && (
              <span className="ml-auto rounded-full bg-pirraia-tint px-2 py-0.5 font-bold text-pirraia-dark">
                IA {p.score_ia}
              </span>
            )}
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-tinta">
            {p.titulo}
          </h3>
          <div className="mt-1 flex items-baseline gap-1.5">
            {p.preco_antigo != null && (
              <span className="text-xs text-fumo line-through">
                {brl(p.preco_antigo)}
              </span>
            )}
            <span className="text-base font-extrabold text-tinta">
              {brl(p.preco)}
            </span>
            {p.desconto_pct != null && (
              <span className="text-xs font-bold text-pirraia">
                -{p.desconto_pct}%
              </span>
            )}
            {p.comissao_pct != null && Number(p.comissao_pct) > 0 && (
              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                {Number(p.comissao_pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                {p.comissao_valor != null && Number(p.comissao_valor) > 0
                  ? ` · ${brl(p.comissao_valor)}`
                  : ""}{" "}
                comissão
              </span>
            )}
          </div>
          {p.url_produto && (
            <a
              href={p.url_produto}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-fumo underline underline-offset-2 hover:text-tinta"
            >
              abrir {p.origem ? `no ${ORIGEM_ROTULO[p.origem] ?? p.origem}` : "a loja"} pra
              pegar o link de afiliado
            </a>
          )}
        </div>
      </div>

      {/* CURAR: cola o short_url + slug, cria o link e publica */}
      <form
        action={curarProduto}
        autoComplete="off"
        className="flex flex-col gap-2 border-t border-black/5 bg-areia/60 p-4 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="produtoId" value={p.id} />
        <label className="flex-1 text-xs font-medium text-fumo">
          Categoria
          <select
            name="categoria"
            defaultValue={p.categoria ?? ""}
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-tinta outline-none focus:border-pirraia"
          >
            <option value="">— sem categoria —</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {p.categoria && !categorias.includes(p.categoria) && (
              <option value={p.categoria}>{p.categoria}</option>
            )}
          </select>
        </label>
        <label className="flex-1 text-xs font-medium text-fumo">
          Slug
          <input
            name="slug"
            defaultValue={slugify(p.titulo)}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-tinta outline-none focus:border-pirraia"
          />
        </label>
        <label className="flex-[2] text-xs font-medium text-fumo">
          Link de afiliado (short_url)
          <input
            name="shortUrl"
            required
            autoComplete="off"
            defaultValue={p.link_afiliado ?? ""}
            placeholder={
              p.origem === "mercadolivre"
                ? "https://meli.la/... (seu link de afiliado)"
                : "https://s.shopee.com.br/..."
            }
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-tinta outline-none focus:border-pirraia"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-pirraia px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-pirraia-dark"
        >
          Curar
        </button>
      </form>

      <form action={descartarProduto} className="border-t border-black/5 px-4 py-2">
        <input type="hidden" name="produtoId" value={p.id} />
        <button
          type="submit"
          className="text-xs font-medium text-fumo hover:text-red-600"
        >
          Descartar
        </button>
      </form>
    </li>
  );
}

function VitrineRow({
  l,
  primeiro,
  ultimo,
}: {
  l: LinkVitrine;
  primeiro: boolean;
  ultimo: boolean;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-carta">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={l.produto.imagem_url ?? ""}
        alt={l.produto.titulo}
        className="h-14 w-14 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {l.destaque && (
            <span className="rounded bg-tinta px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
              Destaque
            </span>
          )}
          <span className="truncate text-sm font-semibold text-tinta">
            {l.produto.titulo}
          </span>
          {l.produto.comissao_pct != null && Number(l.produto.comissao_pct) > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              {Number(l.produto.comissao_pct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              {l.produto.comissao_valor != null && Number(l.produto.comissao_valor) > 0
                ? ` · ${brl(l.produto.comissao_valor)}`
                : ""}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-fumo">
          {brl(l.produto.preco)} · /r/{l.slug} · {l.cliques} cliques
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/* editar */}
        <a
          href={`/admin/editar/${l.produto.id}`}
          aria-label="Editar produto"
          className="flex h-8 items-center justify-center rounded-lg border border-black/10 px-2 text-xs font-semibold text-tinta transition-colors hover:bg-areia"
        >
          Editar
        </a>
        {/* mover */}
        <form action={moverLink}>
          <input type="hidden" name="linkId" value={l.id} />
          <input type="hidden" name="direcao" value="cima" />
          <button
            type="submit"
            disabled={primeiro}
            aria-label="Mover pra cima"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-tinta disabled:opacity-30"
          >
            ↑
          </button>
        </form>
        <form action={moverLink}>
          <input type="hidden" name="linkId" value={l.id} />
          <input type="hidden" name="direcao" value="baixo" />
          <button
            type="submit"
            disabled={ultimo}
            aria-label="Mover pra baixo"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-tinta disabled:opacity-30"
          >
            ↓
          </button>
        </form>

        {/* destaque */}
        <form action={alternarDestaque}>
          <input type="hidden" name="linkId" value={l.id} />
          <input type="hidden" name="destaque" value={(!l.destaque).toString()} />
          <button
            type="submit"
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
              l.destaque
                ? "bg-tinta text-white"
                : "border border-black/10 text-tinta hover:bg-areia"
            }`}
          >
            {l.destaque ? "Tirar destaque" : "Destacar"}
          </button>
        </form>

        {/* remover */}
        <form action={removerDaVitrine}>
          <input type="hidden" name="linkId" value={l.id} />
          <input type="hidden" name="produtoId" value={l.produto.id} />
          <button
            type="submit"
            aria-label="Tirar da vitrine"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-fumo hover:border-red-300 hover:text-red-600"
          >
            ×
          </button>
        </form>
      </div>
    </li>
  );
}
