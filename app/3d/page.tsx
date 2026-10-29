import type { Metadata } from "next";
import { supabasePublic } from "@/lib/supabase";
import type { VitrineItem } from "@/lib/types";
import { Grade } from "@/components/Grade";
import { Carrossel3D } from "@/components/Carrossel3D";
import { PixelTrack } from "@/components/PixelTrack";
import { bannerAtivo } from "@/lib/banner";
import { HeaderLoja3D } from "@/components/HeaderLoja3D";
import { BarraAviso3D } from "@/components/BarraAviso3D";
import { HeroBanner3D } from "@/components/HeroBanner3D";
import { Beneficios3D } from "@/components/Beneficios3D";
import { BannersSegmento3D } from "@/components/BannersSegmento3D";
import { CategoriasCirculos3D } from "@/components/CategoriasCirculos3D";
import { BannersCategoria3D } from "@/components/BannersCategoria3D";
import { Instagram3D } from "@/components/Instagram3D";
import { RodapeLoja3D } from "@/components/RodapeLoja3D";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pirraia 3D — peças impressas por mim",
  description: "Peças impressas em 3D, feitas e entregues por mim. Encomende no WhatsApp.",
};

export default async function Impressoes3D({
  searchParams,
}: {
  searchParams?: { cat?: string };
}) {
  const supabase = supabasePublic();
  const { data } = await supabase
    .from("vitrine")
    .select("*")
    .eq("proprio", true)
    .returns<VitrineItem[]>();
  const itens = data ?? [];

  const banner = await bannerAtivo();
  const novidades = [...itens]
    .filter((i) => i.criado_em)
    .sort((a, b) => (b.criado_em! > a.criado_em! ? 1 : -1))
    .slice(0, 10);
  const destaques = itens.filter((i) => i.destaque).slice(0, 10);

  // categoria vinda dos ícones/banners (/3d?cat=Natal) pré-seleciona o catálogo
  const categoriaInicial = searchParams?.cat;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PixelTrack event="ViewContent" params={{ content_name: "3d" }} />

      <BarraAviso3D />
      <HeaderLoja3D ativo="Início" />

      {itens.length === 0 ? (
        <main className="mx-auto max-w-[1180px] px-4">
          <HeroBanner3D banner={banner} />
          <p className="py-16 text-center text-sm text-fumo">
            Nenhuma peça 3D publicada ainda. Volta já já.
          </p>
        </main>
      ) : (
        <main>
          <div className="mx-auto max-w-[1180px] px-4">
            <HeroBanner3D banner={banner} />
          </div>

          <Beneficios3D />
          <BannersSegmento3D />
          <CategoriasCirculos3D />

          {novidades.length > 0 && (
            <section id="novidades" className="scroll-mt-28 py-4 pt-2">
              <div className="mx-auto max-w-[1180px] px-4">
                <div className="mb-5 text-center">
                  <h2 className="font-display text-[26px] font-semibold">Novidades</h2>
                  <p className="mt-1.5 text-fumo">As últimas que saíram da impressora</p>
                </div>
                <Carrossel3D titulo="" itens={novidades} />
              </div>
            </section>
          )}

          <BannersCategoria3D />

          {destaques.length > 0 && (
            <section className="py-4 pt-2">
              <div className="mx-auto max-w-[1180px] px-4">
                <div className="mb-5 text-center">
                  <h2 className="font-display text-[26px] font-semibold">Destaques</h2>
                  <p className="mt-1.5 text-fumo">As queridinhas da loja</p>
                </div>
                <Carrossel3D titulo="" itens={destaques} />
              </div>
            </section>
          )}

          <Instagram3D />

          <section id="catalogo" className="scroll-mt-28 py-10">
            <div className="mx-auto max-w-[1180px] px-4">
              <div className="mb-5 text-center">
                <h2 className="font-display text-[26px] font-semibold">Todas as peças</h2>
                <p className="mt-1.5 text-fumo">Busca e filtra por categoria</p>
              </div>
              <Grade itens={itens} categoriaInicial={categoriaInicial} />
            </div>
          </section>
        </main>
      )}

      <RodapeLoja3D />
    </div>
  );
}
