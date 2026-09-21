import type { Metadata } from "next";
import { Confirmado } from "./confirmado";
import { pathInterno } from "@/lib/utils";

export const metadata: Metadata = {
  title: "E-mail confirmado",
};

export default async function ConfirmadoPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: raw } = await searchParams;
  // só caminhos internos — "//host" e "/\host" seriam open redirect
  const next = pathInterno(raw) ?? "/";
  return <Confirmado next={next} />;
}
