"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChatsCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { registrarSupervisao } from "@/lib/actions-supervisao";
import type { SupervisaoAlvo } from "@/lib/queries-supervisao";
import { toDateStr } from "@/lib/ciclo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const GERAL = "__geral";

/** "Registrar supervisão" — o ritual supervisor ↔ mentor do guia. O dialog
 *  pede o mentor (só mentores de duplas ativas/pausadas que eu supervisiono),
 *  a dupla (opcional — "sessão geral" vale pra conversa não atada a uma
 *  dupla), a data e o resumo. O mentor lê a sessão depois — o placeholder já
 *  marca o tom positivo do registro. */
export function SupervisaoDialog({
  alvos,
  trigger,
}: {
  /** Duplas ativas/pausadas supervisionadas (getSupervisaoAlvos) — ou um
   *  alvo único quando o dialog nasce na ficha da dupla. */
  alvos: SupervisaoAlvo[];
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  // mentores únicos na ordem das duplas — um mentor com 2 duplas vira 1 opção
  const mentores = [
    ...new Map(
      alvos.map((a) => [a.mentor_id, { id: a.mentor_id, nome: a.mentor_nome }])
    ).values(),
  ];
  const [mentorSel, setMentorSel] = useState<string>(mentores[0]?.id ?? "");
  const duplasDoMentor = alvos.filter((a) => a.mentor_id === mentorSel);
  const [duplaSel, setDuplaSel] = useState<string>(
    alvos[0]?.dupla_id ?? GERAL
  );
  const [resumoLen, setResumoLen] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const hoje = toDateStr(new Date());

  function aoTrocarMentor(id: string) {
    setMentorSel(id);
    // trocou de mentor: volta pra primeira dupla dele — a sessão quase sempre
    // é sobre uma dupla; "geral" é a escolha explícita
    setDuplaSel(alvos.find((a) => a.mentor_id === id)?.dupla_id ?? GERAL);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await registrarSupervisao(fd);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Supervisão registrada.");
        setOpen(false);
        setResumoLen(0);
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
        setOpen(o);
        // reabrir recomeça do primeiro alvo — Select desmonta com o dialog e
        // volta ao default; o estado controlado acompanha
        if (o) {
          const primeiro = mentores[0]?.id ?? "";
          setMentorSel(primeiro);
          setDuplaSel(alvos.find((a) => a.mentor_id === primeiro)?.dupla_id ?? GERAL);
        }
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              <ChatsCircle size={15} />
              Registrar supervisão
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar supervisão</DialogTitle>
          <DialogDescription>
            A conversa de acompanhamento com o mentor: o que foi trabalhado,
            combinados e pontos de atenção. O mentor lê data e resumo depois.
          </DialogDescription>
        </DialogHeader>
        {mentores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum mentor em dupla ativa ou pausada supervisionada por você.
            Quando a coordenação atribuir duplas, os mentores aparecem aqui.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label id="sup-mentor-label">Mentor</Label>
              <Select
                name="mentor_id"
                required
                value={mentorSel}
                items={Object.fromEntries(mentores.map((m) => [m.id, m.nome]))}
                onValueChange={(v) => aoTrocarMentor(v ?? mentores[0].id)}
              >
                <SelectTrigger
                  id="sup-mentor-select"
                  aria-labelledby="sup-mentor-label sup-mentor-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mentores.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label id="sup-dupla-label">Sobre o quê foi a sessão</Label>
              <Select
                name="dupla_id"
                required
                value={duplaSel}
                items={{
                  ...Object.fromEntries(
                    duplasDoMentor.map((d) => [
                      d.dupla_id,
                      `Dupla com ${d.mentorado_nome}`,
                    ])
                  ),
                  [GERAL]: "Sessão geral (sem dupla específica)",
                }}
                onValueChange={(v) => setDuplaSel(v ?? GERAL)}
              >
                <SelectTrigger
                  id="sup-dupla-select"
                  aria-labelledby="sup-dupla-label sup-dupla-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {duplasDoMentor.map((d) => (
                    <SelectItem key={d.dupla_id} value={d.dupla_id}>
                      Dupla com {d.mentorado_nome}
                    </SelectItem>
                  ))}
                  <SelectItem value={GERAL}>
                    Sessão geral (sem dupla específica)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sup-data">Data da sessão</Label>
              <Input
                id="sup-data"
                name="data"
                type="date"
                required
                defaultValue={hoje}
                max={hoje}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="sup-resumo">Resumo</Label>
                <span
                  aria-hidden
                  className="text-xs tabular-nums text-muted-foreground"
                >
                  {resumoLen}/4.000
                </span>
              </div>
              <Textarea
                id="sup-resumo"
                name="resumo"
                required
                minLength={10}
                maxLength={4000}
                rows={4}
                onChange={(e) => setResumoLen(e.target.value.length)}
                placeholder="O que foi trabalhado na sessão, combinados e pontos de atenção"
              />
              <p className="text-xs text-muted-foreground">
                O mentor lê esse resumo. Escreva no tom da conversa, como um
                registro do que vocês construíram juntos.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Registrando…" : "Registrar supervisão"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
