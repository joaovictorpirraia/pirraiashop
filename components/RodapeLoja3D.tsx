import { LogoPirraia3D } from "./LogoPirraia3D";
import { WHATS_URL, INSTA_URL, INSTA_HANDLE } from "@/lib/contato3d";

const CATEGORIAS: Array<{ rotulo: string; href: string }> = [
  { rotulo: "Natal", href: "/3d?cat=Natal#catalogo" },
  { rotulo: "Sensoriais", href: "/3d?cat=Sensoriais#catalogo" },
  { rotulo: "Utilidades", href: "/3d?cat=Utilidades#catalogo" },
  { rotulo: "Colecionáveis", href: "/3d?cat=Colecion%C3%A1veis#catalogo" },
  { rotulo: "Brindes", href: "/3d?cat=Brindes#catalogo" },
  { rotulo: "Ver todas →", href: "/3d#categorias" },
];

/** Rodapé grafite da loja 3D, com colunas (marca / categorias / atendimento). */
export function RodapeLoja3D() {
  return (
    <footer className="mt-2.5 bg-grafite text-[#D9D2CB]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-4 py-11 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <LogoPirraia3D claro />
          <p className="my-3.5 max-w-[34ch] text-[13.5px] leading-relaxed text-[#AFA79F]">
            Peças impressas em 3D por mim, em Recife. Você escolhe a peça e a cor, a gente combina
            tudo pelo WhatsApp e eu imprimo sob encomenda.
          </p>
          <a
            href={WHATS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-semibold text-white"
          >
            WhatsApp (81) 99227-4919
          </a>
          <span className="mt-3 inline-block rounded-full border border-laranja/40 px-3 py-1.5 text-xs text-laranja">
            Feito sob encomenda
          </span>
        </div>

        <div>
          <h5 className="mb-3.5 font-display text-[15px] font-semibold text-white">Categorias</h5>
          <ul className="grid gap-2.5 text-[13.5px] text-[#C7C0B9]">
            {CATEGORIAS.map((c) => (
              <li key={c.rotulo}>
                <a href={c.href}>{c.rotulo}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h5 className="mb-3.5 font-display text-[15px] font-semibold text-white">Atendimento</h5>
          <ul className="grid gap-2.5 text-[13.5px] text-[#C7C0B9]">
            <li>
              <a href={WHATS_URL} target="_blank" rel="noopener noreferrer">
                Como encomendar
              </a>
            </li>
            <li>
              <a href={WHATS_URL} target="_blank" rel="noopener noreferrer">
                Prazo e entrega
              </a>
            </li>
            <li>
              <a href={WHATS_URL} target="_blank" rel="noopener noreferrer">
                Pedidos pelo WhatsApp
              </a>
            </li>
            <li>
              <a href={INSTA_URL} target="_blank" rel="noopener noreferrer">
                {INSTA_HANDLE} no Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 text-xs text-[#8E877F]">
        <div className="mx-auto max-w-[1180px] px-4 py-4">
          Pirraia 3D · Impressões 3D · 2026 — Peças sob encomenda, pagamento combinado no
          WhatsApp.
        </div>
      </div>
    </footer>
  );
}
