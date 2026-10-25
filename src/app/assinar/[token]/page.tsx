import type { Metadata } from "next";
import {
  CheckCircle,
  ClockCountdown,
  FileArrowDown,
  FileX,
  Flask,
  LinkBreak,
  ShareNetwork,
  UserSwitch,
} from "@phosphor-icons/react/dist/ssr";
// import type não emite runtime — o barrel principal usa createContext e
// quebraria a página (server component) se viesse como import de valor
import type { Icon } from "@phosphor-icons/react";
import { assinarComToken, assinaturaPorToken } from "@/lib/actions-assinaturas";
import { demoRole } from "@/lib/demo/mode";
import { AssinaturaForm } from "@/components/assinatura-form";
import { SiteFooter } from "@/components/site-footer";
import { TermoVoluntarioDoc } from "@/components/termo-doc";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/ciclo";
import { sharedOg } from "@/lib/og";
import { SITE_URL } from "@/lib/email";
import {
  AUTORIZACAO_TITULO,
  civisPreview,
  CLAUSULAS_AUTORIZACAO,
  CLAUSULAS_MENTORANDO,
  dataPorExtenso,
  FECHO_AUTORIZACAO,
  FECHO_MENTORANDO,
  MENTORANDO_TITULO,
  preambuloAutorizacao,
  preambuloMentorando,
} from "@/lib/documentos/texto";
import type { DadosAutorizacao, DadosCivis, ResponsavelCivis } from "@/lib/types";

const DESCRICAO_ASSINATURA =
  "Assinatura eletrônica de documento do Programa de Mentoria Social · Realiza.vc.";

// generateMetadata (não metadata estática) pra carregar o token no og:url —
// não custa query nenhuma, o token já vem nos params
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Assinatura de documento",
    description: DESCRICAO_ASSINATURA,
    openGraph: {
      ...sharedOg,
      title: "Assinatura de documento · Realiza.vc",
      description: DESCRICAO_ASSINATURA,
      url: `/assinar/${token}`,
    },
    // link individual por WhatsApp — não é página de indexação (igual a /f)
    robots: { index: false, follow: false },
  };
}

// uuid do token na URL — formato errado nem vai ao banco (e a RPC espera uuid,
// então qualquer outra coisa daria erro feio em vez de tela amigável)
const TOKEN_RE = /^[0-9a-f-]{36}$/;

/** Aviso do modo demo (REALIZA-172) — a mesma etiqueta das irmãs públicas
 *  (/t, /f): discreta, sempre no topo, e honesta sobre o que a demo não
 *  faz — aqui, nada é assinado de verdade. */
