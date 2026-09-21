import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  Binoculars,
  Handshake,
  MapTrifold,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
// import type não emite runtime — o barrel principal usa createContext e
// quebraria a página (server component) se viesse como import de valor
import type { Icon } from "@phosphor-icons/react";
import { papelLabel } from "@/lib/ciclo";
import { entrarNaDemo } from "@/lib/demo/actions";
import { getDemoData } from "@/lib/demo/data";
import { demoRole } from "@/lib/demo/mode";
import type { AppRole } from "@/lib/types";

export const metadata: Metadata = {
  title: "Demonstração",
};

/** Um card por papel — a descrição diz o que aquela visão enxerga. */
const PAPEIS: readonly { role: AppRole; icon: Icon; descricao: string }[] = [
  {
    role: "coordenacao",
    icon: Binoculars,
    descricao: "Painel geral: duplas, registros, pessoas, avisos e exportação.",
  },
  {
    role: "supervisor",
    icon: UsersThree,
    descricao: "As duplas sob supervisão: andamento, registros e contatos.",
  },
  {
    role: "mentor_dpp",
    icon: MapTrifold,
    descricao:
      "A jornada dos 16 encontros: agendar, registrar, pedir apoio e especialista.",
  },
  {
    role: "mentor_especialista",
    icon: Handshake,
    descricao: "Mural de demandas e a trilha de 5 encontros.",
  },
];

export default async function DemoPage() {
  // demo já ativa → a troca de papel é pela DemoBar, não por esta página
  if (await demoRole()) redirect("/");

  const { personas } = getDemoData();

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background px-4 py-10">
      {/* animate-rise: mesma entrada suave do onboarding — coberta pelo guard
          global de prefers-reduced-motion */}
      <div className="w-full max-w-xl animate-rise">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-realiza.png" alt="Realiza.vc" className="h-6 w-auto" />

        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Ambiente de demonstração
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-snug tracking-tight">
          A plataforma do Programa de Mentoria, com dados fictícios
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sem login e sem senha. Escolha um papel pra explorar todas as telas —
          nada do que você fizer é gravado. Ao entrar, você passa pela
          apresentação de primeiro acesso, como um usuário real.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {PAPEIS.map(({ role, icon: Icone, descricao }) => (
            <form key={role} action={entrarNaDemo.bind(null, role)}>
              {/* o card visual mora dentro do botão: group-hover acerta a área
                  toda e o focus-visible cai no elemento focável de verdade */}
              <button
                type="submit"
                className="group w-full rounded-xl text-left outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]"
              >
                <div className="flex h-full flex-col rounded-xl border border-transparent bg-card p-4 shadow-[var(--shadow-border)] transition-[border-color,box-shadow] ease-snappy group-hover:border-[var(--brand-lime)]/60 group-hover:shadow-[var(--shadow-border-hover)]">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)]">
                      <Icone size={18} weight="fill" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">
                        {papelLabel(role)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {personas[role].nome}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-snug text-muted-foreground">
                    {descricao}
                  </p>
                </div>
              </button>
            </form>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-5 text-center text-xs leading-relaxed text-muted-foreground">
          <p>Uso interno pra alinhamento — pessoas e dados são fictícios.</p>
          <p className="mt-2">
            Já tem cadastro?{" "}
            <Link
              href="/login"
              className="underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Entrar com magic link
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
