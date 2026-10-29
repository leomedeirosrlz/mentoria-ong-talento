"use client";

import Link from "next/link";

const LINK_FICHA =
  "inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-foreground/80 transition-colors hover:bg-muted hover:text-foreground sm:min-h-8";

export function AuxCardAcoes({ href }: { href: string }) {
  return (
    <Link href={href} className={LINK_FICHA}>
      Ver ficha ›
    </Link>
  );
}
