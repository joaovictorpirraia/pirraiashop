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
import { BannersPromo3D } from "@/components/BannersPromo3D";
import { CategoriasCirculos3D } from "@/components/CategoriasCirculos3D";
import { Instagram3D } from "@/components/Instagram3D";
import { ultimasMidias3D } from "@/lib/instagramFeed";
import { RodapeLoja3D } from "@/components/RodapeLoja3D";

export const dynamic = "force-dynamic";

/** Prateleira (carrossel) de uma categoria, logo abaixo da faixa do tema. */
function SecaoProdutos({ itens, verHref }: { itens: VitrineItem[]; verHref: string }) {
  if (itens.length === 0) return null;
  return (
    <section className="py-3">
      <div className="mx-auto max-w-[1180px] px-4">
        <Carrossel3D titulo="" itens={itens} />
        <div className="text-center">
          <a href={verHref} className="text-sm font-semibold text-laranja">
            Ver todos →
          </a>
        </div>
      </div>
    </section>
  );
}

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
  const midiasIG = await ultimasMidias3D(6);
  const novidades = [...itens]
    .filter((i) => i.criado_em)
    .sort((a, b) => (b.criado_em! > a.criado_em! ? 1 : -1))
    .slice(0, 10);

  // categoria vinda dos ícones/banners (/3d?cat=Natal) pré-seleciona o catálogo
  const categoriaInicial = searchParams?.cat;

  // produtos por categoria (a faixa do tema + a prateleira logo abaixo)
  const porCat = (cat: string, n = 12) => itens.filter((i) => i.categoria === cat).slice(0, n);
  const natal = porCat("Natal");
  const sensoriais = porCat("Sensoriais");
  const brindes = porCat("Brindes");

  // "Todas as peças" em ordem alfabética
  const todas = [...itens].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));

  // faixas promocionais (arte completa, texto e CTA embutidos) — uma por tema
  const bannerNatal = [{ src: "/banners/natal.webp", href: "/3d?cat=Natal#catalogo", alt: "Natal Pirraia — peças 3D feitas por mim", w: 1842, h: 854 }];
  const bannerSensorial = [{ src: "/banners/sensorial.webp", href: "/3d?cat=Sensoriais#catalogo", alt: "Linha Sensorial — diversão, foco e alívio do estresse", w: 2000, h: 750 }];
  const bannerPresentear = [{ src: "/banners/presentear.webp", href: "/3d?cat=Brindes#catalogo", alt: "Pra presentear — brindes criativos e personalizados em 3D", w: 1843, h: 853 }];

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

          <CategoriasCirculos3D />

          <BannersPromo3D banners={bannerNatal} />
          <SecaoProdutos itens={natal} verHref="/3d?cat=Natal#catalogo" />

          <BannersPromo3D banners={bannerSensorial} />
          <SecaoProdutos itens={sensoriais} verHref="/3d?cat=Sensoriais#catalogo" />

          <BannersPromo3D banners={bannerPresentear} />
          <SecaoProdutos itens={brindes} verHref="/3d?cat=Brindes#catalogo" />

          <section id="catalogo" className="scroll-mt-28 py-10">
            <div className="mx-auto max-w-[1180px] px-4">
              <div className="mb-5 text-center">
                <h2 className="font-display text-[26px] font-semibold">Todas as peças</h2>
                <p className="mt-1.5 text-fumo">Em ordem alfabética — busca e filtra por categoria</p>
              </div>
              <Grade itens={todas} categoriaInicial={categoriaInicial} />
            </div>
          </section>

          <Instagram3D midias={midiasIG} />
        </main>
      )}

      <RodapeLoja3D />
    </div>
  );
}
