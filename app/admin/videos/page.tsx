import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { brl } from "@/lib/format";
import { UploadVideo } from "@/components/UploadVideo";
import { BotaoSubmit } from "@/components/BotaoSubmit";
import { CopiarTexto } from "@/components/CopiarTexto";
import { tiktokConfigurado, contaConectada } from "@/lib/tiktok";
import { removerVideoProduto, conectarTikTok, desconectarTikTok, enviarVideoTikTok, previewTikTok, gerarLegendaTikTok } from "../actions";

export const dynamic = "force-dynamic";

interface ProdVideo {
  id: number;
  titulo: string;
  imagem_url: string | null;
  preco: string | number | null;
  video_url: string | null;
  video_tiktok_url: string | null;
  legenda_tiktok: string | null;
  status: string;
}

export default async function VideosAdmin({
  searchParams,
}: {
  searchParams: { tiktok?: string; tiktok_erro?: string; tiktok_preview?: string; tiktok_legenda?: string };
}) {
  const supabase = supabaseAdmin();
  const tkOn = tiktokConfigurado();
  const conta = tkOn ? await contaConectada(supabase) : null;

  const { data } = await supabase
    .from("links")
    .select("produto:produtos!inner(id, titulo, imagem_url, preco, video_url, video_tiktok_url, legenda_tiktok, status)")
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
      <p className="mb-4 text-xs text-tinta/50">
        {lista.length} produtos na vitrine · {comVideo} com vídeo pronto · MP4/MOV até 100&nbsp;MB.
      </p>

      {searchParams.tiktok && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          {searchParams.tiktok === "conectado"
            ? "TikTok conectado!"
            : searchParams.tiktok === "enviado"
              ? "Vídeo enviado pro TikTok! Pode levar 1-2 min pra o TikTok processar e cair no rascunho (chega uma notificação no app). Se a tela não confirmar mas o vídeo aparecer no app, foi só o tempo do envio — deu certo."
              : searchParams.tiktok === "desconectado"
                ? "TikTok desconectado."
                : "Feito."}
        </p>
      )}
      {searchParams.tiktok_erro && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          TikTok: {searchParams.tiktok_erro}
        </p>
      )}
      {searchParams.tiktok_preview && (
        <p className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700">
          Prévia 9:16 gerada! No produto, clica em “ver prévia 9:16” pra assistir. Ajusta o texto e
          gera de novo, ou clica “Enviar TikTok” quando gostar.
        </p>
      )}
      {searchParams.tiktok_legenda && (
        <p className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700">
          Legenda gerada! No produto, clica em “Copiar legenda” e cola no TikTok quando for postar.
        </p>
      )}

      {/* Barra do TikTok */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3">
        <div className="text-sm">
          <span className="font-bold text-tinta">TikTok</span>
          <span className="text-tinta/60">
            {" "}
            —{" "}
            {!tkOn
              ? "não configurado no servidor (falta TIKTOK_CLIENT_KEY/SECRET)"
              : conta
                ? `conectado como ${conta.display_name}. Envia o vídeo pro rascunho e finaliza no app.`
                : "conecta tua conta pra enviar vídeos como rascunho."}
          </span>
        </div>
        {tkOn && !conta && (
          <form action={conectarTikTok}>
            <BotaoSubmit
              pendingLabel="Abrindo o TikTok…"
              className="whitespace-nowrap rounded-full bg-tinta px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-pirraia"
            >
              Conectar TikTok
            </BotaoSubmit>
          </form>
        )}
        {tkOn && conta && (
          <form action={desconectarTikTok}>
            <button type="submit" className="text-xs font-semibold text-tinta/50 hover:text-red-600">
              desconectar
            </button>
          </form>
        )}
      </div>

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
                  <>
                    {tkOn && conta && (
                      <form className="mt-2 space-y-1.5">
                        <input type="hidden" name="produtoId" value={p.id} />
                        <input
                          name="texto"
                          defaultValue={brl(Number(p.preco))}
                          placeholder="texto na tela (ex: preço do TikTok)"
                          className="w-full rounded-lg border border-black/10 px-2 py-1 text-[11px] text-tinta outline-none focus:border-pirraia"
                        />
                        <div className="flex gap-1.5">
                          <BotaoSubmit
                            formAction={previewTikTok}
                            pendingLabel="Gerando…"
                            className="flex-1 rounded-full border border-black/10 px-2 py-1.5 text-[11px] font-semibold text-tinta transition hover:bg-areia"
                          >
                            Prévia 9:16
                          </BotaoSubmit>
                          <BotaoSubmit
                            formAction={enviarVideoTikTok}
                            pendingLabel="Enviando…"
                            className="flex-1 rounded-full bg-[#000] px-2 py-1.5 text-[11px] font-bold text-white transition hover:opacity-80"
                          >
                            Enviar TikTok
                          </BotaoSubmit>
                        </div>
                        {p.video_tiktok_url && (
                          <a
                            href={p.video_tiktok_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-center text-[11px] font-semibold text-pirraia hover:underline"
                          >
                            ver prévia 9:16 ↗
                          </a>
                        )}
                      </form>
                    )}
                    {/* legenda pro TikTok (a API de rascunho não pré-preenche → copia+cola) */}
                    {tkOn && conta && (
                      <div className="mt-1.5">
                        {p.legenda_tiktok && <CopiarTexto texto={p.legenda_tiktok} />}
                        <form action={gerarLegendaTikTok} className="mt-1.5">
                          <input type="hidden" name="produtoId" value={p.id} />
                          <BotaoSubmit
                            pendingLabel="Escrevendo…"
                            className={
                              p.legenda_tiktok
                                ? "w-full text-[11px] font-semibold text-tinta/50 transition hover:text-pirraia"
                                : "w-full rounded-full border border-black/10 px-2 py-1.5 text-[11px] font-semibold text-tinta transition hover:bg-areia"
                            }
                          >
                            {p.legenda_tiktok ? "regerar legenda" : "Gerar legenda TikTok"}
                          </BotaoSubmit>
                        </form>
                      </div>
                    )}
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
                  </>
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
