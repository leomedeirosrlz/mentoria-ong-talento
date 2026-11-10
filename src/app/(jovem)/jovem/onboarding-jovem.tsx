"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CircleNotch,
  EnvelopeSimple,
  HandHeart,
  Handshake,
  WhatsappLogo,
  type Icon,
} from "@phosphor-icons/react";
import { concluirOnboarding } from "@/lib/actions";
import { assinarComToken } from "@/lib/actions-assinaturas";
import {
  salvarDisponibilidadeJovem,
  setContatoCompartilhado,
} from "@/lib/actions-jovem";
import { recomecarDemo } from "@/lib/demo/actions";
import { assinarTermoDemo } from "@/lib/demo/shared";
import { AssinaturaForm } from "@/components/assinatura-form";
import { CampoDisponibilidade } from "@/components/campos-pessoais";
import { SignOutButton } from "@/components/signout-button";
import { TermoMentorandoDoc } from "@/components/termo-doc";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatWhatsApp } from "@/lib/ciclo";
import type { DadosCivis, Disponibilidade, JovemPerfil, Profile } from "@/lib/types";
import { Logo } from "@/components/logo";

type Recurso = { icon: Icon; texto: string };

/** "O que esperar" do passo de boas-vindas — a promessa do programa em 3
 *  linhas: a dupla, o espaço dele aqui e a rede de segurança. */
const RECURSOS: Recurso[] = [
  {
    icon: Handshake,
    texto:
      "Um mentor ou mentora que caminha com você: encontros pra conversar sobre estudos, planos e o que você quiser construir.",
  },
  {
    icon: CalendarCheck,
    texto:
      "Sua agenda de encontros, os combinados entre vocês e os materiais de apoio do programa num lugar só.",
  },
  {
    icon: HandHeart,
    texto:
      "Um botão de ajuda sempre à mão: avisa a equipe e alguém responde quando você precisar.",
  },
];

/** Wizard de primeiro acesso do mentorado (REALIZA-114): boas-vindas, a
 *  grade de disponibilidade (o insumo que o cruzamento da agenda precisa
 *  — sem ela o mentor vê "nenhum horário em comum" em tudo), o termo de
 *  participação quando há um pendente (mesmo desenho do passo de termo do
 *  OnboardingFlow: documento, dados civis, AssinaturaForm, "Assinar
 *  depois") e a confirmação de contato com o opt-in colega↔colega. O gate
 *  mora no layout: onboarded_em null renderiza isto no lugar do shell;
 *  "Preencher depois" é permitido mas a pendência vira lembrete
 *  permanente na home até a grade existir. Mesma gramática visual do
 *  OnboardingFlow de staff (header fixo + progressbar, balão por passo,
 *  footer fixo). */
