import {
  CalendarBlank,
  CalendarDots,
  CheckCircle,
  VideoCamera,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  VerAvaliacaoButton,
  type AvaliacaoFeita,
} from "@/components/jovem-avaliacoes";
import { JovemAgendarDialog } from "@/components/jovem-agendar-dialog";
import { JovemRetroativoDialog } from "@/components/jovem-retroativo-dialog";
import { EditarLinkDialog } from "@/components/editar-link-dialog";
import {
  AconteceuJovem,
  DesmarcarEncontroJovem,
  DesfazerRetroativoJovem,
  NaoAconteceuJovem,
} from "@/components/jovem-encontro-acoes";
import { Estrelas } from "@/components/estrelas";
import {
  formatDateTime,
  linkSeguro,
  maxEncontros,
  podeEntrarAgora,
} from "@/lib/ciclo";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { cn } from "@/lib/utils";

const STATUS = {
  agendado: { rotulo: "Agendado", cls: "border-border text-muted-foreground" },
  remarcado: {
    rotulo: "Remarcado",
    cls: "border-[var(--warn)]/50 text-[var(--warn-text)]",
  },
  realizado: {
    rotulo: "Aconteceu",
    cls: "border-[var(--ok)]/50 text-[var(--ok-text)]",
  },
  nao_aconteceu: {
    rotulo: "Não aconteceu",
    cls: "border-border text-muted-foreground",
  },
  cancelado: { rotulo: "Cancelado", cls: "border-border text-muted-foreground" },
} as const;

/** Uma linha da agenda do jovem — status + o gesto honesto pra cada fase:
 *  Entrar na janela da chamada, remarcar/desmarcar no futuro, corrigir o
 *  retroativo que ele mesmo criou. O agendado vencido com dupla ativa
 *  recebe o mesmo trio da seção "Precisa de você" (507: o badge passivo
 *  parecia ação morta) — fora dela não sobra gesto que a RPC aceitaria,
 *  então a pergunta do badge segue valendo como status. */
