"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  BookOpen,
  CircleNotch,
  Eye,
  ListChecks,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { enviarInstrumentoMentorado } from "@/lib/actions-formularios";
import {
  INSTRUMENTO_INFO,
  INSTRUMENTOS_DUPLA_SISTEMA,
  type InstrumentoDuplaSistema,
  type RespostaValor,
} from "@/lib/forms/schema";
import type {
  InstrumentoDupla,
  InstrumentoEntrega,
} from "@/lib/forms/queries";
import { parChecklist, parRoda } from "@/lib/jornada";
import { formatDate } from "@/lib/ciclo";
import { docDoSistema, GUIA_ENCONTRO } from "@/lib/como-conduzir";
import {
  ehInstrumentoChave,
  InstrumentoEmblema,
} from "@/components/instrumento-icone";
import { InstrumentoResultado } from "@/components/instrumento-resultado";
import { CopiarLink } from "@/components/forms/copiar-link";
import { msgLinkWhatsApp } from "@/components/forms/link-shared";
import { useOrigem } from "@/components/forms/use-origem";
import { NudgeButton } from "@/components/nudge-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fade, T } from "@/components/motion";
import { cn } from "@/lib/utils";

// Seção "Instrumentos" da ficha da dupla (0080) — os quatro instrumentos
// oficiais da jornada DPP com status por entrega: não enviado → "Enviar"
// (o mentor entrega — emitir_link_instrumento no banco), pendente → copiar
// /mandar de novo, respondido → "Ver resultado" abre a leitura estruturada
// (a roda desenhada, as metas com IS/prazo, a declaração de visão).

/** WP7/REALIZA-202 — chip da janela + "Como conduzir" vêm de
 *  `@/lib/como-conduzir` (módulo único compartilhado com a agenda do
 *  mentor, o detalhe do encontro, os grupos de /materiais e o card da
 *  semana da coordenação). O chip diz QUANDO entra; o "Como conduzir"
 *  diz como o mentor usa — nenhum dos dois muda o fluxo de envio. */

/** O estado que a ficha mostra: respondido ganha sempre (a resposta é o
 *  produto); depois pendente (tem link vivo pra mandar); expirado e "não
 *  enviado" pedem o botão de envio. */
function estadoAtual(entregas: InstrumentoEntrega[]): {
  status: "respondido" | "pendente" | "expirado" | "nao_enviado";
  entrega: InstrumentoEntrega | null;
} {
  const respondidas = entregas
    .filter((e) => e.status === "respondido")
    .sort((a, b) =>
      (b.respondido_em ?? "").localeCompare(a.respondido_em ?? "")
    );
  if (respondidas.length)
    return { status: "respondido", entrega: respondidas[0] };
  const pendente = entregas.find((e) => e.status === "pendente");
  if (pendente) return { status: "pendente", entrega: pendente };
  if (entregas.length) return { status: "expirado", entrega: null };
  return { status: "nao_enviado", entrega: null };
}

