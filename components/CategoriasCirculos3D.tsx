// As 9 categorias da loja 3D. Cada uma leva ao catálogo já filtrado (/3d?cat=...).
const CATEGORIAS = [
  "Natal",
  "Sensoriais",
  "Cozinha",
  "Utilidades",
  "Colecionáveis",
  "Brindes",
  "Fé",
  "Decoração",
  "Futebol",
];

/**
 * "Compre por categoria": ícones circulares em carrossel horizontal.
 * Ícone genérico (cubo 3D) por enquanto — cada categoria pode ganhar o seu depois.
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
              key={cat}
              href={`/3d?cat=${encodeURIComponent(cat)}#catalogo`}
              className="w-[112px] flex-none text-center"
            >
              <span className="mx-auto mb-2.5 grid h-[92px] w-[92px] place-items-center rounded-full border border-linha bg-white shadow-carta [&>svg]:h-[38px] [&>svg]:w-[38px] [&>svg]:text-laranja">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                  <path d="M12 2l9 5v10l-9 5-9-5V7z" />
                  <path d="M12 12l9-5M12 12v10M12 12L3 7" />
                </svg>
              </span>
              <b className="text-[13.5px] font-semibold">{cat}</b>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
