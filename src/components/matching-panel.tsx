"use client";

import { useState } from "react";
import type { MentorProfile } from "@/lib/queries";
import type { Mentorado, Profile } from "@/lib/types";
import { AfinidadePar } from "@/components/matching-afinidade";
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
 *  ligado em /pessoas (página coord-only). A coordenação escolhe um
 *  mentorado e um mentor livres e compara a afinidade antes de abrir o
 *  dialog de criação. Os sensíveis já vêm mergeados nos props (views
 *  *_pessoal só devolvem pra coordenação). */
export function MatchingPanel({
  mentores,
  mentorados,
  mentorProfiles,
}: {
  mentores: Profile[];
  mentorados: Mentorado[];
  mentorProfiles: Record<string, MentorProfile>;
}) {
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [mentoradoId, setMentoradoId] = useState<string | null>(null);
  const mentor = mentores.find((m) => m.id === mentorId) ?? null;
  const mentorado = mentorados.find((m) => m.id === mentoradoId) ?? null;
  const mp = mentor ? mentorProfiles[mentor.id] : undefined;

  return (
    <section className="space-y-3 rounded-xl bg-card px-4 py-3.5 shadow-[var(--shadow-border)] sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Parear
        </h2>
        <NovaDuplaDialog />
      </div>
      {mentores.length === 0 || mentorados.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {mentorados.length === 0 && mentores.length === 0
            ? "Ninguém livre pra parear agora."
            : mentorados.length === 0
              ? "Sem mentorado livre — todos já estão em dupla."
              : "Sem mentor livre — todos já estão em dupla."}
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
                  aria-labelledby="parear-mentorado-label"
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
                  mentores.map((m) => [
                    m.id,
                    m.role === "mentor_especialista"
                      ? `${m.nome} — especialista`
                      : m.nome,
                  ])
                )}
                onValueChange={(v) => setMentorId(v ? String(v) : null)}
              >
                <SelectTrigger
                  aria-labelledby="parear-mentor-label"
                  className="w-full"
                >
                  <SelectValue placeholder="Escolher" />
                </SelectTrigger>
                <SelectContent>
                  {mentores.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                      {m.role === "mentor_especialista"
                        ? " — especialista"
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
