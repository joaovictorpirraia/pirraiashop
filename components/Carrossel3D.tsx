import type { VitrineItem } from "@/lib/types";
import { ProdutoCard } from "./ProdutoCard";
import { CarrosselDeslizavel } from "./CarrosselDeslizavel";

export function Carrossel3D({ titulo, itens }: { titulo: string; itens: VitrineItem[] }) {
  if (itens.length === 0) return null;
  return (
    <section className="mb-8">
      {titulo && (
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fumo">{titulo}</h2>
      )}
      <CarrosselDeslizavel>
        {itens.map((item) => (
          <div key={item.slug} className="w-36 shrink-0 snap-start sm:w-44">
            <ProdutoCard item={item} />
          </div>
        ))}
      </CarrosselDeslizavel>
    </section>
  );
}
