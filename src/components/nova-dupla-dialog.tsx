"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createDupla } from "@/lib/actions";
import { cronogramaVigente, rotuloCronograma } from "@/lib/ciclo";
import { AfinidadePar } from "@/components/matching-afinidade";
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
import type {
  Cronograma,
  Disponibilidade,
  Escolaridade,
  Genero,
  PrefGeneroPar,
} from "@/lib/types";

type Opt = {
  id: string;
  nome: string;
  role?: string | null;
  interesses?: string[] | null;
  cidade?: string | null;
  uf?: string | null;
};
type MentoradoOpt = {
  id: string;
  nome: string;
  interesses?: string[] | null;
  cidade?: string | null;
  uf?: string | null;
  objetivos?: string | null;
  escolaridade?: Escolaridade | null;
  disponibilidade?: Disponibilidade | null;
};
/** Campos sensíveis das views *_pessoal (0034) — coord-only; fora dela o
 *  select volta vazio e a afinidade omite os campos. */
type Pessoal = {
  genero: Genero | null;
  pref_genero_par: PrefGeneroPar | null;
  motivacao: string | null;
  data_nascimento?: string | null;
};
const NENHUM = "__nenhum";

export function NovaDuplaDialog() {
  const [open, setOpen] = useState(false);
  const [mentores, setMentores] = useState<Opt[]>([]);
  const [mentorados, setMentorados] = useState<MentoradoOpt[]>([]);
  const [supervisores, setSupervisores] = useState<Opt[]>([]);
  // vagas por mentor: quantas duplas ativas/pausadas já tem vs. capacidade
  const [emUso, setEmUso] = useState<Record<string, number>>({});
  const [capacidade, setCapacidade] = useState<Record<string, number>>({});
  // mentorado ocupado POR TRILHA — a de especialista convive com a DPP do
  // mesmo mentorado; só ocupa vaga de novo na trilha em que já está
  const [ocupacao, setOcupacao] = useState<Map<string, Set<string>>>(new Map());
  // carga de supervisão: quantas duplas ativas/pausadas cada supervisor já tem
  const [emSup, setEmSup] = useState<Record<string, number>>({});
  // ficha de matching por mentor (disponibilidade/áreas) e sensíveis por id —
  // views *_pessoal só devolvem linhas pra coordenação
  const [fichaMentor, setFichaMentor] = useState<
    Map<string, { disponibilidade: Disponibilidade | null; areas: string[] | null }>
  >(new Map());
  const [pessoalMentor, setPessoalMentor] = useState<Map<string, Pessoal>>(new Map());
  const [pessoalMentorado, setPessoalMentorado] = useState<Map<string, Pessoal>>(new Map());
  // cronogramas do select (0061) — cada um é um calendário oficial por turma;
  // a dupla DPP nasce vinculada ao escolhido (o vigente é o default)
  const [cronogramas, setCronogramas] = useState<Cronograma[]>([]);
  // mentor escolhido — a trilha da dupla nasce do papel dele
  const [mentorSel, setMentorSel] = useState<string | null>(null);
  const [mentoradoSel, setMentoradoSel] = useState<string | null>(null);
  // fetch das opções tem estado explícito — select vazio após erro não pode
  // parecer "ninguém cadastrado"
  const [pronto, setPronto] = useState(false);
  const [falha, setFalha] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  // 1ª carga com skeleton; refetch de reabertura usa o cache — falha ali vira
  // toast, não bloqueio (as opções já carregadas continuam valendo)
  const carregou = useRef(false);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    let cancelado = false;
    (async () => {
      try {
        const [perfis, ments, duplasRes, mps, cronsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, nome, role, interesses, cidade, uf")
            .in("role", ["mentor_dpp", "mentor_especialista", "supervisor"])
            .eq("ativo", true)
            .order("nome"),
          supabase
            .from("mentorados")
            .select("id, nome, interesses, objetivos, escolaridade, cidade, uf, disponibilidade")
            .order("nome"),
          // sem filtro de status: a ocupação filtra em JS sobre o histórico
          // completo
          supabase
            .from("duplas")
            .select("mentor_id, mentorado_id, supervisor_id, trilha, status"),
          supabase
            .from("mentor_profiles")
            .select("profile_id, capacidade, disponibilidade, areas"),
          supabase.from("cronogramas").select("*").order("turma").order("nome"),
        ]);
        const erro = [perfis, ments, duplasRes, mps, cronsRes].find((r) => r.error)?.error;
        if (erro) throw erro;
        if (cancelado) return;
        setMentores((perfis.data ?? []).filter((p) => p.role !== "supervisor"));
        setSupervisores((perfis.data ?? []).filter((p) => p.role === "supervisor"));
        setMentorados((ments.data ?? []) as MentoradoOpt[]);
        const contagem: Record<string, number> = {};
        const ocup = new Map<string, Set<string>>();
        const sup: Record<string, number> = {};
        for (const d of (duplasRes.data ?? []).filter((x) =>
          x.status === "ativa" || x.status === "pausada"
        )) {
          contagem[d.mentor_id] = (contagem[d.mentor_id] ?? 0) + 1;
          const trilhas = ocup.get(d.mentorado_id) ?? new Set<string>();
          trilhas.add(d.trilha ?? "dpp");
          ocup.set(d.mentorado_id, trilhas);
          if (d.supervisor_id) sup[d.supervisor_id] = (sup[d.supervisor_id] ?? 0) + 1;
        }
        setEmUso(contagem);
        setOcupacao(ocup);
        setEmSup(sup);
        const porMentor: Record<string, number> = {};
        const fichas = new Map<
          string,
          { disponibilidade: Disponibilidade | null; areas: string[] | null }
        >();
        for (const mp of mps.data ?? []) {
          porMentor[mp.profile_id] = mp.capacidade;
          fichas.set(mp.profile_id, {
            disponibilidade: (mp.disponibilidade as Disponibilidade | null) ?? null,
            areas: (mp.areas as string[] | null) ?? null,
          });
        }
        setCapacidade(porMentor);
        setFichaMentor(fichas);
        setCronogramas((cronsRes.data ?? []) as Cronograma[]);
        carregou.current = true;
        setPronto(true);
      } catch {
        if (cancelado) return;
        if (carregou.current) {
          toast.error(
            "Não foi possível atualizar as opções. As carregadas antes continuam valendo."
          );
        } else {
          setFalha(true);
        }
      }
    })();
    // sensíveis de matching — as views *_pessoal (0034) filtram por papel no
    // banco: pra coord retornam linhas, pra qualquer outro papel voltam [].
    // Best-effort de propósito: falha aqui não pode derrubar o form (o par
    // só perde os campos de afinidade)
    supabase
      .from("profiles_pessoal")
      .select("id, genero, pref_genero_par, motivacao")
      .then(({ data }) =>
        setPessoalMentor(new Map((data ?? []).map((r) => [r.id, r as Pessoal])))
      );
    supabase
      .from("mentorados_pessoal")
      .select("id, genero, pref_genero_par, motivacao, data_nascimento")
      .then(({ data }) =>
        setPessoalMentorado(new Map((data ?? []).map((r) => [r.id, r as Pessoal])))
      );
    return () => {
      cancelado = true;
    };
  }, [open, tentativa]);

  const mentorSelObj = mentores.find((m) => m.id === mentorSel) ?? null;
  const mentoradoSelObj = mentorados.find((m) => m.id === mentoradoSel) ?? null;
  const ehEsp = mentorSelObj?.role === "mentor_especialista";
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
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // Select desmonta com o dialog — a trilha rederiva do próximo mentor
        if (o) {
          setMentorSel(null);
          setMentoradoSel(null);
          setFalha(false);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" className="max-sm:w-full"><Plus size={16} /> Nova dupla</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Formar dupla</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {falha && !pronto ? (
            // fetch das opções falhou — melhor um erro honesto com retry que
            // selects vazios fingindo "ninguém cadastrado"
            <div
              role="alert"
              className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3.5 py-3 text-sm"
            >
              <p className="font-medium">Não foi possível carregar as opções.</p>
              <p className="mt-0.5 text-muted-foreground">
                Confira a conexão e{" "}
                <button
                  type="button"
                  onClick={() => {
                    setFalha(false);
                    setTentativa((t) => t + 1);
                  }}
                  className="rounded-sm font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  tente de novo
                </button>
                .
              </p>
            </div>
          ) : !pronto ? (
            // skeleton na gramática do form — não mostra select vazio nem
            // placeholder que pareça estado final
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
                  ? `${m.nome} · ${emUso[m.id] ?? 0}/${capacidade[m.id] ?? 1} · especialista`
                  : `${m.nome} · ${emUso[m.id] ?? 0}/${capacidade[m.id] ?? 1}`,
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
                      {m.nome} · {usadas}/{total}{esp ? " · especialista" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {ehEsp && (
              <p className="text-xs text-muted-foreground">
                Mentoria especializada: até 5 encontros de 1h em até 3 meses,
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
              onValueChange={(v) => setMentoradoSel(v ? String(v) : null)}
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
          {/* comparação de afinidade — aparece quando os dois lados estão
              escolhidos; sensíveis vêm das views *_pessoal (coord-only) */}
          {mentorSelObj && mentoradoSelObj && (
            <AfinidadePar
              mentor={{
                nome: mentorSelObj.nome,
                interesses: mentorSelObj.interesses,
                cidade: mentorSelObj.cidade,
                uf: mentorSelObj.uf,
                genero: pessoalMentor.get(mentorSelObj.id)?.genero ?? null,
                pref_genero_par:
                  pessoalMentor.get(mentorSelObj.id)?.pref_genero_par ?? null,
                motivacao: pessoalMentor.get(mentorSelObj.id)?.motivacao ?? null,
                disponibilidade:
                  fichaMentor.get(mentorSelObj.id)?.disponibilidade ?? null,
                trilha: ehEsp ? "especialista" : "dpp",
                areas: fichaMentor.get(mentorSelObj.id)?.areas ?? null,
              }}
              mentorado={{
                nome: mentoradoSelObj.nome,
                interesses: mentoradoSelObj.interesses,
                cidade: mentoradoSelObj.cidade,
                uf: mentoradoSelObj.uf,
                genero: pessoalMentorado.get(mentoradoSelObj.id)?.genero ?? null,
                pref_genero_par:
                  pessoalMentorado.get(mentoradoSelObj.id)?.pref_genero_par ??
                  null,
                motivacao:
                  pessoalMentorado.get(mentoradoSelObj.id)?.motivacao ?? null,
                objetivos: mentoradoSelObj.objetivos,
                escolaridade: mentoradoSelObj.escolaridade,
                data_nascimento:
                  pessoalMentorado.get(mentoradoSelObj.id)?.data_nascimento ??
                  null,
                disponibilidade: mentoradoSelObj.disponibilidade ?? null,
              }}
            />
          )}
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
                placeholder="Por que essa mentoria existe: o que o mentorado precisa trabalhar com o especialista"
              />
              <p className="text-xs text-muted-foreground">
                O contexto aparece na ficha da dupla pro especialista.
              </p>
            </div>
          )}
          {/* cronograma só existe na trilha DPP (a especialista não tem
              calendário) — some junto com o supervisor. Sem opções o campo
              não finge erro: some e o server decide */}
          {!ehEsp && cronogramas.length > 0 && (
            <div className="space-y-2">
              <Label id="cronograma-label">Cronograma</Label>
              <Select
                name="cronograma_id"
                defaultValue={cronogramaVigente(cronogramas)?.id ?? cronogramas[cronogramas.length - 1]?.id}
                items={Object.fromEntries(
                  cronogramas.map((c) => [c.id, rotuloCronograma(c)])
                )}
              >
                <SelectTrigger id="cronograma" aria-labelledby="cronograma-label cronograma"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cronogramas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{rotuloCronograma(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O calendário oficial que a dupla segue — datas e o semáforo saem dele.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="iniciada_em">Início da mentoria</Label>
            <Input id="iniciada_em" name="iniciada_em" type="date" />
            <p className="text-xs text-muted-foreground">
              {ehEsp
                ? "Deixe em branco se a mentoria está começando agora. A dupla nasce hoje."
                : "Deixe em branco se a dupla já existia desde o início do programa. Se ela está começando agora, use a data de hoje."}
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Salvando…" : "Formar dupla"}
          </Button>
          </>
          )}
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
