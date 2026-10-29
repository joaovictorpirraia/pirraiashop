import type { ReactNode } from "react";

/** Faixa de benefícios (4 colunas no desktop, 2 no mobile). */
export function Beneficios3D() {
  return (
    <div className="mt-5 border-y border-linha bg-white">
      <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-4 px-4 py-5 md:grid-cols-4">
        <Item
          titulo="Impresso por mim"
          sub="Feito à mão, no capricho"
          icone={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 2l9 5v10l-9 5-9-5V7z" />
              <path d="M12 12l9-5M12 12v10M12 12L3 7" />
            </svg>
          }
        />
        <Item
          titulo="Escolha a cor"
          sub="Várias cores por peça"
          icone={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <circle cx="8.5" cy="10" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="10" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="10" cy="15" r="1.3" fill="currentColor" stroke="none" />
            </svg>
          }
        />
        <Item
          titulo="Sob encomenda"
          sub="Prazo combinado"
          icone={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M8 2v4M16 2v4M3 9h18" />
            </svg>
          }
        />
        <Item
          titulo="Fale com a gente"
          sub="WhatsApp (81) 99227-4919"
          icone={
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2z" />
            </svg>
          }
        />
      </div>
    </div>
  );
}

function Item({ titulo, sub, icone }: { titulo: string; sub: string; icone: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-xl bg-laranja-tint text-laranja [&>svg]:h-[22px] [&>svg]:w-[22px]">
        {icone}
      </span>
      <div>
        <b className="block text-[14.5px]">{titulo}</b>
        <small className="text-[12.5px] text-fumo">{sub}</small>
      </div>
    </div>
  );
}
