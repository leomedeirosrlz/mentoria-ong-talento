"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  CheckCircle,
  CircleNotch,
  EnvelopeSimple,
  MinusCircle,
  PaperPlaneTilt,
  Warning,
  WarningCircle,
  WhatsappLogo,
} from "@phosphor-icons/react";
import {
  enviarInstrumentoLote,
  type LoteInstrumentoLinha,
} from "@/lib/actions-email";
import { waLink } from "@/lib/ciclo";
import {
  INSTRUMENTO_INFO,
  type InstrumentoSistema,
} from "@/lib/forms/schema";
import { DestinoCheckRow } from "@/components/forms/destino-check-row";
import { CopiarLink } from "@/components/forms/copiar-link";
import { msgLinkWhatsApp } from "@/components/forms/link-shared";
import { useOrigem } from "@/components/forms/use-origem";
import { fade, T } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// REALIZA-51 — "Enviar em lote" no painel da jornada (/materiais): a coord
// seleciona as duplas pendentes da estação, confirma e o relatório por
// linha mostra o que saiu — e-mail pro jovem (ou repasse pelo mentor,
// quando ele não tem e-mail cadastrado — decisão da issue). Nas linhas
// não-enviadas o deep link do WhatsApp é o caminho manual, mesmo padrão
// da ficha da dupla.

/** Dupla elegível do painel — nomes já vêm da linha; e-mail/whatsapp do
 *  destinatário não atravessam pelas PROPS (revisão de segurança): aqui
 *  só os flags que montam a prévia "quem recebe". O retorno da server
 *  action, esse sim, traz `waFone`/token no relatório por linha — ok
 *  porque o componente é coord-only. */
export type DuplaLote = {
  duplaId: string;
  jovemNome: string;
  mentorNome: string;
  jovemTemEmail: boolean;
  mentorTemEmail: boolean;
};

function destinoDe(d: DuplaLote): "jovem" | "mentor" | "nenhum" {
  if (d.jovemTemEmail) return "jovem";
  if (d.mentorTemEmail) return "mentor";
  return "nenhum";
}

const DESTINO_DETALHE: Record<ReturnType<typeof destinoDe>, string> = {
  jovem: "e-mail do jovem",
  mentor: "repassa pelo mentor",
  nenhum: "sem e-mail: WhatsApp",
};

