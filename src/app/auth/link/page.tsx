import { Suspense } from "react";
import type { Metadata } from "next";
import { LinkLanding } from "./link-landing";

export const metadata: Metadata = {
  title: "Entrando",
};

export default function LinkPage() {
  return (
    <Suspense>
      <LinkLanding />
    </Suspense>
  );
}
