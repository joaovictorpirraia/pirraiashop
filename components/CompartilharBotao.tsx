"use client";

import { useState } from "react";
import { brl } from "@/lib/format";

/**
 * Botão de compartilhar por produto. O link compartilhado é o redirect
 * /r/[slug] (conta clique + mantém o link de afiliado). No celular usa a folha
 * nativa (navigator.share = WhatsApp/IG/Telegram/copiar…); no desktop abre um
 * menu com WhatsApp, Telegram, Facebook, X e copiar link.
 *
 * Fica FORA do <a> do card (posicionado por cima), então não dispara a navegação.
 */
const BASE = "https://pirraiashop.com.br";

export function CompartilharBotao({
  slug,
  titulo,
  preco = null,
  descontoPct = null,
  className = "",
}: {
  slug: string;
  titulo: string;
  preco?: string | number | null;
  descontoPct?: number | null;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const url = `${BASE}/r/${slug}`;
  // "Título — R$ 29,60 (-26%) 👉"
  const linhaPreco =
    preco != null
      ? ` — ${brl(preco)}${descontoPct != null && descontoPct > 0 ? ` (-${descontoPct}%)` : ""}`
      : "";
  const msg = `${titulo}${linhaPreco} 👉`;

  const alvos = [
    { nome: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${msg} ${url}`)}` },
    {
      nome: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(msg)}`,
    },
    {
      nome: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      nome: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(url)}`,
    },
  ];

  async function clique(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: titulo, text: titulo, url });
      } catch {
        /* usuário cancelou */
      }
      return;
    }
    setAberto((v) => !v);
  }

  function copiar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={clique}
        aria-label="Compartilhar"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-tinta shadow-carta backdrop-blur transition-colors hover:bg-white"
      >
        <ShareIcon />
      </button>

      {aberto && (
        <>
          {/* clique fora fecha */}
          <button
            type="button"
            aria-label="Fechar"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAberto(false);
            }}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-xl border border-black/5 bg-white py-1 shadow-carta">
            {alvos.map((a) => (
              <a
                key={a.nome}
                href={a.href}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block px-3 py-2 text-sm font-medium text-tinta hover:bg-areia"
              >
                {a.nome}
              </a>
            ))}
            <button
              type="button"
              onClick={copiar}
              className="block w-full px-3 py-2 text-left text-sm font-medium text-tinta hover:bg-areia"
            >
              {copiado ? "Link copiado ✓" : "Copiar link"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}
