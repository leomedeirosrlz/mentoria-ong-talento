"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  CircleNotch,
  Eye,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { enviarInstrumentoMentorado } from "@/lib/actions-formularios";
import {
  INSTRUMENTO_INFO,
  INSTRUMENTOS_SISTEMA,
  type InstrumentoSistema,
} from "@/lib/forms/schema";
import type {
  InstrumentoDupla,
  InstrumentoEntrega,
} from "@/lib/forms/queries";
import { formatDate } from "@/lib/ciclo";
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

/** WP7 — a janela do guia por instrumento (as mesmas âncoras de ESTACOES
 *  na lib de jornada) + a condução em uma frase. O chip diz QUANDO entra;
 *  o "Como conduzir" diz como o mentor usa — nenhum dos dois muda o fluxo
 *  de envio, que continua o mesmo. */
const GUIA_ENCONTRO: Record<
  InstrumentoSistema,
  { chip: string; conduzir: string }
> = {
  visao: {
    chip: "Enc. 1–4",
    conduzir:
      "Entregue no 1º encontro (a janela do guia vai até o 4º). O exercício pede imaginação: o jovem narra o “filme” da vida ideal e fecha com a Declaração de Visão — uma frase no futuro, com prazo. Releiam juntos no encontro seguinte: a frase é o topo do PDM.",
  },
  metas: {
    chip: "Enc. 2–3",
    conduzir:
      "Da Declaração de Visão saem 3 a 5 metas, cada uma com o porquê escrito pelo jovem. Antes de fechar, revisem com o modelo SMART: específica, mensurável, alcançável, relevante e com prazo. A meta prioritária abre o PDM.",
  },
  pdm: {
    chip: "Construir 1–4 · revisão enc. 9",
    conduzir:
      "Documento vivo construído nos enc. 1–4: Visão no topo, metas com indicador de sucesso (IS) e prazo (P), depois o mapa de submetas — pra cada meta, “o que preciso fazer pra conseguir isso?”. Volta à mesa na revisão de meio de percurso (enc. 9).",
  },
  roda_vida: {
    chip: "Leitura enc. 1 · aplicação enc. 12–14",
    conduzir:
      "Duas aplicações: a leitura inicial no enc. 1 — o ponto de partida — e a aplicação formal nos enc. 12–14, que se compara com a primeira. O jovem dá nota de 1 a 10 nas 16 áreas; o desenho vira a roda e orienta as metas das áreas prioritárias.",
  },
};

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
  duplaId,
  mentoradoNome,
  mentoradoWhatsapp,
  podeEnviar,
  jornadaViva,
}: {
  /** null quando o instrumento ainda não foi semeado no banco — a linha
   *  existe pra jornada completa aparecer, mas sem ação */
  item: InstrumentoDupla | null;
  duplaId: string;
  mentoradoNome: string;
  mentoradoWhatsapp: string | null;
  podeEnviar: boolean;
  /** ativa|pausada — dupla fechada esconde TODAS as ações de link pra
   *  qualquer papel (Copiar/WhatsApp/Gerar): o link que o jovem já tem
   *  segue respondível, mas ninguém emite nem reenvia. */
  jornadaViva: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enviado, setEnviado] = useState<string | null>(null);
  const origem = useOrigem();

  const sistema = (item?.sistema ?? null) as InstrumentoSistema | null;
  const info = sistema ? INSTRUMENTO_INFO[sistema] : null;
  const titulo = item?.titulo ?? info?.titulo ?? "Instrumento";

  // estado local pós-envio (a RPC já gravou; o refresh traz o resto)
  const { status, entrega } = enviado
    ? { status: "pendente" as const, entrega: null }
    : estadoAtual(item?.entregas ?? []);
  const tokenVivo = enviado ?? (status === "pendente" ? entrega?.token : null);

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
          ? "Este link já estava pendente — reaproveitado."
          : "Link gerado — copie ou envie pelo WhatsApp."
      );
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-3 lg:flex-col lg:items-stretch">
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
          <details className="group mt-1.5">
            <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground underline-offset-2 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              Como conduzir
            </summary>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
              {GUIA_ENCONTRO[sistema].conduzir}
            </p>
          </details>
        )}
        {status === "respondido" && entrega?.respondido_em && (
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            Respondido em {formatDate(entrega.respondido_em)}
          </p>
        )}
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
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{item.titulo}</DialogTitle>
                <DialogDescription>
                  Respondido por {mentoradoNome}
                  {entrega.respondido_em &&
                    ` em ${formatDate(entrega.respondido_em)}`}
                  .
                </DialogDescription>
              </DialogHeader>
              <InstrumentoResultado
                sistema={item.sistema}
                campos={item.campos}
                respostas={entrega.respostas}
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
              telefone={mentoradoWhatsapp}
              mensagem={msgLinkWhatsApp(
                titulo,
                mentoradoNome,
                tokenVivo,
                origem
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
  podeEnviar,
  jornadaViva,
  className,
}: {
  duplaId: string;
  /** saída da RPC instrumentos_da_dupla — um item por instrumento semeado */
  itens: InstrumentoDupla[];
  mentoradoNome: string;
  mentoradoWhatsapp: string | null;
  /** coord sempre; o mentor DPP da dupla viva também entrega (o guia é dele) */
  podeEnviar: boolean;
  /** ativa|pausada — dupla fechada vira só leitura de resultados */
  jornadaViva: boolean;
  className?: string;
}) {
  if (!itens.length) return null;
  const porSistema = new Map(itens.map((i) => [i.sistema, i]));
  return (
    <section
      className={cn(
        "rounded-xl bg-card p-4 shadow-[var(--shadow-border)]",
        className
      )}
    >
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-[var(--brand-lime)]" />
        Instrumentos da jornada
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Os exercícios oficiais do guia — o jovem responde por link único, sem
        login, e o resultado volta estruturado aqui.
      </p>
      <ul className="mt-2 divide-y divide-border/60">
        {INSTRUMENTOS_SISTEMA.map((s) => (
          <LinhaInstrumento
            key={s}
            item={porSistema.get(s) ?? null}
            duplaId={duplaId}
            mentoradoNome={mentoradoNome}
            mentoradoWhatsapp={mentoradoWhatsapp}
            podeEnviar={podeEnviar}
            jornadaViva={jornadaViva}
          />
        ))}
      </ul>
    </section>
  );
}
