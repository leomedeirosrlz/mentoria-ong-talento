import type { Metadata } from "next";
import {
  CheckCircle,
  Clock,
  Flask,
  LinkBreak,
  WifiSlash,
} from "@phosphor-icons/react/dist/ssr";
import { demoRole } from "@/lib/demo/mode";
import { terceiroPorToken } from "@/lib/terceiros/queries";
import { primeiroNome } from "@/components/forms/link-shared";
import { sharedOg } from "@/lib/og";
import { SiteFooter } from "@/components/site-footer";
import { EstadoCard } from "@/components/estado-card";
import { TerceiroPublico } from "./terceiro-publico";
import { Logo } from "@/components/logo";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;
const TITULO = "Avaliação por terceiros";
const DESCRICAO =
  "Duas perguntas rápidas sobre a pessoa que te indicou. Sua resposta é confidencial e ajuda a mentoria dela.";

// link individual por WhatsApp — og genérico de propósito: o nome do jovem
// não vai no preview (a página já mostra quando a pessoa abre)
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: TITULO,
    description: DESCRICAO,
    openGraph: {
      ...sharedOg,
      title: `${TITULO} · Realiza.vc`,
      description: DESCRICAO,
    },
    robots: { index: false, follow: false },
  };
}

export default async function TerceiroTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, demo] = await Promise.all([params, demoRole()]);

  const res = TOKEN_RE.test(token) ? await terceiroPorToken(token) : null;
  const info = res?.kind === "ok" ? res.info : null;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <main className="flex flex-1 flex-col px-4 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="m-auto w-full max-w-xl">
          <header className="mb-6">
            <Logo size="lg" />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Programa de Mentoria Social
            </p>
          </header>

          {res?.kind === "erro" ? (
            <EstadoCard
              icon={WifiSlash}
              titulo="Não foi possível carregar"
              acao={{ href: `/t/${token}`, label: "Tentar de novo" }}
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
                label: "Falar com a equipe",
              }}
            >
              <p>
                Este link não existe ou foi cancelado. Se você recebeu de um
                mentor da Realiza.vc, peça um novo pra ele.
              </p>
            </EstadoCard>
          ) : info.status === "respondido" ? (
            <EstadoCard icon={CheckCircle} titulo="Resposta já registrada" ok>
              <p>
                Você já respondeu sobre{" "}
                <span className="font-medium text-foreground">
                  {primeiroNome(info.alvo.jovem_nome)}
                </span>
                . Obrigado por contribuir com a jornada dela!
              </p>
            </EstadoCard>
          ) : info.status === "expirado" ? (
            <EstadoCard
              icon={Clock}
              titulo="Este link expirou"
              acao={{
                href: "mailto:mentoria@realiza.vc",
                label: "Falar com a equipe",
              }}
            >
              <p>
                O prazo pra responder sobre{" "}
                <span className="font-medium text-foreground">
                  {primeiroNome(info.alvo.jovem_nome)}
                </span>{" "}
                terminou. Peça um link novo ao mentor que te enviou.
              </p>
            </EstadoCard>
          ) : (
            <>
              {demo && (
                <p className="mb-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Flask size={13} aria-hidden />
                  Modo demonstração: respostas não são gravadas.
                </p>
              )}
              <TerceiroPublico
                token={token}
                convidadoNome={info.convidado.nome}
                jovemNome={info.alvo.jovem_nome}
              />
            </>
          )}

          <SiteFooter className="mt-8" />
        </div>
      </main>
    </div>
  );
}
