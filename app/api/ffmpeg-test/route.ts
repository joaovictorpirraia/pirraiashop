import { NextResponse, type NextRequest } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = promisify(execFile);

/**
 * TESTE TEMPORÁRIO: confirma se o ffmpeg está instalado e roda no container do
 * EasyPanel. Se responder com a versão, o ambiente aguenta o pipeline de vídeo.
 * Remover depois do teste. Gate simples por ?key= (não roda nada sensível — só
 * `ffmpeg -version`).
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== "pirraia-ffmpeg-test") {
    return NextResponse.json({ ok: false, erro: "informe ?key=pirraia-ffmpeg-test" }, { status: 401 });
  }
  try {
    const { stdout } = await run("ffmpeg", ["-version"], { timeout: 10_000 });
    const linhas = stdout.split("\n");
    return NextResponse.json({
      ok: true,
      versao: linhas[0] ?? "",
      config: linhas.find((l) => l.startsWith("configuration:"))?.slice(0, 200) ?? "",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: (e as Error).message });
  }
}
