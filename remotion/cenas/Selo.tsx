import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CORES, POPPINS, T } from "../marca";

export function Selo({ descontoPct }: { descontoPct: number | null }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!descontoPct || descontoPct <= 0) return null;
  const t = frame - T.seloIn;
  const entrada = spring({ frame: t, fps, config: { damping: 10, mass: 0.5 } });
  const pulso = 1 + 0.12 * Math.sin(interpolate(t, [12, 30], [0, Math.PI], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  return (
    <div
      style={{
        position: "absolute",
        top: 980,
        right: 70,
        width: 180,
        height: 180,
        borderRadius: "50%",
        background: CORES.marca,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${entrada * pulso})`,
        boxShadow: "0 8px 30px rgba(229,18,106,0.5)",
      }}
    >
      <span style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 60, color: CORES.branco, lineHeight: 1 }}>
        -{Math.round(descontoPct)}%
      </span>
      <span style={{ fontFamily: POPPINS, fontWeight: 700, fontSize: 26, color: CORES.marcaTint }}>OFF</span>
    </div>
  );
}
