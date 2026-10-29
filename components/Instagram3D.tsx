const INSTA_URL = "https://instagram.com/pirraiashop";

/**
 * Seção Instagram: grade de quadrados (placeholder com gradiente) que levam
 * ao perfil @pirraiashop. Depois dá pra plugar as últimas fotos reais aqui.
 */
export function Instagram3D() {
  return (
    <section className="border-y border-linha bg-white py-8">
      <div className="mx-auto max-w-[1180px] px-4">
        <div className="mb-4 text-center">
          <h2 className="font-display text-[26px] font-semibold">No Instagram</h2>
          <p className="mt-1.5 text-fumo">
            Siga <b className="text-laranja">@pirraiashop</b> e veja os achados do dia
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <a
              key={i}
              href={INSTA_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir @pirraiashop no Instagram"
              className="aspect-square rounded-[10px] bg-gradient-to-br from-[#FBE7D6] to-[#EAE6FB]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
