import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { brl } from "@/lib/format";
import { UploadVideo } from "@/components/UploadVideo";
import { removerVideoProduto } from "../actions";

export const dynamic = "force-dynamic";

interface ProdVideo {
  id: number;
  titulo: string;
  imagem_url: string | null;
  preco: string | number | null;
  video_url: string | null;
  status: string;
}

export default async function VideosAdmin() {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("links")
    .select("produto:produtos!inner(id, titulo, imagem_url, preco, video_url, status)")
    .eq("ativo", true)
    .eq("pausado", false)
    .limit(300);

  const vistos = new Set<number>();
  const lista = ((data ?? []) as unknown[])
    .map((l) => {
      const p = (l as { produto: ProdVideo | ProdVideo[] }).produto;
      return Array.isArray(p) ? p[0] : p;
    })
    .filter((p): p is ProdVideo => Boolean(p) && ["curado", "publicado"].includes(p.status))
    .filter((p) => (vistos.has(p.id) ? false : vistos.add(p.id)));

  const comVideo = lista.filter((p) => p.video_url).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-tinta">Vídeos dos produtos</h1>
        <Link href="/admin/instagram" className="text-sm font-semibold text-pirraia hover:underline">
          ← voltar pro Instagram
        </Link>
      </div>
      <p className="mb-1 text-sm text-tinta/70">
        Sobe um vídeo por produto. O sistema corta pra 4:5 e queima nome + preço + marca.
        Depois é só montar o carrossel de vídeo na tela do Instagram.
      </p>
      <p className="mb-6 text-xs text-tinta/50">
        {lista.length} produtos na vitrine · {comVideo} com vídeo pronto · MP4/MOV até 100&nbsp;MB.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {lista.map((p) => (
          <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white">
            <div className="relative aspect-square bg-black/5">
              {p.imagem_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagem_url} alt="" className="h-full w-full object-cover" />
              )}
              {p.video_url && (
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                  COM VÍDEO
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2.5">
              <div className="line-clamp-2 text-xs font-medium text-tinta">{p.titulo}</div>
              <div className="text-sm font-bold text-tinta">{brl(Number(p.preco))}</div>
              <div className="mt-auto">
                <UploadVideo produtoId={p.id} temVideo={Boolean(p.video_url)} />
                {p.video_url && (
                  <div className="mt-1 flex items-center gap-2">
                    <a
                      href={p.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold text-pirraia hover:underline"
                    >
                      ver
                    </a>
                    <form action={removerVideoProduto}>
                      <input type="hidden" name="produtoId" value={p.id} />
                      <button type="submit" className="text-[11px] text-tinta/50 hover:text-red-600">
                        remover
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {lista.length === 0 && (
        <p className="mt-8 text-center text-sm text-tinta/50">
          Nenhum produto na vitrine ainda. Publica um carrossel primeiro pra popular a vitrine.
        </p>
      )}
    </main>
  );
}
