/** Barra de aviso grafite no topo: tripé de promessas da loja 3D. */
export function BarraAviso3D() {
  return (
    <div className="bg-grafite text-[12.5px] text-[#F3E9DF]">
      <div className="mx-auto flex max-w-[1180px] flex-wrap justify-center gap-x-6 gap-y-1 px-4 py-2.5 text-center">
        <span>
          Impresso <b className="text-laranja">por mim</b>, sob encomenda
        </span>
        <span>
          Escolha a <b className="text-laranja">sua cor</b>
        </span>
        <span>
          Entrega combinada no <b className="text-laranja">WhatsApp</b>
        </span>
      </div>
    </div>
  );
}
