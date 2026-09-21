"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { deleteDupla, updateDupla } from "@/lib/actions";
import type { Dupla, DuplaStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Opt = { id: string; nome: string; role?: string | null };
const NENHUM = "__nenhum";

// sem items o trigger fechado mostra o value cru (UUID/enum)
const STATUS_DUPLA: Record<string, string> = {
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

export function EditarDuplaDialog({ dupla }: { dupla: Dupla }) {
  const [open, setOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [mentores, setMentores] = useState<Opt[]>([]);
  const [mentorados, setMentorados] = useState<Opt[]>([]);
  const [supervisores, setSupervisores] = useState<Opt[]>([]);
  // vagas por mentor: quantas duplas ativas/pausadas já tem vs. capacidade
  const [emUso, setEmUso] = useState<Record<string, number>>({});
  const [capacidade, setCapacidade] = useState<Record<string, number>>({});
  // mentorado em outra dupla ativa/pausada não pode migrar — encerrada libera
  const [mentoradosOcupados, setMentoradosOcupados] = useState<Set<string>>(new Set());
  // carga de supervisão: quantas duplas ativas/pausadas cada supervisor já tem
  const [emSup, setEmSup] = useState<Record<string, number>>({});
  // os Selects só montam com os items carregados — antes disso o trigger
  // exibiria o UUID cru do defaultValue
  const [pronto, setPronto] = useState(false);
  // status escolhido agora — a nota de efeito (FR-3) reage à escolha, não ao valor salvo
  const [statusSel, setStatusSel] = useState<DuplaStatus>(dupla.status);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    // depois da 1ª carga pronto segue true: reabrir o dialog já monta os
    // Selects com os items em cache (o refetch abaixo atualiza em segundo plano)
    const supabase = createClient();
    void Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, role")
        .in("role", ["mentor_dpp", "mentor_especialista", "supervisor"])
        .eq("ativo", true)
        .order("nome")
        .then(({ data }) => {
          const ms: Opt[] = (data ?? []).filter((p) => p.role !== "supervisor");
          const ss: Opt[] = (data ?? []).filter((p) => p.role === "supervisor");
          if (!ms.some((m) => m.id === dupla.mentor.id)) {
            ms.unshift({ id: dupla.mentor.id, nome: `${dupla.mentor.nome} (atual)` });
          }
          const sup = dupla.supervisor;
          if (sup && !ss.some((s) => s.id === sup.id)) {
            ss.unshift({ id: sup.id, nome: `${sup.nome} (atual)` });
          }
          setMentores(ms);
          setSupervisores(ss);
        }),
      supabase
        .from("mentorados")
        .select("id, nome")
        .order("nome")
        .then(({ data }) => setMentorados(data ?? [])),
    ]).then(() => setPronto(true));
    // a própria dupla não conta — senão o mentor atual apareceria lotado por
    // causa dela e o próprio mentorado sairia marcado como ocupado
    supabase
      .from("duplas")
      .select("mentor_id, mentorado_id, supervisor_id")
      .in("status", ["ativa", "pausada"])
      .neq("id", dupla.id)
      .then(({ data }) => {
        const contagem: Record<string, number> = {};
        const ocupados = new Set<string>();
        const sup: Record<string, number> = {};
        for (const d of data ?? []) {
          contagem[d.mentor_id] = (contagem[d.mentor_id] ?? 0) + 1;
          ocupados.add(d.mentorado_id);
          if (d.supervisor_id) sup[d.supervisor_id] = (sup[d.supervisor_id] ?? 0) + 1;
        }
        // a query excluiu a própria dupla, mas ela conta na carga do supervisor atual
        if (dupla.supervisor && dupla.status !== "encerrada") {
          sup[dupla.supervisor.id] = (sup[dupla.supervisor.id] ?? 0) + 1;
        }
        setEmUso(contagem);
        setMentoradosOcupados(ocupados);
        setEmSup(sup);
      });
    supabase
      .from("mentor_profiles")
      .select("profile_id, capacidade")
      .then(({ data }) => {
        const porMentor: Record<string, number> = {};
        for (const mp of data ?? []) porMentor[mp.profile_id] = mp.capacidade;
        setCapacidade(porMentor);
      });
  }, [open, dupla.id, dupla.mentor.id, dupla.mentor.nome, dupla.supervisor, dupla.status]);

  // selects longos (>7): relevância antes de alfabética — quem pode ser
  // escolhido aparece primeiro, disabled afunda, nome (pt-BR) só desempata
  const mentoresOrd = [...mentores].sort((a, b) => {
    // especialista está bloqueado (trilha de 5 não modelada) — afunda sempre
    const espA = a.role === "mentor_especialista";
    const espB = b.role === "mentor_especialista";
    const livresA = espA
      ? -Infinity
      : (capacidade[a.id] ?? 1) - (emUso[a.id] ?? 0);
    const livresB = espB
      ? -Infinity
      : (capacidade[b.id] ?? 1) - (emUso[b.id] ?? 0);
    return livresB - livresA || a.nome.localeCompare(b.nome, "pt-BR");
  });
  const mentoradosOrd = [...mentorados].sort((a, b) => {
    const ocA = a.id !== dupla.mentorado.id && mentoradosOcupados.has(a.id) ? 1 : 0;
    const ocB = b.id !== dupla.mentorado.id && mentoradosOcupados.has(b.id) ? 1 : 0;
    return ocA - ocB || a.nome.localeCompare(b.nome, "pt-BR");
  });
  // supervisor com menos duplas primeiro — distribui a carga de acompanhamento
  const supervisoresOrd = [...supervisores].sort(
    (a, b) => (emSup[a.id] ?? 0) - (emSup[b.id] ?? 0) || a.nome.localeCompare(b.nome, "pt-BR")
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get("supervisor_id") === NENHUM) fd.set("supervisor_id", "");
    start(async () => {
      try {
        const res = await updateDupla(dupla.id, fd);
        if (res?.error) toast.error(res.error);
        else {
          // toast nomeia a dupla — resolve pelos ids escolhidos (podem ter mudado)
          const mid = String(fd.get("mentor_id") ?? "");
          const did = String(fd.get("mentorado_id") ?? "");
          const mentorNome =
            mid === dupla.mentor.id
              ? dupla.mentor.nome
              : mentores.find((m) => m.id === mid)?.nome;
          const mentoradoNome =
            did === dupla.mentorado.id
              ? dupla.mentorado.nome
              : mentorados.find((m) => m.id === did)?.nome;
          toast.success(
            mentorNome && mentoradoNome
              ? `Dupla atualizada: ${mentorNome} e ${mentoradoNome}.`
              : "Dupla atualizada."
          );
          setOpen(false);
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  const registrosCount = dupla.encontros.filter((e) => e.registro).length;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          // Select desmonta com o dialog e volta ao defaultValue — alinha a nota
          if (o) setStatusSel(dupla.status);
        }}
      >
        <DialogTrigger render={<Button variant="outline" size="sm"><PencilSimple size={15} /> Editar</Button>} />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar dupla</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {!pronto ? (
              <div className="space-y-4" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-9 animate-pulse rounded-lg bg-muted" />
                  </div>
                ))}
                <div className="h-9 animate-pulse rounded-lg bg-muted" />
              </div>
            ) : (
            <>
            <div className="space-y-2">
              <Label id="edit-mentor-label">
                {/* dot de papel — distinção não-cromática é o texto; a cor é redundância */}
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentor)]" />
                Mentor
              </Label>
              <Select
                name="mentor_id"
                required
                defaultValue={dupla.mentor.id}
                items={Object.fromEntries(mentoresOrd.map((m) => [
                  m.id,
                  m.role === "mentor_especialista"
                    ? `${m.nome} — trilha especialista — indisponível`
                    : `${m.nome} — ${emUso[m.id] ?? 0}/${capacidade[m.id] ?? 1}`,
                ]))}
              >
                <SelectTrigger id="edit-mentor-select" aria-labelledby="edit-mentor-label edit-mentor-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mentoresOrd.map((m) => {
                    const usadas = emUso[m.id] ?? 0;
                    const total = capacidade[m.id] ?? 1;
                    // trilha especialista (5 encontros) ainda não modelada —
                    // mover a dupla pra ela quebraria o calendário
                    const esp = m.role === "mentor_especialista";
                    return (
                      <SelectItem key={m.id} value={m.id} disabled={usadas >= total || esp}>
                        {m.nome} — {esp ? "trilha especialista — indisponível" : `${usadas}/${total}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label id="edit-mentorado-label">
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
                Mentorado
              </Label>
              <Select
                name="mentorado_id"
                required
                defaultValue={dupla.mentorado.id}
                items={Object.fromEntries(mentoradosOrd.map((m) => [
                  m.id,
                  m.id !== dupla.mentorado.id && mentoradosOcupados.has(m.id) ? `${m.nome} (em dupla)` : m.nome,
                ]))}
              >
                <SelectTrigger id="edit-mentorado-select" aria-labelledby="edit-mentorado-label edit-mentorado-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mentoradosOrd.map((m) => {
                    // o da própria dupla nunca aparece ocupado (a query já a
                    // exclui; o guarda-chuva cobre dados inconsistentes)
                    const emDupla = m.id !== dupla.mentorado.id && mentoradosOcupados.has(m.id);
                    return (
                      <SelectItem key={m.id} value={m.id} disabled={emDupla}>
                        {emDupla ? `${m.nome} (em dupla)` : m.nome}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label id="edit-supervisor-label">Supervisor</Label>
                <Select
                  name="supervisor_id"
                  defaultValue={dupla.supervisor?.id ?? NENHUM}
                  items={{ [NENHUM]: "Nenhum", ...Object.fromEntries(supervisoresOrd.map((s) => [s.id, s.nome])) }}
                >
                  <SelectTrigger id="edit-supervisor-select" aria-labelledby="edit-supervisor-label edit-supervisor-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Nenhum</SelectItem>
                    {supervisoresOrd.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label id="edit-status-label">Status</Label>
                <Select
                  name="status"
                  defaultValue={dupla.status}
                  items={STATUS_DUPLA}
                  onValueChange={(v) => setStatusSel(v ?? dupla.status)}
                >
                  <SelectTrigger id="edit-status-select" aria-labelledby="edit-status-label edit-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="pausada">Pausada</SelectItem>
                    <SelectItem value="encerrada">Encerrada</SelectItem>
                  </SelectContent>
                </Select>
                {/* alto impacto mas reversível: declara o efeito antes de salvar */}
                {statusSel === "pausada" && (
                  <p className="text-xs text-muted-foreground">
                    Pausada sai do semáforo e do acompanhamento até voltar pra Ativa —
                    pedido de apoio continua visível.
                  </p>
                )}
                {statusSel === "encerrada" && (
                  <p className="text-xs text-muted-foreground">
                    Encerrada sai do semáforo e do acompanhamento — nem pedido de apoio
                    reaparece. O histórico fica salvo e a pausa pode ser revertida reabrindo a edição.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inicio">Início da mentoria</Label>
              <Input id="inicio" name="iniciada_em" type="date" defaultValue={dupla.iniciada_em ?? ""} />
              <p className="text-xs text-muted-foreground">vazio mantém a data atual</p>
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            </>
            )}
          </form>

          <div className="border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive w-full"
              onClick={() => { setOpen(false); setDelOpen(true); }}
            >
              Excluir dupla
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteButton
        open={delOpen}
        onOpenChange={setDelOpen}
        titulo="Excluir dupla?"
        descricao={`Apaga a dupla ${dupla.mentor.nome} e ${dupla.mentorado.nome} junto com ${dupla.encontros.length} ${dupla.encontros.length === 1 ? "encontro" : "encontros"} e ${registrosCount} ${registrosCount === 1 ? "registro" : "registros"}. Essa ação não tem volta. Se quiser manter o histórico, prefira encerrar a dupla.`}
        sucesso={`Dupla ${dupla.mentor.nome} e ${dupla.mentorado.nome} excluída.`}
        onConfirm={async () => {
          const res = await deleteDupla(dupla.id);
          if (res?.ok) router.push("/duplas");
          return res;
        }}
      />
    </>
  );
}
