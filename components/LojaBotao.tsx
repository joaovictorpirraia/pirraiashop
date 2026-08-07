/**
 * Botão "Ver na loja", com cor e texto por marca (derivado de item.loja):
 *  - Shopee → laranja Shopee
 *  - Mercado Livre → amarelo ML, texto escuro
 *  - AliExpress → vermelho AliExpress
 *  - resto (tiktok/manual sem link reconhecido) → cai no padrão Shopee
 */
function infoLoja(loja: string): { texto: string; classe: string } {
  if (loja === "mercadolivre") {
    return {
      texto: "Ver no Mercado Livre",
      classe: "bg-[#FFE600] text-[#2D3277] hover:brightness-95",
    };
  }
  if (loja === "aliexpress") {
    return { texto: "Ver na AliExpress", classe: "bg-[#E62E04] text-white hover:brightness-95" };
  }
  if (loja === "tiktok") {
    return { texto: "Ver no TikTok Shop", classe: "bg-tinta text-white hover:bg-black" };
  }
  return { texto: "Ver na Shopee", classe: "bg-[#EE4D2D] text-white hover:brightness-95" };
}

export function LojaBotao({
  loja,
  grande = false,
  className = "",
}: {
  loja: string;
  grande?: boolean;
  className?: string;
}) {
  const { texto, classe } = infoLoja(loja);
  const tam = grande ? "py-3 text-base" : "py-2 text-sm";
  const ic = grande ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span
      className={`flex items-center justify-center gap-1.5 rounded-full font-bold transition ${classe} ${tam} ${className}`}
    >
      <BagIcon className={ic} />
      {texto}
      <ArrowIcon className={ic} />
    </span>
  );
}

function BagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2 3 6v14a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}
