import Image from "next/image";

/**
 * Logo da loja 3D (imagem em public/pirraia-3d-logo.webp).
 * A logo tem fundo escuro: no header (fundo claro) ela vai dentro de um tile
 * grafite arredondado; no rodapé (`claro`, fundo já escuro) entra direto.
 */
export function LogoPirraia3D({
  href = "/3d",
  className = "",
  claro = false,
}: {
  href?: string;
  className?: string;
  // versão para fundo escuro (rodapé): sem o tile
  claro?: boolean;
}) {
  const img = (
    <Image
      src="/pirraia-3d-logo.webp"
      alt="Pirraia 3D"
      width={240}
      height={240}
      priority
      className={claro ? "h-14 w-auto" : "h-12 w-auto"}
    />
  );

  return (
    <a href={href} aria-label="Pirraia 3D" className={`inline-flex items-center ${className}`}>
      {claro ? img : <span className="inline-flex rounded-xl bg-grafite p-1">{img}</span>}
    </a>
  );
}
