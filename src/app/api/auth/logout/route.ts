import { cookies } from "next/headers";
import { api, ok } from "@/lib/http";
import { destroySession, SESSION_COOKIE, CLIENT_COOKIE } from "@/lib/auth/core";

export const POST = api(async () => {
  const jar = await cookies();
  await destroySession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  jar.delete(CLIENT_COOKIE);
  return ok();
});
