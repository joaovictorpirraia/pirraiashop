import Image from "next/image";
import type { VitrineItem } from "@/lib/types";
import { brl, nota } from "@/lib/format";
import { LojaBotao } from "./LojaBotao";
import { CompartilharBotao } from "./CompartilharBotao";

export function ProdutoCard({ item }: { item: VitrineItem }) {
  const avaliacao = nota(item.avaliacao);

  return (
    <div className="group relative">
      <CompartilharBotao
        slug={item.slug}
        titulo={item.titulo}
        className="absolute right-2 top-2 z-10"
      />
      <a href={`/r/${item.slug}`} className="block">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white shadow-carta">
        {item.imagem_url && (
          <Image
            src={item.imagem_url}
            alt={item.titulo}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        )}
        {item.desconto_pct != null && item.desconto_pct > 0 && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-pirraia px-2.5 py-1 text-xs font-extrabold leading-none text-white shadow-sm">
            -{item.desconto_pct}%
          </span>
        )}
      </div>

      <div className="mt-2.5">
        <div className="flex items-center gap-1 text-xs text-fumo">
          {avaliacao && (
            <>
              <StarIcon />
              <span className="font-semibold text-tinta">{avaliacao}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="truncate">{item.loja_nome}</span>
        </div>

        <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-tinta">
          {item.titulo}
        </h3>

        <div className="mt-1.5 flex items-baseline gap-1.5">
          {item.preco_antigo != null && (
            <span className="text-xs text-fumo line-through">
              {brl(item.preco_antigo)}
            </span>
          )}
          <span className="text-lg font-extrabold tracking-tight text-tinta">
            {brl(item.preco)}
          </span>
        </div>

        <LojaBotao loja={item.loja} className="mt-2.5" />
      </div>
      </a>
    </div>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-pirraia" aria-hidden>
      <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.95 2.6.95-5.5-4-3.9 5.53-.8z" />
    </svg>
  );
}
