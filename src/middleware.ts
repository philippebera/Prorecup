import { NextResponse, type NextRequest } from "next/server";

// Expose le chemin courant aux layouts serveur (navigation active).
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/loueur/:path*", "/admin/:path*"] };
