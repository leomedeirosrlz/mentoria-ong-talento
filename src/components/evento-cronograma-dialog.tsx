"use client";

import { useId, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import {
  FASES_DPP,
  TIPO_EVENTO_LABEL,
  normalizaEvento,
  validaEvento,
  type EventoRascunho,
  type TipoEvento,
} from "@/lib/gerador-cronograma";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagInput } from "@/components/tag-input";

/** Sugestões do TagInput — os instrumentos nomeados no guia DPP. */
const INSTRUMENTOS_SUGESTOES = [
  "PDM",
  "Escuta Ativa",
  "Perguntas Eficazes",
  "Feedback Construtivo",
  "Roda da Vida",
  "Construindo a sua Visão",
  "Modelo SMART",
  "Papel de modelo",
  "Avaliação 360º",
  "Autoavaliação do mentor",
] as const;

/** Form de um evento do cronograma — compartilhado pelo builder (/turmas/novo,
 *  edita o rascunho local) e pelo editor (/turmas/[id], persiste via action).
 *  O rascunho mora dentro do conteúdo do Dialog: o popup desmonta ao fechar,
 *  então cada abertura recomeça do `inicial` sem efeito de reset. */
export function EventoCronogramaDialog({
  open,
  onOpenChange,
  inicial,
  titulo,
  onSalvar,
  pending = false,
  salvarLabel = "Salvar",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** estado inicial do form — cada abertura re-semeia */
  inicial: EventoRascunho;
  titulo: string;
  /** parent decide: gravar no rascunho local ou chamar a action */
  onSalvar: (rascunho: EventoRascunho) => void;
  pending?: boolean;
  salvarLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <FormularioEvento
          inicial={inicial}
          onSalvar={onSalvar}
          pending={pending}
          salvarLabel={salvarLabel}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormularioEvento({
  inicial,
  onSalvar,
  pending,
  salvarLabel,
}: {
  inicial: EventoRascunho;
  onSalvar: (rascunho: EventoRascunho) => void;
  pending: boolean;
  salvarLabel: string;
}) {
  const uid = useId();
  const [draft, setDraft] = useState<EventoRascunho>(inicial);
  const [erro, setErro] = useState<string | null>(null);

  const ehEncontro = draft.tipo === "encontro";
  const ehEtapa = draft.tipo === "etapa_preparacao";
  const temFim = ehEtapa || draft.tipo === "recesso";

  function patch(p: Partial<EventoRascunho>) {
    setDraft((d) => ({ ...d, ...p }));
    setErro(null);
  }

  function trocarTipo(tipo: TipoEvento) {
    // a coerção é imediata: sair de encontro zera número/fase/instrumentos,
    // sair de etapa volta o status a pendente — sem resíduo invisível
    setDraft((d) => normalizaEvento({ ...d, tipo }));
    setErro(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const limpo = normalizaEvento(draft);
    const erroV = validaEvento(limpo);
    if (erroV) {
      setErro(erroV);
      return;
    }
    onSalvar(limpo);
  }

  const id = (n: string) => `ev-${uid}-${n}`;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label id={id("tipo-label")}>Tipo</Label>
          <Select
            value={draft.tipo}
            items={TIPO_EVENTO_LABEL}
            onValueChange={(v) => trocarTipo(v as TipoEvento)}
          >
            <SelectTrigger aria-labelledby={id("tipo-label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_EVENTO_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {ehEncontro && (
          <div className="space-y-2">
            <Label htmlFor={id("numero")}>Número do encontro</Label>
            <Input
              id={id("numero")}
              type="number"
              min={1}
              max={99}
              required
              value={draft.numero ?? ""}
              onChange={(e) =>
                patch({
                  numero: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("titulo")}>Título</Label>
        <Input
          id={id("titulo")}
          required
          maxLength={160}
          value={draft.titulo}
          onChange={(e) => patch({ titulo: e.target.value })}
        />
      </div>

      <div className={`grid gap-4 ${temFim ? "sm:grid-cols-2" : ""}`}>
        <div className="space-y-2">
          <Label htmlFor={id("data")}>Data</Label>
          <Input
            id={id("data")}
            type="date"
            required={!(ehEtapa && draft.status === "concluida")}
            value={draft.data ?? ""}
            onChange={(e) => patch({ data: e.target.value || null })}
          />
          {ehEtapa && (
            <p className="text-xs text-muted-foreground">
              Uma etapa concluída entregue pela ONG parceira pode ficar sem
              data.
            </p>
          )}
        </div>
        {temFim && (
          <div className="space-y-2">
            <Label htmlFor={id("data_fim")}>Fim do período (opcional)</Label>
            <Input
              id={id("data_fim")}
              type="date"
              disabled={!draft.data}
              value={draft.data_fim ?? ""}
              onChange={(e) => patch({ data_fim: e.target.value || null })}
            />
          </div>
        )}
      </div>

      {ehEtapa && (
        <div className="space-y-2">
          <Label id={id("status-label")}>Status da etapa</Label>
          <Select
            value={draft.status}
            items={{ pendente: "Pendente", concluida: "Concluída" }}
            onValueChange={(v) =>
              patch({ status: v as EventoRascunho["status"] })
            }
          >
            <SelectTrigger aria-labelledby={id("status-label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {ehEncontro && (
        <>
          <div className="space-y-2">
            <Label htmlFor={id("fase")}>Fase do guia (opcional)</Label>
            <Input
              id={id("fase")}
              list={id("fases")}
              maxLength={120}
              value={draft.fase ?? ""}
              onChange={(e) => patch({ fase: e.target.value || null })}
            />
            <datalist id={id("fases")}>
              {FASES_DPP.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label>Instrumentos do guia</Label>
            <TagInput
              name={id("instrumentos")}
              sugestoes={[...INSTRUMENTOS_SUGESTOES]}
              value={draft.instrumentos}
              onChange={(instrumentos) => patch({ instrumentos })}
              max={10}
              maxChars={60}
              placeholder="Outro instrumento…"
              inputLabel="Adicionar instrumento"
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor={id("obs")}>Observação operacional (opcional)</Label>
        <Textarea
          id={id("obs")}
          rows={2}
          maxLength={300}
          placeholder="Ex.: Feriado municipal — confirmar local"
          value={draft.observacao ?? ""}
          onChange={(e) => patch({ observacao: e.target.value || null })}
        />
      </div>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <CircleNotch className="animate-spin" />}
          {pending ? "Salvando…" : salvarLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
