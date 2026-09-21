"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { LinkBreak, MagnifyingGlass, Student, UsersThree } from "@phosphor-icons/react";
import type { Mentorado, Profile } from "@/lib/types";
import type { MentorProfile } from "@/lib/queries";
import { normaliza } from "@/lib/utils";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { PessoaActions } from "@/components/pessoa-actions";
import { MentoradoActions } from "@/components/mentorado-actions";
import { RoleSelect } from "@/components/role-select";
import { ImportarCsvDialog } from "@/components/importar-csv-dialog";
import { NovaPessoaDialog, NovoMentoradoDialog } from "@/components/pessoas-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ehMentor = (p: Profile) =>
  p.role === "mentor_dpp" || p.role === "mentor_especialista";

/** "5511999998888" -> "+55 (11) 99999-8888"; fora do padrão BR mostra como veio. */
function formatarWhatsApp(wa: string): string {
  const d = wa.replace(/\D/g, "");
  if (d.startsWith("55") && d.length === 13) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.startsWith("55") && d.length === 12) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return wa;
}

export function PessoasListas({
  pessoas,
  mentorados,
  comDupla,
  comQualquerDupla,
  mentorProfiles,
  contagemPorMentor,
}: {
  pessoas: Profile[];
  mentorados: Mentorado[];
  comDupla: string[];
  /** Ids com QUALQUER dupla (até encerrada) — espelha a guarda das actions de exclusão. */
  comQualquerDupla: string[];
  mentorProfiles: Record<string, MentorProfile>;
  contagemPorMentor: Record<string, number>;
}) {
  const [busca, setBusca] = useState("");
  const [semDupla, setSemDupla] = useState(false);
  const emDupla = useMemo(() => new Set(comDupla), [comDupla]);
  const temQualquerDupla = useMemo(() => new Set(comQualquerDupla), [comQualquerDupla]);

  const q = normaliza(busca.trim());
  let pessoasFiltradas = q
    ? pessoas.filter(
        (p) => normaliza(p.nome).includes(q) || normaliza(p.email).includes(q)
      )
    : pessoas;
  let mentoradosFiltrados = q
    ? mentorados.filter(
        (m) =>
          normaliza(m.nome).includes(q) ||
          normaliza(m.email).includes(q) ||
          normaliza(m.ong_origem).includes(q)
      )
    : mentorados;

  // matching board: "Sem dupla" deixa só mentores e mentorados livres pra parear
  const livres =
    pessoas.filter((p) => ehMentor(p) && !emDupla.has(p.id)).length +
    mentorados.filter((m) => !emDupla.has(m.id)).length;
  if (semDupla) {
    pessoasFiltradas = pessoasFiltradas.filter(
      (p) => ehMentor(p) && !emDupla.has(p.id)
    );
    mentoradosFiltrados = mentoradosFiltrados.filter((m) => !emDupla.has(m.id));
  }
  const filtrando = Boolean(q) || semDupla;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <MagnifyingGlass
            aria-hidden
            size={16}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Buscar pessoa"
            placeholder="Buscar por nome ou e-mail"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <button
          type="button"
          aria-pressed={semDupla}
          onClick={() => setSemDupla((v) => !v)}
          className={
            "inline-flex min-h-11 md:min-h-8 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring " +
            (semDupla
              ? "border-[var(--brand-lime)]/60 bg-[var(--brand-lime)]/15 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground")
          }
        >
          Sem dupla
          <span className="font-mono text-[11px]">{livres}</span>
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Com acesso ({filtrando ? `${pessoasFiltradas.length} de ${pessoas.length}` : pessoas.length})
        </h2>
        <div className="rounded-xl bg-card shadow-[var(--shadow-border)] divide-y divide-border overflow-hidden">
          {pessoas.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <UsersThree aria-hidden size={32} className="text-muted-foreground" />
              <p className="text-sm font-medium">Ninguém cadastrado ainda</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Quem tem acesso à plataforma — mentores, supervisores e coordenação —
                entra por aqui, um a um ou de uma planilha.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <ImportarCsvDialog />
                <NovaPessoaDialog />
              </div>
            </div>
          )}
          {pessoas.length > 0 && pessoasFiltradas.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              {q ? (
                <>
                  <MagnifyingGlass aria-hidden size={32} className="text-muted-foreground" />
                  <p className="text-sm font-medium">Nenhum resultado para “{busca.trim()}”</p>
                  <p className="text-sm text-muted-foreground">Tente outro nome ou e-mail.</p>
                  <Button
                    variant="outline" size="sm" className="mt-2"
                    onClick={() => setBusca("")}
                  >
                    Limpar busca
                  </Button>
                </>
              ) : (
                <>
                  <LinkBreak aria-hidden size={32} className="text-muted-foreground" />
                  <p className="text-sm font-medium">Ninguém livre no momento</p>
                  <p className="text-sm text-muted-foreground">Todos os mentores já estão em dupla.</p>
                  <Button
                    variant="ghost" size="sm" className="mt-2"
                    onClick={() => setSemDupla(false)}
                  >
                    Ver todos
                  </Button>
                </>
              )}
            </div>
          )}
          {pessoasFiltradas.map((p, i) => {
            const mp = mentorProfiles[p.id];
            // mentor sem linha em mentor_profiles vale capacidade 1 (mesma regra do createDupla)
            const capacidade = mp?.capacidade ?? 1;
            const vagas = contagemPorMentor[p.id] ?? 0;
            const cheio = vagas >= capacidade;
            // pendências do mentor consolidadas num badge warn só (HH-2, máx 2/row)
            const pendencias = [
              ...(mp?.termo_ok ? [] : ["termo"]),
              ...(mp?.formacao_ok ? [] : ["formação"]),
            ];
            return (
              <div
                key={p.id}
                className="animate-enter flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
                style={{ "--i": Math.min(i, 10) } as CSSProperties}
              >
                {/* um Link só engloba avatar+nome+meta — tabstop único e alvo
                    de toque maior; aria-label pro nome acessível não virar
                    "Nome email +55…" (o Avatar já é aria-hidden) */}
                <Link
                  href={`/pessoas/${p.id}`}
                  aria-label={`Abrir perfil de ${p.nome}`}
                  className="group -my-1.5 flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-lg py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar
                    nome={p.nome}
                    src={p.avatar_path ? avatarPublicUrl(p.avatar_path) : null}
                    size={32}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium underline-offset-4 transition-colors group-hover:underline">
                      {p.nome}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.email}
                      {p.whatsapp ? ` · ${formatarWhatsApp(p.whatsapp)}` : ""}
                    </span>
                  </span>
                </Link>
                {!p.ativo && (
                  <Badge variant="outline" className="text-xs shrink-0 border-[var(--danger)]/50 text-[var(--danger)]">
                    inativa
                  </Badge>
                )}
                {p.ativo && !p.user_id && (
                  <Badge variant="outline" className="text-xs shrink-0">ainda não entrou</Badge>
                )}
                {/* pra mentor o contador vagas/capacidade já diz "em dupla" —
                    o badge só aparece quando o contador não cobriria (vagas 0) */}
                {emDupla.has(p.id) && !(ehMentor(p) && vagas > 0) && (
                  <Badge variant="outline" className="text-xs shrink-0">em dupla</Badge>
                )}
                {ehMentor(p) && (
                  <>
                    {/* sem badge "especialista": o seletor de papel na mesma
                        linha já diz "mentor especialista" (mp.tipo é derivado
                        de role) — a palavra não se repete */}
                    <Badge
                      variant="outline"
                      className={
                        "text-[11px] shrink-0 font-mono " +
                        (cheio ? "border-[var(--warn)]/50 text-[var(--warn-text)]" : "")
                      }
                    >
                      {vagas}/{capacidade} {capacidade === 1 ? "dupla" : "duplas"}
                    </Badge>
                    {pendencias.length > 0 && (
                      <Badge variant="outline" className="text-[11px] shrink-0 border-[var(--warn)]/50 text-[var(--warn-text)]">
                        {pendencias.length === 1 ? "pendência" : "pendências"}:{" "}
                        {pendencias.join(" · ")}
                      </Badge>
                    )}
                  </>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <div className="w-40">
                    <RoleSelect profileId={p.id} role={p.role} nome={p.nome} />
                  </div>
                  <PessoaActions
                    pessoa={p}
                    // mesma guarda do server: qualquer dupla (até encerrada) bloqueia excluir
                    podeExcluir={!p.user_id && !temQualquerDupla.has(p.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Mentorados ({filtrando ? `${mentoradosFiltrados.length} de ${mentorados.length}` : mentorados.length})
        </h2>
        <div className="rounded-xl bg-card shadow-[var(--shadow-border)] divide-y divide-border overflow-hidden">
          {mentorados.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <Student aria-hidden size={32} className="text-muted-foreground" />
              <p className="text-sm font-medium">Nenhum mentorado cadastrado ainda</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Quem recebe a mentoria entra por aqui — um a um ou trazendo a
                lista inteira de uma planilha.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <ImportarCsvDialog tipoInicial="mentorados" />
                <NovoMentoradoDialog />
              </div>
            </div>
          )}
          {mentorados.length > 0 && mentoradosFiltrados.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              {q ? (
                <>
                  <MagnifyingGlass aria-hidden size={32} className="text-muted-foreground" />
                  <p className="text-sm font-medium">Nenhum resultado para “{busca.trim()}”</p>
                  <p className="text-sm text-muted-foreground">Tente outro nome ou ONG.</p>
                  <Button
                    variant="outline" size="sm" className="mt-2"
                    onClick={() => setBusca("")}
                  >
                    Limpar busca
                  </Button>
                </>
              ) : (
                <>
                  <LinkBreak aria-hidden size={32} className="text-muted-foreground" />
                  <p className="text-sm font-medium">Nenhum mentorado livre no momento</p>
                  <p className="text-sm text-muted-foreground">Todos os mentorados já estão em dupla.</p>
                  <Button
                    variant="ghost" size="sm" className="mt-2"
                    onClick={() => setSemDupla(false)}
                  >
                    Ver todos
                  </Button>
                </>
              )}
            </div>
          )}
          {mentoradosFiltrados.map((m, i) => (
            <div
              key={m.id}
              className="animate-enter flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
              style={{ "--i": Math.min(i, 10) } as CSSProperties}
            >
              <Link
                href={`/pessoas/${m.id}`}
                aria-label={`Abrir perfil de ${m.nome}`}
                className="group -my-1.5 flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-lg py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar
                  nome={m.nome}
                  src={m.avatar_path ? avatarPublicUrl(m.avatar_path) : null}
                  papel="mentorado"
                  size={32}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {!m.avatar_path && (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--role-mentorado)]" />
                    )}
                    <span className="truncate underline-offset-4 transition-colors group-hover:underline">
                      {m.nome}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.ong_origem ?? <span className="italic">sem ONG</span>}
                    {m.whatsapp ? ` · ${formatarWhatsApp(m.whatsapp)}` : ""}
                  </span>
                </span>
              </Link>
              {emDupla.has(m.id) && (
                <Badge variant="outline" className="text-xs shrink-0">em dupla</Badge>
              )}
              {/* LGPD: parear menor sem a autorização do responsável no arquivo
                  é pendência jurídica — mesmo tratamento do "sem termo" */}
              {!m.documento_path && (
                <Badge variant="outline" className="text-[11px] shrink-0 border-[var(--warn)]/50 text-[var(--warn-text)]">
                  sem autorização
                </Badge>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <MentoradoActions mentorado={m} temDupla={temQualquerDupla.has(m.id)} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
