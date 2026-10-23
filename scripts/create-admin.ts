// Crée (ou promeut) un administrateur : npm run admin:create -- email@exemple.fr "Nom"
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/crypto";

const prisma = new PrismaClient();
async function main() {
  const [email, name = "Administrateur"] = process.argv.slice(2);
  if (!email) throw new Error("Usage : npm run admin:create -- email \"Nom\"");
  const password = process.env.ADMIN_PASSWORD || randomBytes(12).toString("base64url");
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), name, role: "ADMIN", passwordHash, emailVerifiedAt: new Date() },
    update: { role: "ADMIN", passwordHash },
  });
  console.log(`Administrateur ${email} prêt. Mot de passe : ${process.env.ADMIN_PASSWORD ? "(celui fourni)" : password}`);
}
main().finally(() => prisma.$disconnect());
