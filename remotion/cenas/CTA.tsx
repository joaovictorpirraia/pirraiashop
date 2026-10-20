import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CORES, COR_LOJA, POPPINS, ROTULO_LOJA, T } from "../marca";

export function CTA({ loja }: { loja: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - T.ctaIn;
  const s = spring({ frame: t, fps, config: { damping: 13, mass: 0.6 } });
  const corBadge = COR_LOJA[loja] ?? CORES.marca;
  const corTexto = loja === "mercadolivre" ? "#2D3277" : CORES.branco;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 360, opacity: s }}>
      <div style={{ transform: `translateY(${(1 - s) * 30}px)`, textAlign: "center" }}>
        <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 68, color: CORES.marca }}>link na bio</div>
        <div
          style={{
            marginTop: 24,
            fontFamily: POPPINS,
            fontWeight: 800,
            fontSize: 40,
            color: corTexto,
            background: corBadge,
            padding: "18px 44px",
            borderRadius: 999,
            display: "inline-block",
          }}
        >
          {ROTULO_LOJA[loja] ?? "Ver na loja"}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 140,
          fontFamily: POPPINS,
          fontWeight: 700,
          fontSize: 34,
          color: CORES.branco,
          opacity: 0.85,
        }}
      >
        pirraiashop
      </div>
    </AbsoluteFill>
  );
}
