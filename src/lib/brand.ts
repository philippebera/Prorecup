// Nom de la plateforme : modifiable via NEXT_PUBLIC_BRAND_NAME sans toucher au code.
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "Benne Direct";
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
