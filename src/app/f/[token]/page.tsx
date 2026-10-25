import type { Metadata } from "next";
import {
  CheckCircle,
  Clock,
  Flask,
  LinkBreak,
  PauseCircle,
  UserSwitch,
  WifiSlash,
} from "@phosphor-icons/react/dist/ssr";
import { demoRole } from "@/lib/demo/mode";
import { formularioPorToken } from "@/lib/forms/queries";
import { formatDateTime } from "@/lib/ciclo";
import { sharedOg } from "@/lib/og";
import { SiteFooter } from "@/components/site-footer";
import { EstadoCard } from "@/components/estado-card";
import { FormularioPublico } from "./formulario-publico";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

// o título real do form + o card de marca são o que o WhatsApp mostra no
// preview do link — og precisa de title, description, url e image cheios
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const r = TOKEN_RE.test(token) ? await formularioPorToken(token) : null;
  const form = r?.kind === "ok" ? r.info.formulario : null;
  const titulo = form?.titulo ?? "Formulário";
  const descricao =
    form?.descricao?.trim() ||
    "Responda o formulário do Programa de Mentoria Social: leva poucos minutos.";
  return {
    title: titulo,
    description: descricao,
    // merge raso do Next: sem espalhar o sharedOg a rota perderia
    // siteName/images/url do layout
    openGraph: {
      ...sharedOg,
      title: `${titulo} · Realiza.vc`,
      description: descricao,
      url: `/f/${token}`,
    },
    // link individual por WhatsApp/e-mail — não é página de indexação
    robots: { index: false, follow: false },
  };
}

export default async function FormularioTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, demo] = await Promise.all([params, demoRole()]);

  // demo: a página abre em leitura sobre os links do fixture — os estados
  // (respondido/expirado/encerrado) ficam todos demonstráveis e o submit
  // cai no DEMO_MSG da action, como toda escrita da demo
  const res = TOKEN_RE.test(token) ? await formularioPorToken(token) : null;
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

          {res?.kind === "erro" ? (
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
                  {info.formulario?.titulo}
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
                  {info.formulario?.titulo}
                </span>{" "}
                terminou
                {info.expira_em && <> em {formatDateTime(info.expira_em)}</>}.
                Peça um novo link à equipe Realiza.vc.
              </p>
            </EstadoCard>
          ) : info.status === "outra_pessoa" ? (
            <EstadoCard icon={UserSwitch} titulo="Este link é de outra pessoa">
              <p>
                Você está conectado com uma conta que não é a de{" "}
                {info.destinatario ? (
                  <strong className="font-semibold text-foreground">
                    {info.destinatario}
                  </strong>
                ) : (
                  "quem recebeu este link"
                )}
                . Saia da conta atual e abra o link de novo, ou peça um link
                só seu à equipe Realiza.vc.
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
                  {info.formulario?.titulo}
                </span>{" "}
                não está recebendo respostas no momento. Se acha que isso é um
                engano, fale com a equipe Realiza.vc.
              </p>
            </EstadoCard>
          ) : !info.formulario ? (
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
          ) : (
            <>
              {/* a página pública não tem DemoBar — a faixa diz que é
                  visualização antes do visitante descobrir no submit */}
              {demo && (
                <p className="mb-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Flask size={13} aria-hidden />
                  Modo demonstração: respostas não são gravadas.
                </p>
              )}
              <FormularioPublico
                token={token}
                titulo={info.formulario.titulo}
                descricao={info.formulario.descricao}
                campos={info.formulario.campos}
                destinatario={info.destinatario}
                sistema={info.formulario.sistema}
              />
            </>
          )}

          <SiteFooter className="mt-8" />
        </div>
      </main>
    </div>
  );
}
