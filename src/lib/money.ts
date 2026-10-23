// Montants en centimes, TVA en points de base (2000 = 20 %).

export function vatFromHt(htCents: number, vatRateBp: number) {
  const vat = Math.round((htCents * vatRateBp) / 10000);
  return { ht: htCents, vat, ttc: htCents + vat };
}

export function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function vatLabel(vatRateBp: number): string {
  return `${(vatRateBp / 100).toLocaleString("fr-FR")} %`;
}

export function eurosToCents(value: string | number): number {
  const n = typeof value === "number" ? value : Number(String(value).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Montant invalide");
  return Math.round(n * 100);
}
