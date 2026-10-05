"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle,
  Circle,
  Paperclip,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { DuplaNomes } from "@/components/dupla-nomes";
import { CopiarChamada } from "@/components/copiar-chamada";
import { RegistroView } from "@/components/registro-view";
import { ResolverApoioButton } from "@/components/resolver-apoio-button";
import { formatTamanho } from "@/lib/ciclo";
import { createClient } from "@/lib/supabase/client";
import {
  formatDate,
  formatDateTime,
  formatDiaMes,
  linkSeguro,
  registroTardio,
  type PassoGuia,
} from "@/lib/ciclo";
import type {
  Dupla,
  Encontro,
  EncontroStatus,
  RegistroAnexo,
} from "@/lib/types";

const STATUS_LABEL: Record<EncontroStatus, string> = {
  agendado: "Agendado",
  remarcado: "Remarcado",
  realizado: "Realizado",
  nao_aconteceu: "Não aconteceu",
  cancelado: "Cancelado",
};

/** "Detalhes do encontro" — a leitura do dia pra coordenação/supervisor:
 *  status, sugestão do guia, plano do mentor, registro completo, combinados
 *  gerados e evidências — sem sair da agenda. Tudo read-only: quem escreve
 *  no encontro é a dupla. */
export function EncontroDetalheDialog({
  encontro,
  dupla,
  evento,
  souCoord,
  open,
  onOpenChange,
}: {
  encontro: Encontro;
  dupla: Dupla;
  /** Passo do guia do nº — título/instrumentos (DPP) ou foco (especialista). */
  evento: PassoGuia | null;
  souCoord: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reg = encontro.registro ?? null;
  // "vencido" congela na abertura — um prazo vencendo durante a leitura não
  // muda o item sob o olhar
  const [agora] = useState(() => Date.now());
  const nota =
    dupla.notas?.find((n) => n.numero === encontro.numero)?.texto ?? null;
  const combinados = reg
    ? (dupla.encaminhamentos ?? []).filter((e) => e.registro_id === reg.id)
    : [];
  const tardio = reg != null && registroTardio(reg, encontro);

  // anexos não vêm no payload da agenda — busca sob demanda ao abrir;
  // fecha/troca de registro → reseta (sem flash da lista velha ao reabrir)
  const [anexos, setAnexos] = useState<RegistroAnexo[] | null>(null);
  const [anexosDe, setAnexosDe] = useState<string | null>(null);
  const [erroAnexos, setErroAnexos] = useState(false);
  const alvoAnexos = open && reg ? reg.id : null;
  if (anexosDe !== alvoAnexos) {
    setAnexosDe(alvoAnexos);
    setAnexos(null);
    setErroAnexos(false);
  }
  useEffect(() => {
    if (!open || !reg) return;
    let vivo = true;
    createClient()
      .from("registro_anexos")
      .select("*, autor:profiles!registro_anexos_created_by_fkey(nome)")
      .eq("registro_id", reg.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("EncontroDetalheDialog anexos:", error);
          // "falhou" ≠ "sem anexos" — a lista vazia silenciosa escondia o erro
          if (vivo) setErroAnexos(true);
          return;
        }
        if (vivo) setAnexos((data as unknown as RegistroAnexo[]) ?? []);
      });
    return () => {
      vivo = false;
    };
  }, [open, reg]);

  const divergiu =
    encontro.realizado_em != null &&
    encontro.data_hora != null &&
    encontro.realizado_em !== encontro.data_hora;
  const meta = [
    encontro.status === "realizado" && !divergiu
      ? `realizado ${formatDate(encontro.realizado_em ?? encontro.data_hora)}`
      : encontro.data_hora
        ? `agendado ${formatDateTime(encontro.data_hora)}`
        : null,
    divergiu &&
      `realizado em ${formatDate(encontro.realizado_em)}`,
    encontro.origem === "externo" && "marcado fora da plataforma",
    encontro.motivo_reagendamento &&
      `remarcado: ${encontro.motivo_reagendamento}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <DuplaAvatares
              mentor={dupla.mentor}
              mentorado={dupla.mentorado}
              size={32}
            />
            <span>
              {encontro.numero}º encontro ·{" "}
              <DuplaNomes
                mentor={dupla.mentor.nome}
                mentorado={dupla.mentorado.nome}
              />
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{STATUS_LABEL[encontro.status]}</Badge>
            {reg?.precisa_apoio && (
              <Badge
                variant="outline"
                className="border-[var(--danger)]/60 text-[var(--danger)]"
              >
                apoio solicitado
              </Badge>
            )}
          </div>
          {meta && <p className="text-xs text-muted-foreground">{meta}</p>}

          {/* "entrar" é gesto da dupla — este dialog só abre pra coord/sup,
              que copiam o link pra repassar */}
          {encontro.status === "agendado" && linkSeguro(encontro.link) && (
            <CopiarChamada url={linkSeguro(encontro.link)!} />
          )}

          {evento && (
            <p className="text-xs text-muted-foreground">
              Sugestão do guia: {evento.titulo}
              {evento.instrumentos.length > 0 &&
                ` · ${evento.instrumentos.join(", ")}`}
              {evento.foco ? ` · ${evento.foco}` : ""}
            </p>
          )}

          {nota && (
            <div className="rounded-lg bg-muted/40 px-3.5 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">
                Plano do mentor
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{nota}</p>
            </div>
          )}

          {reg ? (
            <div className="space-y-2 rounded-lg border p-3.5">
              <RegistroView reg={reg} tardio={tardio} />
              {erroAnexos && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Não foi possível carregar as evidências. Elas estão na ficha
                  da dupla.
                </p>
              )}
              {anexos && anexos.length > 0 && (
                <ul className="space-y-1.5 pt-1">
                  {anexos.map((a) => (
                    <li key={a.id} className="text-xs">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Paperclip
                          size={12}
                          className="shrink-0 text-muted-foreground"
                        />
                        <a
                          href={`/api/anexo/${a.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={a.nome}
                          className="min-w-0 flex-1 truncate underline underline-offset-2 hover:text-foreground"
                        >
                          {a.nome}
                        </a>
                      </span>
                      <span className="block pl-4.5 text-muted-foreground">
                        {[
                          a.tamanho != null ? formatTamanho(a.tamanho) : null,
                          a.autor?.nome ? `por ${a.autor.nome}` : null,
                          formatDiaMes(a.created_at),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {souCoord && reg.precisa_apoio && (
                <div className="pt-1">
                  <ResolverApoioButton registroId={reg.id} duplaId={dupla.id} />
                </div>
              )}
            </div>
          ) : (
            encontro.status === "realizado" && (
              <p className="rounded-lg border border-dashed border-[var(--warn)]/60 bg-[var(--warn)]/5 px-3.5 py-2.5 text-xs text-[var(--warn-text)]">
                Sem registro: o mentor ainda não contou como foi.
              </p>
            )
          )}

          {combinados.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Combinados deste encontro
              </p>
              <ul className="mt-1 space-y-1">
                {combinados.map((c) => {
                  const vencido =
                    c.status !== "feito" &&
                    c.prazo != null &&
                    new Date(`${c.prazo}T23:59:59`).getTime() < agora;
                  return (
                    <li key={c.id} className="flex items-start gap-2 text-sm">
                      {c.status === "feito" ? (
                        <CheckCircle
                          size={15}
                          className="mt-0.5 shrink-0 text-[var(--ok)]"
                        />
                      ) : (
                        <Circle
                          size={15}
                          className="mt-0.5 shrink-0 text-muted-foreground/60"
                        />
                      )}
                      <span
                        className={
                          c.status === "feito"
                            ? "text-muted-foreground line-through"
                            : undefined
                        }
                      >
                        {c.descricao}
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {c.responsavel === "mentorado" ? "Mentorado" : "Mentor"}
                          {c.prazo ? ` · até ${formatDate(c.prazo)}` : ""}
                        </span>
                        {vencido && (
                          <span className="text-xs font-medium text-[var(--danger)]">
                            {" "}
                            (vencido)
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="border-t pt-3">
            <Link
              href={`/duplas/${dupla.id}#registrar-${encontro.id}`}
              className="inline-flex min-h-11 items-center gap-1 text-xs font-medium underline underline-offset-2 hover:text-muted-foreground sm:min-h-0"
            >
              Abrir na ficha da dupla
              <ArrowUpRight size={12} aria-hidden />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
