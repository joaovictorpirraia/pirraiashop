"use client";

import { useMemo, useState } from "react";
import type { VitrineItem } from "@/lib/types";
import { ProdutoCard } from "./ProdutoCard";

const TODOS = "Tudo";
const TODAS = "todas";

const LOJA_ROTULO: Record<string, string> = {
  shopee: "Shopee",
  mercadolivre: "Mercado Livre",
  tiktok: "TikTok Shop",
};

export function Grade({ itens }: { itens: VitrineItem[] }) {
  const [fonte, setFonte] = useState<string>(TODAS);
  const [ativa, setAtiva] = useState<string>(TODOS);

  // lojas presentes (só mostra o seletor de fonte se houver mais de uma)
  const lojas = useMemo(() => {
    const set = new Set<string>();
    for (const i of itens) if (i.loja) set.add(i.loja);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [itens]);

  const porFonte = useMemo(
    () => (fonte === TODAS ? itens : itens.filter((i) => i.loja === fonte)),
    [itens, fonte],
  );

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const i of porFonte) if (i.categoria) set.add(i.categoria);
    return [TODOS, ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [porFonte]);

  const visiveis = useMemo(
    () => porFonte.filter((i) => ativa === TODOS || i.categoria === ativa),
    [porFonte, ativa],
  );

  function trocarFonte(f: string) {
    setFonte(f);
    setAtiva(TODOS); // zera a categoria pra não ficar num filtro vazio
  }

  return (
    <section>
      <div className="sticky top-14 z-20 -mx-5 space-y-2 bg-areia/90 px-5 py-3 backdrop-blur">
        {/* seletor de loja (só quando há mais de uma) */}
        {lojas.length > 1 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <ChipFonte rotulo="Todas" loja={TODAS} on={fonte === TODAS} onClick={trocarFonte} />
            {lojas.map((l) => (
              <ChipFonte
                key={l}
                rotulo={LOJA_ROTULO[l] ?? l}
                loja={l}
                on={fonte === l}
                onClick={trocarFonte}
              />
            ))}
          </div>
        )}

        {/* chips de categoria */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {categorias.map((cat) => {
            const on = cat === ativa;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setAtiva(cat)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  on ? "bg-tinta text-white" : "bg-white text-fumo shadow-carta hover:text-tinta"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {visiveis.map((item) => (
          <ProdutoCard key={item.slug} item={item} />
        ))}
      </div>

      {visiveis.length === 0 && (
        <p className="py-16 text-center text-sm text-fumo">
          Nada em {ativa === TODOS ? LOJA_ROTULO[fonte] ?? "" : ativa} por enquanto. Volta já já.
        </p>
      )}
    </section>
  );
}

/** Chip do seletor de loja — cor da marca quando ativo. */
function ChipFonte({
  rotulo,
  loja,
  on,
  onClick,
}: {
  rotulo: string;
  loja: string;
  on: boolean;
  onClick: (l: string) => void;
}) {
  const ativoClasse =
    loja === "shopee"
      ? "bg-[#EE4D2D] text-white"
      : loja === "mercadolivre"
        ? "bg-[#FFE600] text-[#2D3277]"
        : "bg-tinta text-white";
  return (
    <button
      type="button"
      onClick={() => onClick(loja)}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
        on ? ativoClasse : "bg-white text-fumo shadow-carta hover:text-tinta"
      }`}
    >
      {rotulo}
    </button>
  );
}
