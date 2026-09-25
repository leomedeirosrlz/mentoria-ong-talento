"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Users } from "@phosphor-icons/react";
import { toast } from "sonner";
import { marcarPresenca, marcarPresencas } from "@/lib/actions-presenca";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import type { MentorChamada } from "@/lib/queries-presenca";
import { cn } from "@/lib/utils";

/** Chamada da formação (detalhe do dia, coordenação): lista dos mentores
 *  ativos do ciclo com toggle de presença. Otimista por linha — numa chamada
 *  de ~30 pessoas o tap é rápido e a resposta da action chega depois; erro
 *  reverte a marca e avisa. O refresh do servidor confirma e os overrides
 *  que já batem com o que voltou são descartados. */
export function ChamadaFormacao({
  eventoId,
  mentores,
  presentes,
}: {
  eventoId: string;
  /** Mentores ativos do ciclo (mentor_dpp + mentor_especialista). */
  mentores: MentorChamada[];
  /** profile_id → presente — só o que tem row; ausência de row = não marcado. */
  presentes: Record<string, boolean>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // marcações otimistas por cima da prop — quando o refresh traz a prop nova,
  // reconcilia durante o render (o padrão do React, mesmo do Avatar com a
  // chave do src): override confirmado pelo servidor sai; divergente fica
  // até a action dele responder
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [presentesAnt, setPresentesAnt] = useState(presentes);
  if (presentes !== presentesAnt) {
    setPresentesAnt(presentes);
    const confirmados = Object.fromEntries(
      Object.entries(overrides).filter(([id, v]) => presentes[id] !== v)
    );
    if (Object.keys(confirmados).length !== Object.keys(overrides).length)
      setOverrides(confirmados);
  }

  const presenteDe = (id: string) => overrides[id] ?? presentes[id] ?? false;
  const total = mentores.length;
  const marcados = mentores.filter((m) => presenteDe(m.id)).length;

  function alternar(m: MentorChamada, v: boolean) {
    setOverrides((o) => ({ ...o, [m.id]: v }));
    setPendingId(m.id);
    start(async () => {
      try {
        const res = await marcarPresenca(eventoId, m.id, v);
        if (res?.error) {
          setOverrides((o) => {
            const c = { ...o };
            delete c[m.id];
            return c;
          });
          toast.error(res.error);
        } else {
          router.refresh();
        }
      } catch {
        setOverrides((o) => {
          const c = { ...o };
          delete c[m.id];
          return c;
        });
        toast.error("Sem conexão. Tente de novo.");
      } finally {
        setPendingId(null);
      }
    });
  }

  function marcarTodas() {
    setOverrides((o) => ({
      ...o,
      ...Object.fromEntries(mentores.map((m) => [m.id, true])),
    }));
    start(async () => {
      try {
        const res = await marcarPresencas(
          eventoId,
          mentores.map((m) => ({ profileId: m.id, presente: true }))
        );
        if (res?.error) {
          setOverrides({});
          toast.error(res.error);
        } else {
          router.refresh();
        }
      } catch {
        setOverrides({});
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <div className="mt-3 rounded-xl bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2 px-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Chamada
        </h3>
        <p
          aria-live="polite"
          className="font-mono text-xs tabular-nums text-muted-foreground"
        >
          {marcados}/{total} {marcados === 1 ? "presente" : "presentes"}
        </p>
      </div>
      {total === 0 ? (
        <p className="mt-1.5 px-2 py-2 text-sm text-muted-foreground">
          Nenhum mentor ativo no ciclo.
        </p>
      ) : (
        <>
          <ul className="scroll-fina mt-1 max-h-80 overflow-y-auto">
            {mentores.map((m) => {
              const presente = presenteDe(m.id);
              return (
                <li key={m.id}>
                  {/* checkbox nativo + label: teclado, estado e o clique no
                      nome funcionam sem ARIA manual (mesma gramática dos
                      combinados em encaminhamentos-list) */}
                  <label
                    className={cn(
                      "group flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/70",
                      pending && pendingId === m.id && "opacity-60"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={presente}
                      disabled={pending && pendingId === m.id}
                      onChange={(e) => alternar(m, e.target.checked)}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-4.5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card",
                        presente
                          ? "border-[var(--ok)] bg-[var(--ok)] text-white"
                          : "border-muted-foreground/40 group-hover:border-foreground"
                      )}
                    >
                      {presente && (
                        <svg
                          viewBox="0 0 10 8"
                          className="size-2.5 fill-none stroke-current stroke-2"
                        >
                          <path d="M1 4l2.5 2.5L9 1" />
                        </svg>
                      )}
                    </span>
                    <Avatar
                      nome={m.nome}
                      src={m.avatar_path ? avatarPublicUrl(m.avatar_path) : null}
                      size={26}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {m.nome}
                      {m.role === "mentor_especialista" && (
                        <span className="text-muted-foreground">
                          {" "}
                          · especialista
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {marcados < total && (
            <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-border/60 px-2 pt-2.5">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users aria-hidden size={13} />
                todos os mentores ativos
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={marcarTodas}
              >
                <CheckSquare size={14} aria-hidden />
                Marcar todas
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
