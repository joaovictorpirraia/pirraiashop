import type { ReactNode } from "react";

// As 9 categorias da loja 3D, cada uma com seu ícone de linha (laranja da marca).
// Cada categoria leva ao catálogo já filtrado (/3d?cat=...).
const CATEGORIAS: { nome: string; icone: ReactNode }[] = [
  {
    nome: "Natal",
    // árvore de Natal
    icone: <path d="M12 3 7 11h3l-3 5h4l-2 4h6l-2-4h4l-3-5h3zM11 20v2h2v-2" />,
  },
  {
    nome: "Sensoriais",
    // círculos concêntricos (foco/calma)
    icone: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    nome: "Cozinha",
    // garfo e faca
    icone: <path d="M7 3v6a2 2 0 002 2 2 2 0 002-2V3M9 11v10M16.5 3c-1.3 1-1.5 4-1.5 6 0 1.2.6 2 1.5 2v10" />,
  },
  {
    nome: "Utilidades",
    // chave de boca
    icone: <path d="M15 4a4 4 0 00-4.9 5.2l-6.4 6.4 2.7 2.7 6.4-6.4A4 4 0 0019 7l-2.4 2.4-2.1-.5-.5-2.1z" />,
  },
  {
    nome: "Colecionáveis",
    // troféu
    icone: <path d="M8 4h8v4a4 4 0 01-8 0zM8 6H5a3 3 0 003 3.3M16 6h3a3 3 0 01-3 3.3M12 12v3.5M9.5 20h5M10.5 15.5h3V20h-3z" />,
  },
  {
    nome: "Brindes",
    // presente
    icone: (
      <>
        <rect x="4" y="9" width="16" height="12" rx="1" />
        <path d="M4 13h16M12 9v12M12 9c-2.2 0-4-.9-4-2.5S10 4.5 12 9c2-4.5 4-2.3 4-2.5 0 1.6-1.8 2.5-4 2.5" />
      </>
    ),
  },
  {
    nome: "Fé",
    // cruz
    icone: <path d="M10 3h4v6h6v4h-6v8h-4v-8H4V9h6z" />,
  },
  {
    nome: "Decoração",
    // quadro / moldura
    icone: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="1.5" />
        <path d="M4 16l4.5-4 3 2.5L16 9l4 5" />
        <circle cx="9" cy="9" r="1.3" />
      </>
    ),
  },
  {
    nome: "Futebol",
    // bola
    icone: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5l3.2 2.3-1.2 3.9h-4l-1.2-3.9zM12 7.5V3.2M15.2 9.8l3.6-1.4M13.9 13.7l2.4 3.3M10.1 13.7l-2.4 3.3M8.8 9.8 5.2 8.4" />
      </>
    ),
  },
];

/**
 * "Compre por categoria": ícones circulares em carrossel horizontal.
 * Cada categoria tem um ícone de linha próprio, no laranja da marca.
 */
export function CategoriasCirculos3D() {
  return (
    <section id="categorias" className="scroll-mt-28 py-8 pt-2">
      <div className="mx-auto max-w-[1180px] px-4">
        <div className="mb-5 text-center">
          <h2 className="font-display text-[26px] font-semibold">Compre por categoria</h2>
          <p className="mt-1.5 text-fumo">Escolhe o que você procura</p>
        </div>
        <div className="no-scrollbar flex gap-3.5 overflow-x-auto pb-1.5">
          {CATEGORIAS.map((cat) => (
            <a
              key={cat.nome}
              href={`/3d?cat=${encodeURIComponent(cat.nome)}#catalogo`}
              className="group w-[112px] flex-none text-center"
            >
              <span className="mx-auto mb-2.5 grid h-[92px] w-[92px] place-items-center rounded-full border border-linha bg-white shadow-carta transition-colors group-hover:border-laranja">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-[38px] w-[38px] text-laranja"
                >
                  {cat.icone}
                </svg>
              </span>
              <b className="text-[13.5px] font-semibold">{cat.nome}</b>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
