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
import { Textarea } from "@/components/ui/textarea";
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
  // mentorado ocupado POR TRILHA — a de especialista convive com a DPP do
  // mesmo mentorado; só ocupa vaga de novo na trilha em que já está
  const [ocupacao, setOcupacao] = useState<Map<string, Set<string>>>(new Map());
  // carga de supervisão: quantas duplas ativas/pausadas cada supervisor já tem
  const [emSup, setEmSup] = useState<Record<string, number>>({});
  // mentor escolhido — a trilha da dupla nasce do papel dele
  const [mentorSel, setMentorSel] = useState<string | null>(null);
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
      .select("mentor_id, mentorado_id, supervisor_id, trilha")
      .in("status", ["ativa", "pausada"])
      .then(({ data }) => {
        const contagem: Record<string, number> = {};
        const ocup = new Map<string, Set<string>>();
        const sup: Record<string, number> = {};
        for (const d of data ?? []) {
          contagem[d.mentor_id] = (contagem[d.mentor_id] ?? 0) + 1;
          const trilhas = ocup.get(d.mentorado_id) ?? new Set<string>();
          trilhas.add(d.trilha ?? "dpp");
          ocup.set(d.mentorado_id, trilhas);
          if (d.supervisor_id) sup[d.supervisor_id] = (sup[d.supervisor_id] ?? 0) + 1;
        }
        setEmUso(contagem);
        setOcupacao(ocup);
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

  const ehEsp = mentores.find((m) => m.id === mentorSel)?.role === "mentor_especialista";
  const trilhaSel: "dpp" | "especialista" | null = mentorSel
    ? ehEsp ? "especialista" : "dpp"
    : null;
  // mentorado indisponível só na trilha em que já está — estar na DPP não
  // impede a de especialista (é exatamente o caso de uso dela)
  const ocupadoEm = (id: string) => {
    const trilhas = ocupacao.get(id);
    if (!trilhas) return null;
    return trilhaSel ? (trilhas.has(trilhaSel) ? trilhaSel : null) : null;
  };
  const rotuloOcupado = (id: string) => {
    const trilhas = ocupacao.get(id);
    if (!trilhas) return null;
    const lista = [...trilhas].map((t) => (t === "especialista" ? "especialista" : "DPP"));
    return `em dupla ${lista.join(" e ")}`;
  };

  // selects longos (>7): relevância antes de alfabética — quem pode ser
  // escolhido aparece primeiro, disabled afunda, nome (pt-BR) só desempata
  const mentoresOrd = [...mentores].sort(
    (a, b) =>
      (capacidade[b.id] ?? 1) - (emUso[b.id] ?? 0) -
        ((capacidade[a.id] ?? 1) - (emUso[a.id] ?? 0)) ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );
  const mentoradosOrd = [...mentorados].sort(
    (a, b) =>
      Number(ocupadoEm(a.id) != null) - Number(ocupadoEm(b.id) != null) ||
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
    // dupla de especialista nunca leva supervisor — o server força null também
    if (ehEsp) fd.set("supervisor_id", "");
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Select desmonta com o dialog — a trilha rederiva do próximo mentor
        if (o) setMentorSel(null);
      }}
    >
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
                  ? `${m.nome} — ${emUso[m.id] ?? 0}/${capacidade[m.id] ?? 1} · especialista`
                  : `${m.nome} — ${emUso[m.id] ?? 0}/${capacidade[m.id] ?? 1}`,
              ]))}
              onValueChange={(v) => setMentorSel(v ? String(v) : null)}
            >
              <SelectTrigger id="mentor" aria-labelledby="mentor-label mentor"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {mentores.length === 0 && (
                  <SelectItem value="__vazio" disabled>Nenhum mentor cadastrado</SelectItem>
                )}
                {mentoresOrd.map((m) => {
                  const usadas = emUso[m.id] ?? 0;
                  const total = capacidade[m.id] ?? 1;
                  const esp = m.role === "mentor_especialista";
                  return (
                    <SelectItem key={m.id} value={m.id} disabled={usadas >= total}>
                      {m.nome} — {usadas}/{total}{esp ? " · especialista" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {ehEsp && (
              <p className="text-xs text-muted-foreground">
                Mentoria especializada — até 5 encontros de 1h em até 3 meses,
                com datas combinadas pela dupla (sem calendário fixo).
              </p>
            )}
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
                rotuloOcupado(m.id) ? `${m.nome} (${rotuloOcupado(m.id)})` : m.nome,
              ]))}
            >
              <SelectTrigger id="mentorado" aria-labelledby="mentorado-label mentorado"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {mentorados.length === 0 && (
                  <SelectItem value="__vazio" disabled>Nenhum mentorado cadastrado</SelectItem>
                )}
                {mentoradosOrd.map((m) => {
                  const ocupado = ocupadoEm(m.id) != null;
                  return (
                    <SelectItem key={m.id} value={m.id} disabled={ocupado}>
                      {rotuloOcupado(m.id) ? `${m.nome} (${rotuloOcupado(m.id)})` : m.nome}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {mentorados.length === 0 && (
              <CampoVazio texto="Nenhum mentorado cadastrado ainda." />
            )}
          </div>
          {/* dupla de especialista não tem supervisor — o campo some em vez de
              desabilitar pra não sugerir uma supervisão que não existe */}
          {!ehEsp && (
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
          )}
          {ehEsp && (
            <div className="space-y-2">
              <Label htmlFor="demanda">Contexto (opcional)</Label>
              <Textarea
                id="demanda"
                name="demanda"
                rows={3}
                placeholder="Por que essa mentoria existe — o que o mentorado precisa trabalhar com o especialista"
              />
              <p className="text-xs text-muted-foreground">
                O contexto aparece na ficha da dupla pro especialista.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="iniciada_em">Início da mentoria</Label>
            <Input id="iniciada_em" name="iniciada_em" type="date" />
            <p className="text-xs text-muted-foreground">
              {ehEsp
                ? "Deixe em branco se a mentoria está começando agora — a dupla nasce hoje."
                : "Deixe em branco se a dupla já existia desde o início do programa. Se ela está começando agora, use a data de hoje."}
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : "Formar dupla"}
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
