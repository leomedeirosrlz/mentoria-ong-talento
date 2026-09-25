import Link from "next/link";
import type { Metadata } from "next";
import {
  CheckCircle,
  Clock,
  Flask,
  LinkBreak,
  PauseCircle,
  WifiSlash,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { demoRole } from "@/lib/demo/mode";
import { formularioPorToken } from "@/lib/forms/queries";
import { formatDateTime } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { FormularioPublico } from "./formulario-publico";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

// o título real do form é o que o WhatsApp mostra no preview do link
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const [{ token }, demo] = await Promise.all([params, demoRole()]);
  const r =
    !demo && TOKEN_RE.test(token) ? await formularioPorToken(token) : null;
  const titulo = r?.kind === "ok" ? r.info.formulario.titulo : "Formulário";
  return {
    title: titulo,
    openGraph: { title: `${titulo} · Realiza.vc` },
    // link individual por WhatsApp/e-mail — não é página de indexação
    robots: { index: false, follow: false },
  };
}

function EstadoCard({
  icon: Icon,
  titulo,
  acao,
  ok,
  children,
}: {
  icon: Icon;
  titulo: string;
  /** saída do beco — mailto pra equipe ou retry do mesmo link */
  acao?: { href: string; label: string };
  /** tom de sucesso — círculo lime pro estado "já respondida" */
  ok?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card p-6 text-center shadow-[var(--shadow-border)] sm:p-8">
      <div
        className={cn(
          "mx-auto grid size-12 place-items-center rounded-full",
          ok
            ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon size={24} weight={ok ? "bold" : "regular"} aria-hidden />
      </div>
      <h1 className="mt-4 text-lg font-semibold">{titulo}</h1>
      <div className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
      {acao && (
        <p className="mt-5">
          <a
            href={acao.href}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {acao.label}
          </a>
        </p>
      )}
    </div>
  );
}

export default async function FormularioTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, demo] = await Promise.all([params, demoRole()]);

  // na demo, /f/<token> não roda — os links existem só pra coord ver na ficha
  const res =
    !demo && TOKEN_RE.test(token) ? await formularioPorToken(token) : null;
  const info = res?.kind === "ok" ? res.info : null;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* flex + m-auto (não place-items-center): forms longos não clipam o
          topo em telas baixas — centraliza só quando há espaço. flex, não
          grid: em grid o w-full do filho resolve contra o padding box */}
      <main className="flex flex-1 flex-col px-4 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="m-auto w-full max-w-xl">
          <header className="mb-6">
            {/* width/height naturais reservam a proporção — sem CLS */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-realiza.png"
              alt="Realiza.vc"
              width={1920}
              height={262}
              className="h-7 w-auto"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Programa de Mentoria Social
            </p>
          </header>

          {demo ? (
            <EstadoCard icon={Flask} titulo="Você está na demonstração">
              <p>
                Os links públicos de formulário não funcionam no modo demo:
                eles existem pra quem recebe por WhatsApp ou e-mail.
              </p>
              <p className="mt-2">
                Pra ver o fluxo, abra um formulário em{" "}
                <Link href="/formularios" className="underline underline-offset-2 hover:text-foreground">
                  Formulários
                </Link>{" "}
                e confira a aba de respostas.
              </p>
              <p className="mt-4">
                <Link
                  href="/"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Voltar pra demonstração
                </Link>
              </p>
            </EstadoCard>
          ) : res?.kind === "erro" ? (
            <EstadoCard
              icon={WifiSlash}
              titulo="Não foi possível carregar"
              acao={{ href: `/f/${token}`, label: "Tentar de novo" }}
            >
              <p>
                A conexão falhou no caminho. Não é problema com o seu link.
                Confira a internet e tente de novo.
              </p>
            </EstadoCard>
          ) : !info ? (
            <EstadoCard
              icon={LinkBreak}
              titulo="Link não encontrado"
              acao={{
                href: "mailto:mentoria@realiza.vc",
                label: "Pedir um novo link",
              }}
            >
              <p>
                Este link não existe ou foi digitado errado. Se você recebeu
                da equipe Realiza.vc, peça um novo.
              </p>
            </EstadoCard>
          ) : info.status === "respondido" ? (
            <EstadoCard icon={CheckCircle} titulo="Resposta já registrada" ok>
              <p>
                Você já respondeu{" "}
                <span className="font-medium text-foreground">
                  {info.formulario.titulo}
                </span>
                {info.respondido_em && (
                  <> em {formatDateTime(info.respondido_em)}</>
                )}
                . Obrigado por contribuir!
              </p>
            </EstadoCard>
          ) : info.status === "expirado" ? (
            <EstadoCard
              icon={Clock}
              titulo="Este link expirou"
              acao={{
                href: "mailto:mentoria@realiza.vc",
                label: "Pedir um novo link",
              }}
            >
              <p>
                O prazo pra responder{" "}
                <span className="font-medium text-foreground">
                  {info.formulario.titulo}
                </span>{" "}
                terminou
                {info.expira_em && <> em {formatDateTime(info.expira_em)}</>}.
                Peça um novo link à equipe Realiza.vc.
              </p>
            </EstadoCard>
          ) : info.status === "inativo" ? (
            <EstadoCard
              icon={PauseCircle}
              titulo="Formulário encerrado"
              acao={{
                href: "mailto:mentoria@realiza.vc",
                label: "Falar com a equipe",
              }}
            >
              <p>
                <span className="font-medium text-foreground">
                  {info.formulario.titulo}
                </span>{" "}
                não está recebendo respostas no momento. Se acha que isso é um
                engano, fale com a equipe Realiza.vc.
              </p>
            </EstadoCard>
          ) : (
            <FormularioPublico
              token={token}
              titulo={info.formulario.titulo}
              descricao={info.formulario.descricao}
              campos={info.formulario.campos}
              destinatario={info.destinatario}
              sistema={info.formulario.sistema}
            />
          )}

          <SiteFooter className="mt-8" />
        </div>
      </main>
    </div>
  );
}
