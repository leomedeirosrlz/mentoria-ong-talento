"use client";

// O gesto da linha de encontro do jovem (530): UMA ação decisiva à vista e
// o resto no ⋯ — a fileira de botões soltos virava sopa (até 5 na linha do
// agendado futuro). As réguas são as mesmas de sempre: Entrar só na janela
// da chamada (QW5), remarcar/editar link DPP-only (0072 — a RPC recusa a
// trilha de especialista), o trio do vencido com dupla viva (507) e
// corrigir/desfazer no retroativo que ele mesmo criou (0207). O "Aconteceu"
// some no passo de encerramento — o fecho é do mentor.
//
// Os dialogs ficam fora do popup, controlados por um estado só — fechar o
// menu não os desmonta e o foco volta pro ⋯ (padrão do DuplaLinhaMenu). O
// que fica à vista abre o próprio dialog pelo trigger (modo interno); o
// que vai pro menu rende com trigger=null + open controlado. Com zero ação
// rende nada (a linha cai no badge de status); com uma só, ela fica à
// vista sem ⋯.

import { useState } from "react";
import {
  ArrowCounterClockwise,
  CalendarDots,
  CalendarX,
  ClockCounterClockwise,
  PencilSimple,
  VideoCamera,
  XCircle,
} from "@phosphor-icons/react";
import { linkSeguro, maxEncontros, podeEntrarAgora } from "@/lib/ciclo";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { AcoesMenu, type AcaoMenuItem } from "@/components/acoes-menu";
import { EditarLinkDialog } from "@/components/editar-link-dialog";
import { JovemAgendarDialog } from "@/components/jovem-agendar-dialog";
import { JovemRetroativoDialog } from "@/components/jovem-retroativo-dialog";
import {
  AconteceuJovem,
  DesmarcarEncontroJovem,
  DesfazerRetroativoJovem,
  NaoAconteceuJovem,
} from "@/components/jovem-encontro-acoes";
import type { SeletorSugestoes } from "@/components/seletor-dia-hora";
import { Button, buttonVariants } from "@/components/ui/button";

// tamanho e cor explícitos — alinha o texto do item com o da linha (mesma
// norma do ICONE do ⋯ da dupla)
const ICONE = "size-4 shrink-0 text-muted-foreground";

type DialogId = "remarcar" | "corrigir" | "link" | "desmarcar" | "nao" | "desfazer";

