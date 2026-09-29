import type { Metadata } from "next";
import { supabasePublic } from "@/lib/supabase";
import type { VitrineItem } from "@/lib/types";
import { Grade } from "@/components/Grade";
import { PixelTrack } from "@/components/PixelTrack";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Impressões 3D — pirraiashop",
  description: "Peças impressas em 3D, feitas e entregues por mim. Encomende no WhatsApp.",
};

export default async function Impressoes3D() {
  const supabase = supabasePublic();
  const { data } = await supabase
    .from("vitrine")
    .select("*")
    .eq("proprio", true)
    .returns<VitrineItem[]>();
  const itens = data ?? [];

  return (
    <div className="min-h-screen">
      <PixelTrack event="ViewContent" params={{ content_name: "3d" }} />

      <header className="sticky top-0 z-30 h-14 border-b border-black/5 bg-areia/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5 lg:max-w-7xl">
          <a href="/" className="text-xl font-extrabold tracking-tight text-tinta">
            pirraiashop<span className="text-pirraia">.</span>com.br
          </a>
          <a href="/" className="rounded-full border border-black/10 px-3.5 py-1.5 text-xs font-bold text-tinta transition hover:bg-white">
            ← Achadinhos
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16 lg:max-w-7xl">
        <section className="py-6">
          <h1 className="text-2xl font-extrabold text-tinta">Impressões 3D</h1>
          <p className="mt-1 max-w-xl text-sm text-fumo">
            Peças impressas em 3D por mim, com entrega combinada direto no WhatsApp. Escolhe a peça,
            clica em <span className="font-semibold text-[#128C4B]">Comprar no WhatsApp</span> e a gente
            fecha o pedido.
          </p>
        </section>

        {itens.length === 0 ? (
          <p className="py-16 text-center text-sm text-fumo">
            Nenhuma peça 3D publicada ainda. Volta já já.
          </p>
        ) : (
          <Grade itens={itens} />
        )}
      </main>

      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto max-w-3xl px-5 py-8 lg:max-w-7xl">
          <p className="text-xs leading-relaxed text-fumo">
            Peças feitas sob encomenda e impressas por mim. Prazo, cores e frete são combinados no
            WhatsApp antes do pagamento.
          </p>
          <p className="mt-3 text-xs font-semibold text-tinta">
            pirraia<span className="text-pirraia">.</span> impressões 3D
          </p>
        </div>
      </footer>
    </div>
  );
}
