"use server";

import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/types";
import { papelDemoValido } from "./shared";
import {
  definirPapelDemo,
  demoRole,
  desmarcarOnboardingDemo,
  limparDemo,
  limparDemoLidas,
  resetarOnboardingDemo,
} from "./mode";

/** Entrada da /demo: escolhe o papel e cai no onboarding. O "já vi" de TODAS
 *  as personas zera na entrada — cada papel mostra o wizard de novo, uma vez
 *  por sessão de demo. */
export async function entrarNaDemo(papel: AppRole) {
  if (!papelDemoValido(papel)) redirect("/demo");
  await definirPapelDemo(papel);
  await resetarOnboardingDemo();
  await limparDemoLidas();
  redirect("/");
}

/** Troca de papel no meio da demo — vai pra home porque a página atual pode
 *  não existir no escopo do novo papel (ex.: /formularios é só da
 *  coordenação; /registros não abre pra mentor).
 *  Não toca nos cookies de onboarding: o gate decide — persona nunca vista
 *  passa pelo wizard, já vista cai direto no app. */
export async function trocarPapelDemo(papel: AppRole) {
  if (!papelDemoValido(papel)) return { error: "Papel inválido." };
  await definirPapelDemo(papel);
  redirect("/");
}

/** Voltar do passo 0 do onboarding na demo: sai da demo e cai na seleção de
 *  papel — equivale a "sair e entrar de novo". limparDemo zera papel + os
 *  "já vi" de todas as personas; sem cookie a /demo deixa de redirecionar
 *  pra home e mostra os cards de novo. */
export async function recomecarDemo() {
  await limparDemo();
  redirect("/demo");
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
