/**
 * Logo da loja 3D: "Pirraia" + badge "3D" laranja, em fonte arredondada (Fredoka).
 *
 * Para trocar por um PNG depois, substitua o conteúdo do <a> por:
 *   <Image src="/logo-pirraia-3d.png" alt="Pirraia 3D" width={120} height={34} priority />
 * (e importe `next/image`).
 */
export function LogoPirraia3D({
  href = "/3d",
  className = "",
  claro = false,
}: {
  href?: string;
  className?: string;
  // versão para fundo escuro (rodapé): "Pirraia" em branco
  claro?: boolean;
}) {
  return (
    <a
      href={href}
      aria-label="Pirraia 3D"
      className={`inline-flex items-baseline gap-0.5 font-display text-2xl font-semibold leading-none tracking-wide ${className}`}
    >
      <span className={claro ? "text-white" : "text-tinta"}>Pirraia</span>
      <span className="rounded-lg bg-laranja px-2 py-0.5 text-white">3D</span>
    </a>
  );
}