export function EncontroLinha({
  e,
  futuro = false,
  aval,
  agora,
  duplaAtiva = false,
  trilha = "dpp",
  rotulo,
  nota,
  meId,
  temMedia = true,
}: {
  e: JovemEncontro;
  futuro?: boolean;
  /** A avaliação que já saiu — as estrelas quietas abrem "Ver resposta".
   *  A pendente não entra: pedir avaliação é da lista "Precisa de você"
   *  (REALIZA-493), sem duplicar o gesto na linha. */
  aval?: AvaliacaoFeita | null;
  /** ms do render da página — o "futuro" do gesto é o da listagem, não o do
   *  clique; a RPC reavalia o instante real de qualquer jeito */
  agora: number;
  /** A RPC de agendar/não-aconteceu exige dupla ativa; desmarcar não checa,
   *  mas um gesto numa dupla encerrada seria ruído — os botões seguem ela. */
  duplaAtiva?: boolean;
  /** agendar_encontro_mentorado é DPP-only (0072): na trilha de especialista
   *  quem marca é o especialista — o botão de remarcar não renderiza pra não
   *   prometer um gesto que a RPC recusaria. Desmarcar/"não aconteceu" valem
   *  em qualquer trilha e seguem aparecendo. */
  trilha?: string;
  /** rótulo canônico da linha — "Sessão N com Fulana" na trilha de
   *  especialista (passo do guia, nunca a tentativa), "Nº encontro" no DPP.
   *  Distinção DPP×esp na listagem mista (0097). */
  rotulo: string;
  /** linha extra de contexto ("a sessão rolou em…") — a tentativa falha de
   *  trilha esp que a remarcação cobriu não lê como buraco no histórico. */
  nota?: string | null;
  /** profile do jovem logado — casa com created_by pra liberar Corrigir/
   *  Desfazer no retroativo criado por ele (0207). */
  meId?: string | null;
  /** a dupla já tem o lote da média (≥3 respostas) — a copy do toggle no
   *  detalhe da avaliação não promete média que não existe (027/FR-003). */
  temMedia?: boolean;
}) {
  const st = STATUS[e.status];
  const quando = e.status === "realizado" && e.realizado_em ? e.realizado_em : e.data_hora;
  // agendado futuro = remarcar/desmarcar (0072). Só status 'agendado' — é o
  // único que as RPCs movem (remarcado/legado não ganha botão: recusariam)
  const agendadoFuturo =
    e.status === "agendado" &&
    duplaAtiva &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() > agora;
  // "agendado" com o horário vencido não é mais um plano — é uma pendência.
  // Com a dupla viva o trio da seção do topo mora aqui também (507); sem
  // ela fica a pergunta do badge, como status
  const passadoSemDesfecho =
    e.status === "agendado" &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() <= agora;
  // retroativo do jovem (0207): o realizado que ELE criou é editável
  // (corrigir data) e desfazível enquanto o mentor não registra — o gate
  // de verdade mora na RPC; aqui o affordance é por autoria
  const retroDele =
    e.status === "realizado" &&
    duplaAtiva &&
    trilha !== "especialista" &&
    meId != null &&
    e.created_by === meId;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:px-5">
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          e.status === "realizado"
            ? "bg-[var(--ok)]/15 text-[var(--ok-text)]"
            : e.status === "nao_aconteceu" || e.status === "cancelado"
              ? "bg-muted text-muted-foreground"
              : "bg-[var(--role-mentorado)]/25 text-foreground"
        )}
      >
        {e.status === "realizado" ? (
          <CheckCircle size={16} aria-hidden />
        ) : e.status === "nao_aconteceu" || e.status === "cancelado" ? (
          <XCircle size={16} aria-hidden />
        ) : (
          <CalendarBlank size={16} aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-medium">{rotulo}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {quando ? formatDateTime(quando) : "data a combinar"}
        </p>
        {e.motivo_reagendamento && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Por que mudou: {e.motivo_reagendamento}
          </p>
        )}
        {nota && (
          <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>
        )}
      </div>
      {/* no celular as ações que não cabem caem numa linha própria
          alinhada no texto (ps-12 = ícone + gap) — o ms-auto sozinho
          empurrava pro canto e deixava o buraco à esquerda; badge/strela
          que ainda cabe segue na mesma linha. Em sm+ volta pra direita */}
      <div className="flex flex-wrap items-center justify-start gap-2 ps-12 sm:ms-auto sm:justify-end sm:ps-0">
        {/* Entrar é a ação decisiva só na janela da chamada (QW5: 30 min
            antes até 2 h depois — mesma régua da home e da ficha). Fora
            dela o link segue acessível, mas discreto. */}
        {futuro &&
          linkSeguro(e.link) &&
          (podeEntrarAgora(e.data_hora, agora) ? (
            <a
              href={linkSeguro(e.link)!}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              <VideoCamera size={15} aria-hidden />
              Entrar
              <span className="sr-only"> na chamada (abre em nova aba)</span>
            </a>
          ) : (
            <a
              href={linkSeguro(e.link)!}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <VideoCamera size={15} aria-hidden />
              Link da chamada
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          ))}
        {/* o lápis troca só o link e só em agendado futuro (a action roteia
            o jovem pela RPC da 0072, DPP-only — ela recusa a linha já
            vencida) */}
        {agendadoFuturo && trilha !== "especialista" && (
          <EditarLinkDialog encontroId={e.id} linkAtual={e.link} />
        )}
        {agendadoFuturo && (
          <>
            {trilha !== "especialista" && (
              <JovemAgendarDialog
                duplaId={e.dupla_id}
                numero={e.numero}
                atual={e}
                trigger={
                  <Button variant="outline" size="sm">
                    <CalendarDots size={15} aria-hidden />
                    Remarcar
                  </Button>
                }
              />
            )}
            <DesmarcarEncontroJovem encontroId={e.id} />
          </>
        )}
        {aval && (
          <VerAvaliacaoButton
            quiet
            avaliacao={aval}
            temMedia={temMedia}
            label={<Estrelas n={aval.estrelas} size={13} />}
          />
        )}
        {retroDele && (
          <>
            <JovemRetroativoDialog
              duplaId={e.dupla_id}
              atual={e}
              trigger={
                <Button variant="ghost" size="sm">
                  Corrigir
                </Button>
              }
            />
            <DesfazerRetroativoJovem encontroId={e.id} />
          </>
        )}
        {/* 507: o vencido com dupla ativa recebe aqui o trio da seção
            "Precisa de você" — mesmas RPCs e mesmos gates (o "Aconteceu"
            some no passo final, Remarcar é DPP-only). Sem a dupla viva o
            gesto não se sustenta: a pergunta do badge vira o status. O
            realizado não carimba "Aconteceu" de novo (ser o que é já
            basta) e os demais seguem a tabela de status */}
        {e.status === "realizado" ? null : passadoSemDesfecho && duplaAtiva ? (
          <>
            {e.numero <
              maxEncontros(
                trilha === "especialista" ? "especialista" : "dpp"
              ) && <AconteceuJovem encontroId={e.id} variant="outline" />}
            {trilha !== "especialista" && (
              <JovemAgendarDialog
                duplaId={e.dupla_id}
                numero={e.numero}
                atual={e}
                trigger={
                  <Button variant="ghost" size="sm">
                    <CalendarDots size={15} aria-hidden />
                    Remarcar
                  </Button>
                }
              />
            )}
            <NaoAconteceuJovem encontroId={e.id} />
          </>
        ) : passadoSemDesfecho ? (
          <Badge
            variant="outline"
            className="border-[var(--warn)]/50 text-[var(--warn-text)]"
          >
            Aconteceu?
          </Badge>
        ) : (
          <Badge variant="outline" className={st.cls}>
            {st.rotulo}
          </Badge>
        )}
      </div>
    </div>
  );
}
