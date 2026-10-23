import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.DATABASE_URL_TEST || "postgresql://benne:benne@localhost:5432/bennedirect_test";
  // Base de test dédiée : schéma recréé à chaque exécution.
  execSync(`psql "${url}" -q -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"`, { stdio: "inherit" });
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
