import { supabaseAdmin } from "@/lib/supabase";
import { brl } from "@/lib/format";
import { instagramConfigurado } from "@/lib/instagram";
import { montarCarrossel, montarCarrosselAuto, publicarCarrossel, descartarCarrossel } from "../actions";

export const dynamic = "force-dynamic";

interface ProdutoVitrine {
  id: number;
  titulo: string;
  imagem_url: string | null;
  preco: string | number | null;
  desconto_pct: number | null;
  status?: string;
}

interface Carrossel {
  id: number;
  produto_ids: number[];
  gancho: string;
  legenda: string;
  status: string;
  ig_media_id: string | null;
  erro: string | null;
}

export default async function InstagramAdmin({
  searchParams,
}: {
  searchParams: { ok?: string; erro?: string };
}) {
  const supabase = supabaseAdmin();
  const igOn = instagramConfigurado();

  // produtos da vitrine (pra montar o carrossel) — via links ativos e não pausados
  const { data: linksRaw } = await supabase
    .from("links")
    .select("produto:produtos!inner(id, titulo, imagem_url, preco, desconto_pct, status)")
    .eq("ativo", true)
    .eq("pausado", false)
    .order("destaque", { ascending: false })
    .order("ordem", { ascending: true });
  const produtos: ProdutoVitrine[] = ((linksRaw ?? []) as unknown[])
    .map((l) => {
      const p = (l as { produto: ProdutoVitrine | ProdutoVitrine[] }).produto;
      return Array.isArray(p) ? p[0] : p;
    })
    .filter((p): p is ProdutoVitrine => Boolean(p) && ["curado", "publicado"].includes(p?.status ?? ""));

  // carrosséis (rascunhos primeiro, depois publicados/erro recentes)
  const { data: carrosseisRaw } = await supabase
    .from("carrosseis")
    .select("id, produto_ids, gancho, legenda, status, ig_media_id, erro")
    .order("criado_em", { ascending: false })
    .limit(20);
  const carrosseis = (carrosseisRaw ?? []) as Carrossel[];
  const rascunhos = carrosseis.filter((c) => c.status !== "publicado");
  const publicados = carrosseis.filter((c) => c.status === "publicado");

  // mapa de produtos referenciados pelos carrosséis (pra thumbnails)
  const idsRef = Array.from(new Set(carrosseis.flatMap((c) => c.produto_ids ?? [])));
  const { data: refRaw } = idsRef.length
    ? await supabase.from("produtos").select("id, titulo, imagem_url").in("id", idsRef)
    : { data: [] };
  const mapaProd = new Map(
    ((refRaw ?? []) as { id: number; titulo: string; imagem_url: string | null }[]).map((p) => [p.id, p]),
  );

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span> <span className="text-fumo">instagram</span>
          </span>
          <a
            href="/admin"
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-tinta transition-colors hover:bg-white"
          >
            ← Admin
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
        {searchParams.ok && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
            {searchParams.ok === "publicado"
              ? "Carrossel publicado no Instagram!"
              : "Carrossel montado — revise e publique abaixo."}
          </p>
        )}
        {searchParams.erro && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            {searchParams.erro}
          </p>
        )}
        {!igOn && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
            Instagram não configurado (falta IG_USER_ID / IG_ACCESS_TOKEN no servidor). Dá pra montar
            rascunhos, mas o botão de publicar fica desligado até as credenciais existirem.
          </p>
        )}

        {/* MONTAR CARROSSEL */}
        <section className="rounded-2xl bg-white p-5 shadow-carta">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">Montar carrossel</h2>
              <p className="mt-1 max-w-xl text-xs text-fumo">
                Marca de 2 a 9 produtos. A IA escreve o gancho da capa + a legenda “achados do dia” e monta um
                rascunho pra você revisar. A capa (foto + gancho) entra como 1º slide automaticamente.
              </p>
            </div>
            {/* automático: a IA escolhe os produtos do dia sozinha */}
            <form action={montarCarrosselAuto}>
              <button
                type="submit"
                title="A IA escolhe os melhores produtos do dia (temático, sem repetir os já postados) e monta o rascunho sozinha."
                className="whitespace-nowrap rounded-full bg-tinta px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-pirraia"
              >
                Montar automático
              </button>
            </form>
          </div>
          <form action={montarCarrossel} className="mt-4">
            <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
              {produtos.map((p) => (
                <label
                  key={p.id}
                  className="relative cursor-pointer rounded-xl border border-black/10 p-2 transition-colors has-[:checked]:border-pirraia has-[:checked]:ring-2 has-[:checked]:ring-pirraia"
                >
                  <input type="checkbox" name="produtoIds" value={p.id} className="peer sr-only" />
                  <span className="absolute right-2 top-2 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-pirraia text-[11px] font-bold text-white peer-checked:flex">
                    ✓
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imagem_url ?? ""}
                    alt={p.titulo}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                  <div className="mt-1.5 line-clamp-2 text-[11px] font-semibold text-tinta">{p.titulo}</div>
                  <div className="text-[11px] font-bold text-tinta">{brl(p.preco)}</div>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="mt-4 rounded-lg bg-pirraia px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-pirraia-dark"
            >
              Montar carrossel
            </button>
          </form>
        </section>

        {/* RASCUNHOS */}
        {rascunhos.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">Rascunhos</h2>
            {rascunhos.map((c) => (
              <div key={c.id} className="rounded-2xl bg-white p-5 shadow-carta">
                <div className="flex flex-wrap items-start gap-3">
                  {/* prévia da CAPA (1º slide) */}
                  <div className="flex flex-col items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/capa/${c.id}`}
                      alt="capa do carrossel"
                      className="h-[150px] w-[120px] rounded-lg object-cover ring-2 ring-pirraia"
                    />
                    <span className="mt-1 text-[10px] font-bold uppercase text-pirraia">capa</span>
                  </div>
                  {/* thumbs dos produtos */}
                  <div className="flex flex-wrap gap-2">
                    {(c.produto_ids ?? []).map((pid) => {
                      const p = mapaProd.get(pid);
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={pid}
                          src={p?.imagem_url ?? ""}
                          alt={p?.titulo ?? ""}
                          title={p?.titulo ?? ""}
                          className="h-[120px] w-[120px] rounded-lg object-cover"
                        />
                      );
                    })}
                  </div>
                </div>

                {c.status === "erro" && c.erro && (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    Falhou na última tentativa: {c.erro}
                  </p>
                )}

                <form action={publicarCarrossel} className="mt-3">
                  <input type="hidden" name="carrosselId" value={c.id} />
                  <label className="text-xs font-medium text-fumo">
                    Gancho da capa (edita à vontade — a capa usa este texto)
                    <input
                      name="gancho"
                      defaultValue={c.gancho}
                      className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-tinta outline-none focus:border-pirraia"
                    />
                  </label>
                  <label className="mt-3 block text-xs font-medium text-fumo">
                    Legenda (dá pra editar antes de publicar)
                    <textarea
                      name="legenda"
                      defaultValue={c.legenda}
                      rows={6}
                      className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-pirraia"
                    />
                  </label>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={!igOn}
                      title={igOn ? "Publica o carrossel no feed do @pirraiashop" : "Configure o Instagram no servidor primeiro"}
                      className="rounded-lg bg-[#C13584] px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-40"
                    >
                      Publicar no Instagram
                    </button>
                  </div>
                </form>

                <form action={descartarCarrossel} className="mt-2">
                  <input type="hidden" name="carrosselId" value={c.id} />
                  <button type="submit" className="text-xs font-semibold text-fumo hover:text-red-600">
                    Descartar rascunho
                  </button>
                </form>
              </div>
            ))}
          </section>
        )}

        {/* PUBLICADOS */}
        {publicados.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-fumo">Publicados</h2>
            {publicados.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-carta">
                <div className="flex flex-wrap gap-1.5">
                  {(c.produto_ids ?? []).slice(0, 5).map((pid) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={pid}
                      src={mapaProd.get(pid)?.imagem_url ?? ""}
                      alt=""
                      className="h-12 w-12 rounded-md object-cover"
                    />
                  ))}
                </div>
                <span className="ml-auto text-xs font-medium text-emerald-700">
                  publicado · {(c.produto_ids ?? []).length} itens
                </span>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
