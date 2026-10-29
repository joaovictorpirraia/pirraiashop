import type { VitrineItem } from "@/lib/types";
import { ProdutoCard } from "./ProdutoCard";

export function Carrossel3D({ titulo, itens }: { titulo: string; itens: VitrineItem[] }) {
  if (itens.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fumo">{titulo}</h2>
      <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5">
        {itens.map((item) => (
          <div key={item.slug} className="w-36 shrink-0 snap-start sm:w-44">
            <ProdutoCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
