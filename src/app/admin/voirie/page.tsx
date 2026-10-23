import { PageTitle, Alert } from "@/components/ui";
import { prisma } from "@/lib/db";
import { dateFr } from "@/lib/format";
import { KNOWN_FORM_TEMPLATES } from "@/lib/permits";
import { JsonForm } from "../forms";

const FIELDS = [
  { name: "name", label: "Nom de l'autorité" },
  { name: "kind", label: "Type", type: "select" as const, options: ["MAIRIE", "METROPOLE", "DEPARTEMENT", "AUTRE"] },
  { name: "departmentCode", label: "Département (code)" },
  { name: "postalCodes", label: "Codes postaux couverts", type: "list" as const, hint: "Vide = référence départementale générale" },
  { name: "portalUrl", label: "Portail officiel (URL)" },
  { name: "formUrl", label: "Formulaire officiel (URL)" },
  { name: "email", label: "Email de contact" },
  { name: "phone", label: "Téléphone" },
  { name: "feesInfo", label: "Frais (redevance)" },
  { name: "delayInfo", label: "Délais d'instruction" },
  { name: "instructions", label: "Instructions pour le demandeur", type: "textarea" as const },
  { name: "submissionEmail", label: "Adresse de dépôt acceptée (envoi depuis l'app)" },
  { name: "submissionEmailVerified", label: "Canal de dépôt vérifié auprès de l'autorité", type: "checkbox" as const },
  { name: "knownFormTemplate", label: `Modèle de formulaire connu (${Object.keys(KNOWN_FORM_TEMPLATES).join(", ") || "aucun défini"})` },
  { name: "markVerifiedNow", label: "J'ai vérifié ces informations aujourd'hui", type: "checkbox" as const },
  { name: "active", label: "Active", type: "checkbox" as const },
];

export default async function AdminVoirie() {
  const authorities = await prisma.permitAuthority.findMany({ orderBy: [{ departmentCode: "asc" }, { name: "asc" }] });
  const blank = { name: "", kind: "MAIRIE", departmentCode: "", postalCodes: [], portalUrl: "", formUrl: "", email: "", phone: "", feesInfo: "", delayInfo: "", instructions: "", submissionEmail: "", submissionEmailVerified: false, knownFormTemplate: "", markVerifiedNow: false, active: true, inseeCodes: [] };
  return (
    <>
      <PageTitle title="Annuaire des démarches de voirie" subtitle="Références saisies et vérifiées manuellement. Il n'existe pas d'API nationale des mairies." />
      <div className="mb-6"><Alert tone="warn">N&apos;activez « canal de dépôt vérifié » qu&apos;après confirmation par l&apos;autorité qu&apos;elle accepte les demandes à cette adresse. N&apos;ajoutez un modèle de formulaire qu&apos;après l&apos;avoir implémenté dans le code (KNOWN_FORM_TEMPLATES) à partir du formulaire officiel.</Alert></div>
      <section className="card mb-6">
        <h2 className="mb-3 font-bold">Ajouter une référence</h2>
        <JsonForm url="/api/admin/authorities" initial={blank} fields={FIELDS} submitLabel="Ajouter" />
      </section>
      <div className="space-y-3">
        {authorities.map((a) => (
          <details key={a.id} className="card">
            <summary className="cursor-pointer font-semibold">{a.name} <span className="font-normal text-ink-mute">· {a.departmentCode} · {a.postalCodes.length ? a.postalCodes.join(", ") : "départemental"} · {a.lastVerifiedAt ? `vérifié le ${dateFr(a.lastVerifiedAt)}` : "non vérifié"}{a.submissionEmailVerified ? " · dépôt depuis l'app" : ""}</span></summary>
            <div className="mt-3"><JsonForm url="/api/admin/authorities" initial={{ ...a, id: a.id, markVerifiedNow: false }} fields={FIELDS} /></div>
          </details>
        ))}
      </div>
    </>
  );
}
