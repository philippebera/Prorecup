import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { AppError } from "./errors";
import { APP_URL } from "./brand";
import { rateLimit } from "./rate-limit";
import { sha256 } from "./crypto";

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Protection CSRF : les requêtes non-GET doivent provenir de l'application elle-même. */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  const allowed = new Set([new URL(APP_URL).origin, req.nextUrl.origin]);
  return allowed.has(origin);
}

export function api<C = unknown>(handler: Handler<C>, opts: { skipOriginCheck?: boolean } = {}): Handler<C> {
  return async (req, ctx) => {
    try {
      if (!opts.skipOriginCheck && req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req))
        throw new AppError("BAD_ORIGIN", "Origine non autorisée", 403);
      const res = await handler(req, ctx);
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    } catch (e) {
      if (e instanceof AppError) return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json(
          { error: "VALIDATION", message: e.issues[0]?.message ?? "Données invalides", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
          { status: 422 },
        );
      console.error(e);
      return NextResponse.json({ error: "INTERNAL", message: "Erreur interne" }, { status: 500 });
    }
  };
}

export async function body<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new AppError("BAD_JSON", "Corps de requête invalide");
  }
  return schema.parse(json);
}

export function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

export async function limit(req: NextRequest, bucket: string, max: number, windowSeconds: number) {
  const key = `${bucket}:${sha256(clientIp(req)).slice(0, 24)}`;
  if (!(await rateLimit(key, max, windowSeconds))) throw new AppError("RATE_LIMITED", "Trop de requêtes, réessayez plus tard", 429);
}

export const ok = (data: unknown = { ok: true }, status = 200) => NextResponse.json(data, { status });
