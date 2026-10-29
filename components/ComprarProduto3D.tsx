"use client";
import { useState } from "react";

export function ComprarProduto3D({
  slug,
  cores,
}: {
  slug: string;
  cores: Array<{ chave: string; label: string; hex: string }>;
}) {
  const [cor, setCor] = useState<string | null>(null);
  const href = cor ? `/r/${slug}?cor=${encodeURIComponent(cor)}` : `/r/${slug}`;

  return (
    <div className="flex flex-col gap-3">
      {cores.length > 0 ? (
        <div>
          <p className="mb-1.5 text-sm font-semibold text-tinta">
            Cor{cor ? `: ${cores.find((c) => c.chave === cor)?.label}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {cores.map((c) => (
              <button
                key={c.chave}
                type="button"
                onClick={() => setCor(c.chave)}
                aria-label={c.label}
                title={c.label}
                className={`h-8 w-8 rounded-full border ${
                  cor === c.chave ? "ring-2 ring-pirraia ring-offset-2" : "border-black/15"
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-fumo">Escolha a cor na hora da encomenda.</p>
      )}

      <a
        href={href}
        className="flex items-center justify-center rounded-xl bg-[#25D366] px-6 py-3 text-base font-bold text-white transition hover:brightness-95"
      >
        Encomendar no WhatsApp
      </a>
      <p className="text-xs text-fumo">Feito sob encomenda — prazo e frete combinados no WhatsApp.</p>
    </div>
  );
}
