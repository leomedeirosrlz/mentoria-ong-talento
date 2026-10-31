"use client";

import dynamic from "next/dynamic";

/** OnboardingFlow (~1,1k linhas) só existe pra quem não concluiu o
 *  onboarding — SSR mantido (o wizard é a tela inteira desse caso), o
 *  chunk desce separado e quem já concluiu não baixa. */
export const OnboardingFlowLazy = dynamic(() =>
  import("@/components/onboarding-flow").then((m) => m.OnboardingFlow)
);
