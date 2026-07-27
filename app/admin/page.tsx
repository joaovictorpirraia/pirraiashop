import { supabaseAdmin } from "@/lib/supabase";
import { slugify } from "@/lib/slug";
import { brl } from "@/lib/format";
import {
  curarProduto,
  descartarProduto,
  alternarDestaque,
  moverLink,
  removerDaVitrine,
} from "./actions";

export const dynamic = "force-dynamic";

interface ProdutoNovo {
  id: number;
  titulo: string;
  categoria: string | null;
  preco: string | number | null;
  preco_antigo: string | number | null;
  desconto_pct: number | null;
  imagem_url: string | null;
  loja_nome: string | null;
  url_produto: string | null;
  score_ia: number | null;
}

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
  };
}

export default async function Admin() {
  const supabase = supabaseAdmin();

  const { data: filaRaw } = await supabase
    .from("produtos")
    .select(
      "id, titulo, categoria, preco, preco_antigo, desconto_pct, imagem_url, loja_nome, url_produto, score_ia",
    )
    .eq("status", "novo")
    .order("score_ia", { ascending: false, nullsFirst: false })
    .order("visto_em", { ascending: false });

  const { data: linksRaw } = await supabase
    .from("links")
    .select(
      "id, slug, short_url, destaque, ordem, cliques, produto:produtos!inner(id, titulo, categoria, preco, imagem_url, loja_nome, status)",
    )
    .eq("ativo", true)
    .order("destaque", { ascending: false })
    .order("ordem", { ascending: true });

  const fila = (filaRaw ?? []) as ProdutoNovo[];
  const vitrine = ((linksRaw ?? []) as unknown[])
    .map((l) => {
      const row = l as LinkVitrine & { produto: LinkVitrine["produto"] | LinkVitrine["produto"][] };
      const produto = Array.isArray(row.produto) ? row.produto[0] : row.produto;
      return { ...row, produto } as LinkVitrine;
    })
    .filter((l) => l.produto && ["curado", "publicado"].includes(l.produto.status));

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span>{" "}
            <span className="text-fumo">admin</span>
          </span>
          <span className="text-xs text-fumo">
            {fila.length} na fila · {vitrine.length} na vitrine
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-5 py-8">
        {/* FILA DE CURADORIA */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fumo">
            Fila de curadoria
          </h2>
          {fila.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-fumo shadow-carta">
              Nada novo na fila. Quando a ingestão trouxer produtos, eles caem aqui.
            </p>
          ) : (
            <ul className="space-y-4">
              {fila.map((p) => (
                <FilaCard key={p.id} p={p} />
              ))}
            </ul>
          )}
        </section>

        {/* NA VITRINE */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fumo">
            Na vitrine
          </h2>
          {vitrine.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-fumo shadow-carta">
              Nenhum produto publicado ainda. Cure algo da fila acima.
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
      </main>
    </div>
  );
}

function FilaCard({ p }: { p: ProdutoNovo }) {
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
          </div>
          {p.url_produto && (
            <a
              href={p.url_produto}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-fumo underline underline-offset-2 hover:text-tinta"
            >
              abrir na Shopee pra pegar o link de afiliado
            </a>
          )}
        </div>
      </div>

      {/* CURAR: cola o short_url + slug, cria o link e publica */}
      <form
        action={curarProduto}
        className="flex flex-col gap-2 border-t border-black/5 bg-areia/60 p-4 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="produtoId" value={p.id} />
        <label className="flex-1 text-xs font-medium text-fumo">
          Slug
          <input
            name="slug"
            defaultValue={slugify(p.titulo)}
            className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-tinta outline-none focus:border-pirraia"
          />
        </label>
        <label className="flex-[2] text-xs font-medium text-fumo">
          Link de afiliado (short_url)
          <input
            name="shortUrl"
            required
            placeholder="https://s.shopee.com.br/..."
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
        </div>
        <div className="mt-0.5 text-xs text-fumo">
          {brl(l.produto.preco)} · /r/{l.slug} · {l.cliques} cliques
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
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
