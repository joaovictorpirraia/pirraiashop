import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CORES, POPPINS, SAFE, T } from "../marca";
import { Selo } from "./Selo";

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Preco({
  preco,
  precoAntigo,
  descontoPct,
}: {
  preco: number;
  precoAntigo: number | null;
  descontoPct: number | null;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - T.precoIn;
  const antigo = spring({ frame: t, fps, config: { damping: 18 } });
  const novo = spring({ frame: t - 12, fps, config: { damping: 9, mass: 0.7 } });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: SAFE.lateral, paddingBottom: SAFE.base }}>
      {precoAntigo && precoAntigo > preco && (
        <div
          style={{
            fontFamily: POPPINS,
            fontWeight: 700,
            fontSize: 40,
            color: CORES.fumo,
            textDecoration: "line-through",
            opacity: antigo,
          }}
        >
          {brl(precoAntigo)}
        </div>
      )}
      <div
        style={{
          fontFamily: POPPINS,
          fontWeight: 800,
          fontSize: 132,
          color: CORES.branco,
          lineHeight: 1,
          textShadow: "0 3px 16px rgba(0,0,0,0.55)",
          transform: `scale(${novo})`,
          transformOrigin: "left bottom",
        }}
      >
        {brl(preco)}
      </div>
      <Selo descontoPct={descontoPct} />
    </AbsoluteFill>
  );
}