function AvisoDemo({ className }: { className?: string }) {
  return (
    <p
      className={`flex items-center justify-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <Flask size={13} aria-hidden />
      Demonstração: nada aqui é assinado de verdade.
    </p>
  );
}

/** Telas terminais do link (inválido, já assinado, revogado, expirado) — quem
 *  abre é o responsável pelo jovem, então a mensagem é direta e sem jargão. */
function EstadoLink({
  icon: Icone,
  titulo,
  demo,
  children,
}: {
  icon: Icon;
  titulo: string;
  /** cookie demo ativo — a etiqueta aparece no topo do card terminal. */
  demo?: boolean;
  children: React.ReactNode;
}) {
  return (
    // flex + m-auto (não place-items-center): em telas baixas o topo do card
    // continua rolável — centraliza só quando há espaço. flex, não grid: em
    // grid o w-full do filho resolve contra o padding box e vaza o padding
    // lateral (1rem ou o safe-area, o que for maior)
    <div className="flex min-h-[100dvh] flex-col bg-background py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div className="m-auto w-full max-w-sm animate-rise text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-realiza.png" alt="Realiza.vc" className="mx-auto h-6 w-auto" />
        {demo && <AvisoDemo className="mt-6" />}
        <div className="mt-8 rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
          <Icone size={28} className="mx-auto text-muted-foreground" aria-hidden />
          <h1 className="mt-3 text-base font-semibold">{titulo}</h1>
          <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {children}
          </div>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Realiza.vc · Programa de Mentoria
        </p>
      </div>
    </div>
  );
}

export default async function AssinarTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, demoRoleAtivo] = await Promise.all([params, demoRole()]);
  const demo = demoRoleAtivo != null;
  const info = TOKEN_RE.test(token) ? await assinaturaPorToken(token) : null;

  if (!info) {
    return (
      <EstadoLink icon={LinkBreak} titulo="Link inválido" demo={demo}>
        <p>
          Este link de assinatura não é válido. Ele pode ter sido copiado
          incompleto ou substituído por um mais recente. Peça um novo link à
          coordenação do programa.
        </p>
      </EstadoLink>
    );
  }

  if (info.status === "assinado") {
    return (
      <EstadoLink icon={CheckCircle} titulo="Documento assinado" demo={demo}>
        <p>
          Este documento já foi assinado
          {info.assinado_em ? ` em ${formatDateTime(info.assinado_em)}` : ""}.
          Guarde a via em PDF para seus registros.
        </p>
        <p className="mt-4">
          <a
            href={`/api/assinar-token/${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileArrowDown size={15} aria-hidden />
            Baixar a via do documento
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </p>
      </EstadoLink>
    );
  }

  if (info.status === "revogado") {
    return (
      <EstadoLink icon={FileX} titulo="Documento cancelado" demo={demo}>
        <p>
          Este documento foi cancelado pela coordenação do programa e não pode
          mais ser assinado por este link. Se você acha que isso é um engano,
          fale com a coordenação.
        </p>
      </EstadoLink>
    );
  }

  if (info.status === "expirado") {
    return (
      <EstadoLink icon={ClockCountdown} titulo="Link expirado" demo={demo}>
        <p>
          O prazo deste link de assinatura terminou. Peça um novo link à
          coordenação do programa; a assinatura leva poucos minutos.
        </p>
      </EstadoLink>
    );
  }

  // 0070 — sessão autenticada conferida contra o destinatário do link (a
  // RPC já omite `civis` nesses dois casos — nada de dado civil vaza no
  // card de bloqueio)
  if (info.identidade === "outra_pessoa") {
    return (
      <EstadoLink
        icon={UserSwitch}
        titulo="Este link é de outra pessoa"
        demo={demo}
      >
        <p>
          Você está conectado com uma conta que não é a de{" "}
          <strong className="font-semibold text-foreground">
            {info.alvo.nome}
          </strong>
          , para quem este documento foi emitido. Saia da conta atual e abra o
          link de novo, ou peça um link só seu à coordenação.
        </p>
      </EstadoLink>
    );
  }

  if (info.identidade === "signatario_externo") {
    return (
      <EstadoLink
        icon={ShareNetwork}
        titulo="Quem assina é o responsável"
        demo={demo}
      >
        <p>
          A autorização de{" "}
          <strong className="font-semibold text-foreground">
            {info.alvo.nome}
          </strong>{" "}
          precisa ser assinada pelo responsável legal, que não tem conta na
          plataforma. Encaminhe este link para a pessoa responsável abrir no
          celular dela.
        </p>
        <p className="mt-4">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Olá! A Realiza.vc precisa da sua assinatura no documento "${info.template.titulo}". Abra este link no seu celular: ${SITE_URL}/assinar/${token}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ShareNetwork size={15} aria-hidden />
            Encaminhar pelo WhatsApp
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </p>
      </EstadoLink>
    );
  }

  // pendente: preview do documento já com o que está na ficha (0046 — a
  // RPC devolve `civis` como sugestão; o que faltar fica em branco e o form
  // abaixo completa/corrige — o snapshot registra o que foi assinado)
  const slug = info.template.slug;
  const ehAutorizacao = slug === "autorizacao-responsavel";
  const ehVoluntario = slug === "termo-voluntario";
  const civis = info.civis as (DadosCivis & { parentesco?: string }) | null;
  const dadosPreview: DadosAutorizacao = {
    mentorado_nome: info.alvo.nome,
    responsavel: { ...civisPreview(civis), parentesco: civis?.parentesco ?? "______" },
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="mx-auto w-full max-w-2xl flex-1 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-realiza.png" alt="Realiza.vc" className="h-6 w-auto" />

        {demo && <AvisoDemo className="mt-6" />}

        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Assinatura eletrônica
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-snug tracking-tight">
          {info.template.titulo}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {ehAutorizacao ? (
            <>
              Você recebeu este link como responsável por{" "}
              <strong className="font-semibold text-foreground">
                {info.alvo.nome}
              </strong>
              . Leia o documento abaixo e assine com seus dados civis. A
              assinatura eletrônica tem a mesma validade de uma assinatura em
              papel.
            </>
          ) : ehVoluntario ? (
            <>
              Você recebeu este link para assinar o seu termo de adesão ao
              trabalho voluntário. Leia o documento abaixo, confira seus
              dados e assine. A assinatura eletrônica tem a mesma validade de
              uma assinatura em papel.
            </>
          ) : (
            <>
              Você recebeu este link para a assinatura do termo de{" "}
              <strong className="font-semibold text-foreground">
                {info.alvo.nome}
              </strong>
              . Leia o documento abaixo, confira os dados e assine. A
              assinatura eletrônica tem a mesma validade de uma assinatura em
              papel.
            </>
          )}
        </p>
        {/* índice da tarefa — mesmo passo a passo da página logada: cada
            âncora aponta pra seção que resolve aquele passo */}
        <nav aria-label="Etapas da assinatura" className="mt-4">
          <ol className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <li>
              <a
                href="#termo"
                className="inline-flex min-h-11 items-center rounded-lg font-medium text-primary underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                1 · Leia o documento
              </a>
            </li>
            <li>
              <a
                href="#dados"
                className="inline-flex min-h-11 items-center rounded-lg font-medium text-primary underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {ehVoluntario ? "2 · Confira seus dados" : "2 · Confira os dados"}
              </a>
            </li>
            <li>
              <a
                href="#assinar"
                className="inline-flex min-h-11 items-center rounded-lg font-medium text-primary underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                3 · Assine
              </a>
            </li>
          </ol>
        </nav>

        {/* o documento como será emitido — o texto é o mesmo que entra no PDF
            (src/lib/documentos/texto.ts é a fonte única dos dois). O termo do
            voluntário renderiza pelo mesmo TermoVoluntarioDoc da página
            logada — um doc só, duas portas de entrada */}
        {ehVoluntario ? (
          <div className="mt-8">
            <TermoVoluntarioDoc
              civis={civis}
              id="termo"
              continuar={{
                href: "#dados",
                rotulo: "Continuar para seus dados ↓",
              }}
            />
          </div>
        ) : (
          <section
            id="termo"
            className="mt-8 scroll-mt-4 rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8"
          >
            <h2 className="text-center text-sm font-semibold uppercase tracking-[0.06em]">
              {ehAutorizacao ? AUTORIZACAO_TITULO : MENTORANDO_TITULO}
            </h2>
            <div className="mt-5 space-y-3 text-sm leading-relaxed">
              {(ehAutorizacao
                ? preambuloAutorizacao(dadosPreview)
                : preambuloMentorando(civisPreview(civis))
              ).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {(ehAutorizacao ? CLAUSULAS_AUTORIZACAO : CLAUSULAS_MENTORANDO).map(
                ([titulo, paragrafos]) => (
                  <div key={titulo} className="pt-1">
                    <h3 className="font-semibold">{titulo}</h3>
                    {paragrafos.map((p) => (
                      <p key={p} className="mt-1.5">
                        {p}
                      </p>
                    ))}
                  </div>
                )
              )}
              <p>{ehAutorizacao ? FECHO_AUTORIZACAO : FECHO_MENTORANDO}</p>
              <p>{dataPorExtenso(new Date())}</p>
            </div>
            <p className="mt-6 border-t border-border pt-5 text-center">
              <a
                href="#dados"
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline"
              >
                Continuar para seus dados ↓
              </a>
            </p>
          </section>
        )}

        <section
          id="dados"
          className="mt-6 scroll-mt-4 rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8"
        >
          <h2 className="text-base font-semibold">
            {ehAutorizacao
              ? "2 · Seus dados para assinar"
              : ehVoluntario
                ? "2 · Confira seus dados e assine"
                : "2 · Dados do(a) jovem e assinatura"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {civis
              ? "Os dados já vêm do cadastro. Confira, corrija se preciso e assine. A assinatura registra data, hora e endereço de rede."
              : "Preencha como consta no documento oficial. As informações entram no documento e a assinatura registra data, hora e endereço de rede."}
          </p>
          <div className="mt-6">
            <AssinaturaForm
              modo={ehAutorizacao ? "autorizacao" : "termo"}
              alvoNome={info.alvo.nome}
              acao={assinarComToken.bind(null, token)}
              dados={civis}
              parentesco={
                ehAutorizacao ? ((civis as ResponsavelCivis | null)?.parentesco ?? undefined) : undefined
              }
              etapas
            />
          </div>
        </section>
      </main>

      <div className="border-t border-border py-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
        <SiteFooter />
      </div>
    </div>
  );
}
