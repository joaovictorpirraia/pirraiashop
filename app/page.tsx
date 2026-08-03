import Image from "next/image";
import { supabasePublic } from "@/lib/supabase";
import type { VitrineItem } from "@/lib/types";
import { brl, nota } from "@/lib/format";
import { Grade } from "@/components/Grade";
import { LojaBotao } from "@/components/LojaBotao";
import { PixelTrack } from "@/components/PixelTrack";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = supabasePublic();
  const { data, error } = await supabase
    .from("vitrine")
    .select("*")
    .returns<VitrineItem[]>();

  const itens = data ?? [];
  // até 2 destaques: os marcados; se faltar, completa com os primeiros da lista
  const marcados = itens.filter((i) => i.destaque);
  const destaques = (
    marcados.length >= 2 ? marcados : [...marcados, ...itens.filter((i) => !i.destaque)]
  ).slice(0, 2);
  const slugsDestaque = new Set(destaques.map((d) => d.slug));
  const resto = itens.filter((i) => !slugsDestaque.has(i.slug));

  return (
    <div className="min-h-screen">
      <PixelTrack event="ViewContent" params={{ content_name: "vitrine" }} />
      <Header />

      <main className="mx-auto max-w-3xl px-5 pb-16 lg:max-w-7xl">
        {error ? (
          <p className="py-20 text-center text-sm text-fumo">
            Deu ruim ao carregar os achados. Recarrega a página.
          </p>
        ) : itens.length === 0 ? (
          <p className="py-20 text-center text-sm text-fumo">
            Ainda garimpando os primeiros achados. Volta já já.
          </p>
        ) : (
          <>
            {destaques.length > 0 && (
              <section className="grid gap-5 pb-8 pt-5 lg:grid-cols-2">
                {destaques.map((d) => (
                  <Hero key={d.slug} item={d} />
                ))}
              </section>
            )}
            <Grade itens={resto} />
          </>
        )}
      </main>

      <Rodape />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-black/5 bg-areia/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5 lg:max-w-7xl">
        <span className="text-xl font-extrabold tracking-tight text-tinta">
          pirraiashop<span className="text-pirraia">.</span>com.br
        </span>
        <span className="hidden text-xs font-medium text-fumo sm:block">
          achadinhos garimpados e testados para quem gosta de ofertas
        </span>
      </div>
    </header>
  );
}

function Hero({ item }: { item: VitrineItem }) {
  const avaliacao = nota(item.avaliacao);

  return (
    <a
      href={`/r/${item.slug}`}
      className="group block overflow-hidden rounded-3xl bg-white shadow-carta"
    >
      <div className="relative aspect-[4/5] sm:aspect-[3/2]">
          {item.imagem_url && (
            <Image
              src={item.imagem_url}
              alt={item.titulo}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          )}
          <span className="absolute left-4 top-4 rounded-full bg-pirraia px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white shadow-sm">
            Achado da vez
          </span>
          {item.desconto_pct != null && item.desconto_pct > 0 && (
            <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-sm font-extrabold text-pirraia shadow-sm">
              -{item.desconto_pct}%
            </span>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-center gap-1.5 text-xs text-fumo">
            {avaliacao && (
              <>
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-pirraia" aria-hidden>
                  <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.95 2.6.95-5.5-4-3.9 5.53-.8z" />
                </svg>
                <span className="font-semibold text-tinta">{avaliacao}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{item.categoria}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{item.loja_nome}</span>
          </div>

          <h1 className="mt-2 text-xl font-bold leading-tight tracking-tight text-tinta sm:text-2xl">
            {item.titulo}
          </h1>

          <div className="mt-3 flex items-baseline gap-2">
            {item.preco_antigo != null && (
              <span className="text-sm text-fumo line-through">
                {brl(item.preco_antigo)}
              </span>
            )}
            <span className="text-3xl font-extrabold tracking-tight text-tinta">
              {brl(item.preco)}
            </span>
          </div>

          <LojaBotao loja={item.loja} grande className="mt-4" />
        </div>
      </a>
  );
}

function Rodape() {
  return (
    <footer className="border-t border-black/5 bg-white">
      <div className="mx-auto max-w-3xl px-5 py-8 lg:max-w-7xl">
        <p className="text-xs leading-relaxed text-fumo">
          Esta página contém links de afiliado. Ao comprar por eles você não paga
          nada a mais — a comissão vem da loja, não de você.
        </p>
        <p className="mt-3 text-xs font-semibold text-tinta">
          pirraia<span className="text-pirraia">.</span> achadinhos
        </p>
      </div>
    </footer>
  );
}
