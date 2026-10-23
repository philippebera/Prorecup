import type { ReactNode } from "react";

/** Cadre de téléphone décoratif (illustration d'interface, sans données réelles). */
export function PhoneMock({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={`relative mx-auto w-[260px] rounded-[2.75rem] bg-[#0b0d0c] p-2.5 shadow-float ring-1 ring-white/10 ${className}`}>
      <div className="absolute left-1/2 top-4 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
      <div className="overflow-hidden rounded-[2.2rem] bg-canvas px-4 pb-5 pt-12 text-ink">{children}</div>
    </div>
  );
}