export function EncontroLinhaAcoes({
  e,
  agora,
  duplaAtiva = false,
  trilha = "dpp",
  meId = null,
  futuro = false,
  sugestoes = null,
}: {
  e: JovemEncontro;
  /** ms do render da página — o "futuro" do gesto é o da listagem; a RPC
   *  reavalia o instante real de qualquer jeito */
  agora: number;
  /** As RPCs do jovem exigem dupla ativa — sem ela o gesto não renderiza
   *  (botão que falha é promessa quebrada). */
  duplaAtiva?: boolean;
  /** agendar_encontro_mentorado é DPP-only: na trilha de especialista quem
   *  marca é o especialista — remarcar/editar link não renderizam. */
  trilha?: string;
  /** profile do jovem logado — casa com created_by pra liberar Corrigir/
   *  Desfazer no retroativo criado por ele (0207). */
  meId?: string | null;
  /** Linha da seção "Próximos" — os âncoras de chamada (Entrar / Link da
   *  chamada) só existem ali; no histórico o link não vira gesto. */
  futuro?: boolean;
  /** Pacote do motor de sugestões — o remarcar do DPP ganha chips de
   *  dia/hora quando vem. */
  sugestoes?: SeletorSugestoes | null;
}) {
  const [dialog, setDialog] = useState<DialogId | null>(null);

  const esp = trilha === "especialista";
  const link = linkSeguro(e.link);
  // agendado futuro = remarcar/desmarcar/editar link (0072). Só status
  // 'agendado' — é o único que as RPCs movem (remarcado recusaria)
  const agendadoFuturo =
    e.status === "agendado" &&
    duplaAtiva &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() > agora;
  // agendado com o horário vencido vira pendência, não plano — com a dupla
  // viva mora aqui o trio da seção do topo (507)
  const vencido =
    e.status === "agendado" &&
    duplaAtiva &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() <= agora;
  // retroativo do jovem (0207): o realizado que ELE criou é corrigível e
  // desfazível enquanto o mentor não registra — affordance por autoria
  const retroDele =
    e.status === "realizado" &&
    duplaAtiva &&
    !esp &&
    meId != null &&
    e.created_by === meId;
  // último passo do ciclo: o "Aconteceu" some — o fecho é do mentor
  const encerramento =
    e.numero >= maxEncontros(esp ? "especialista" : "dpp");
  // janela da chamada (QW5): 30 min antes até 2 h depois — dentro dela
  // Entrar é a decisiva; fora o link vira item discreto do ⋯
  const naJanela =
    futuro && link != null && podeEntrarAgora(e.data_hora, agora);

  // inventário do que o estado sustenta — um flag por gesto
  const tem = {
    entrar: naJanela,
    chamada: futuro && link != null && !naJanela,
    editarLink: agendadoFuturo && !esp,
    remarcar: !esp && (agendadoFuturo || vencido),
    corrigir: retroDele,
    desfazer: retroDele,
    desmarcar: agendadoFuturo,
    nao: vencido,
    aconteceu: vencido && !encerramento,
  };
  type AcaoId = keyof typeof tem;
  const total = Object.values(tem).filter(Boolean).length;
  if (total === 0) return null;

  // a decisiva da linha — a primeira que casa; o resto vira item do ⋯.
  // Remarcar só lidera quando nada mais urgente existe: vencido no passo
  // de encerramento (sem Aconteceu) ou agendado futuro sem link — com
  // link fora da janela a chamada já é item do menu e nada é decisivo
  const primaria: AcaoId | null = tem.entrar
    ? "entrar"
    : tem.aconteceu
      ? "aconteceu"
      : vencido && tem.remarcar
        ? "remarcar"
        : agendadoFuturo && link == null && tem.remarcar
          ? "remarcar"
          : tem.corrigir
            ? "corrigir"
            : null;
  // ação única fica solta à vista — sem primária nem ⋯
  const unica: AcaoId | null =
    total === 1
      ? ((Object.keys(tem) as AcaoId[]).find((k) => tem[k]) ?? null)
      : null;
  const aVista = unica ?? primaria;

  // ⋯ na ordem da fileira que substitui: editar link → link da chamada →
  // remarcar → corrigir → desfazer → desmarcar → não aconteceu
  const itens: AcaoMenuItem[] = [];
  if (tem.editarLink && aVista !== "editarLink")
    itens.push({
      id: "editar-link",
      rotulo: "Editar link da chamada",
      icone: <PencilSimple aria-hidden className={ICONE} />,
      onEscolher: () => setDialog("link"),
    });
  if (tem.chamada && aVista !== "chamada")
    itens.push({
      id: "chamada",
      rotulo: "Link da chamada",
      icone: <VideoCamera aria-hidden className={ICONE} />,
      href: link!,
    });
  if (tem.remarcar && aVista !== "remarcar")
    itens.push({
      id: "remarcar",
      rotulo: "Remarcar",
      icone: <CalendarDots aria-hidden className={ICONE} />,
      onEscolher: () => setDialog("remarcar"),
    });
  if (tem.corrigir && aVista !== "corrigir")
    itens.push({
      id: "corrigir",
      rotulo: "Corrigir",
      icone: <ClockCounterClockwise aria-hidden className={ICONE} />,
      onEscolher: () => setDialog("corrigir"),
    });
  if (tem.desfazer && aVista !== "desfazer")
    itens.push({
      id: "desfazer",
      rotulo: "Desfazer",
      icone: <ArrowCounterClockwise aria-hidden className={ICONE} />,
      onEscolher: () => setDialog("desfazer"),
    });
  if (tem.desmarcar && aVista !== "desmarcar")
    itens.push({
      id: "desmarcar",
      rotulo: "Desmarcar",
      icone: <CalendarX aria-hidden className={ICONE} />,
      onEscolher: () => setDialog("desmarcar"),
    });
  if (tem.nao && aVista !== "nao")
    itens.push({
      id: "nao",
      rotulo: "Não aconteceu",
      icone: <XCircle aria-hidden className={ICONE} />,
      onEscolher: () => setDialog("nao"),
    });

  // trigger=null + open controlado quando o gesto mora no ⋯; à vista o
  // próprio trigger do dialog abre (estado interno, sem `dialog`)
  const aberto = (id: DialogId) => dialog === id;
  const aoMudar = (id: DialogId) => (o: boolean) => setDialog(o ? id : null);

  return (
    <>
      {aVista === "entrar" && (
        <a
          href={link!}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          <VideoCamera size={15} aria-hidden />
          Entrar
          <span className="sr-only"> na chamada (abre em nova aba)</span>
        </a>
      )}
      {aVista === "chamada" && (
        <a
          href={link!}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <VideoCamera size={15} aria-hidden />
          Link da chamada
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      )}
      {aVista === "aconteceu" && (
        <AconteceuJovem encontroId={e.id} variant="outline" />
      )}
      {tem.editarLink && (
        <EditarLinkDialog
          encontroId={e.id}
          linkAtual={e.link}
          trigger={aVista === "editarLink" ? undefined : null}
          open={aVista === "editarLink" ? undefined : aberto("link")}
          onOpenChange={aVista === "editarLink" ? undefined : aoMudar("link")}
        />
      )}
      {tem.remarcar && (
        <JovemAgendarDialog
          duplaId={e.dupla_id}
          numero={e.numero}
          atual={e}
          sugestoes={sugestoes}
          trigger={
            aVista === "remarcar" ? (
              <Button variant={vencido ? "ghost" : "outline"} size="sm">
                <CalendarDots size={15} aria-hidden />
                Remarcar
              </Button>
            ) : null
          }
          open={aVista === "remarcar" ? undefined : aberto("remarcar")}
          onOpenChange={
            aVista === "remarcar" ? undefined : aoMudar("remarcar")
          }
        />
      )}
      {tem.corrigir && (
        <JovemRetroativoDialog
          duplaId={e.dupla_id}
          atual={e}
          trigger={
            aVista === "corrigir" ? (
              <Button variant="ghost" size="sm">
                Corrigir
              </Button>
            ) : null
          }
          open={aVista === "corrigir" ? undefined : aberto("corrigir")}
          onOpenChange={
            aVista === "corrigir" ? undefined : aoMudar("corrigir")
          }
        />
      )}
      {tem.desfazer && (
        <DesfazerRetroativoJovem
          encontroId={e.id}
          trigger={aVista === "desfazer" ? undefined : null}
          open={aVista === "desfazer" ? undefined : aberto("desfazer")}
          onOpenChange={
            aVista === "desfazer" ? undefined : aoMudar("desfazer")
          }
        />
      )}
      {tem.desmarcar && (
        <DesmarcarEncontroJovem
          encontroId={e.id}
          trigger={aVista === "desmarcar" ? undefined : null}
          open={aVista === "desmarcar" ? undefined : aberto("desmarcar")}
          onOpenChange={
            aVista === "desmarcar" ? undefined : aoMudar("desmarcar")
          }
        />
      )}
      {tem.nao && (
        <NaoAconteceuJovem
          encontroId={e.id}
          trigger={aVista === "nao" ? undefined : null}
          open={aVista === "nao" ? undefined : aberto("nao")}
          onOpenChange={aVista === "nao" ? undefined : aoMudar("nao")}
        />
      )}
      <AcoesMenu itens={itens} label="Ações do encontro" />
    </>
  );
}
