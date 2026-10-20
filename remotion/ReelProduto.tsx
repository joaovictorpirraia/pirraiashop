import { AbsoluteFill } from "remotion";
import { ReelProps } from "./props";
import { FundoBorrado } from "./cenas/FundoBorrado";
import { FotoKenBurns } from "./cenas/FotoKenBurns";
import { Intro } from "./cenas/Intro";
import { Titulo } from "./cenas/Titulo";
import { Preco } from "./cenas/Preco";
import { CTA } from "./cenas/CTA";

export function ReelProduto(props: ReelProps) {
  return (
    <AbsoluteFill>
      <FundoBorrado imagem={props.imagem} />
      <FotoKenBurns imagem={props.imagem} />
      <Titulo titulo={props.titulo} categoria={props.categoria} />
      <Preco preco={props.preco} precoAntigo={props.precoAntigo} descontoPct={props.descontoPct} />
      <CTA loja={props.loja} />
      <Intro />
    </AbsoluteFill>
  );
}
