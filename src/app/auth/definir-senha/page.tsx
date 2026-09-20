import { Suspense } from "react";
import type { Metadata } from "next";
import { DefinirSenhaForm } from "./definir-senha-form";

export const metadata: Metadata = {
  title: "Criar senha",
};

export default function DefinirSenhaPage() {
  return (
    <Suspense>
      <DefinirSenhaForm />
    </Suspense>
  );
}
