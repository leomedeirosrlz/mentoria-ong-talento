import { cpfValido, nomeProprio } from "@/lib/utils";
import type { AppRole, DadosCivis } from "@/lib/types";

// Núcleo isomórfico do modo demo — SEM imports de next/* nem do dataset:
// este módulo entra no bundle do browser (stub de src/lib/supabase/client.ts)
// e no middleware (edge). Cookies legíveis no client de propósito.

export const DEMO_ROLE_COOKIE = "demo_role";
/** Cookie de onboarding por papel (`demo_onboarded_mentor_dpp=1`): a
 *  apresentação de cada persona aparece só no primeiro acesso DELA — trocar
 *  de papel mostra o wizard do novo, voltar pro já visto cai direto no app. */
export const demoObCookie = (role: AppRole) => `demo_onboarded_${role}`;

/** Cookie da assinatura simulada do termo (wizard demo): JSON com o que a
 *  action real gravaria na row — o nome digitado vira assinatura_texto, os
 *  civis viram dados_snapshot e `em` sela a data/hora. Os espelhos de
 *  queries viram a pendência da persona em "assinado" enquanto ele existe:
 *  banner, /assinar, perfil e a via em PDF refletem a assinatura da sessão. */
export const DEMO_TERMO_COOKIE = "demo_termo";

export type TermoSimulado = {
  papel: AppRole;
  nome: string;
  civis: DadosCivis;
  em: string;
};

/** Grava a assinatura simulada — lado client, legível no browser de
 *  propósito como os demais cookies demo. */
export function gravarTermoSimulado(t: TermoSimulado) {
  if (typeof document === "undefined") return;
  document.cookie = `${DEMO_TERMO_COOKIE}=${encodeURIComponent(JSON.stringify(t))};path=/;max-age=${60 * 60 * 24 * 30}`;
}

/** Assinatura simulada da demo — mesmo contrato da action assinarTermo:
 *  valida civis e assinatura na mesma ordem, "grava" o snapshot no cookie
 *  demo_termo (os espelhos leem como assinado) e devolve ok depois de um
 *  delay curto — o estado "Assinando…" aparece como no fluxo real. Serve
 *  tanto ao termo do voluntário (OnboardingFlow) quanto ao termo de
 *  participação do mentorado (OnboardingJovem, papel "mentorado"). */
export async function assinarTermoDemo(
  papel: AppRole,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const s = (n: string) => String(formData.get(n) ?? "").trim();
  const endereco = {
    logradouro: nomeProprio(s("logradouro")),
    numero: s("numero"),
    complemento: s("complemento") || null,
    bairro: nomeProprio(s("bairro")),
    cidade: nomeProprio(s("cidade")),
    uf: s("uf").toUpperCase(),
    cep: s("cep").replace(/\D/g, ""),
  };
  if (
    !endereco.logradouro ||
    !endereco.numero ||
    !endereco.bairro ||
    !endereco.cidade ||
    endereco.uf.length !== 2
  ) {
    return {
      error:
        "Endereço incompleto: revise logradouro, número, bairro, cidade e UF.",
    };
  }
  if (endereco.cep.length !== 8) return { error: "CEP inválido." };
  const nomeCivil = nomeProprio(s("nome_civil"));
  if (nomeCivil.split(/\s+/).filter(Boolean).length < 2) {
    return { error: "Informe o nome civil completo (como no documento)." };
  }
  const rg = s("rg");
  const cpf = s("cpf").replace(/\D/g, "");
  if (!rg) return { error: "Informe o RG." };
  if (!cpfValido(cpf)) {
    return { error: "CPF inválido. Confira os dígitos." };
  }
  const civis: DadosCivis = {
    nome_civil: nomeCivil,
    rg,
    cpf,
    data_nascimento: s("data_nascimento") || null,
    endereco,
  };
  const texto = s("assinatura_texto");
  if (texto.split(/\s+/).filter(Boolean).length < 2 || texto.length > 120) {
    return { error: "Digite seu nome completo pra assinar." };
  }
  if (s("aceite") !== "on") {
    return { error: "É preciso ler e aceitar o termo pra assinar." };
  }
  gravarTermoSimulado({
    papel,
    nome: texto,
    civis,
    em: new Date().toISOString(),
  });
  await new Promise((r) => setTimeout(r, 700));
  return { ok: true };
}

/** Toast único das mutations bloqueadas — actions retornam `{ error: DEMO_MSG }`. */
export const DEMO_MSG =
  "Modo demonstração. Nada é gravado de verdade.";

export const DEMO_ROLES: readonly AppRole[] = [
  "coordenacao",
  "supervisor",
  "mentor_dpp",
  "mentor_especialista",
  "mentorado",
];

export function papelDemoValido(v: string | undefined | null): AppRole | null {
  return v != null && (DEMO_ROLES as readonly string[]).includes(v)
    ? (v as AppRole)
    : null;
}

/** Papel da demo lido do document.cookie — par client dos helpers server de
 *  ./mode. Serve pra desligar persistência local (rascunhos em localStorage)
 *  na demo: nada que o visitante digita pode sobreviver pro próximo. */
export function demoRoleClient(): AppRole | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${DEMO_ROLE_COOKIE}=`));
  return papelDemoValido(
    decodeURIComponent(raw?.slice(raw.indexOf("=") + 1) ?? "")
  );
}

export function demoAtivoClient(): boolean {
  return demoRoleClient() != null;
}

// par client do mesmo nome em mode.ts (módulo server — não importa aqui)
const DEMO_LIDAS_COOKIE = "demo_lidas";

/** Login real venceu: sai do modo demo apagando no browser o papel, os
 *  "já vi" das personas e o mural-lidas local. Sem isso o cookie demo_role
 *  (30 dias) seguiria desviando a navegação e todo createClient() do app
 *  continuaria preso no stub mesmo autenticado. */
export function limparCookiesDemo() {
  if (typeof document === "undefined") return;
  for (const nome of [
    DEMO_ROLE_COOKIE,
    DEMO_LIDAS_COOKIE,
    DEMO_TERMO_COOKIE,
    ...DEMO_ROLES.map(demoObCookie),
  ]) {
    document.cookie = `${nome}=;path=/;max-age=0`;
  }
}
