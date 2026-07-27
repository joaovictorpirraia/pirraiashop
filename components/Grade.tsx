"use client";

import { useMemo, useState } from "react";
import type { VitrineItem } from "@/lib/types";
import { ProdutoCard } from "./ProdutoCard";

const TODOS = "Tudo";

export function Grade({ itens }: { itens: VitrineItem[] }) {
  const [ativa, setAtiva] = useState<string>(TODOS);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const i of itens) if (i.categoria) set.add(i.categoria);
    return [TODOS, ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [itens]);

  const visiveis = useMemo(
    () => (ativa === TODOS ? itens : itens.filter((i) => i.categoria === ativa)),
    [itens, ativa],
  );

  return (
    <section>
      {/* chips de categoria — scroll horizontal, sticky abaixo do header */}
      <div className="sticky top-14 z-20 -mx-5 bg-areia/90 px-5 py-3 backdrop-blur">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {categorias.map((cat) => {
            const on = cat === ativa;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setAtiva(cat)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  on
                    ? "bg-tinta text-white"
                    : "bg-white text-fumo shadow-carta hover:text-tinta"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {visiveis.map((item) => (
          <ProdutoCard key={item.slug} item={item} />
        ))}
      </div>

      {visiveis.length === 0 && (
        <p className="py-16 text-center text-sm text-fumo">
          Nada em {ativa} por enquanto. Volta já já.
        </p>
      )}
    </section>
  );
}
