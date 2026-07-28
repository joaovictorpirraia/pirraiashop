import { supabaseAdmin } from "@/lib/supabase";
import { editarPost } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditarPost({ params }: { params: { id: string } }) {
  const supabase = supabaseAdmin();
  const postId = Number(params.id);

  const { data: p } = await supabase
    .from("posts")
    .select("id, legenda, hashtags, roteiro, produto:produtos(titulo)")
    .eq("id", postId)
    .maybeSingle();

  const produto = Array.isArray((p as { produto?: unknown })?.produto)
    ? (p as { produto: { titulo: string }[] }).produto[0]
    : (p as { produto?: { titulo: string } } | null)?.produto;

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span>{" "}
            <span className="text-fumo">editar post</span>
          </span>
          <a
            href="/admin/conteudo"
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-tinta transition-colors hover:bg-white"
          >
            ← Conteúdo
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-8">
        {!p ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-fumo shadow-carta">
            Post não encontrado. <a className="text-pirraia" href="/admin/conteudo">Voltar</a>.
          </p>
        ) : (
          <>
            {produto?.titulo && (
              <p className="mb-4 truncate text-sm font-semibold text-tinta">{produto.titulo}</p>
            )}
            <form action={editarPost} className="space-y-4 rounded-2xl bg-white p-5 shadow-carta">
              <input type="hidden" name="postId" value={p.id} />

              <label className="block text-xs font-medium text-fumo">
                Legenda
                <textarea
                  name="legenda"
                  rows={5}
                  defaultValue={p.legenda ?? ""}
                  className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm text-tinta outline-none focus:border-pirraia"
                />
              </label>

              <label className="block text-xs font-medium text-fumo">
                Hashtags <span className="text-fumo/70">(separadas por espaço, sem #)</span>
                <input
                  name="hashtags"
                  defaultValue={(p.hashtags ?? []).join(" ")}
                  className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm text-tinta outline-none focus:border-pirraia"
                />
              </label>

              <label className="block text-xs font-medium text-fumo">
                Roteiro
                <textarea
                  name="roteiro"
                  rows={6}
                  defaultValue={p.roteiro ?? ""}
                  className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm text-tinta outline-none focus:border-pirraia"
                />
              </label>

              <button
                type="submit"
                className="w-full rounded-lg bg-pirraia py-2.5 text-sm font-bold text-white transition-colors hover:bg-pirraia-dark"
              >
                Salvar
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
