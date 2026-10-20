import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CORES, POPPINS, SAFE, T } from "../marca";
import { quebrarEmLinhas } from "../../lib/texto";

export function Titulo({ titulo, categoria }: { titulo: string; categoria: string | null }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - T.tituloIn;
  const s = spring({ frame: t, fps, config: { damping: 14, mass: 0.6 } });
  // some quando o CTA entra, pra liberar o topo pro "link na bio"
  const saida = interpolate(frame, [T.ctaIn, T.ctaIn + 15], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const linhas = quebrarEmLinhas(titulo, { maxChars: 22, maxLinhas: 2, limiteTotal: 46 });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", padding: SAFE.lateral, paddingTop: 300 }}>
      <div style={{ transform: `translateY(${(1 - s) * 40}px)`, opacity: s * saida }}>
        {categoria && (
          <span
            style={{
              fontFamily: POPPINS,
              fontWeight: 700,
              fontSize: 30,
              color: CORES.branco,
              background: CORES.marca,
              padding: "8px 20px",
              borderRadius: 999,
            }}
          >
            {categoria}
          </span>
        )}
        <div
          style={{
            marginTop: 20,
            fontFamily: POPPINS,
            fontWeight: 800,
            fontSize: 72,
            lineHeight: 1.05,
            color: CORES.branco,
            textShadow: "0 2px 12px rgba(0,0,0,0.55)",
          }}
        >
          {linhas.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}
