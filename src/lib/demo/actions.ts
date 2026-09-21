"use server";

import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/types";
import { papelDemoValido } from "./shared";
import {
  definirPapelDemo,
  desmarcarOnboardingDemo,
  limparDemo,
} from "./mode";

/** Entrada da /demo: escolhe o papel e cai no onboarding (1º acesso sempre). */
export async function entrarNaDemo(papel: AppRole) {
  if (!papelDemoValido(papel)) redirect("/demo");
  await definirPapelDemo(papel);
  await desmarcarOnboardingDemo();
  redirect("/");
}

/** Troca de papel no meio da demo — vai pra home porque a página atual pode
 *  não existir no escopo do novo papel (ex.: /pessoas é só da coordenação). */
export async function trocarPapelDemo(papel: AppRole) {
  if (!papelDemoValido(papel)) return { error: "Papel inválido." };
  await definirPapelDemo(papel);
  redirect("/");
}

/** O wizard depende de me.onboarded_em — zerar o cookie devolve o gate. */
export async function reverOnboardingDemo() {
  await desmarcarOnboardingDemo();
  redirect("/");
}

export async function sairDaDemo() {
  await limparDemo();
  redirect("/demo");
}
