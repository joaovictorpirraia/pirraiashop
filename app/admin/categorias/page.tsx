import { supabaseAdmin } from "@/lib/supabase";
import { adicionarCategoria, removerCategoria, moverCategoria } from "./actions";

export const dynamic = "force-dynamic";

interface Categoria {
  id: number;
  nome: string;
  ordem: number;
}

export default async function Categorias({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("categorias")
    .select("id, nome, ordem")
    .order("ordem", { ascending: true });
  const cats = (data ?? []) as Categoria[];

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span>{" "}
            <span className="text-fumo">categorias</span>
          </span>
          <a
            href="/admin"
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-tinta transition-colors hover:bg-white"
          >
            ← Admin
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-5 py-8">
        {/* adicionar */}
        <form action={adicionarCategoria} className="flex items-end gap-2">
          <label className="flex-1 text-xs font-medium text-fumo">
            Nova categoria
            <input
              name="nome"
              placeholder="ex.: Ferramentas"
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-tinta outline-none focus:border-pirraia"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-pirraia px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-pirraia-dark"
          >
            Adicionar
          </button>
        </form>

        {searchParams.erro && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {searchParams.erro}
          </p>
        )}

        <p className="text-xs text-fumo">
          Esta é a lista que aparece no seletor de categoria ao curar um produto. A ordem aqui é a
          ordem do dropdown. Remover uma categoria não muda os produtos que já estão nela.
        </p>

        {/* lista */}
        {cats.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-fumo shadow-carta">
            Nenhuma categoria ainda. Adicione a primeira acima.
          </p>
        ) : (
          <ul className="space-y-2">
            {cats.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-carta"
              >
                <span className="flex-1 px-1 text-sm font-semibold text-tinta">{c.nome}</span>

                <form action={moverCategoria}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="direcao" value="cima" />
                  <button
                    type="submit"
                    disabled={i === 0}
                    aria-label="Subir"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-tinta disabled:opacity-30"
                  >
                    ↑
                  </button>
                </form>
                <form action={moverCategoria}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="direcao" value="baixo" />
                  <button
                    type="submit"
                    disabled={i === cats.length - 1}
                    aria-label="Descer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-tinta disabled:opacity-30"
                  >
                    ↓
                  </button>
                </form>
                <form action={removerCategoria}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    aria-label="Remover"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-fumo transition-colors hover:border-red-300 hover:text-red-600"
                  >
                    ×
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
