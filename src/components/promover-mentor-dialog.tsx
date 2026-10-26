"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { promoverMentorado, type PapelMentorAlvo } from "@/lib/actions-promocao";
import type { Cronograma, Mentorado } from "@/lib/types";
import { turmaLonga } from "@/lib/turma";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPCOES_PAPEL: {
  value: PapelMentorAlvo;
  titulo: string;
  detalhe: string;
}[] = [
  {
    value: "mentor_dpp",
    titulo: "Mentor de jornada (DPP)",
    detalhe:
      "Acompanha um jovem semana a semana dentro de uma turma. Você escolhe qual.",
  },
  {
    value: "mentor_especialista",
    titulo: "Mentor especialista",
    detalhe:
      "Atende jovens por trilha pontual (saúde mental, carreira…). Fica disponível pro programa inteiro.",
  },
];

/** "Promover a mentor" (REALIZA-159) — quem concluiu o programa vira mentor
 *  na MESMA identidade: a RPC promover_mentorado_mentor (0112) reusa/cria o
 *  profile, troca o papel e abre a ficha de mentor, sem tocar no histórico
 *  de jovem. O item do menu só aparece pra quem concluiu (situacao =
 *  'concluido'); as revalidações de elegibilidade ficam no banco. */
export function PromoverMentorDialog({
  mentorado,
  open,
  onOpenChange,
}: {
  mentorado: Mentorado;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [papel, setPapel] = useState<PapelMentorAlvo>("mentor_dpp");
  const [turma, setTurma] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<string[]>([]);
  // "carregando" evita o flash do estado vazio antes do primeiro fetch
  const [carregandoTurmas, setCarregandoTurmas] = useState(false);
  const [falhaTurmas, setFalhaTurmas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const primeiroNome = (mentorado.nome_social || mentorado.nome).split(" ")[0];

  // escopo do mentor DPP = label de turma (profile_papeis.escopo_turma) —
  // a fonte são os cronogramas (a entidade turma ainda não existe, 0061):
  // ativos ou em rascunho servem (promoção costuma mirar o ciclo seguinte);
  // encerrado é passado morto e nem entra. Duas linhas com a mesma turma
  // colapsam — o escopo guarda o label, não o calendário
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from("cronogramas")
        .select("turma, status")
        .order("turma");
      if (cancelado) return;
      setCarregandoTurmas(false);
      if (error) {
        setFalhaTurmas(true);
        return;
      }
      const labels = [
        ...new Set(
          ((data ?? []) as Pick<Cronograma, "turma" | "status">[])
            .filter((c) => c.status !== "encerrado")
            .map((c) => c.turma)
        ),
      ];
      setTurmas(labels);
      setFalhaTurmas(false);
      setTurma((atual) => (atual && labels.includes(atual) ? atual : null));
    })();
    return () => {
      cancelado = true;
    };
  }, [open]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (papel === "mentor_dpp" && !turma) {
      setErro("Escolha a turma de escopo do mentor de jornada.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const obs = String(fd.get("obs") ?? "").trim() || null;
    setErro(null);
    start(async () => {
      try {
        const res = await promoverMentorado(
          mentorado.id,
          papel,
          papel === "mentor_dpp" ? turma : null,
          obs
        );
        if ("error" in res) {
          setErro(res.error);
          return;
        }
        const profileId = res.profileId;
        toast.success(
          `${primeiroNome} agora é ${papel === "mentor_dpp" ? "mentor de jornada" : "mentor especialista"}. A ficha de equipe já está no ar.`,
          {
            description:
              "Lembre de gerar o termo de voluntário na ficha da pessoa.",
            action: {
              label: "Abrir ficha",
              onClick: () => router.push(`/pessoas/${profileId}`),
            },
          }
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
          // estado fresco por abertura — uma promoção abortada não pode
          // vazar seleção pra próxima vez
          setPapel("mentor_dpp");
          setTurma(null);
          setErro(null);
          setCarregandoTurmas(true);
        }
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Promover {primeiroNome} a mentor</DialogTitle>
          <DialogDescription>
            Quem concluiu o programa pode voltar como mentor. O cadastro de
            jovem e o histórico ficam intactos: duplas, encontros e
            formulários continuam na ficha dela.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Papel de mentor</legend>
            {OPCOES_PAPEL.map((op) => (
              <label
                key={op.value}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors has-checked:border-primary/60 has-checked:bg-primary/5"
              >
                <input
                  type="radio"
                  name="papel"
                  value={op.value}
                  checked={papel === op.value}
                  onChange={() => {
                    setPapel(op.value);
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

          {papel === "mentor_dpp" && (
            <div className="space-y-2">
              <Label id="promo-turma-label" htmlFor="promo-turma">
                Turma de escopo
              </Label>
              <Select
                value={turma}
                items={Object.fromEntries(
                  // value cru = o escopo gravado; label narrativo (Turma 2)
                  turmas.map((t) => [t, turmaLonga(t)])
                )}
                onValueChange={(v) => {
                  setTurma(v ?? null);
                  setErro(null);
                }}
              >
                <SelectTrigger
                  id="promo-turma"
                  aria-labelledby="promo-turma-label promo-turma"
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
              ) : carregandoTurmas ? (
                <p className="text-xs text-muted-foreground">
                  Carregando as turmas…
                </p>
              ) : turmas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma turma ativa ou em preparação. Crie o cronograma da
                  turma antes de promover pra jornada.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  É o recorte do papel: enquanto mentor, {primeiroNome} vê e
                  escreve só nessa turma.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="promo-obs">Observação (opcional)</Label>
            <Textarea
              id="promo-obs"
              name="obs"
              rows={2}
              maxLength={2000}
              placeholder="Ex.: formada no ciclo 2025/2026, volta como mentora"
            />
          </div>

          {/* estado da conta: o vínculo mentorados.profile_id decide —
              conta existente vira mentor nela; sem conta, a promoção cria
              uma (pré-cadastro) e o magic link precisa do e-mail do jovem */}
          {mentorado.profile_id ? (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {primeiroNome} já tem conta na plataforma. Ela continua a
              mesma, com o login de hoje. O que muda é o que ela vê dentro.
            </p>
          ) : mentorado.email ? (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Uma conta nova é criada pra {primeiroNome}. O primeiro magic
              link vai pro e-mail do cadastro do jovem.
            </p>
          ) : (
            <p className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/5 px-3 py-2 text-xs">
              {primeiroNome} ainda não tem conta. A promoção cria uma, mas o
              magic link precisa de um e-mail. Cadastre um na ficha dela
              antes de promover.
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

          {/* sem conta E sem e-mail a RPC falha sempre — trava já aqui e o
              aviso acima diz o que falta (e-mail na ficha do jovem) */}
          <DialogFooter sticky>
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
                pending ||
                (!mentorado.profile_id && !mentorado.email) ||
                (papel === "mentor_dpp" && turmas.length === 0)
              }
            >
              {pending ? "Promovendo…" : `Promover pra ${papel === "mentor_dpp" ? "jornada" : "especialista"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
