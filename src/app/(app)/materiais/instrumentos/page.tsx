import { redirect } from "next/navigation";

// /materiais/instrumentos sem chave é a régua de /materiais mesmo — a
// página por instrumento vive em ./[chave] (REALIZA-331)
export default function InstrumentosIndexPage() {
  redirect("/materiais?aba=instrumentos");
}
