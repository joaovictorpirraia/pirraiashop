import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { T } from "../marca";

export function FotoKenBurns({ imagem }: { imagem: string }) {
  const frame = useCurrentFrame();
  const escala = interpolate(frame, [T.fotoIn, T.fim], [1.0, 1.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const entrada = interpolate(frame, [T.fotoIn, T.fotoIn + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: entrada }}>
      <Img
        src={imagem}
        style={{
          width: "82%",
          maxHeight: "60%",
          objectFit: "contain",
          borderRadius: 28,
          transform: `scale(${escala})`,
        }}
      />
    </AbsoluteFill>
  );
}
