import {
  CalendarBlank,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import {
  VerAvaliacaoButton,
  type AvaliacaoFeita,
} from "@/components/jovem-avaliacoes";
import { EncontroLinhaAcoes } from "@/components/jovem-encontro-acoes-menu";
import type { SeletorSugestoes } from "@/components/seletor-dia-hora";
import { Estrelas } from "@/components/estrelas";
import { formatDateTime } from "@/lib/ciclo";
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
  sugestoes = null,
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
  /** Pacote do motor — vai pro remarcar do DPP (chips de dia/hora). Só a
   *  dupla DPP ativa tem pacote; as demais linhas recebem null. */
  sugestoes?: SeletorSugestoes | null;
}) {
  const st = STATUS[e.status];
  const quando = e.status === "realizado" && e.realizado_em ? e.realizado_em : e.data_hora;
  // "agendado" com o horário vencido não é mais um plano — é uma pendência.
  // Com a dupla viva o trio da seção do topo mora no EncontroLinhaAcoes
  // (507); sem ela fica a pergunta do badge, como status
  const passadoSemDesfecho =
    e.status === "agendado" &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() <= agora;
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-2.5 sm:px-5">
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
      {/* o ⋯ e o status sobem pro topo à direita no celular (mesma norma
          do card da dupla): a linha própria com ps-12 deixava o botão
          solto no meio do card. Em sm+ a fileira volta a crescer à
          direita, alinhada ao texto */}
      <div className="order-2 ml-auto flex flex-wrap items-start justify-end gap-2 sm:order-none sm:items-center">
        {aval && (
          <VerAvaliacaoButton
            quiet
            avaliacao={aval}
            temMedia={temMedia}
            label={<Estrelas n={aval.estrelas} size={13} />}
          />
        )}
        {/* 530: uma decisiva à vista + ⋯ — EncontroLinhaAcoes carrega as
            mesmas réguas dos botões que a fileira tinha soltos (janela do
            Entrar, DPP-only do remarcar/editar link, trio do vencido,
            retroativo dele). Sem gesto rende nada e sobra o status */}
        <EncontroLinhaAcoes
          e={e}
          agora={agora}
          duplaAtiva={duplaAtiva}
          trilha={trilha}
          meId={meId}
          futuro={futuro}
          sugestoes={sugestoes}
        />
        {/* 507: sem a dupla viva o gesto não se sustenta — a pergunta do
            badge vira o status. O realizado não carimba "Aconteceu" de
            novo e os demais seguem a tabela de status */}
        {e.status === "realizado" ? null : passadoSemDesfecho &&
          !duplaAtiva ? (
          <Badge
            variant="outline"
            className="border-[var(--warn)]/50 text-[var(--warn-text)]"
          >
            Aconteceu?
          </Badge>
        ) : passadoSemDesfecho ? null : (
          <Badge variant="outline" className={st.cls}>
            {st.rotulo}
          </Badge>
        )}
      </div>
    </div>
  );
}
