import { Composition } from "remotion";
import { ReelProduto } from "./ReelProduto";
import { reelProps } from "./props";

const EXEMPLO = {
  titulo: "Carregador turbo 20W bivolt USB-C",
  preco: 39.9,
  precoAntigo: 79.9,
  descontoPct: 50,
  imagem:
    "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80",
  loja: "shopee" as const,
  categoria: "eletronicos",
};

export function Root() {
  return (
    <Composition
      id="ReelProduto"
      component={ReelProduto}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      schema={reelProps}
      defaultProps={EXEMPLO}
    />
  );
}
