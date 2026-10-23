import type { Offer } from "@prisma/client";
import { euros, vatLabel } from "@/lib/money";
import { dateFr } from "@/lib/format";
import { Badge } from "./ui";

export function OfferCard({ offer, companyName }: { offer: Offer; companyName: string }) {
  const expired = offer.validUntil < new Date();
  const rows: [string, string][] = [
    ["Volume de benne", `${offer.volumeM3} m³`],
    ["Déchets autorisés", offer.wasteAllowed],
    ["Déchets exclus", offer.wasteExcluded],
    ["Inclus", [offer.includesDelivery && "pose", offer.includesTransport && "transport", offer.includesPickup && "retrait"].filter(Boolean).join(", ") || "—"],
    ["Durée incluse", `${offer.includedDays} jour(s)`],
    ["Poids", offer.weightMode === "INCLUDED" ? `${offer.includedTonnes?.toString()} t incluses` : "Facturé au réel après pesée"],
    ["Tonne supplémentaire", offer.pricePerTonneCents != null ? `${euros(offer.pricePerTonneCents)} HT` : "—"],
    ["Jour supplémentaire", offer.pricePerExtraDayCents != null ? `${euros(offer.pricePerExtraDayCents)} HT` : "—"],
    ["Autres suppléments", offer.otherFees || "—"],
    ["Disponibilité proposée", offer.proposedAvailability],
  ];
  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{companyName}</p>
          <p className="text-xs text-ink-mute">Offre du {dateFr(offer.createdAt)} · valable jusqu&apos;au {dateFr(offer.validUntil)}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{euros(offer.amountTtcCents)} <span className="text-sm font-normal">TTC</span></p>
          <p className="text-xs text-ink-mute">{euros(offer.amountHtCents)} HT · TVA {vatLabel(offer.vatRateBp)} ({euros(offer.vatCents)})</p>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        {offer.status === "CHOSEN" && <Badge tone="blue">Choisie</Badge>}
        {expired && <Badge tone="amber">Validité dépassée</Badge>}
      </div>
      <dl className="mt-3 divide-y divide-black/5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-5 gap-2 py-1.5"><dt className="col-span-2 text-ink-mute">{k}</dt><dd className="col-span-3">{v}</dd></div>
        ))}
      </dl>
      {offer.message && <p className="mt-3 whitespace-pre-line rounded-2xl bg-canvas p-3 text-sm">{offer.message}</p>}
      <p className="mt-3 text-xs text-ink-mute">Le prix et le paiement se règlent directement avec l&apos;entreprise. La plateforme ne prélève aucune commission.</p>
    </div>
  );
}