export function OnboardingJovem({
  me,
  perfil,
  termo,
  demo,
}: {
  me: Profile;
  /** ficha mentorados do próprio jovem (view jovem_perfil) — preenche a
   *  grade, o contato e os dados civis do termo; null = ficha ainda não
   *  vinculada pela coordenação */
  perfil: JovemPerfil | null;
  /** token do termo-mentorando pendente (o jovem assina pelo próprio
   *  token, como em /assinar/[token]) — null = sem pendência: o passo
   *  não existe e o wizard fica em 3 */
  termo?: { token: string } | null;
  /** pill da DemoBar dockada no header (demo ativa) — presença também é a
   *  flag "não grava nada": o wizard demo flui igual, sem writes */
  demo?: React.ReactNode;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [termoOk, setTermoOk] = useState(false);

  const temTermo = !!termo;
  const total = temTermo ? 4 : 3;
  // penúltimo, como no wizard de staff — o passo seguinte (contato) é o
  // fechamento
  const passoTermo = temTermo ? total - 2 : -1;
  const ehPassoTermo = step === passoTermo;
  const civis = (perfil?.dados_civis as DadosCivis | null) ?? null;

  const [grade, setGrade] = useState<Disponibilidade | null>(
    (perfil?.disponibilidade as Disponibilidade | null) ?? null
  );
  const compartilhaInicial = perfil?.contato_compartilhado ?? false;
  const [compartilha, setCompartilha] = useState(compartilhaInicial);

  // o botão do footer segue montado — foco no título do balão a cada passo,
  // mesmo padrão do OnboardingFlow e das etapas do importar-csv. O scrollTo
  // vem antes: sem ele a troca de passo só grampeia no fim do passo novo
  // quando ele é mais baixo que o scroll atual — o cartão de título
  // aparecia escondido embaixo do header fixo
  useEffect(() => {
    window.scrollTo(0, 0);
    tituloRef.current?.focus();
  }, [step]);

  const primeiroNome =
    (me.nome_social || me.nome).trim().split(/\s+/)[0] || me.nome;
  const ultimo = step === total - 1;
  const temWhatsapp = perfil?.whatsapp != null;
  // texto único do dd de contato — o truncate precisa do title com o valor
  // inteiro pra ler o que ficou de fora (mesmo padrão do resumo do staff)
  const whatsappTxt = perfil?.whatsapp
    ? formatWhatsApp(perfil.whatsapp)
    : "Ainda não cadastrado. A coordenação inclui";
  const emailTxt = perfil?.email ?? me.email;

  function avancar() {
    setStep((s) => Math.min(s + 1, total - 1));
  }

  /** Continuar do passo da grade — grava o que estiver marcado (a RPC
   *  normaliza vazio pra null) e avança. Na demo e sem ficha não há onde
   *  gravar: o gesto só avança — o "Preencher depois" é o mesmo gesto sem
   *  salvar, igual ao "Pular etapa" do wizard de staff. */
  function salvarGrade() {
    if (demo || !perfil) {
      avancar();
      return;
    }
    start(async () => {
      try {
        const res = await salvarDisponibilidadeJovem(grade);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        avancar();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  /** "Entrar" do último passo — persiste o opt-in se mudou e carimba o
   *  onboarding. Falha no toggle segura a conclusão: sair do wizard sem a
   *  escolha gravada prometeria uma privacidade que não aconteceu. */
  function entrar() {
    start(async () => {
      try {
        if (!demo && perfil && compartilha !== compartilhaInicial) {
          const r = await setContatoCompartilhado(compartilha);
          if (r.error) {
            toast.error(r.error);
            return;
          }
        }
        const res = await concluirOnboarding();
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        // o layout relê getMe — onboarded_em setado devolve o shell do app
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  const titulo = (() => {
    if (ehPassoTermo) return "Seu termo de participação";
    switch (step) {
      case 0:
        return `Bem-vindo(a) ao Realiza, ${primeiroNome}!`;
      case 1:
        return "Quando dá pra você?";
      default:
        return "Seu contato tá certo?";
    }
  })();

  const hint = (() => {
    if (ehPassoTermo) {
      return "É o documento que formaliza a sua participação no programa: leia, confira seus dados e assine pra começar.";
    }
    switch (step) {
      case 0:
        return "O Programa de Mentoria Social te conecta com um mentor pra caminhar junto: encontros, planos e o que você quiser construir. Três passos rápidos e você entra.";
      case 1:
        return "Marque os dias e períodos em que costuma ter tempo livre. A agenda cruza a sua grade com a do seu mentor pra achar horários em comum.";
      default:
        return "É por esses canais que seu mentor e a coordenação falam com você. Se algo estiver errado ou faltando, avisa a equipe.";
    }
  })();

  // fechamento: quem pulou o termo sai do wizard com o lembrete de onde
  // ele fica — a pendência permanece e o card Documentos da home resolve.
  // Mesmo desenho do corpoFechamento do OnboardingFlow
  const corpoFechamento =
    ultimo && temTermo && !termoOk ? (
      <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Falta só o termo de participação: assine quando puder pelo card
        Documentos, na sua home.
      </p>
    ) : null;

  const corpo = (() => {
    // o termo tem form próprio (AssinaturaForm) — intercepta antes do
    // switch; na demo a gravação é simulada (cookie demo_termo) e os
    // espelhos leem como "assinado", como no wizard de staff
    if (ehPassoTermo && termo) {
      return (
        <div className="space-y-4">
          <TermoMentorandoDoc
            civis={civis}
            continuar={{
              href: "#ob-termo-dados",
              rotulo: "Continuar para seus dados ↓",
            }}
          />
          <div id="ob-termo-dados" className="scroll-mt-[calc(6rem+env(safe-area-inset-top))] space-y-2">
            <h2 className="text-base font-semibold">Seus dados para assinar</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {civis
                ? "Já temos seus dados do cadastro: confira, corrija se preciso e assine."
                : "Pra assinar precisamos dos seus dados civis: preencha como no documento de identidade. Eles entram no termo exatamente como digitados."}{" "}
              {demo
                ? "Na demonstração a assinatura é simulada: nada sai do seu navegador."
                : "Eles ficam restritos à coordenação e ao termo."}
            </p>
          </div>
          <AssinaturaForm
            modo="termo"
            acao={
              demo
                ? (fd) => assinarTermoDemo("mentorado", fd)
                : assinarComToken.bind(null, termo.token)
            }
            dados={civis}
            onSucesso={() => {
              setTermoOk(true);
              avancar();
            }}
          />
        </div>
      );
    }
    switch (step) {
      case 0:
        return (
          <div className="space-y-2">
            <ul className="space-y-2">
              {RECURSOS.map((r) => (
                <li
                  key={r.texto}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--role-mentorado)] text-[var(--destaque-foreground)]">
                    <r.icon size={18} weight="fill" aria-hidden />
                  </span>
                  <span className="text-sm leading-snug">{r.texto}</span>
                </li>
              ))}
            </ul>
            {/* conta errada acontece (e-mail da mãe, celular compartilhado)
                — a saída precisa existir, mas quieta */}
            <SignOutButton
              icone={false}
              iconSize={13}
              label="Não é você? Sair e voltar ao login"
              className="mt-2 flex min-h-11 w-full items-center justify-center text-xs text-muted-foreground underline transition-colors hover:text-foreground"
            />
          </div>
        );
      case 1:
        return perfil ? (
          <CampoDisponibilidade value={grade} onChange={setGrade} />
        ) : (
          <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            Sua ficha ainda não foi conectada à sua conta. A coordenação faz
            esse vínculo. Quando ela estiver no lugar, você conta seus
            horários em Perfil.
          </p>
        );
      default:
        return (
          <div className="space-y-4">
            {corpoFechamento}
            <dl className="space-y-2">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--role-mentorado)] text-[var(--destaque-foreground)]">
                  <WhatsappLogo size={18} weight="fill" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <dt className="text-xs text-muted-foreground">Seu WhatsApp</dt>
                  <dd className="truncate text-sm font-medium" title={whatsappTxt}>
                    {whatsappTxt}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--role-mentorado)] text-[var(--destaque-foreground)]">
                  <EnvelopeSimple size={18} weight="fill" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <dt className="text-xs text-muted-foreground">Seu e-mail</dt>
                  <dd className="truncate text-sm font-medium" title={emailTxt}>
                    {emailTxt}
                  </dd>
                </div>
              </div>
            </dl>

            {/* o mesmo toggle do /jovem/perfil (0076) — opt-in colega↔colega.
                Grava só no "Entrar" e só se mudou; na demo é visual (a
                preferência da persona é fixa, como no perfil) */}
            {perfil && (
              <div className="space-y-2">
                <label className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                  <Switch
                    checked={compartilha}
                    onCheckedChange={setCompartilha}
                    disabled={pending || !temWhatsapp}
                    aria-label="Compartilhar meu WhatsApp com os colegas"
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">
                      Compartilhar meu WhatsApp com os colegas
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {temWhatsapp
                        ? "(ligado, os colegas da sua turma que têm conta na plataforma veem seu número em Pessoas; desligado, ninguém vê)"
                        : "(seu cadastro ainda não tem WhatsApp; quando ele estiver lá, ligar aqui compartilha com os colegas)"}
                    </span>
                  </span>
                </label>
                <p className="px-1 text-xs text-muted-foreground">
                  Do outro lado é igual: um colega só mostra o WhatsApp dele
                  se escolher compartilhar.
                </p>
              </div>
            )}
          </div>
        );
    }
  })();

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* header fixo: voltar circular + progresso + contador (+ pill demo);
          pt safe-area tira o header de sob o notch em standalone */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-3 px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              // demo no passo 0: voltar sai da demo e devolve a seleção de
              // papel — troca de visão sem precisar abrir a pill
              if (step === 0) {
                start(async () => {
                  await recomecarDemo();
                });
                return;
              }
              setStep((s) => s - 1);
            }}
            disabled={(step === 0 && !demo) || pending}
            aria-label={
              step === 0 && demo ? "Escolher outro papel" : "Voltar um passo"
            }
            title={step === 0 && demo ? "Escolher outro papel" : undefined}
            className="shrink-0 rounded-full"
          >
            {pending && step === 0 ? (
              <CircleNotch className="animate-spin" aria-hidden />
            ) : (
              <ArrowLeft aria-hidden />
            )}
          </Button>
          <div
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-label={`Passo ${step + 1} de ${total}`}
            className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-[var(--role-mentorado)] transition-all duration-500"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>
          {/* aria-hidden: o progressbar já anuncia "Passo X de Y" — o
              contador cru leria o mesmo dado duas vezes (paridade staff) */}
          <span aria-hidden className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {step + 1}/{total}
          </span>
          {demo}
        </div>
      </header>

      {/* coluna central — pb/pt compensam header e footer fixos. pt soma o
          safe-area-top porque o header cresce com o notch (57px + inset) e
          80px fixos deixariam o topo do conteúdo embaixo dele em retrato;
          pl/pr idem pros lados. Mobile ancora no topo (justify-center
          deixava espaço morto sob o header e o balão pulava de altura a
          cada passo) — o centro vertical volta a partir de sm, mesmo
          desenho do OnboardingFlow de staff */}
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col pb-32 pt-[calc(5rem+env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:justify-center sm:px-6">
        <Logo size="sm" className="mb-6 self-start" />
        <div key={step} className="animate-rise">
          <div className="rounded-3xl rounded-bl-md border border-border bg-card px-5 py-4">
            <h1
              ref={tituloRef}
              tabIndex={-1}
              className="text-xl font-semibold leading-snug outline-none"
            >
              {titulo}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {hint}
            </p>
          </div>
          <div className="mt-5">{corpo}</div>
        </div>
      </main>

      {/* footer fixo: "Preencher depois" no passo da grade, "Assinar
          depois" no do termo + primário. requestSubmit não se usa aqui —
          o passo não tem <form>, o gesto chama a action direto; no termo
          o submit mora dentro do AssinaturaForm e o primário some (um
          "Continuar" ao lado de "Assinar depois" seria ambíguo — paridade
          com o OnboardingFlow) */}
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
          {step === 1 && perfil && (
            <Button
              type="button"
              variant="ghost"
              onClick={avancar}
              disabled={pending}
            >
              Preencher depois
            </Button>
          )}
          {ehPassoTermo && (
            <Button
              type="button"
              variant="ghost"
              onClick={avancar}
              disabled={pending}
            >
              Assinar depois
            </Button>
          )}
          {!ehPassoTermo && (
          <Button
            type="button"
            onClick={() => {
              if (ultimo) entrar();
              else if (step === 1) salvarGrade();
              else avancar();
            }}
            disabled={pending}
            className="h-11 flex-1 font-semibold"
          >
            {pending
              ? ultimo
                ? "Entrando…"
                : "Salvando…"
              : ultimo
                ? "Entrar"
                : "Continuar"}
            {!pending &&
              (ultimo ? (
                <Check weight="bold" aria-hidden />
              ) : (
                <ArrowRight aria-hidden />
              ))}
          </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
