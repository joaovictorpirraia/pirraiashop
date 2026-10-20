import { AbsoluteFill, Img } from "remotion";
import { CORES } from "../marca";

export function FundoBorrado({ imagem }: { imagem: string }) {
  return (
    <AbsoluteFill style={{ backgroundColor: CORES.tinta }}>
      <Img
        src={imagem}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(40px) brightness(0.45)",
          transform: "scale(1.2)",
        }}
      />
    </AbsoluteFill>
  );
}
