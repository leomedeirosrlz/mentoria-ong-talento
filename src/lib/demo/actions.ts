"use server";

import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/types";
import { papelDemoValido } from "./shared";
import {
  definirPapelDemo,
  demoRole,
  desmarcarOnboardingDemo,
  limparDemo,
  resetarOnboardingDemo,
} from "./mode";

/** Entrada da /demo: escolhe o papel e cai no onboarding. O "já vi" de TODAS
 *  as personas zera na entrada — cada papel mostra o wizard de novo, uma vez
 *  por sessão de demo. */
export async function entrarNaDemo(papel: AppRole) {
  if (!papelDemoValido(papel)) redirect("/demo");
  await definirPapelDemo(papel);
  await resetarOnboardingDemo();
  redirect("/");
}

/** Troca de papel no meio da demo — vai pra home porque a página atual pode
 *  não existir no escopo do novo papel (ex.: /pessoas é só da coordenação).
 *  Não toca nos cookies de onboarding: o gate decide — persona nunca vista
 *  passa pelo wizard, já vista cai direto no app. */
export async function trocarPapelDemo(papel: AppRole) {
  if (!papelDemoValido(papel)) return { error: "Papel inválido." };
  await definirPapelDemo(papel);
  redirect("/");
}

/** O wizard depende de me.onboarded_em — desmarcar o cookie DA PERSONA ATIVA
 *  devolve o gate só pra ela (o "já vi" das outras segue valendo). */
export async function reverOnboardingDemo() {
  const papel = await demoRole();
  if (papel) await desmarcarOnboardingDemo(papel);
  redirect("/");
}

export async function sairDaDemo() {
  await limparDemo();
  redirect("/login");
}
