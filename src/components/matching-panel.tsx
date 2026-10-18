"use client";

import { useState } from "react";
import { tetoMentor } from "@/lib/fila";
import type { MentorProfile } from "@/lib/queries";
import { temPapel } from "@/lib/types";
import type { Mentorado, Profile } from "@/lib/types";
import { AfinidadePar } from "@/components/matching-afinidade";
import { CapacidadeMentorDialog } from "@/components/capacidade-mentor-dialog";
import { NovaDuplaDialog } from "@/components/nova-dupla-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [mentoradoId, setMentoradoId] = useState<string | null>(null);
  const mentor = mentores.find((m) => m.id === mentorId) ?? null;
  const mentorado = mentorados.find((m) => m.id === mentoradoId) ?? null;
  const mp = mentor ? mentorProfiles[mentor.id] : undefined;

  // board de pareamento é DPP (WP6b): especialista pareja pelo mural. A
  // ocupação vem chaveada `${id}:${trilha}` — aqui sempre a pool DPP, e o
  // híbrido comparece só se tiver o papel DPP.
  const tetoDe = (id: string) => {
    const p = mentores.find((m) => m.id === id);
    return p ? tetoMentor(p, mentorProfiles[id], "dpp") : 1;
  };
  const usadasDe = (id: string) => ocupacao[`${id}:dpp`] ?? 0;
  const mentorLotado =
    mentor != null && usadasDe(mentor.id) >= tetoDe(mentor.id);
  const comVaga = mentores.filter((m) => usadasDe(m.id) < tetoDe(m.id));
  // livres primeiro (mais vagas na frente), cheios afundam; nome desempata —
  // mesma régua dos selects dos dialogs
  const mentoresOrd = [...mentores].sort(
    (a, b) =>
      tetoDe(b.id) - usadasDe(b.id) - (tetoDe(a.id) - usadasDe(a.id)) ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );
  const rotuloMentor = (m: Profile) => {
    const hibrido =
      temPapel(m, "mentor_dpp") && temPapel(m, "mentor_especialista");
    const cheio = usadasDe(m.id) >= tetoDe(m.id);
    return `${m.nome} · ${usadasDe(m.id)}/${tetoDe(m.id)}${
      hibrido ? " · DPP e especialista" : ""
    }${cheio ? " · sem vaga" : ""}`;
  };

  return (
    <section className="space-y-3 rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Parear
        </h2>
        <NovaDuplaDialog />
      </div>
      {mentorados.length === 0 || mentores.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {mentorados.length === 0 && mentores.length === 0
            ? "Ninguém livre pra parear agora."
            : mentorados.length === 0
              ? "Sem mentorado livre. Todos já estão em dupla."
              : "Nenhum mentor ativo cadastrado."}
        </p>
      ) : (
        <>
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
                  Todos os mentores estão sem vaga — aumente a capacidade de
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
                trilha="dpp"
                trigger={
                  <button
                    type="button"
                    className="rounded-sm font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    aumentar capacidade →
                  </button>
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
                trilha:
                  mentor.role === "mentor_especialista"
                    ? "especialista"
                    : "dpp",
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
    </section>
  );
}
