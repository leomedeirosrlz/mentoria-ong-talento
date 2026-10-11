import type { Metadata } from "next";
import {
  CheckCircle,
  Clock,
  Flask,
  LinkBreak,
  UserSwitch,
  WifiSlash,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { demoRole } from "@/lib/demo/mode";
import {
  avaliacaoPorToken,
  linkAvaliacaoMeta,
} from "@/lib/queries-avaliacao";
import { formatDateTime } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { AvaliacaoEncontroForm } from "@/components/avaliacao-encontro-form";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

// o preview do WhatsApp mostra isto — o título fala do gesto (avaliar o
// encontro), não do instrumento
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const r = TOKEN_RE.test(token) ? await avaliacaoPorToken(token) : null;
  const jovem = r?.kind === "ok" ? r.info.alvo?.jovem_nome : null;
  const titulo = "Como foi o encontro?";
  return {
    title: jovem ? `${titulo} · ${jovem.split(/\s+/)[0]}` : titulo,
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

const MAILTO = "mailto:mentoria@realiza.vc";

export default async function AvaliarTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, demo] = await Promise.all([params, demoRole()]);

  const res = TOKEN_RE.test(token) ? await avaliacaoPorToken(token) : null;
  const info = res?.kind === "ok" ? res.info : null;

  // a trilha decide se o toggle "mentor pode ler" aparece — a RPC pública
  // não a devolve de propósito (nem encontro_id); leitura coord-scope no
  // servidor, fora do payload do client
  const meta =
    info && TOKEN_RE.test(token) ? await linkAvaliacaoMeta(token) : null;

  // data do encontro pra contextualizar — "o encontro 4 de dd/mm"
  const quando =
    info?.encontro?.realizado_em ?? info?.encontro?.data_hora ?? null;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* flex + m-auto (não place-items-center): o form não clipa o topo
          em telas baixas — centraliza só quando há espaço */}
      <main className="flex flex-1 flex-col px-4 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="m-auto w-full max-w-xl">
          <header className="mb-6">
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

          {res?.kind === "erro" ? (
            <EstadoCard
              icon={WifiSlash}
              titulo="Não foi possível carregar"
              acao={{ href: `/avaliar/${token}`, label: "Tentar de novo" }}
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
              acao={{ href: MAILTO, label: "Pedir um novo link" }}
            >
              <p>
                Este link não existe ou foi digitado errado. Se você recebeu
                da equipe Realiza.vc, peça um novo.
              </p>
            </EstadoCard>
          ) : info.identidade === "outra_pessoa" ? (
            <EstadoCard icon={UserSwitch} titulo="Este link é de outra pessoa">
              <p>
                Você está conectado com uma conta que não é a de{" "}
                {info.alvo?.jovem_nome ? (
                  <strong className="font-semibold text-foreground">
                    {info.alvo.jovem_nome}
                  </strong>
                ) : (
                  "quem recebeu este link"
                )}
                . Saia da conta atual e abra o link de novo — ou responda
                pela sua página quando entrar.
              </p>
            </EstadoCard>
          ) : info.status === "expirado" ? (
            <EstadoCard
              icon={Clock}
              titulo="Este link expirou"
              acao={{ href: MAILTO, label: "Pedir um novo link" }}
            >
              <p>
                O prazo pra avaliar este encontro terminou. Peça um novo
                link à equipe Realiza.vc — sua opinião continua valendo.
              </p>
            </EstadoCard>
          ) : info.status === "respondido" || info.respondida ? (
            <EstadoCard icon={CheckCircle} titulo="Avaliação já registrada" ok>
              <p>
                Você já contou como foi este encontro. Obrigado — suas
                respostas ficam entre você e a equipe da Realiza.vc.
              </p>
            </EstadoCard>
          ) : !meta ? (
            <EstadoCard
              icon={WifiSlash}
              titulo="Não foi possível carregar"
              acao={{ href: `/avaliar/${token}`, label: "Tentar de novo" }}
            >
              <p>
                A conexão falhou no caminho. Não é problema com o seu link.
                Confira a internet e tente de novo.
              </p>
            </EstadoCard>
          ) : (
            <>
              {/* a página pública não tem DemoBar — a faixa diz que é
                  visualização antes do visitante descobrir no submit */}
              {demo && (
                <p className="mb-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Flask size={13} aria-hidden />
                  Modo demonstração — respostas não são gravadas.
                </p>
              )}
              {info.encontro && quando && (
                <p className="mb-4 text-center text-xs text-muted-foreground">
                  Encontro {info.encontro.numero}
                  {info.mentor?.nome ? ` com ${info.mentor.nome}` : ""} ·{" "}
                  {formatDateTime(quando)}
                </p>
              )}
              <AvaliacaoEncontroForm
                token={token}
                trilha={meta.trilha}
                primeiroNome={
                  info.alvo?.jovem_nome?.trim().split(/\s+/)[0] ?? null
                }
              />
            </>
          )}

          <SiteFooter className="mt-8" />
        </div>
      </main>
    </div>
  );
}
