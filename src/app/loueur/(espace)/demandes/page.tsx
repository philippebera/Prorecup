import { PageTitle, Empty } from "@/components/ui";
import { requirePageProvider } from "@/lib/auth/server";
import { listPreviewsForCompany } from "@/lib/requests/views";
import { PreviewCard } from "@/components/preview-card";

type Props = { searchParams: Promise<{ filtre?: string }> };

export default async function DemandesPage({ searchParams }: Props) {
  const { company } = await requirePageProvider();
  const { filtre } = await searchParams;
  const all = await listPreviewsForCompany(company.id);
  const list = filtre === "toutes" ? all : all.filter((p) => p.available || p.unlockedByMe);
  return (
    <>
      <PageTitle
        title="Demandes reçues"
        subtitle="Aperçu gratuit. Les coordonnées et l'adresse exacte sont visibles après déblocage (1 crédit)."
        actions={
          <a className="btn-secondary btn-sm" href={filtre === "toutes" ? "/loueur/demandes" : "/loueur/demandes?filtre=toutes"}>
            {filtre === "toutes" ? "Ouvertes uniquement" : "Afficher toutes"}
          </a>
        }
      />
      {list.length === 0 ? (
        <Empty>Aucune demande pour le moment. Vérifiez vos zones et types de déchets dans « Entreprise ».</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((p) => (
            <PreviewCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </>
  );
}
