"use client";

import dynamic from "next/dynamic";

/** OnboardingJovem só existe enquanto o jovem não concluiu o cadastro —
 *  SSR mantido (é a tela inteira nesse estado), chunk separado. */
export const OnboardingJovemLazy = dynamic(() =>
  import("./onboarding-jovem").then((m) => m.OnboardingJovem)
);
