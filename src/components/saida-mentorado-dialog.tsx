"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { marcarSaidaMentorado } from "@/lib/actions";
import { MOTIVOS_SAIDA, motivoSaida } from "@/lib/ciclo";
import type { Mentorado, SituacaoMentorado } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SituacaoSaida = Exclude<SituacaoMentorado, "ativo">;

const OPCOES_SAIDA: {
  value: SituacaoSaida;
  titulo: string;
  detalhe: string;
}[] = [
  {
    value: "desistente",
    titulo: "Desistente",
    detalhe: "Saiu do programa antes do fim — o motivo fica na ficha.",
  },
  {
    value: "concluido",
    titulo: "Concluiu o programa",
    detalhe:
      "Terminou a jornada — sai do grupo dos ativos sem contar como evasão.",
  },
];

/** "Marcar saída" do mentorado (0077) — registra desistência ou conclusão
 *  com motivo; a pessoa sai do grupo principal da /pessoas pra seção "Fora
 *  do programa". Quem tem dupla em andamento é bloqueado aqui: o rito de
 *  encerramento (checklist + resumo) mora na ficha da dupla — o estado
 *  bloqueado aponta direto pra ela. Reversível pelo "Reativar" do menu. */
export function SaidaMentoradoDialog({
  mentorado,
  open,
  onOpenChange,
  duplaVivaId,
}: {
  mentorado: Mentorado;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Id da dupla ativa/pausada quando a listagem já conhece — pré-condição:
   *  quem tem par em andamento encerra a dupla antes de marcar a saída. */
  duplaVivaId?: string | null;
}) {
  const [situacao, setSituacao] = useState<SituacaoSaida>("desistente");
  const [motivoSel, setMotivoSel] = useState("desistencia");
  // erro da action fica inline (padrão dos dialogs) — a correção costuma
  // ser outra escolha no próprio form, então a mensagem não pode sumir
  const [erro, setErro] = useState<string | null>(null);
  // dupla viva descoberta no server — a lista pode estar velha; trava com
  // o link direto pra ficha dela em vez de só texto de erro
  const [duplaBloqueio, setDuplaBloqueio] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const primeiroNome = (mentorado.nome_social || mentorado.nome).split(" ")[0];

  const bloqueio = duplaVivaId ?? duplaBloqueio;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const detalhe = String(fd.get("detalhe") ?? "");
    const motivo =
      situacao === "concluido"
        ? detalhe.trim() || null
        : motivoSaida(motivoSel, detalhe);
    if (situacao === "desistente" && !motivo) {
      setErro("Conte o motivo da saída — ele aparece na ficha e na lista.");
      return;
    }
    setErro(null);
    start(async () => {
      try {
        const res = await marcarSaidaMentorado(mentorado.id, situacao, motivo);
        if (res?.error) {
          if ("duplaId" in res && res.duplaId) setDuplaBloqueio(res.duplaId);
          setErro(res.error);
          return;
        }
        toast.success(
          situacao === "desistente"
            ? `Saída de ${primeiroNome} registrada — o cadastro foi pra "Fora do programa".`
            : `${primeiroNome} marcada como quem concluiu o programa.`
        );
        onOpenChange(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          // estado fresco por abertura — uma marcação abortada não pode
          // vazar seleção pra próxima vez
          setSituacao("desistente");
          setMotivoSel("desistencia");
          setErro(null);
          setDuplaBloqueio(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar saída de {primeiroNome}</DialogTitle>
          <DialogDescription>
            A pessoa sai da lista principal e da fila de pareamento — o
            cadastro e o histórico ficam. Dá pra reverter com “Reativar”.
          </DialogDescription>
        </DialogHeader>

        {bloqueio ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/5 px-3.5 py-3 text-sm">
              <p className="font-medium">
                {primeiroNome} tem dupla em andamento.
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Registre o encerramento na ficha da dupla — o checklist e o
                resumo da jornada ficam guardados lá. A saída do programa vem
                depois, aqui mesmo.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Voltar
              </Button>
              <Button
                render={<Link href={`/duplas/${bloqueio}`} />}
                nativeButton={false}
                onClick={() => onOpenChange(false)}
              >
                Abrir a ficha da dupla
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Situação</legend>
              {OPCOES_SAIDA.map((op) => (
                <label
                  key={op.value}
                  className={
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors " +
                    (op.value === "desistente"
                      ? "has-checked:border-[var(--warn)]/60 has-checked:bg-[var(--warn)]/5"
                      : "has-checked:border-[var(--ok)]/60 has-checked:bg-[var(--ok)]/5")
                  }
                >
                  <input
                    type="radio"
                    name="situacao"
                    value={op.value}
                    checked={situacao === op.value}
                    onChange={() => {
                      setSituacao(op.value);
                      setErro(null);
                    }}
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    <span className="font-medium">{op.titulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {op.detalhe}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              {situacao === "desistente" && (
                <div className="space-y-2">
                  <Label id="saida-motivo-label" htmlFor="saida-motivo">Motivo</Label>
                  <Select
                    value={motivoSel}
                    items={Object.fromEntries(
                      MOTIVOS_SAIDA.map((m) => [m.value, m.label])
                    )}
                    onValueChange={(v) => {
                      setMotivoSel(v ?? "desistencia");
                      setErro(null);
                    }}
                  >
                    <SelectTrigger
                      id="saida-motivo"
                      aria-labelledby="saida-motivo-label saida-motivo"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVOS_SAIDA.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="saida-detalhe">
                  {situacao === "concluido"
                    ? "Detalhe (opcional)"
                    : motivoSel === "outro"
                      ? "Qual motivo?"
                      : "Detalhe (opcional)"}
                </Label>
                <Textarea
                  id="saida-detalhe"
                  name="detalhe"
                  rows={2}
                  required={situacao === "desistente" && motivoSel === "outro"}
                  maxLength={300}
                  placeholder={
                    situacao === "concluido"
                      ? "Ex.: ciclo 2025/2026"
                      : motivoSel === "outro"
                        ? "Conte em uma frase"
                        : "Contexto pra ficha"
                  }
                />
              </div>
            </div>

            {mentorado.profile_id && (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {primeiroNome} tem conta na plataforma — o acesso continua até
                o cadastro dela ser desativado na seção “Com acesso”.
              </p>
            )}

            {erro && (
              <p
                role="alert"
                className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3.5 py-3 text-sm"
              >
                {erro}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending
                ? "Registrando…"
                : situacao === "desistente"
                  ? "Registrar desistência"
                  : "Marcar como concluída"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
