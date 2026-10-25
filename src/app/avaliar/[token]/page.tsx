import type { Metadata } from "next";
import {
  Clock,
  LinkBreak,
  UserSwitch,
  WifiSlash,
} from "@phosphor-icons/react/dist/ssr";
import { demoRole } from "@/lib/demo/mode";
import {
  avaliacaoPorToken,
  linkAvaliacaoMeta,
} from "@/lib/queries-avaliacao";
import { formatDateTime } from "@/lib/ciclo";
import { sharedOg } from "@/lib/og";
import { SiteFooter } from "@/components/site-footer";
import { EstadoCard } from "@/components/estado-card";
import { AvaliarTokenFlow } from "@/components/avaliar-token-flow";

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
  const descricao =
    "Sua avaliação ajuda a mentoria a melhorar. Leva menos de 1 minuto.";
  return {
    title: jovem ? `${titulo} · ${jovem.split(/\s+/)[0]}` : titulo,
    description: descricao,
    openGraph: {
      ...sharedOg,
      title: `${titulo} · Realiza.vc`,
      description: descricao,
      url: `/avaliar/${token}`,
    },
    // link individual por WhatsApp/e-mail — não é página de indexação
    robots: { index: false, follow: false },
  };
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
                . Saia da conta atual e abra o link de novo, ou responda
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
                link à equipe Realiza.vc. Sua opinião continua valendo.
              </p>
            </EstadoCard>
          ) : (
            /* pendente/respondido/erro-de-meta ficam NO CLIENT: o submit
               revalida a rota e a render seguinte já traz o link
               'respondido' — com o corte aqui o form seria desmontado e a
               tela de sucesso nunca pintaria. O flow ocupa posição estável
               na árvore e trava o cartão certo depois do envio. */
            <AvaliarTokenFlow
              token={token}
              trilha={meta?.trilha ?? null}
              jaRegistrada={info.status === "respondido" || !!info.respondida}
              primeiroNome={
                info.alvo?.jovem_nome?.trim().split(/\s+/)[0] ?? null
              }
              contexto={
                info.encontro && quando
                  ? `Encontro ${info.encontro.numero}${info.mentor?.nome ? ` com ${info.mentor.nome}` : ""} · ${formatDateTime(quando)}`
                  : null
              }
              demo={!!demo}
              retryHref={`/avaliar/${token}`}
            />
          )}

          <SiteFooter className="mt-8" />
        </div>
      </main>
    </div>
  );
}
