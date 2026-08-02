import { supabaseAdmin } from "@/lib/supabase";
import {
  aprovarPost,
  descartarPost,
  marcarPublicado,
  gerarConteudoAgora,
  regerarPost,
} from "./actions";
import { CopiarConteudo } from "@/components/CopiarConteudo";

export const dynamic = "force-dynamic";

interface PostRow {
  id: number;
  canal: string;
  legenda: string | null;
  hashtags: string[] | null;
  roteiro: string | null;
  produto: { titulo: string; imagem_url: string | null } | null;
}

const CANAL_ROTULO: Record<string, string> = {
  instagram_feed: "Instagram · feed",
  instagram_story: "Instagram · story",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

function normaliza(raw: unknown[]): PostRow[] {
  return (raw ?? []).map((p) => {
    const row = p as PostRow & { produto: PostRow["produto"] | PostRow["produto"][] };
    const produto = Array.isArray(row.produto) ? row.produto[0] : row.produto;
    return { ...row, produto } as PostRow;
  });
}

/** Legenda + hashtags no formato pronto pra colar na legenda do Instagram. */
function legendaPronta(p: PostRow): string {
  const tags = (p.hashtags ?? []).map((h) => "#" + h).join(" ");
  return [p.legenda?.trim(), tags].filter(Boolean).join("\n\n");
}

export default async function Conteudo({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = supabaseAdmin();
  const tab = searchParams.tab === "aprovados" ? "aprovados" : "rascunhos";
  const status = tab === "aprovados" ? "aprovado" : "rascunho";

  const [{ count: nRascunhos }, { count: nAprovados }, { data: raw }] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "rascunho"),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "aprovado"),
    supabase
      .from("posts")
      .select("id, canal, legenda, hashtags, roteiro, produto:produtos(titulo, imagem_url)")
      .eq("status", status)
      .order("criado_em", { ascending: false }),
  ]);
  const posts = normaliza(raw ?? []);

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span>{" "}
            <span className="text-fumo">conteúdo</span>
          </span>
          <div className="flex items-center gap-3 text-xs text-fumo">
            <form action={gerarConteudoAgora} className="flex items-center gap-1.5">
              <select
                name="canal"
                className="rounded-full border border-black/10 bg-white px-2 py-1.5 text-xs font-semibold text-tinta outline-none"
                title="Canal do conteúdo a gerar"
              >
                <option value="instagram_feed">Feed</option>
                <option value="instagram_story">Story</option>
                <option value="tiktok">TikTok</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              <button
                type="submit"
                className="rounded-full bg-pirraia px-3 py-1.5 font-bold text-white transition-colors hover:bg-pirraia-dark"
                title="Gera rascunhos no canal escolhido pros produtos curados sem um"
              >
                Gerar
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

      <main className="mx-auto max-w-3xl px-5 py-8">
        {/* abas */}
        <div className="mb-5 flex gap-2">
          <Aba href="/admin/conteudo" ativa={tab === "rascunhos"} rotulo="Rascunhos" n={nRascunhos ?? 0} />
          <Aba href="/admin/conteudo?tab=aprovados" ativa={tab === "aprovados"} rotulo="Aprovados" n={nAprovados ?? 0} />
        </div>

        {posts.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-fumo shadow-carta">
            {tab === "aprovados"
              ? "Nada aprovado ainda. Aprove um rascunho na aba Rascunhos."
              : "Nenhum rascunho na fila. Use o botão “Gerar conteúdo” pra a IA escrever pros produtos curados."}
          </p>
        ) : (
          <div className="space-y-4">
            {posts.map((p) =>
              tab === "aprovados" ? (
                <CardAprovado key={p.id} p={p} />
              ) : (
                <CardRascunho key={p.id} p={p} />
              ),
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Aba({
  href,
  ativa,
  rotulo,
  n,
}: {
  href: string;
  ativa: boolean;
  rotulo: string;
  n: number;
}) {
  return (
    <a
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        ativa ? "bg-tinta text-white" : "bg-white text-fumo shadow-carta hover:text-tinta"
      }`}
    >
      {rotulo} <span className="tabular-nums opacity-70">{n}</span>
    </a>
  );
}

function Cabecalho({ p }: { p: PostRow }) {
  return (
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
  );
}

function Corpo({ p }: { p: PostRow }) {
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-fumo">Legenda</div>
        <p className="whitespace-pre-line text-sm text-tinta">{p.legenda}</p>
      </div>
      {p.hashtags && p.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.hashtags.map((h) => (
            <span key={h} className="rounded bg-pirraia-tint px-2 py-0.5 text-xs font-medium text-pirraia-dark">
              #{h}
            </span>
          ))}
        </div>
      )}
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-fumo">Roteiro</div>
        <p className="whitespace-pre-line text-sm text-fumo">{p.roteiro}</p>
      </div>
    </div>
  );
}

function CardRascunho({ p }: { p: PostRow }) {
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-carta">
      <Cabecalho p={p} />
      <Corpo p={p} />
      <div className="flex flex-wrap gap-2 border-t border-black/5 p-3">
        <form action={aprovarPost} className="flex-1">
          <input type="hidden" name="postId" value={p.id} />
          <button
            type="submit"
            className="w-full rounded-lg bg-pirraia py-2 text-sm font-bold text-white transition-colors hover:bg-pirraia-dark"
          >
            Aprovar
          </button>
        </form>
        <CopiarConteudo texto={legendaPronta(p)} rotulo="Copiar legenda" variante="secundario" />
        <form action={regerarPost}>
          <input type="hidden" name="postId" value={p.id} />
          <button
            type="submit"
            className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-tinta transition-colors hover:bg-areia"
            title="Pede uma nova versão pra IA (substitui o texto atual)"
          >
            Regerar
          </button>
        </form>
        <a
          href={`/admin/conteudo/editar/${p.id}`}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-tinta transition-colors hover:bg-areia"
        >
          Editar
        </a>
        <form action={descartarPost}>
          <input type="hidden" name="postId" value={p.id} />
          <button
            type="submit"
            className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-fumo transition-colors hover:border-red-300 hover:text-red-600"
          >
            Descartar
          </button>
        </form>
      </div>
    </article>
  );
}

function CardAprovado({ p }: { p: PostRow }) {
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-carta">
      <Cabecalho p={p} />
      <Corpo p={p} />
      <div className="flex flex-wrap items-center gap-2 border-t border-black/5 p-3">
        <CopiarConteudo texto={legendaPronta(p)} rotulo="Copiar legenda + hashtags" />
        {p.roteiro && <CopiarConteudo texto={p.roteiro} rotulo="Copiar roteiro" />}
        <div className="flex-1" />
        <a
          href={`/admin/conteudo/editar/${p.id}`}
          className="rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-tinta transition-colors hover:bg-areia"
        >
          Editar
        </a>
        <form action={marcarPublicado}>
          <input type="hidden" name="postId" value={p.id} />
          <button
            type="submit"
            className="rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold text-tinta transition-colors hover:bg-areia"
            title="Tira da fila de aprovados"
          >
            Já postei
          </button>
        </form>
        <form action={descartarPost}>
          <input type="hidden" name="postId" value={p.id} />
          <button
            type="submit"
            aria-label="Descartar"
            className="rounded-lg border border-black/10 px-3 py-2 text-sm text-fumo transition-colors hover:border-red-300 hover:text-red-600"
          >
            ×
          </button>
        </form>
      </div>
    </article>
  );
}
