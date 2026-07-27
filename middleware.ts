import { NextResponse, type NextRequest } from "next/server";

// Basic Auth simples só na área de admin. Não inventar auth — senha em env.
export const config = { matcher: ["/admin", "/admin/:path*"] };

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  const negar = () =>
    new NextResponse("Autenticação necessária.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="pirraia admin", charset="UTF-8"',
      },
    });

  // Sem credenciais no env = admin trancado (nunca libera com vazio).
  if (!user || !pass) return negar();

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return negar();

  let decoded: string;
  try {
    decoded = atob(auth.slice(6));
  } catch {
    return negar();
  }

  const sep = decoded.indexOf(":");
  const u = sep >= 0 ? decoded.slice(0, sep) : decoded;
  const p = sep >= 0 ? decoded.slice(sep + 1) : "";

  if (u !== user || p !== pass) return negar();

  return NextResponse.next();
}
