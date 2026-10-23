import Link from "next/link";
import type { RequestPreview } from "@/lib/requests/views";
import { wasteLabel, accessLabel } from "@/lib/catalog";
import { PLACEMENT_LABEL, CONTACT_LABEL, CLIENT_TYPE_LABEL, dateFr } from "@/lib/format";
import { Badge } from "./ui";

export function PreviewCard({ p }: { p: RequestPreview & { unlockedByMe?: boolean } }) {
  return (
    <Link href={`/loueur/demandes/${p.id}`} className="card block hover:border-brand-300">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {p.city} <span className="font-normal text-ink-mute">({p.departmentName})</span>
          </p>
          <p className="text-xs text-ink-mute">
            {p.publicRef} · publiée le {dateFr(p.publishedAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {p.unlockedByMe ? (
            <Badge tone="blue">Débloquée</Badge>
          ) : p.available ? (
            <Badge tone="green">
              {p.placesLeft} place(s) sur {p.maxPlaces}
            </Badge>
          ) : (
            <Badge tone="gray">Indisponible</Badge>
          )}
          {p.urgent && <Badge tone="red">Urgent</Badge>}
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        <li>
          📅 Pose {dateFr(p.startDate)}
          {p.endDate ? ` → retrait ${dateFr(p.endDate)}` : ""}
          {p.flexibleDates ? " (flexible)" : ""}
        </li>
        <li>♻️ {p.wasteTypes.map(wasteLabel).join(", ")}</li>
        <li>
          📦 {p.volumeM3 ? `${p.volumeM3} m³` : "Volume à définir"} · {PLACEMENT_LABEL[p.placement]}
        </li>
        {p.accessFlags.length > 0 && <li>⚠️ {p.accessFlags.map(accessLabel).join(", ")}</li>}
        <li className="text-ink-mute">
          {CLIENT_TYPE_LABEL[p.clientType]} · contact souhaité : {CONTACT_LABEL[p.contactChannels]}
          {p.hasPhotos ? " · photos après déblocage" : ""}
        </li>
      </ul>
    </Link>
  );
}
