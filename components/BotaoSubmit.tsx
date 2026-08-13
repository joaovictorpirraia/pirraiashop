"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de submit que mostra estado de "processando" enquanto a server action roda.
 * Usa useFormStatus — PRECISA estar dentro do <form> da action. Enquanto pendente:
 * desabilita, baixa a opacidade e (opcional) troca o texto por pendingLabel.
 */
export function BotaoSubmit({
  children,
  className = "",
  pendingLabel,
  title,
  spinner = true,
  disabled = false,
  formAction,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  title?: string;
  spinner?: boolean;
  disabled?: boolean;
  /** action específica deste botão (pra ter 2+ botões no mesmo form) */
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending || disabled}
      title={title}
      aria-busy={pending}
      className={`${className} ${pending ? "cursor-wait opacity-60" : ""} inline-flex items-center justify-center gap-1.5`}
    >
      {pending && spinner && (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {pending ? (pendingLabel ?? "Processando…") : children}
    </button>
  );
}
