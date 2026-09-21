"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle,
  Circle,
  Paperclip,
  VideoCamera,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RegistroView } from "@/components/registro-view";
import { ResolverApoioButton } from "@/components/resolver-apoio-button";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatDateTime, formatDiaMes } from "@/lib/ciclo";
import type {
  CicloEvento,
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

function formatTamanho(bytes: number): string {
  if (bytes >= 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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
  /** Evento oficial do nº — título/instrumentos sugeridos pelo guia. */
  evento: CicloEvento | null;
  souCoord: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reg = encontro.registro ?? null;
  const nota =
    dupla.notas?.find((n) => n.numero === encontro.numero)?.texto ?? null;
  const combinados = reg
    ? (dupla.encaminhamentos ?? []).filter((e) => e.registro_id === reg.id)
    : [];
  const tardio =
    reg != null &&
    (encontro.realizado_em ?? encontro.data_hora) != null &&
    new Date(reg.created_at).getTime() -
      new Date(encontro.realizado_em ?? encontro.data_hora!).getTime() >
      3 * 86400000;

  // anexos não vêm no payload da agenda — busca sob demanda ao abrir
  const [anexos, setAnexos] = useState<RegistroAnexo[] | null>(null);
  useEffect(() => {
    if (!open || !reg) return;
    let vivo = true;
    createClient()
      .from("registro_anexos")
      .select("*, autor:profiles!registro_anexos_created_by_fkey(nome)")
      .eq("registro_id", reg.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        // falha de leitura vira lista vazia — distinguir de "sem anexos" não
        // muda a ação disponível (tudo é read-only), mas o erro precisa logar
        if (error) console.error("EncontroDetalheDialog anexos:", error);
        if (vivo) setAnexos((data as unknown as RegistroAnexo[]) ?? []);
      });
    return () => {
      vivo = false;
    };
  }, [open, reg]);

  const meta = [
    encontro.data_hora &&
      `agendado ${formatDateTime(encontro.data_hora)}`,
    encontro.realizado_em &&
      encontro.realizado_em !== encontro.data_hora &&
      `realizado em ${formatDate(encontro.realizado_em)}`,
    encontro.origem === "externo" && "marcado fora da plataforma",
    encontro.motivo_reagendamento &&
      `remarcado: ${encontro.motivo_reagendamento}`,
    encontro.status === "realizado" &&
      !reg &&
      "registro pendente — a dupla ainda deve o follow-up",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {encontro.numero}º encontro — {dupla.mentor.nome} e{" "}
            {dupla.mentorado.nome}
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

          {encontro.status === "agendado" && encontro.link && (
            <a
              href={encontro.link}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <VideoCamera /> Entrar na chamada
            </a>
          )}

          {evento && (
            <p className="text-xs text-muted-foreground">
              Sugestão do guia: {evento.titulo}
              {evento.instrumentos.length > 0 &&
                ` · ${evento.instrumentos.join(", ")}`}
            </p>
          )}

          {nota && (
            <div className="rounded-lg bg-muted/40 px-3.5 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">
                Plano do mentor
              </p>
              <p className="mt-0.5 whitespace-pre-wrap">{nota}</p>
            </div>
          )}

          {reg ? (
            <div className="space-y-2 rounded-lg border p-3.5">
              <RegistroView reg={reg} tardio={tardio} />
              {anexos && anexos.length > 0 && (
                <ul className="space-y-1.5 pt-1">
                  {anexos.map((a) => (
                    <li
                      key={a.id}
                      className="flex min-w-0 items-center gap-1.5 text-xs"
                    >
                      <Paperclip
                        size={12}
                        className="shrink-0 text-muted-foreground"
                      />
                      <a
                        href={`/api/anexo/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={a.nome}
                        className="truncate underline underline-offset-2 hover:text-foreground"
                      >
                        {a.nome}
                      </a>
                      <span className="shrink-0 text-muted-foreground">
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
                Sem registro — o mentor ainda não contou como foi.
              </p>
            )
          )}

          {combinados.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Combinados deste encontro
              </p>
              <ul className="mt-1 space-y-1">
                {combinados.map((c) => (
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
                        · {c.responsavel}
                        {c.prazo ? ` · até ${formatDate(c.prazo)}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t pt-3">
            <Link
              href={`/duplas/${dupla.id}#registrar-${encontro.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:text-muted-foreground"
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