export function EnviarInstrumentoLote({
  sistema,
  estacaoTitulo,
  linhas,
  envioLiberado,
  contador,
}: {
  sistema: InstrumentoSistema;
  /** Nome da estação do painel ("Visão", "Roda formal") — o cabeçalho diz
   *  o que está sendo disparado; o e-mail leva o título oficial do form. */
  estacaoTitulo: string;
  linhas: DuplaLote[];
  envioLiberado: boolean;
  /** Contagem de elegíveis no gatilho ("Enviar em lote · N") — o icard do
   *  v5c traz o número de cara; sem ele o gatilho fica só o rótulo. */
  contador?: number;
}) {
  const uid = useId();
  const listaId = `${uid}-duplas`;
  const router = useRouter();
  const origem = useOrigem();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(
    () => new Set(linhas.map((l) => l.duplaId))
  );
  const [report, setReport] = useState<LoteInstrumentoLinha[] | null>(null);
  const [pending, start] = useTransition();

  const instrumento = INSTRUMENTO_INFO[sistema].titulo;
  const porDupla = useMemo(
    () => new Map(linhas.map((l) => [l.duplaId, l])),
    [linhas]
  );

  const selecionadas = linhas.filter((l) => sel.has(l.duplaId));
  const nJovem = selecionadas.filter((d) => destinoDe(d) === "jovem").length;
  const nMentor = selecionadas.filter((d) => destinoDe(d) === "mentor").length;
  const nNenhum = selecionadas.length - nJovem - nMentor;
  const nFalhas =
    report?.filter((l) => l.status === "falha").length ?? 0;

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function disparar(alvo?: string[]) {
    const duplaIds = alvo ?? selecionadas.map((l) => l.duplaId);
    if (!duplaIds.length) return;
    start(async () => {
      let r;
      try {
        r = await enviarInstrumentoLote({ sistema, duplaIds });
      } catch {
        toast.error("Sem conexão. Tente de novo.");
        return;
      }
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      // retry parcial: funde o resultado novo nas linhas antigas
      setReport((prev) =>
        prev && alvo
          ? prev.map((l) => r.linhas.find((n) => n.duplaId === l.duplaId) ?? l)
          : r.linhas
      );
      if (!r.envioLiberado) {
        toast.info(
          "Links emitidos. O envio de e-mail está desligado neste ambiente."
        );
      } else if (r.enviados > 0) {
        toast.success(
          `${r.enviados} ${r.enviados === 1 ? "e-mail enviado" : "e-mails enviados"}.`
        );
      }
      router.refresh();
    });
  }

  function aoAbrir(o: boolean) {
    setOpen(o);
    if (o) {
      setReport(null);
      setSel(new Set(linhas.map((l) => l.duplaId)));
    }
  }

  const waDe = (l: LoteInstrumentoLinha) =>
    l.waFone && l.token
      ? waLink(
          l.waFone,
          msgLinkWhatsApp(instrumento, l.waNome, l.token, origem)
        )
      : null;

  return (
    <Dialog open={open} onOpenChange={aoAbrir}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <PaperPlaneTilt aria-hidden />
            Enviar em lote
            {contador != null && (
              <span className="tabular-nums"> · {contador}</span>
            )}
          </Button>
        }
      />
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>Enviar “{estacaoTitulo}” em lote</DialogTitle>
          <DialogDescription>
            O link do instrumento sai por e-mail pro jovem. Quem não tem
            e-mail cadastrado recebe pelo mentor.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait" initial={false}>
          {report ? (
            <motion.div
              key="relatorio"
              {...fade}
              transition={T.enter}
              className="space-y-3"
              role="status"
            >
              <ResumoRelatorio linhas={report} />
              <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto">
                {report.map((l) => {
                  const d = porDupla.get(l.duplaId);
                  const wa = waDe(l);
                  return (
                    <li
                      key={l.duplaId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2"
                    >
                      <StatusIcon status={l.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {d?.jovemNome ?? "Jovem"}
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            mentor {d?.mentorNome ?? "—"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {l.status === "enviado"
                            ? l.via === "mentor"
                              ? "e-mail enviado pelo mentor"
                              : "e-mail enviado pro jovem"
                            : l.motivo}
                          {l.reutilizado && " · link reaproveitado"}
                        </p>
                      </div>
                      {l.status !== "enviado" && l.status !== "simulado" && (
                        <span className="flex items-center gap-1.5">
                          {wa && (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
                            >
                              <WhatsappLogo size={13} aria-hidden />
                              WhatsApp
                            </a>
                          )}
                          {l.token && <CopiarLink token={l.token} />}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <DialogFooter showCloseButton>
                {nFalhas > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      disparar(
                        report
                          .filter((l) => l.status === "falha")
                          .map((l) => l.duplaId)
                      )
                    }
                  >
                    {pending && (
                      <CircleNotch className="animate-spin" aria-hidden />
                    )}
                    Tentar de novo nas falhas
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReport(null)}
                >
                  Voltar à seleção
                </Button>
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.div
              key="selecao"
              {...fade}
              transition={T.enter}
              className="space-y-4"
            >
              {!envioLiberado && (
                <p className="flex items-start gap-2 rounded-lg bg-[var(--warn)]/10 px-3 py-2 text-xs leading-relaxed text-[var(--warn-text)]">
                  <Warning size={14} weight="fill" aria-hidden className="mt-0.5 shrink-0" />
                  O envio de e-mail está desligado neste ambiente. Os links
                  são emitidos do mesmo jeito e o relatório deixa o WhatsApp
                  de cada um pronto pra mandar à mão.
                </p>
              )}

              <fieldset>
                <legend
                  id={listaId}
                  className="mb-1.5 flex w-full items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Duplas ({selecionadas.length} de {linhas.length})
                  <button
                    type="button"
                    className="font-normal normal-case tracking-normal underline underline-offset-2 hover:text-foreground"
                    onClick={() =>
                      setSel(
                        sel.size === linhas.length
                          ? new Set()
                          : new Set(linhas.map((l) => l.duplaId))
                      )
                    }
                  >
                    {sel.size === linhas.length
                      ? "Desmarcar todas"
                      : "Selecionar todas"}
                  </button>
                </legend>
                <ul
                  aria-labelledby={listaId}
                  className="max-h-56 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border/60"
                >
                  {linhas.map((d) => (
                    <li key={d.duplaId}>
                      <DestinoCheckRow
                        nome={d.jovemNome}
                        detalhe={`mentor ${d.mentorNome.split(" ")[0]} · ${DESTINO_DETALHE[destinoDe(d)]}`}
                        checked={sel.has(d.duplaId)}
                        onToggle={() => toggle(d.duplaId)}
                      />
                    </li>
                  ))}
                </ul>
              </fieldset>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {nJovem > 0 && (
                  <>
                    <strong className="font-semibold text-foreground">
                      {nJovem}
                    </strong>{" "}
                    {nJovem === 1 ? "vai" : "vão"} direto pro jovem
                  </>
                )}
                {nMentor > 0 && (
                  <>
                    {nJovem > 0 ? " · " : ""}
                    <strong className="font-semibold text-foreground">
                      {nMentor}
                    </strong>{" "}
                    {nMentor === 1 ? "cai" : "caem"} pro mentor repassar
                  </>
                )}
                {nNenhum > 0 && (
                  <>
                    {nJovem + nMentor > 0 ? " · " : ""}
                    <strong className="font-semibold text-foreground">
                      {nNenhum}
                    </strong>{" "}
                    sem e-mail nenhum: {nNenhum === 1 ? "sai" : "saem"} pra
                    WhatsApp manual
                  </>
                )}
                .
              </p>

              <details className="group">
                <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground underline-offset-2 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                  Prévia do e-mail
                </summary>
                <div className="mt-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-xs leading-relaxed">
                  <p className="font-semibold">
                    {instrumento}: chegou a sua vez na jornada
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    “Oi, Ana! Chegou a sua vez de responder{" "}
                    <strong>{instrumento}</strong>, um exercício da sua
                    jornada de mentoria. Responda no seu tempo, direto pelo
                    botão, sem senha nem cadastro.” + o link pessoal.
                  </p>
                </div>
              </details>

              <DialogFooter>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => disparar()}
                  disabled={pending || selecionadas.length === 0}
                >
                  {pending ? (
                    <CircleNotch className="animate-spin" aria-hidden />
                  ) : (
                    <EnvelopeSimple aria-hidden />
                  )}
                  {envioLiberado
                    ? selecionadas.length
                      ? `Enviar ${selecionadas.length} ${
                          selecionadas.length === 1 ? "e-mail" : "e-mails"
                        }`
                      : "Selecione as duplas"
                    : selecionadas.length
                      ? `Emitir ${selecionadas.length} ${
                          selecionadas.length === 1 ? "link" : "links"
                        }`
                      : "Selecione as duplas"}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function StatusIcon({ status }: { status: LoteInstrumentoLinha["status"] }) {
  const Icon =
    status === "enviado"
      ? CheckCircle
      : status === "falha"
        ? WarningCircle
        : MinusCircle;
  const cor =
    status === "enviado"
      ? "text-[var(--ok-text)]"
      : status === "falha"
        ? "text-[var(--warn-text)]"
        : "text-muted-foreground";
  return <Icon size={16} weight="fill" aria-hidden className={cor} />;
}

function ResumoRelatorio({ linhas }: { linhas: LoteInstrumentoLinha[] }) {
  const enviados = linhas.filter((l) => l.status === "enviado").length;
  const desligado = linhas.filter(
    (l) => l.status === "envio_desligado"
  ).length;
  const falhas = linhas.filter((l) => l.status === "falha").length;
  const pulados = linhas.filter((l) => l.status === "pulado").length;
  const simulados = linhas.filter((l) => l.status === "simulado").length;
  const partes = [
    enviados > 0 &&
      `${enviados} ${enviados === 1 ? "e-mail enviado" : "e-mails enviados"}`,
    desligado > 0 &&
      `${desligado} ${desligado === 1 ? "link emitido" : "links emitidos"} (envio desligado)`,
    falhas > 0 && `${falhas} ${falhas === 1 ? "falhou" : "falharam"}`,
    pulados > 0 &&
      `${pulados} ${pulados === 1 ? "pulada" : "puladas"}`,
    simulados > 0 && `${simulados} simuladas (demonstração)`,
  ].filter(Boolean);
  return (
    <p className="text-sm">
      <strong className="font-semibold">{partes.join(" · ")}.</strong>
      {linhas.some((l) => l.token) && (
        <span className="mt-1 block text-xs text-muted-foreground">
          Nas linhas sem e-mail o link já está emitido: mande pelo WhatsApp
          ou copie o endereço.
        </span>
      )}
    </p>
  );
}
