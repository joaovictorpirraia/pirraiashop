import { LogoPirraia3D } from "./LogoPirraia3D";

const WHATS_URL = "https://wa.me/5581992274919";
const INSTA_URL = "https://instagram.com/pirraiashop";

const MENU: Array<{ rotulo: string; href: string }> = [
  { rotulo: "Início", href: "/3d" },
  { rotulo: "Categorias", href: "/3d#categorias" },
  { rotulo: "Novidades", href: "/3d#novidades" },
  { rotulo: "Como encomendar", href: WHATS_URL },
  { rotulo: "Contato", href: WHATS_URL },
];

/**
 * Cabeçalho da loja 3D: logo + busca (leva ao catálogo) + @pirraiashop +
 * botão WhatsApp, com uma linha de menu abaixo. Sticky no topo.
 *
 * `ativo` marca o item de menu da página atual (ex.: "Início" na home).
 */
export function HeaderLoja3D({ ativo = "Início" }: { ativo?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-linha bg-white">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[auto_auto] items-center gap-x-4 gap-y-3 px-4 py-3.5 md:grid-cols-[auto_1fr_auto]">
        <LogoPirraia3D />

        {/* busca: âncora estilizada que leva ao catálogo real (filtro no Grade) */}
        <a
          href="/3d#catalogo"
          className="order-3 col-span-2 flex items-center gap-2 rounded-full border border-linha bg-areia px-4 py-2.5 text-sm text-fumo md:order-none md:col-span-1"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="9" cy="9" r="6" />
            <path d="M14 14l4 4" />
          </svg>
          Buscar peça, categoria…
        </a>

        <div className="flex items-center justify-end gap-3.5">
          <a
            href={INSTA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 text-[13.5px] font-semibold text-tinta sm:inline-flex"
          >
            <span className="grid h-[34px] w-[34px] place-items-center rounded-full border border-linha bg-areia">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
              </svg>
            </span>
            @pirraiashop
          </a>
          <a
            href={WHATS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-[13.5px] font-semibold text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm0 2a8 8 0 11-4.1 14.9l-.3-.2-2.8.8.8-2.7-.2-.3A8 8 0 0112 4z" />
            </svg>
            <span className="hidden sm:inline">Fale no WhatsApp</span>
            <span className="sm:hidden">WhatsApp</span>
          </a>
        </div>
      </div>

      <nav className="border-t border-linha">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 text-[13.5px] font-semibold uppercase tracking-wide">
          {MENU.map((item) => {
            const externo = item.href.startsWith("http");
            return (
              <a
                key={item.rotulo}
                href={item.href}
                {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={item.rotulo === ativo ? "text-laranja" : "text-tinta"}
              >
                {item.rotulo}
              </a>
            );
          })}
          <a href="/" className="ml-auto text-fumo">
            ← Achadinhos
          </a>
        </div>
      </nav>
    </header>
  );
}
