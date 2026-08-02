"use client";

import { useEffect, useRef, useState } from "react";
import { capturarProduto } from "../actions";

/**
 * Recebe o produto capturado pelo bookmarklet (dados no fragmento # da URL, que
 * não vai pro servidor). Cria na fila via Server Action e mostra o resultado.
 * Protegida pela mesma Basic Auth do /admin (middleware cobre /admin/:path*).
 */
type Estado = "lendo" | "salvando" | "ok" | "erro" | "vazio";

export default function Capturar() {
  const [estado, setEstado] = useState<Estado>("lendo");
  const [msg, setMsg] = useState("");
  const rodou = useRef(false);

  useEffect(() => {
    if (rodou.current) return; // evita rodar duas vezes no StrictMode
    rodou.current = true;

    const raw = window.location.hash.slice(1);
    if (!raw) {
      setEstado("vazio");
      return;
    }
    let dados: unknown;
    try {
      dados = JSON.parse(decodeURIComponent(raw));
    } catch {
      setEstado("erro");
      setMsg("Dados inválidos no link do bookmarklet.");
      return;
    }

    setEstado("salvando");
    capturarProduto(dados as Parameters<typeof capturarProduto>[0])
      .then((r) => {
        if (r.ok) {
          setEstado("ok");
          setMsg(r.titulo ?? "");
        } else {
          setEstado("erro");
          setMsg(r.erro ?? "Falha ao capturar.");
        }
      })
      .catch((e) => {
        setEstado("erro");
        setMsg((e as Error)?.message ?? "Falha ao capturar.");
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-areia px-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-carta">
        <div className="mb-4 text-lg font-extrabold tracking-tight text-tinta">
          pirraia<span className="text-pirraia">.</span>{" "}
          <span className="text-fumo">captura</span>
        </div>

        {(estado === "lendo" || estado === "salvando") && (
          <p className="text-sm text-fumo">Capturando produto…</p>
        )}

        {estado === "ok" && (
          <>
            <div className="mb-2 text-3xl">✅</div>
            <p className="text-sm font-semibold text-tinta">Produto na fila!</p>
            {msg && <p className="mt-1 line-clamp-3 text-xs text-fumo">{msg}</p>}
            <p className="mt-3 text-xs text-fumo">
              Pode fechar esta aba e capturar o próximo. Depois, no admin, cure colando o link de
              afiliado.
            </p>
            <a
              href="/admin"
              className="mt-4 inline-block rounded-lg bg-pirraia px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-pirraia-dark"
            >
              Ir pra fila
            </a>
          </>
        )}

        {estado === "vazio" && (
          <p className="text-sm text-fumo">
            Abra esta página pelo bookmarklet “Mandar pro Pirraia”, na página de um produto da
            Shopee.
          </p>
        )}

        {estado === "erro" && (
          <>
            <div className="mb-2 text-3xl">⚠️</div>
            <p className="text-sm font-semibold text-tinta">Não deu pra capturar</p>
            <p className="mt-1 text-xs text-fumo">{msg}</p>
            <a
              href="/admin/novo"
              className="mt-4 inline-block rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-tinta transition-colors hover:bg-areia"
            >
              Cadastrar na mão
            </a>
          </>
        )}
      </div>
    </div>
  );
}
