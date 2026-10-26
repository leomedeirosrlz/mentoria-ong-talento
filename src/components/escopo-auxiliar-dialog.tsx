"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { setEscopoAuxiliar, setPessoaRole } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import {
  escopoAuxiliarDe,
  type EscopoAuxiliar,
  type PapelEscopo,
} from "@/lib/auxiliar-escopo";
import { turmaLonga } from "@/lib/turma";
import type { Cronograma } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPCOES: { value: EscopoAuxiliar; label: string; detalhe: string }[] = [
  {
    value: "duplas",
    label: "Só as duplas dele",
    detalhe: "Acompanha só as duplas em que é atribuído como auxiliar.",
  },
  {
    value: "turma",
    label: "Toda a turma",
    detalhe:
      "Acompanha todas as duplas da turma escolhida, com as mesmas permissões das que já supervisiona.",
  },
];

/** Escopo do auxiliar executivo por pessoa (REALIZA-32, migration 0125):
 *  a coordenação decide se o auxiliar vê "só as duplas dele" (padrão) ou
 *  "toda a turma". Duas entradas — `atribuir` quando o papel supervisor
 *  está sendo dado agora pelo RoleSelect (a action de papel roda antes e a
 *  de escopo logo depois); sem ele, a edição de quem já é auxiliar (menu ⋯
 *  da pessoa). O prefill vem das linhas de profile_papeis, a fonte do
 *  grant: quem recebe o papel agora sempre cai no padrão "duplas". */
export function EscopoAuxiliarDialog({
  profileId,
  nome,
  atribuir = false,
  open,
  onOpenChange,
}: {
  profileId: string;
  nome?: string;
  /** true = o papel supervisor está sendo atribuído junto (veio do select de papel). */
  atribuir?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [modo, setModo] = useState<EscopoAuxiliar>("duplas");
  const [turma, setTurma] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [falhaTurmas, setFalhaTurmas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const primeiroNome = nome?.split(" ")[0];

  // prefill + catálogo de turmas por abertura — o grant vem das linhas de
  // profile_papeis (a fonte); as turmas dos cronogramas, mesma régua do
  // escopo de mentor (ativas e em preparação, encerradas são passado morto)
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    const supabase = createClient();
    (async () => {
      const [papeisRes, turmasRes] = await Promise.all([
        supabase
          .from("profile_papeis")
          .select("papel, escopo_turma, escopo_supervisao")
          .eq("profile_id", profileId)
          .eq("papel", "supervisor"),
        supabase.from("cronogramas").select("turma, status").order("turma"),
      ]);
      if (cancelado) return;
      setCarregando(false);

      if (!papeisRes.error) {
        const estado = escopoAuxiliarDe(
          (papeisRes.data ?? []) as PapelEscopo[]
        );
        setModo(estado.modo);
        setTurma(estado.turma);
      }
      // falha no prefill cai no padrão "duplas" — nunca num grant inventado

      if (turmasRes.error) {
        setFalhaTurmas(true);
        return;
      }
      const labels = [
        ...new Set(
          ((turmasRes.data ?? []) as Pick<Cronograma, "turma" | "status">[])
            .filter((c) => c.status !== "encerrado")
            .map((c) => c.turma)
        ),
      ];
      setTurmas(labels);
      setFalhaTurmas(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [open, profileId]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (modo === "turma" && !turma) {
      setErro("Escolha a turma que o auxiliar acompanha.");
      return;
    }
    setErro(null);
    start(async () => {
      try {
        // atribuição: o papel vem primeiro (setPessoaRole cria a linha-
        // identidade via espelho role→papeis); o grant vai na sequência
        if (atribuir) {
          const resPapel = await setPessoaRole(profileId, "supervisor");
          if (resPapel?.error) {
            setErro(resPapel.error);
            return;
          }
        }
        const res = await setEscopoAuxiliar(
          profileId,
          modo,
          modo === "turma" ? turma : null
        );
        if (res?.error) {
          setErro(res.error);
          return;
        }
        const quem = primeiroNome ?? "A pessoa";
        toast.success(
          modo === "turma"
            ? `${quem} ${atribuir ? "agora é auxiliar executivo e " : ""}acompanha todas as duplas da ${turmaLonga(turma)}.`
            : `${quem} ${atribuir ? "agora é auxiliar executivo e " : ""}acompanha só as duplas que supervisiona.`
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
          setModo("duplas");
          setTurma(null);
          setErro(null);
          setCarregando(true);
        }
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {atribuir
              ? `Como ${primeiroNome ?? "a pessoa"} acompanha as duplas?`
              : `Escopo de ${primeiroNome ?? "auxiliar"}`}
          </DialogTitle>
          <DialogDescription>
            {atribuir
              ? `${primeiroNome ?? "A pessoa"} vai virar auxiliar executivo. Escolha o alcance do acompanhamento; dá pra mudar depois.`
              : "Escolha o alcance do acompanhamento."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* segmentado — radios nativos com a barra conectada do app (mesmo
              padrão de especialista-horarios): um tab stop, setas movem */}
          <div
            role="radiogroup"
            aria-label="Escopo do auxiliar"
            className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
          >
            {OPCOES.map((op) => (
              <label
                key={op.value}
                className="flex h-11 cursor-pointer items-center justify-center rounded-lg px-1 text-center text-sm font-medium text-muted-foreground transition-colors select-none has-checked:bg-primary has-checked:text-primary-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:h-10"
              >
                <input
                  type="radio"
                  name="escopo-auxiliar"
                  value={op.value}
                  checked={modo === op.value}
                  onChange={() => {
                    setModo(op.value);
                    setErro(null);
                  }}
                  className="sr-only"
                  aria-label={`Escopo: ${op.label}`}
                />
                {op.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {OPCOES.find((op) => op.value === modo)?.detalhe}
          </p>

          {modo === "turma" && (
            <div className="space-y-2">
              <Label id="escopo-turma-label" htmlFor="escopo-turma">
                Turma acompanhada
              </Label>
              <Select
                value={turma}
                items={Object.fromEntries(
                  turmas.map((t) => [t, turmaLonga(t)])
                )}
                onValueChange={(v) => {
                  setTurma(v ?? null);
                  setErro(null);
                }}
              >
                <SelectTrigger
                  id="escopo-turma"
                  aria-labelledby="escopo-turma-label escopo-turma"
                >
                  <SelectValue placeholder="Escolha a turma" />
                </SelectTrigger>
                <SelectContent>
                  {turmas.map((t) => (
                    <SelectItem key={t} value={t}>
                      {turmaLonga(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {falhaTurmas ? (
                <p className="text-xs text-muted-foreground">
                  A lista de turmas não carregou. Feche e abra de novo.
                </p>
              ) : carregando ? (
                <p className="text-xs text-muted-foreground">
                  Carregando as turmas…
                </p>
              ) : turmas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma turma ativa ou em preparação. Crie o cronograma da
                  turma antes de dar a visão de turma.
                </p>
              ) : null}
            </div>
          )}

          {erro && (
            <p
              role="alert"
              className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3.5 py-3 text-sm"
            >
              {erro}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                pending || (modo === "turma" && turmas.length === 0)
              }
            >
              {pending && <CircleNotch className="animate-spin" />}
              {atribuir ? "Atribuir papel" : "Salvar escopo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
