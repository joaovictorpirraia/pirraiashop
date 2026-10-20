import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CORES, POPPINS, T } from "../marca";

export function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const saida = interpolate(frame, [T.introOut - 10, T.introOut], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{ backgroundColor: CORES.marca, justifyContent: "center", alignItems: "center", opacity: saida }}
    >
      <div style={{ transform: `scale(${s})`, textAlign: "center" }}>
        <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 92, color: CORES.branco }}>pirraiashop</div>
        <div style={{ fontFamily: POPPINS, fontWeight: 600, fontSize: 40, color: CORES.marcaTint, marginTop: 8 }}>
          achadinho do dia
        </div>
      </div>
    </AbsoluteFill>
  );
}
