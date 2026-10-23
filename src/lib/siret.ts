// Contrôle de forme du SIRET (14 chiffres, clé de Luhn ; exception La Poste).
// Ce contrôle n'est PAS une vérification d'existence : l'administrateur doit
// vérifier l'entreprise (annuaire INSEE / API Recherche d'entreprises) avant validation.

export function normalizeSiret(input: string): string {
  return input.replace(/\D/g, "");
}

export function isValidSiret(input: string): boolean {
  const s = normalizeSiret(input);
  if (!/^\d{14}$/.test(s)) return false;
  if (s.startsWith("356000000")) {
    // La Poste : somme des chiffres multiple de 5
    return s.split("").reduce((a, c) => a + Number(c), 0) % 5 === 0;
  }
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(s[13 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function sirenOf(siret: string): string {
  return normalizeSiret(siret).slice(0, 9);
}
