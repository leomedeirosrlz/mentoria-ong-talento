"use client";

import { useEffect, useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { CaretDown } from "@phosphor-icons/react";
import { tetoMentor } from "@/lib/fila";
import type { MentorProfile } from "@/lib/queries";
import { temPapel } from "@/lib/types";
import type { Mentorado, Profile } from "@/lib/types";
import { AfinidadePar } from "@/components/matching-afinidade";
import { CapacidadeMentorDialog } from "@/components/capacidade-mentor-dialog";
import { NovaDuplaDialog } from "@/components/nova-dupla-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Painel do board de matching — aparece quando "Livres para dupla" está
 *  ligado em /pessoas (o chip só existe na visão da coordenação). A
 *  coordenação escolhe um mentorado livre e um mentor e compara a afinidade
 *  antes de abrir o dialog de criação. Os sensíveis já vêm mergeados nos
 *  props (views *_pessoal só devolvem pra coordenação).
 *
 *  Ocupação X/Y (REALIZA-116): todo mentor ativo aparece — com vaga
 *  primeiro, cheio afunda marcado "sem vaga". Selecionar um cheio é o
 *  convite pra comparar a afinidade e abrir "aumentar capacidade →":
 *  esconder seria fingir que o par certo não existe. */
export function MatchingPanel({
  mentores,
  mentorados,
  mentorProfiles,
  ocupacao,
}: {
  /** Todos os mentores ativos — o X/Y de cada um vem de ocupacao+profiles. */
  mentores: Profile[];
  mentorados: Mentorado[];
  mentorProfiles: Record<string, MentorProfile>;
  /** Duplas ativas/pausadas por mentor — a régua do trigger (0025/0073). */
  ocupacao: Record<string, number>;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("matching-open") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem("matching-open", open ? "1" : "0");
    } catch {
      // ignore
    }
  }, [open]);

  const [mentorId, setMentorId] = useState<string | null>(null);
  const [mentoradoId, setMentoradoId] = useState<string | null>(null);
  const [trilhaFiltro, setTrilhaFiltro] = useState<"dpp" | "especialista" | "todos">("dpp");
  const mentor = mentores.find((m) => m.id === mentorId) ?? null;
  const mentorado = mentorados.find((m) => m.id === mentoradoId) ?? null;
  const mp = mentor ? mentorProfiles[mentor.id] : undefined;

  // filtro de trilha no board (REALIZA-316): DPP / Especialista / Todos
  const mentoresFiltrados = mentores.filter((m) => {
    if (trilhaFiltro === "dpp") return temPapel(m, "mentor_dpp");
    if (trilhaFiltro === "especialista") return temPapel(m, "mentor_especialista");
    return true;
  });

  // pool efetivo de um mentor conforme o filtro selecionado
  const poolDe = (m: Profile): "dpp" | "especialista" => {
    if (trilhaFiltro === "dpp") return "dpp";
    if (trilhaFiltro === "especialista") return "especialista";
    return m.role === "mentor_especialista" ? "especialista" : "dpp";
  };

  // board de pareamento é DPP (WP6b): especialista pareja pelo mural. A
  // ocupação vem chaveada `${id}:${trilha}` — aqui sempre a pool DPP, e o
  // híbrido comparece só se tiver o papel DPP.
  const tetoDe = (id: string) => {
    const p = mentores.find((m) => m.id === id);
    if (!p) return 1;
    return tetoMentor(p, mentorProfiles[id], poolDe(p));
  };
  const usadasDe = (id: string) => {
    const p = mentores.find((m) => m.id === id);
    if (!p) return 0;
    return ocupacao[`${id}:${poolDe(p)}`] ?? 0;
  };
  const mentorLotado =
    mentor != null && usadasDe(mentor.id) >= tetoDe(mentor.id);
  const comVaga = mentoresFiltrados.filter((m) => usadasDe(m.id) < tetoDe(m.id));
  // livres primeiro (mais vagas na frente), cheios afundam; nome desempata —
  // mesma régua dos selects dos dialogs
  const mentoresOrd = [...mentoresFiltrados].sort(
    (a, b) =>
      tetoDe(b.id) - usadasDe(b.id) - (tetoDe(a.id) - usadasDe(a.id)) ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );
  const rotuloMentor = (m: Profile) => {
    const hibrido =
      temPapel(m, "mentor_dpp") && temPapel(m, "mentor_especialista");
    const cheio = usadasDe(m.id) >= tetoDe(m.id);
    const pool = poolDe(m) === "dpp" ? "DPP" : "Especialista";
    return `${m.nome} · ${usadasDe(m.id)}/${tetoDe(m.id)}${
      trilhaFiltro === "todos" ? ` · ${pool}` : ""
    }${hibrido && trilhaFiltro === "todos" ? " · híbrido" : ""}${
      cheio ? " · sem vaga" : ""
    }`;
  };

  // contagem de mentores livres (com vaga em qualquer pool) pro resumo do header
  const mentoresLivresCount = mentores.filter((m) => {
    if (temPapel(m, "mentor_dpp")) {
      const t = tetoMentor(m, mentorProfiles[m.id], "dpp");
      const u = ocupacao[`${m.id}:dpp`] ?? 0;
      if (t - u > 0) return true;
    }
    if (temPapel(m, "mentor_especialista")) {
      const t = tetoMentor(m, mentorProfiles[m.id], "especialista");
      const u = ocupacao[`${m.id}:especialista`] ?? 0;
      if (t - u > 0) return true;
    }
    return false;
  }).length;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <section className="rounded-xl bg-card shadow-[var(--shadow-border)] overflow-hidden">
        <Collapsible.Trigger
          className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5"
          aria-expanded={open}
        >
          <span className="text-base font-semibold">
            Matching · {mentoresLivresCount} mentores livres · {mentorados.length} jovens livres
          </span>
          <CaretDown
            aria-hidden
            size={16}
            className={cn("transition-transform duration-200", open && "rotate-180")}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel
          keepMounted
          className="h-[var(--collapsible-panel-height)] overflow-hidden opacity-100 transition-[height,opacity] duration-200 data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 [&[hidden]:not([hidden='until-found'])]:hidden"
        >
          <div className="space-y-3 px-4 pb-3.5 sm:px-5">
            {mentorados.length === 0 || mentoresFiltrados.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {mentorados.length === 0 && mentores.length === 0
                  ? "Ninguém livre pra parear agora."
                  : mentorados.length === 0
                    ? "Sem mentorado livre. Todos já estão em dupla."
                    : "Nenhum mentor ativo cadastrado pra esta trilha."}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Label id="parear-trilha-label">Trilha</Label>
                  <Select
                    value={trilhaFiltro}
                    onValueChange={(v) =>
                      setTrilhaFiltro((v ? String(v) : "dpp") as "dpp" | "especialista" | "todos")
                    }
                    items={{
                      dpp: "DPP",
                      especialista: "Especialista",
                      todos: "Todos",
                    }}
                  >
                    <SelectTrigger id="parear-trilha" aria-labelledby="parear-trilha-label" className="w-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dpp">DPP</SelectItem>
                      <SelectItem value="especialista">Especialista</SelectItem>
                      <SelectItem value="todos">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label id="parear-mentorado-label">Mentorado</Label>
                    <Select
                      items={Object.fromEntries(
                        mentorados.map((m) => [m.id, m.nome])
                      )}
                      onValueChange={(v) => setMentoradoId(v ? String(v) : null)}
                    >
                      <SelectTrigger
                        id="parear-mentorado"
                        aria-labelledby="parear-mentorado-label parear-mentorado"
                        className="w-full"
                      >
                        <SelectValue placeholder="Escolher" />
                      </SelectTrigger>
                      <SelectContent>
                        {mentorados.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label id="parear-mentor-label">Mentor</Label>
                    <Select
                      items={Object.fromEntries(
                        mentoresOrd.map((m) => [m.id, rotuloMentor(m)])
                      )}
                      onValueChange={(v) => setMentorId(v ? String(v) : null)}
                    >
                      <SelectTrigger
                        id="parear-mentor"
                        aria-labelledby="parear-mentor-label parear-mentor"
                        className="w-full"
                      >
                        <SelectValue placeholder="Escolher" />
                      </SelectTrigger>
                      <SelectContent>
                        {mentoresOrd.map((m) => {
                          const cheio = usadasDe(m.id) >= tetoDe(m.id);
                          return (
                            <SelectItem
                              key={m.id}
                              value={m.id}
                              className={
                                cheio ? "text-muted-foreground" : undefined
                              }
                            >
                              {rotuloMentor(m)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {comVaga.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Todos os mentores estão sem vaga. Aumente a capacidade de
                        um deles pra parear.
                      </p>
                    )}
                  </div>
                </div>
                {mentor && mentorLotado && (
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--warn-text)]">
                    {mentor.nome.split(" ")[0]} está sem vaga ({usadasDe(mentor.id)}
                    /{tetoDe(mentor.id)} duplas em andamento). Se a afinidade
                    fechar,{" "}
                    <CapacidadeMentorDialog
                      mentorId={mentor.id}
                      nome={mentor.nome}
                      atual={tetoDe(mentor.id)}
                      emUso={usadasDe(mentor.id)}
                      trilha={mentor ? poolDe(mentor) : "dpp"}
                      trigger={
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="-my-2 sm:my-0"
                        >
                          aumentar capacidade →
                        </Button>
                      }
                    />
                  </p>
                )}
                {mentor && mentorado ? (
                  <AfinidadePar
                    mentor={{
                      nome: mentor.nome,
                      interesses: mentor.interesses,
                      cidade: mentor.cidade,
                      uf: mentor.uf,
                      genero: mentor.genero ?? null,
                      pref_genero_par: mentor.pref_genero_par ?? null,
                      motivacao: mentor.motivacao ?? null,
                      disponibilidade: mp?.disponibilidade ?? null,
                      trilha: mentor ? poolDe(mentor) : "dpp",
                      areas: mp?.areas ?? null,
                    }}
                    mentorado={{
                      nome: mentorado.nome,
                      interesses: mentorado.interesses,
                      cidade: mentorado.cidade,
                      uf: mentorado.uf,
                      genero: mentorado.genero ?? null,
                      pref_genero_par: mentorado.pref_genero_par ?? null,
                      motivacao: mentorado.motivacao ?? null,
                      objetivos: mentorado.objetivos,
                      escolaridade: mentorado.escolaridade,
                      data_nascimento: mentorado.data_nascimento,
                      disponibilidade: mentorado.disponibilidade ?? null,
                    }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Escolha um mentorado e um mentor pra comparar interesses,
                    preferências e agenda antes de formar a dupla.
                  </p>
                )}
              </>
            )}
            <div className="pt-1">
              <NovaDuplaDialog />
            </div>
          </div>
        </Collapsible.Panel>
      </section>
    </Collapsible.Root>
  );
}