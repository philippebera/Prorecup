import Link from "next/link";
import type { RequestPreview } from "@/lib/requests/views";
import { wasteLabel, accessLabel } from "@/lib/catalog";
import { PLACEMENT_LABEL, CONTACT_LABEL, CLIENT_TYPE_LABEL, dateFr } from "@/lib/format";
import { Badge } from "./ui";

/** Aperçu d'une demande côté loueur : aucune donnée privée (voir lib/requests/views.ts). */
export function PreviewCard({ p }: { p: RequestPreview & { unlockedByMe?: boolean } }) {
  const status = p.unlockedByMe ? <Badge tone="lime">Débloquée</Badge> : p.available ? <Badge tone="lime">{p.placesLeft}/{p.maxPlaces} places</Badge> : <Badge tone="dark">Indisponible</Badge>;
  return (
    <Link href={`/loueur/demandes/${p.id}`} className="group block rounded-4xl bg-white p-2 shadow-soft ring-1 ring-black/[0.04] transition hover:-translate-y-0.5">
      <div className="rounded-3xl bg-ink p-4 text-white">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{p.publicRef}</p>
            <p className="mt-0.5 text-xl font-extrabold leading-tight">{p.city}</p>
            <p className="text-sm text-white/60">{p.departmentName}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {status}
            {p.urgent && <Badge tone="red">Urgent</Badge>}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
          <span className="h-2 w-2 rounded-full bg-white/40" />
          <span>Pose {dateFr(p.startDate)}</span>
          <span className="h-px flex-1 border-t border-dashed border-white/25" />
          <span>{p.endDate ? `Retrait ${dateFr(p.endDate)}` : p.flexibleDates ? "Dates flexibles" : "Retrait à définir"}</span>
          <span className="h-2.5 w-2.5 rounded-full bg-lime" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-2 pt-3 text-sm">
        <div className="rounded-2xl bg-canvas px-3 py-2.5">
          <p className="text-2xl font-extrabold leading-none">{p.volumeM3 ? `${p.volumeM3}` : "?"}<span className="ml-0.5 text-sm font-semibold">m³</span></p>
          <p className="mt-1 text-xs text-ink-mute">{PLACEMENT_LABEL[p.placement]}</p>
        </div>
        <div className="rounded-2xl bg-canvas px-3 py-2.5">
          <p className="line-clamp-2 font-bold leading-snug">{p.wasteTypes.map(wasteLabel).join(", ")}</p>
        </div>
      </div>
      <div className="px-3 pb-3 text-xs text-ink-mute">
        {p.accessFlags.length > 0 && <p className="mb-1 text-ink-soft">⚠ {p.accessFlags.map(accessLabel).join(" · ")}</p>}
        <p>
          {CLIENT_TYPE_LABEL[p.clientType]} · contact : {CONTACT_LABEL[p.contactChannels]} · publiée le {dateFr(p.publishedAt)}
          {p.hasPhotos ? " · photos après déblocage" : ""}
        </p>
      </div>
    </Link>
  );
}
