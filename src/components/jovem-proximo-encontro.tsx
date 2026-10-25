import type { CSSProperties } from "react";
import Link from "next/link";
import { PencilSimple, Sparkle, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { EditarLinkDialog } from "@/components/editar-link-dialog";
import { JovemAgendarDialog } from "@/components/jovem-agendar-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  formatDiaHora,
  formatDiaMes,
  formatDiaSemana,
  linkSeguro,
  toDateStr,
} from "@/lib/ciclo";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { cn } from "@/lib/utils";

/** Hero "Seu próximo encontro" da home do jovem: o encontro que motivou abrir
 *  o app, com uma única ação conforme o estado. A ação preenchida (lima) é a
 *  única da primeira dobra; o resto é secundário. Os fluxos (chamada, agenda,
 *  agendar) são os que já existem em /jovem/agenda. */
export function ProximoEncontro({
  proximo,
  rotulo,
  hoje,
  agendar,
  linkEditavel,
  emCurso,
  concluida,
  primeiroNome,
}: {
  /** Próximo encontro agendado/remarcado com data futura; null = nenhum. */
  proximo: JovemEncontro | null;
  /** "6º encontro com Ricardo" ou "3ª sessão com Sofia", montado na página. */
  rotulo: string | null;
  /** "YYYY-MM-DD" no fuso do programa. */
  hoje: string;
  /** DPP ativa com um nº livre: o botão abre o agendamento desse número. */
  agendar: { duplaId: string; numero: number } | null;
  /** Mesma regra da agenda: agendado de dupla ativa e DPP pode trocar o link. */
  linkEditavel: boolean;
  /** Dupla em curso (ativa ou pausada). */
  emCurso: boolean;
  /** Jornada DPP concluída. */
  concluida: boolean;
  primeiroNome: string;
}) {
  const link = proximo ? linkSeguro(proximo.link) : null;
  const eHoje =
    proximo?.data_hora != null &&
    toDateStr(new Date(proximo.data_hora)) === hoje;

  const cabecalho = { style: { "--i": 0 } as CSSProperties };

  if (proximo) {
    const quando = quandoCurto(proximo.data_hora!, eHoje);
    const remarcado = proximo.status === "remarcado" ? " · remarcado" : "";
    return (
      <Casca {...cabecalho} titulo="Seu próximo encontro">
        <p className="mt-2 text-xl font-semibold tracking-tight text-balance">
          {rotulo ?? `${proximo.numero}º encontro`}
        </p>
        <p className="mt-1 text-sm">
          {quando}
          {remarcado}
        </p>
        <Acoes>
          {eHoje && link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
            >
              <VideoCamera size={18} aria-hidden />
              Entrar na chamada
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          ) : (
            <Link
              href="/jovem/agenda"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full bg-background sm:w-auto"
              )}
            >
              Ver na agenda
            </Link>
          )}
          {linkEditavel && (
            <EditarLinkDialog
              encontroId={proximo.id}
              linkAtual={proximo.link}
              trigger={
                <Button variant="ghost" size="sm" className="text-sm">
                  <PencilSimple size={16} aria-hidden />
                  Trocar link da chamada
                </Button>
              }
            />
          )}
        </Acoes>
      </Casca>
    );
  }

  if (concluida) {
    return (
      <Casca {...cabecalho} titulo="Sua jornada">
        <p className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Sparkle size={22} weight="fill" aria-hidden />
          Jornada concluída
        </p>
        <p className="mt-1 text-sm">
          Parabéns, {primeiroNome}! Você chegou ao fim do ciclo.
        </p>
      </Casca>
    );
  }

  if (agendar) {
    return (
      <Casca {...cabecalho} titulo="Seu próximo encontro">
        <p className="mt-2 text-xl font-semibold tracking-tight text-balance">
          O {agendar.numero}º encontro ainda não tem data
        </p>
        <p className="mt-1 text-sm">Escolham juntos o dia e a hora.</p>
        <Acoes>
          <JovemAgendarDialog
            duplaId={agendar.duplaId}
            numero={agendar.numero}
            atual={null}
            trigger={
              <Button size="lg" className="w-full sm:w-auto">
                Agendar o {agendar.numero}º encontro
              </Button>
            }
          />
        </Acoes>
      </Casca>
    );
  }

  if (emCurso) {
    return (
      <Casca {...cabecalho} titulo="Seu próximo encontro">
        <p className="mt-2 text-xl font-semibold tracking-tight text-balance">
          Nenhum encontro marcado
        </p>
        <p className="mt-1 text-sm">
          Combinem o próximo pelo papo ou pelo WhatsApp.
        </p>
        <Acoes>
          <Link
            href="/jovem/agenda"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full bg-background sm:w-auto"
            )}
          >
            Ver na agenda
          </Link>
        </Acoes>
      </Casca>
    );
  }

  return (
    <Casca {...cabecalho} titulo="Seu próximo encontro">
      <p className="mt-2 text-xl font-semibold tracking-tight text-balance">
        Sua mentoria começa em breve
      </p>
      <p className="mt-1 text-sm">
        Quando a sua dupla estiver formada, o próximo encontro aparece aqui.
      </p>
    </Casca>
  );
}

function Casca({
  titulo,
  style,
  children,
}: {
  titulo: string;
  style: CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="proximo-titulo"
      style={style}
      className="animate-enter rounded-xl border border-[var(--destaque-borda)] bg-[var(--destaque-suave)] p-5 text-foreground sm:p-6"
    >
      <h2
        id="proximo-titulo"
        className="text-xs font-semibold uppercase tracking-[0.08em]"
      >
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Acoes({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>
  );
}

/** "hoje, 19h" no dia; "terça, 27/10, 19h" nos demais. Hora cheia sem minutos. */
function quandoCurto(iso: string, eHoje: boolean): string {
  const hora =
    formatDiaHora(iso)
      .split("às ")[1]
      ?.trim()
      .replace(/:00$/, "h")
      .replace(":", "h") ?? "";
  if (eHoje) return `hoje, ${hora}`;
  const dia = formatDiaSemana(iso).replace("-feira", "");
  return [dia, formatDiaMes(iso).slice(0, 5), hora].filter(Boolean).join(", ");
}
