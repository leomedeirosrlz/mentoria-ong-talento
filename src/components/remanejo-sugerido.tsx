"use client";

import { useState } from "react";
import { ArrowsLeftRight } from "@phosphor-icons/react";
import { textoEspera } from "@/lib/fila";
import type { CandidatoMentor, CandidatoMentorado } from "@/lib/remanejo";
import type { Dupla } from "@/lib/types";
import type { LadoRemanejo } from "@/lib/ciclo";
import { CapacidadeMentorDialog } from "@/components/capacidade-mentor-dialog";
import { RemanejarDuplaDialog } from "@/components/remanejar-dupla-dialog";
import { Button } from "@/components/ui/button";

// REALIZA-115 — dupla em risco vira pergunta de trabalho: "se for pra
// trocar um lado, com quem?". O card lista os candidatos já ranqueados
// pela afinidade (mesma matéria do AfinidadePar) e deixa a decisão a um
// clique do RemanejarDuplaDialog de sempre — nenhum fluxo novo de escrita.
// Mentor cheio não some da lista: aparece marcado com a saída dele,
// "aumentar capacidade →".

const LIMITE_LIVRES = 4;
const LIMITE_CHEIOS = 3;

const primeiroNome = (n: string) => n.split(" ")[0];

/** Linha de motivo/alerta do candidato — o porquê da posição, não o score. */
function Sinais({ motivos, alertas }: { motivos: string[]; alertas: string[] }) {
  return (
    <>
      {motivos.length > 0 && (
        <p className="text-xs text-muted-foreground">{motivos.join(" · ")}</p>
      )}
      {alertas.map((a) => (
        <p key={a} className="text-xs text-[var(--warn-text)]">
          {a}
        </p>
      ))}
    </>
  );
}

export function RemanejoSugerido({
  dupla,
  motivo,
  mentores,
  mentorados,
  agoraMs,
}: {
  dupla: Dupla;
  /** O motivo do semáforo ("3 encontros em atraso"…) — abre o card. */
  motivo: string;
  mentores: CandidatoMentor[];
  mentorados: CandidatoMentorado[];
  /** Carimbo do SSR pro "há N dias na fila" — injetado pra não divergir
   *  servidor × hidratação. */
  agoraMs: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [preselecao, setPreselecao] = useState<{
    lado: LadoRemanejo;
    novoId: string;
  } | null>(null);

  const abrir = (lado: LadoRemanejo, novoId: string | null) => {
    setPreselecao(novoId ? { lado, novoId } : null);
    setAberto(true);
  };

  const mentoresLivres = mentores.filter((c) => c.livre);
  const mentoresCheios = mentores.filter((c) => !c.livre);
  const ehEsp = dupla.trilha === "especialista";
  const rotuloTrilha = ehEsp ? "especialista" : "DPP";

  return (
    <section
      aria-labelledby="remanejo-sugerido-titulo"
      className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/[0.04] px-4 py-3.5 shadow-[var(--shadow-border)] sm:px-5"
    >
      <h2
        id="remanejo-sugerido-titulo"
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
      >
        <ArrowsLeftRight size={15} aria-hidden className="shrink-0" />
        Sugerir remanejamento
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {motivo}. Se a conversa não destravar, dá pra trocar um lado sem
        perder o histórico — sugestões por afinidade, a decisão é sua.
      </p>

      <div className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {/* ---- trocar o mentor: pool do papel da trilha, livres primeiro ---- */}
        <div>
          <p className="text-xs font-medium">
            Se o mentor sair — quem pode assumir{" "}
            {primeiroNome(dupla.mentorado.nome)}:
          </p>
          {mentores.length === 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Nenhum mentor {rotuloTrilha} ativo além de{" "}
              {primeiroNome(dupla.mentor.nome)}.
            </p>
          ) : (
            <ul className="mt-1.5 divide-y divide-border/50">
              {mentoresLivres.slice(0, LIMITE_LIVRES).map((c) => (
                <li
                  key={c.profile.id}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <span className="truncate">{c.profile.nome}</span>{" "}
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {c.usadas}/{c.teto}
                      </span>
                    </p>
                    <Sinais
                      motivos={c.pontuacao.motivos}
                      alertas={c.pontuacao.alertas}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => abrir("mentor", c.profile.id)}
                  >
                    Remanejar
                  </Button>
                </li>
              ))}
              {mentoresLivres.length > LIMITE_LIVRES && (
                <li className="py-1.5 text-xs text-muted-foreground">
                  …e mais {mentoresLivres.length - LIMITE_LIVRES} com vaga no
                  dialog de remanejo.
                </li>
              )}
              {mentoresCheios.slice(0, LIMITE_CHEIOS).map((c) => (
                <li
                  key={c.profile.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">
                      <span className="truncate">{c.profile.nome}</span>{" "}
                      <span className="font-mono text-xs tabular-nums">
                        {c.usadas}/{c.teto}
                      </span>{" "}
                      <span className="text-xs">· sem vaga</span>
                    </p>
                    <Sinais
                      motivos={c.pontuacao.motivos}
                      alertas={c.pontuacao.alertas}
                    />
                  </div>
                  <CapacidadeMentorDialog
                    mentorId={c.profile.id}
                    nome={c.profile.nome}
                    atual={c.teto}
                    emUso={c.usadas}
                    trigger={
                      <button
                        type="button"
                        className="shrink-0 rounded-sm text-xs font-medium text-foreground underline underline-offset-2 transition-colors hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        aumentar capacidade →
                      </button>
                    }
                  />
                </li>
              ))}
              {mentoresCheios.length > LIMITE_CHEIOS && (
                <li className="py-1.5 text-xs text-muted-foreground">
                  …e mais {mentoresCheios.length - LIMITE_CHEIOS} sem vaga.
                </li>
              )}
            </ul>
          )}
        </div>

        {/* ---- trocar o mentorado: a fila "Aguardando par" ranqueada ---- */}
        <div>
          <p className="text-xs font-medium">
            Se o mentorado sair — quem espera na fila:
          </p>
          {mentorados.length === 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              A fila “Aguardando par” está vazia — ninguém esperando o
              primeiro par.
            </p>
          ) : (
            <ul className="mt-1.5 divide-y divide-border/50">
              {mentorados.slice(0, LIMITE_LIVRES).map((c) => (
                <li
                  key={c.mentorado.id}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <span className="truncate">{c.mentorado.nome}</span>
                      {c.desde && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {" "}
                          · {textoEspera(c.desde, agoraMs)} na fila
                        </span>
                      )}
                    </p>
                    <Sinais
                      motivos={c.pontuacao.motivos}
                      alertas={c.pontuacao.alertas}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => abrir("mentorado", c.mentorado.id)}
                  >
                    Remanejar
                  </Button>
                </li>
              ))}
              {mentorados.length > LIMITE_LIVRES && (
                <li className="py-1.5 text-xs text-muted-foreground">
                  …e mais {mentorados.length - LIMITE_LIVRES} esperando no
                  dialog de remanejo.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-3 border-t border-border/50 pt-2.5 text-xs text-muted-foreground">
        Nenhum candidato convence?{" "}
        <button
          type="button"
          onClick={() => abrir("mentor", null)}
          className="rounded-sm font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Remaneje manualmente
        </button>{" "}
        — o dialog lista todo mundo.
      </p>

      {/* o dialog de sempre, controlado — a sugestão só escolhe lado + par */}
      <RemanejarDuplaDialog
        dupla={dupla}
        trigger={null}
        open={aberto}
        onOpenChange={setAberto}
        preselecao={preselecao}
      />
    </section>
  );
}
