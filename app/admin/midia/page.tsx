"use client";

import { useEffect, useState } from "react";
import { baixarMidia } from "./actions";

/**
 * Recebe as URLs de mídia coletadas pelo bookmarklet na página da Shopee
 * (no fragmento # da URL). Mostra as fotos numa grade selecionável — o dono
 * desmarca o que não presta (thumb de produto relacionado, ícone) e baixa o
 * resto num .zip. Protegida pela Basic Auth do /admin.
 */
export default function Midia() {
  const [nome, setNome] = useState("produto");
  const [urls, setUrls] = useState<string[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [estado, setEstado] = useState<"lendo" | "pronto" | "vazio" | "baixando">("lendo");
  const [erro, setErro] = useState("");

  useEffect(() => {
    const raw = window.location.hash.slice(1);
    if (!raw) {
      setEstado("vazio");
      return;
    }
    try {
      const d = JSON.parse(decodeURIComponent(raw)) as { urls?: string[]; nome?: string };
      const lista = (d.urls ?? []).filter((u) => typeof u === "string");
      if (lista.length === 0) {
        setEstado("vazio");
        return;
      }
      setUrls(lista);
      setSel(Object.fromEntries(lista.map((u) => [u, true])));
      setNome(d.nome || "produto");
      setEstado("pronto");
    } catch {
      setEstado("vazio");
    }
  }, []);

  const selecionadas = urls.filter((u) => sel[u]);

  async function baixar() {
    if (selecionadas.length === 0) return;
    setErro("");
    setEstado("baixando");
    try {
      const res = await baixarMidia(selecionadas, nome);
      if (!res.ok || !res.zipBase64) {
        setErro(res.erro ?? "Falha ao montar o zip.");
        setEstado("pronto");
        return;
      }
      const bytes = Uint8Array.from(atob(res.zipBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.arquivo ?? "midia.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErro((e as Error)?.message ?? "Falha ao baixar.");
    } finally {
      setEstado("pronto");
    }
  }

  return (
    <div className="min-h-screen bg-areia">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            pirraia<span className="text-pirraia">.</span>{" "}
            <span className="text-fumo">mídia</span>
          </span>
          <a
            href="/admin"
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-tinta transition-colors hover:bg-white"
          >
            ← Admin
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        {estado === "vazio" ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-fumo shadow-carta">
            Abra esta página pelo bookmarklet “Baixar mídia”, na página de um produto da Shopee.
          </p>
        ) : estado === "lendo" ? (
          <p className="p-8 text-center text-sm text-fumo">Lendo mídias…</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-fumo">
                <span className="font-semibold text-tinta">{nome}</span> · {selecionadas.length} de{" "}
                {urls.length} selecionada(s)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSel(Object.fromEntries(urls.map((u) => [u, true])))}
                  className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-tinta transition-colors hover:bg-white"
                >
                  Marcar todas
                </button>
                <button
                  onClick={() => setSel({})}
                  className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-tinta transition-colors hover:bg-white"
                >
                  Limpar
                </button>
                <button
                  onClick={baixar}
                  disabled={selecionadas.length === 0 || estado === "baixando"}
                  className="rounded-full bg-pirraia px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-pirraia-dark disabled:opacity-40"
                >
                  {estado === "baixando" ? "Montando zip…" : `Baixar .zip (${selecionadas.length})`}
                </button>
              </div>
            </div>

            {erro && (
              <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {erro}
              </p>
            )}

            <p className="mb-3 text-xs text-fumo">
              Desmarque o que não for do produto (ícones, fotos de produtos relacionados) e baixe o
              resto. Clique numa foto pra marcar/desmarcar.
            </p>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {urls.map((u) => {
                const ehVideo = /\.mp4(\?|$)/i.test(u) || /vod\.susercontent/i.test(u);
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setSel((s) => ({ ...s, [u]: !s[u] }))}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                      sel[u] ? "border-pirraia" : "border-transparent opacity-45"
                    }`}
                  >
                    {ehVideo ? (
                      <video
                        src={u}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full bg-black object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u} alt="" className="h-full w-full object-cover" />
                    )}
                    {ehVideo && (
                      <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-bold text-white">
                        🎬 vídeo
                      </span>
                    )}
                    {sel[u] && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-pirraia text-[11px] font-bold text-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
