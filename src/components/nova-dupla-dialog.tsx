"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createDupla } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Opt = { id: string; nome: string; role?: string | null };
const NENHUM = "__nenhum";

export function NovaDuplaDialog() {
  const [open, setOpen] = useState(false);
  const [mentores, setMentores] = useState<Opt[]>([]);
  const [mentorados, setMentorados] = useState<Opt[]>([]);
  const [supervisores, setSupervisores] = useState<Opt[]>([]);
  // vagas por mentor: quantas duplas ativas/pausadas já tem vs. capacidade
  const [emUso, setEmUso] = useState<Record<string, number>>({});
  const [capacidade, setCapacidade] = useState<Record<string, number>>({});
  // mentorado em dupla ativa/pausada não pode entrar em outra — encerrada libera
  const [mentoradosOcupados, setMentoradosOcupados] = useState<Set<string>>(new Set());
  // carga de supervisão: quantas duplas ativas/pausadas cada supervisor já tem
  const [emSup, setEmSup] = useState<Record<string, number>>({});
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, nome, role")
      .in("role", ["mentor_dpp", "mentor_especialista", "supervisor"])
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        setMentores((data ?? []).filter((p) => p.role !== "supervisor"));
        setSupervisores((data ?? []).filter((p) => p.role === "supervisor"));
      });
    supabase
      .from("mentorados")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => setMentorados(data ?? []));
    supabase
      .from("duplas")
      .select("mentor_id, mentorado_id, supervisor_id")
      .in("status", ["ativa", "pausada"])
      .then(({ data }) => {
        const contagem: Record<string, number> = {};
        const ocupados = new Set<string>();
        const sup: Record<string, number> = {};
        for (const d of data ?? []) {
          contagem[d.mentor_id] = (contagem[d.mentor_id] ?? 0) + 1;
          ocupados.add(d.mentorado_id);
          if (d.supervisor_id) sup[d.supervisor_id] = (sup[d.supervisor_id] ?? 0) + 1;
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
  }, [open]);

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
  const mentoradosOrd = [...mentorados].sort(
    (a, b) =>
      Number(mentoradosOcupados.has(a.id)) - Number(mentoradosOcupados.has(b.id)) ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );
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
        const res = await createDupla(fd);
        if (res?.error) toast.error(res.error);
        else {
          // toast nomeia a dupla — a confirmação tem que ser reconhecível
          const mentorNome = mentores.find((m) => m.id === fd.get("mentor_id"))?.nome;
          const mentoradoNome = mentorados.find((m) => m.id === fd.get("mentorado_id"))?.nome;
          toast.success(
            mentorNome && mentoradoNome
              ? `Dupla formada: ${mentorNome} e ${mentoradoNome}.`
              : "Dupla formada."
          );
          setOpen(false);
          router.refresh();
        }
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus size={16} /> Nova dupla</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Formar dupla</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label id="mentor-label">
              {/* dot de papel — distinção não-cromática é o texto; a cor é redundância */}
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentor)]" />
              Mentor
            </Label>
            <Select
              name="mentor_id"
              required
              items={Object.fromEntries(mentoresOrd.map((m) => [
                m.id,
                m.role === "mentor_especialista"
                  ? `${m.nome} — trilha especialista (em breve)`
                  : `${m.nome} — ${emUso[m.id] ?? 0}/${capacidade[m.id] ?? 1}`,
              ]))}
            >
              <SelectTrigger id="mentor" aria-labelledby="mentor-label mentor"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {mentores.length === 0 && (
                  <SelectItem value="__vazio" disabled>Nenhum mentor cadastrado</SelectItem>
                )}
                {mentoresOrd.map((m) => {
                  const usadas = emUso[m.id] ?? 0;
                  const total = capacidade[m.id] ?? 1;
                  // especialista tem trilha própria de 5 encontros ainda não
                  // modelada — bloqueado até o calendário dela existir
                  const esp = m.role === "mentor_especialista";
                  return (
                    <SelectItem key={m.id} value={m.id} disabled={usadas >= total || esp}>
                      {m.nome} — {esp ? "trilha especialista (em breve)" : `${usadas}/${total}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {mentores.length === 0 && (
              <CampoVazio texto="Nenhum mentor cadastrado ainda." />
            )}
          </div>
          <div className="space-y-2">
            <Label id="mentorado-label">
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
              Mentorado
            </Label>
            <Select
              name="mentorado_id"
              required
              items={Object.fromEntries(mentoradosOrd.map((m) => [
                m.id,
                mentoradosOcupados.has(m.id) ? `${m.nome} (em dupla)` : m.nome,
              ]))}
            >
              <SelectTrigger id="mentorado" aria-labelledby="mentorado-label mentorado"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {mentorados.length === 0 && (
                  <SelectItem value="__vazio" disabled>Nenhum mentorado cadastrado</SelectItem>
                )}
                {mentoradosOrd.map((m) => {
                  const emDupla = mentoradosOcupados.has(m.id);
                  return (
                    <SelectItem key={m.id} value={m.id} disabled={emDupla}>
                      {emDupla ? `${m.nome} (em dupla)` : m.nome}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {mentorados.length === 0 && (
              <CampoVazio texto="Nenhum mentorado cadastrado ainda." />
            )}
          </div>
          <div className="space-y-2">
            <Label id="supervisor-label">Supervisor de relacionamento (opcional)</Label>
            <Select
              name="supervisor_id"
              defaultValue={NENHUM}
              items={{ [NENHUM]: "Nenhum", ...Object.fromEntries(supervisoresOrd.map((m) => [m.id, m.nome])) }}
            >
              <SelectTrigger id="supervisor" aria-labelledby="supervisor-label supervisor"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Nenhum</SelectItem>
                {supervisoresOrd.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="iniciada_em">Início da mentoria</Label>
            <Input id="iniciada_em" name="iniciada_em" type="date" />
            <p className="text-xs text-muted-foreground">
              vazio = a dupla já existia desde o início do ciclo. Se ela está
              começando agora, use a data de hoje.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando..." : "Formar dupla"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Select vazio não é beco sem saída — aponta onde cadastrar a pessoa que falta. */
function CampoVazio({ texto }: { texto: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      {texto}{" "}
      <Link href="/pessoas" className="font-medium text-foreground underline underline-offset-2">
        Cadastrar em Pessoas
      </Link>
    </p>
  );
}
