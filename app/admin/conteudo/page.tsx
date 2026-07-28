import { supabaseAdmin } from "@/lib/supabase";
import { aprovarPost, descartarPost, gerarConteudoAgora } from "./actions";

export const dynamic = "force-dynamic";

interface PostRow {
  id: number;
  canal: string;
  legenda: string | null;
  hashtags: string[] | null;
  roteiro: string | null;
  criado_em: string;
  produto: { titulo: string; imagem_url: string | null } | null;
}

const CANAL_ROTULO: Record<string, string> = {
  instagram_feed: "Instagram · feed",
  instagram_story: "Instagram · story",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

export default async function Conteudo() {
  const supabase = supabaseAdmin();

  const { data: raw } = await supabase
    .from("posts")
    .select("id, canal, legenda, hashtags, roteiro, criado_em, produto:produtos(titulo, imagem_url)")
    .eq("status", "rascunho")
    .order("criado_em", { ascending: false });

  const { count: aprovados } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "aprovado");

  const rascunhos = ((raw ?? []) as unknown[]).map((p) => {
    const row = p as PostRow & { produto: PostRow["produto"] | PostRow["produto"][] };
    const produto = Array.isArray(row.produto) ? row.produto[0] : row.produto;
    return { ...row, produto } as PostRow;
  });

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span>{" "}
            <span className="text-fumo">conteúdo</span>
          </span>
          <div className="flex items-center gap-3 text-xs text-fumo">
            <span className="hidden sm:inline">
              {rascunhos.length} rascunho(s) · {aprovados ?? 0} aprovado(s)
            </span>
            <form action={gerarConteudoAgora}>
              <button
                type="submit"
                className="rounded-full bg-pirraia px-3 py-1.5 font-bold text-white transition-colors hover:bg-pirraia-dark"
                title="Gera rascunhos pros produtos curados que ainda não têm um"
              >
                Gerar conteúdo
              </button>
            </form>
            <a
              href="/admin"
              className="rounded-full border border-black/10 px-3 py-1.5 font-bold text-tinta transition-colors hover:bg-white"
            >
              ← Admin
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-5 py-8">
        {rascunhos.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-fumo shadow-carta">
            Nenhum rascunho na fila. Gere conteúdo chamando{" "}
            <code className="rounded bg-areia px-1">POST /api/gerar-conteudo</code> (precisa da
            OPENAI_API_KEY), e os rascunhos caem aqui pra aprovar.
          </p>
        ) : (
          rascunhos.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-2xl bg-white shadow-carta">
              <div className="flex items-center gap-3 border-b border-black/5 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.produto?.imagem_url ?? ""}
                  alt={p.produto?.titulo ?? ""}
                  className="h-11 w-11 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-tinta">
                    {p.produto?.titulo ?? "Produto"}
                  </div>
                  <div className="text-xs text-fumo">{CANAL_ROTULO[p.canal] ?? p.canal}</div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-fumo">
                    Legenda
                  </div>
                  <p className="whitespace-pre-line text-sm text-tinta">{p.legenda}</p>
                </div>

                {p.hashtags && p.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.hashtags.map((h) => (
                      <span
                        key={h}
                        className="rounded bg-pirraia-tint px-2 py-0.5 text-xs font-medium text-pirraia-dark"
                      >
                        #{h}
                      </span>
                    ))}
                  </div>
                )}

                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-fumo">
                    Roteiro
                  </div>
                  <p className="whitespace-pre-line text-sm text-fumo">{p.roteiro}</p>
                </div>
              </div>

              <div className="flex gap-2 border-t border-black/5 p-3">
                <form action={aprovarPost} className="flex-1">
                  <input type="hidden" name="postId" value={p.id} />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-pirraia py-2 text-sm font-bold text-white transition-colors hover:bg-pirraia-dark"
                  >
                    Aprovar
                  </button>
                </form>
                <form action={descartarPost}>
                  <input type="hidden" name="postId" value={p.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-fumo transition-colors hover:border-red-300 hover:text-red-600"
                  >
                    Descartar
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