function LinhaInstrumento({
  item,
  sistema: sistemaEsperado,
  duplaId,
  mentoradoNome,
  mentoradoWhatsapp,
  mentorNome,
  mentorWhatsapp,
  podeEnviar,
  jornadaViva,
  remetenteMentorNome,
  rodaPar,
  checklistPar,
}: {
  /** null quando o instrumento ainda não foi semeado no banco — a linha
   *  existe pra jornada completa aparecer, mas sem ação */
  item: InstrumentoDupla | null;
  /** a chave da régua — cobre o item não-semeado (o guia e o doc do
   *  instrumento existem independente da semente). */
  sistema: InstrumentoDuplaSistema;
  duplaId: string;
  mentoradoNome: string;
  mentoradoWhatsapp: string | null;
  /** destinatário do checklist de competências (0190) — o mentor */
  mentorNome: string;
  mentorWhatsapp: string | null;
  podeEnviar: boolean;
  /** ativa|pausada — dupla fechada esconde TODAS as ações de link pra
   *  qualquer papel (Copiar/WhatsApp/Gerar): o link que o jovem já tem
   *  segue respondível, mas ninguém emite nem reenvia. */
  jornadaViva: boolean;
  /** Quando quem vê é o mentor: a msg do link sai na voz dele ("seu
   *  mentor"), não "a equipe" — o texto vai do número dele. */
  remetenteMentorNome?: string;
  /** pares antes × depois já derivados das entregas (REALIZA-18 / -359) */
  rodaPar: ReturnType<typeof parRoda<InstrumentoEntrega>>;
  checklistPar: ReturnType<typeof parChecklist<InstrumentoEntrega>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enviado, setEnviado] = useState<string | null>(null);
  const origem = useOrigem();

  const sistema = (item?.sistema ?? sistemaEsperado) as InstrumentoDuplaSistema;
  const info = sistema ? INSTRUMENTO_INFO[sistema] : null;
  const titulo = item?.titulo ?? info?.titulo ?? "Instrumento";

  // estado local pós-envio (a RPC já gravou; o refresh traz o resto)
  const { status, entrega } = enviado
    ? { status: "pendente" as const, entrega: null }
    : estadoAtual(item?.entregas ?? []);
  const tokenVivo = enviado ?? (status === "pendente" ? entrega?.token : null);

  // o checklist vai pro mentor; os 4 de jornada, pro mentorado — destino
  // por sistema, não por linha (o whatsapp e o nome da msg acompanham)
  const destNome =
    sistema === "competencias_mentor" ? mentorNome : mentoradoNome;
  const destWhatsapp =
    sistema === "competencias_mentor" ? mentorWhatsapp : mentoradoWhatsapp;

  // payload do momento anterior pra leitura comparada — só quando a
  // entrega exibida é a ponta do fim (a inicial sozinha não compara)
  const respostasAnterior: Record<string, RespostaValor> | null =
    sistema === "roda_vida" && entrega?.link_id === rodaPar.formal?.link_id
      ? (rodaPar.inicial?.respostas ?? null)
      : sistema === "competencias_mentor" &&
          entrega?.link_id === checklistPar.final?.link_id
        ? (checklistPar.inicio?.respostas ?? null)
        : null;

  function enviar() {
    if (!sistema) return;
    start(async () => {
      let r;
      try {
        r = await enviarInstrumentoMentorado(duplaId, sistema);
      } catch {
        toast.error("Sem conexão. Tente de novo.");
        return;
      }
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setEnviado(r.token);
      toast.success(
        r.reutilizado
          ? "Este link já estava pendente. Reaproveitado."
          : "Link gerado. Copie ou envie pelo WhatsApp."
      );
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      {/* emblema + texto na coluna, ações embaixo na largura toda — a faixa
          sm–lg como linha deixava os botões roubando metade do texto e um
          vazio sob eles (REALIZA-253). O símbolo do instrumento
          (formularios.md item 2) é o mesmo da régua e da prateleira */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {sistema && ehInstrumentoChave(sistema) ? (
          <InstrumentoEmblema instrumento={sistema} size={36} />
        ) : (
          // item ainda não semeado (sistema null) ou valor novo do banco —
          // o fallback neutro da prateleira, nunca quebra a linha
          <span className="grid size-9 shrink-0 place-items-center rounded-[28%] bg-muted text-muted-foreground">
            <ListChecks size={18} aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{titulo}</p>
            {sistema && (
              <Badge variant="outline" className="font-normal">
                {GUIA_ENCONTRO[sistema].chip}
              </Badge>
            )}
            {status === "respondido" && (
              <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
                respondido
              </Badge>
            )}
            {status === "pendente" && (
              <Badge className="bg-[var(--warn)]/15 text-[var(--warn-text)]">
                link enviado
              </Badge>
            )}
            {status === "expirado" && (
              <Badge variant="secondary">link expirado</Badge>
            )}
          </div>
          {info && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {info.resumo}
            </p>
          )}
          {sistema && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <details className="group">
                <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground underline-offset-2 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                  Como conduzir
                </summary>
                <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
                  {GUIA_ENCONTRO[sistema].conduzir}
                </p>
              </details>
              {/* ponte instrumento → doc (REALIZA-386): o guia nativo; o
                  ?dupla= faz o "Abrir instrumento" do doc voltar pra cá */}
              <Link
                href={`/materiais/documento/${docDoSistema(sistema)}?dupla=${duplaId}`}
                prefetch={false}
                className="inline-flex min-h-8 items-center gap-1 rounded-md text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BookOpen size={12} aria-hidden />
                Ler o guia
              </Link>
            </div>
          )}
          {status === "respondido" && entrega?.respondido_em && (
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              Respondido em {formatDate(entrega.respondido_em)}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {status === "respondido" && item && entrega?.respostas && (
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm">
                  <Eye aria-hidden />
                  Ver resultado
                </Button>
              }
            />
            {/* xl, não 2xl: leitura estruturada do instrumento, não prévia
                tabular; o scroll vem da base do DialogContent */}
            <DialogContent size="xl">
              <DialogHeader>
                <DialogTitle>{item.titulo}</DialogTitle>
                <DialogDescription>
                  Respondido por {destNome}
                  {entrega.respondido_em &&
                    ` em ${formatDate(entrega.respondido_em)}`}
                  .
                </DialogDescription>
              </DialogHeader>
              <InstrumentoResultado
                sistema={item.sistema}
                campos={item.campos}
                respostas={entrega.respostas}
                respostasAnterior={respostasAnterior}
              />
            </DialogContent>
          </Dialog>
        )}

        {status === "pendente" && tokenVivo && jornadaViva && (
          <motion.div
            {...fade}
            transition={T.enter}
            className="flex flex-wrap items-center gap-2"
          >
            <CopiarLink token={tokenVivo} />
            <NudgeButton
              telefone={destWhatsapp}
              mensagem={msgLinkWhatsApp(
                titulo,
                destNome,
                tokenVivo,
                origem,
                // "your mentor" voice only fits the mentee — the checklist
                // goes to the mentor himself, institutional voice is right
                sistema === "competencias_mentor"
                  ? undefined
                  : remetenteMentorNome
              )}
              duplaId={duplaId}
              label="Enviar no WhatsApp"
            />
          </motion.div>
        )}

        {(status === "nao_enviado" || status === "expirado") &&
          podeEnviar &&
          jornadaViva &&
          item && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={enviar}
              disabled={pending || !item.ativo}
              title={item.ativo ? undefined : "Instrumento encerrado em Formulários"}
            >
              {pending ? (
                <CircleNotch className="animate-spin" aria-hidden />
              ) : (
                <PaperPlaneTilt aria-hidden />
              )}
              {status === "expirado" ? "Gerar novo link" : "Gerar link"}
            </Button>
          )}
      </div>
    </li>
  );
}

export function InstrumentosDupla({
  duplaId,
  itens,
  mentoradoNome,
  mentoradoWhatsapp,
  mentorNome,
  mentorWhatsapp,
  podeEnviar,
  jornadaViva,
  remetenteMentorNome,
  className,
}: {
  duplaId: string;
  /** saída da RPC instrumentos_da_dupla — um item por instrumento semeado */
  itens: InstrumentoDupla[];
  mentoradoNome: string;
  mentoradoWhatsapp: string | null;
  /** o checklist de competências responde o mentor (0190) */
  mentorNome: string;
  mentorWhatsapp: string | null;
  /** coord sempre; o mentor DPP da dupla viva também entrega (o guia é dele) */
  podeEnviar: boolean;
  /** ativa|pausada — dupla fechada vira só leitura de resultados */
  jornadaViva: boolean;
  /** Voz do link de WhatsApp: nome quando quem envia é o mentor da dupla. */
  remetenteMentorNome?: string;
  className?: string;
}) {
  if (!itens.length) return null;
  const porSistema = new Map(itens.map((i) => [i.sistema, i]));
  // os pares antes × depois derivam UMA vez das entregas já carregadas —
  // a leitura inicial da roda e a marcação de início do checklist alimentam
  // a comparação do "Ver resultado" de cada linha (REALIZA-18/-359)
  const rodaPar = parRoda(porSistema.get("roda_vida")?.entregas ?? []);
  const checklistPar = parChecklist(
    porSistema.get("competencias_mentor")?.entregas ?? []
  );
  return (
    <section
      id="instrumentos"
      className={cn(
        "scroll-mt-20 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]",
        className
      )}
    >
      <h2 className="text-base font-semibold">Instrumentos da jornada</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Os exercícios oficiais do guia: o jovem responde por link único, sem
        login, e o resultado volta estruturado aqui.
      </p>
      <ul className="mt-2 divide-y divide-border/60">
        {INSTRUMENTOS_DUPLA_SISTEMA.map((s) => (
          <LinhaInstrumento
            key={s}
            item={porSistema.get(s) ?? null}
            sistema={s}
            duplaId={duplaId}
            mentoradoNome={mentoradoNome}
            mentoradoWhatsapp={mentoradoWhatsapp}
            mentorNome={mentorNome}
            mentorWhatsapp={mentorWhatsapp}
            podeEnviar={podeEnviar}
            jornadaViva={jornadaViva}
            remetenteMentorNome={remetenteMentorNome}
            rodaPar={rodaPar}
            checklistPar={checklistPar}
          />
        ))}
      </ul>
    </section>
  );
}
