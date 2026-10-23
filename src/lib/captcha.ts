import { captchaConfigured } from "./integrations";
import { AppError } from "./errors";

/** Vérifie un jeton Cloudflare Turnstile si l'intégration est configurée. */
export async function verifyCaptcha(token: string | undefined, ip: string) {
  if (!captchaConfigured()) return;
  if (!token) throw new AppError("CAPTCHA_REQUIRED", "Vérification anti-robot requise");
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token, remoteip: ip }),
  });
  const json = (await res.json()) as { success: boolean };
  if (!json.success) throw new AppError("CAPTCHA_FAILED", "Vérification anti-robot échouée");
}
