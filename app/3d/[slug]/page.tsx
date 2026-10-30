import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduto3D, relacionados3D } from "@/lib/produto3d";
import { coresDoProduto } from "@/lib/cores";
import { brl } from "@/lib/format";
import { Galeria3D } from "@/components/Galeria3D";
import { ComprarProduto3D } from "@/components/ComprarProduto3D";
import { ProdutoCard } from "@/components/ProdutoCard";
import { PixelTrack } from "@/components/PixelTrack";
import { HeaderLoja3D } from "@/components/HeaderLoja3D";
import { BarraAviso3D } from "@/components/BarraAviso3D";
import { RodapeLoja3D } from "@/components/RodapeLoja3D";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getProduto3D(params.slug);
  if (!p) return { title: "Produto não encontrado — Pirraia 3D" };
  return {
    title: `${p.titulo} — Pirraia 3D`,
    description: p.descricao ?? "Peça impressa em 3D, feita sob encomenda.",
    openGraph: { images: p.imagem_url ? [p.imagem_url] : [] },
  };
}

export default async function Produto3D({ params }: { params: { slug: string } }) {
  const p = await getProduto3D(params.slug);
  if (!p) notFound();

  const cores = coresDoProduto(p.cores);
  const relacionados = await relacionados3D(p.categoria, p.slug);
  const preco = Number(p.preco);
  const antigo = p.preco_antigo != null ? Number(p.preco_antigo) : null;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PixelTrack event="ViewContent" params={{ content_name: p.titulo, content_category: p.categoria ?? "3D" }} />

      <BarraAviso3D />
      <HeaderLoja3D ativo="" />

      <main className="mx-auto max-w-5xl px-5 py-6">
        <nav className="mb-4 text-xs text-fumo">
          <a href="/3d" className="hover:underline">Impressões 3D</a>
          {p.categoria && <> · <span className="text-tinta">{p.categoria}</span></>}
        </nav>

        <div className="grid gap-6 lg:grid-cols-2">
          <Galeria3D capa={p.imagem_url} fotos={p.fotos} videoUrl={p.video_url} titulo={p.titulo} />

          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-extrabold text-tinta">{p.titulo}</h1>
            <div className="flex items-baseline gap-2">
              {antigo != null && antigo > preco && (
                <span className="text-sm text-fumo line-through">{brl(antigo)}</span>
              )}
              <span className="text-3xl font-extrabold text-tinta">{brl(preco)}</span>
            </div>
            <ComprarProduto3D slug={p.slug} cores={cores} />
            {p.descricao && <p className="whitespace-pre-line text-sm leading-relaxed text-tinta/80">{p.descricao}</p>}
          </div>
        </div>

        {relacionados.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fumo">Você também vai gostar</h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {relacionados.map((item) => (
                <ProdutoCard key={item.slug} item={item} />
              ))}
            </div>
          </section>
        )}
      </main>

      <RodapeLoja3D />
    </div>
  );
}
