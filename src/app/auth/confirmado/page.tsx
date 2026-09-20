import type { Metadata } from "next";
import { Confirmado } from "./confirmado";

export const metadata: Metadata = {
  title: "E-mail confirmado · Realiza.vc",
};

export default async function ConfirmadoPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: raw } = await searchParams;
  // só caminhos internos — "//host" e "https://..." seriam open redirect
  const next = raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return <Confirmado next={next} />;
}
