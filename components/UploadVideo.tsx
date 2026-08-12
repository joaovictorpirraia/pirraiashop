"use client";

import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { assinarUploadVideo, processarVideoUpload } from "@/app/admin/actions";

type Estado = "idle" | "enviando" | "processando" | "ok" | "erro";

/**
 * Sobe o vídeo cru DIRETO no Supabase (URL assinada, sem passar pelo proxy do
 * EasyPanel) e dispara o processamento (ffmpeg: 4:5 + texto). Mostra o andamento.
 */
export function UploadVideo({ produtoId, temVideo }: { produtoId: number; temVideo: boolean }) {
  const [estado, setEstado] = useState<Estado>(temVideo ? "ok" : "idle");
  const [msg, setMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("");
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) throw new Error("Supabase não configurado no client");

      // 1. pede a URL assinada (server action, protegida pelo admin)
      setEstado("enviando");
      const assinado = await assinarUploadVideo(produtoId, String(Date.now()));
      if (!assinado.ok || !assinado.path || !assinado.token) {
        throw new Error(assinado.erro || "falha ao preparar o upload");
      }

      // 2. sobe o arquivo direto pro Storage
      const supa = createClient(url, anon, { auth: { persistSession: false } });
      const { error } = await supa.storage
        .from("videos")
        .uploadToSignedUrl(assinado.path, assinado.token, file);
      if (error) throw new Error(`falha no upload: ${error.message}`);

      // 3. processa (ffmpeg) e grava video_url
      setEstado("processando");
      const proc = await processarVideoUpload(produtoId, assinado.path);
      if (!proc.ok) throw new Error(proc.erro || "falha ao processar o vídeo");

      setEstado("ok");
    } catch (err) {
      setEstado("erro");
      setMsg((err as Error).message);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const ocupado = estado === "enviando" || estado === "processando";
  const rotulo =
    estado === "enviando"
      ? "Enviando…"
      : estado === "processando"
        ? "Processando…"
        : estado === "ok"
          ? "Trocar vídeo"
          : "Subir vídeo";

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        id={`vid-${produtoId}`}
        type="file"
        accept="video/*"
        onChange={aoEscolher}
        disabled={ocupado}
        className="hidden"
      />
      <label
        htmlFor={`vid-${produtoId}`}
        className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
          ocupado
            ? "cursor-wait bg-black/10 text-tinta/60"
            : estado === "ok"
              ? "bg-black/5 text-tinta hover:bg-black/10"
              : "bg-pirraia text-white hover:opacity-90"
        }`}
      >
        {ocupado && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {rotulo}
      </label>
      {estado === "ok" && <span className="text-[11px] font-medium text-green-600">vídeo pronto</span>}
      {estado === "erro" && (
        <span className="text-[11px] text-red-600" title={msg}>
          erro: {msg.length > 40 ? `${msg.slice(0, 40)}…` : msg}
        </span>
      )}
    </div>
  );
}
