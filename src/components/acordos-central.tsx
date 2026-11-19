import { PlanoAcordosCard } from "@/components/plano-acordos";
import {
  IntervencaoAcoes,
  VoltarGuiaButton,
  rotuloIntervencao,
} from "@/components/acordos-acoes";
import type { Dupla } from "@/lib/types";

/** Central "Acordos e intervenções" (REALIZA-459, sugestão 7 da auditoria
 *  de design): o que a dupla combinou e o que a equipe sugeriu, no mesmo
 *  lugar da ficha — o plano persistido (0219) com responder/aplicar, os
 *  ajustes do guia vigente (0220) e a fila de intervenções abertas. Só
 *  renderiza quando há algo pra ver; as permissões ficam nas RPCs, o
 *  papel aqui só decide quais CTAs aparecem. */
export function AcordosCentral({
  dupla,
  souMentor,
  souStaff,
  numeroGuiaAtual,
}: {
  dupla: Dupla;
  souMentor: boolean;
  /** coordenacao ou supervisor da dupla — leem/fecham intervenções */
  souStaff: boolean;
  /** número do encontro do guia vigente — os ajustes ancora nele */
  numeroGuiaAtual: number | null;
}) {
  const planoVivo =
    (dupla.planos ?? []).find((p) =>
      ["proposto", "aceito", "ativo"].includes(p.status)
    ) ?? null;
  const ultimoFechado =
    (dupla.planos ?? [])
      .filter((p) => !["proposto", "aceito", "ativo"].includes(p.status))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
  const intervencoesAbertas = (dupla.intervencoes ?? []).filter(
    (i) => i.status === "sugerida"
  );
  const ajustesGuia =
    numeroGuiaAtual != null
      ? (dupla.guia_ajustes ?? []).find((g) => g.numero === numeroGuiaAtual)
      : null;

  if (!planoVivo && !ultimoFechado && !intervencoesAbertas.length && !ajustesGuia)
    return null;

  return (
    <section
      aria-labelledby="acordos"
      className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
    >
      <h2 id="acordos" className="text-base font-semibold">
        Acordos e intervenções
      </h2>

      {planoVivo && (
        <div className="mt-3">
          <PlanoAcordosCard
            plano={planoVivo}
            duplaId={dupla.id}
            podeResponder={souMentor}
            podeAplicar={souMentor}
          />
        </div>
      )}

      {!planoVivo && ultimoFechado && (
        <p className="mt-2 text-sm text-muted-foreground">
          Último plano: {rotuloStatus(ultimoFechado.status)}
          {ultimoFechado.contestado_motivo
            ? ` — ${ultimoFechado.contestado_motivo}`
            : ""}
          . Um novo acordo pode ser proposto a qualquer momento.
        </p>
      )}

      {ajustesGuia && (
        <div className="mt-3 rounded-lg bg-muted/50 px-3.5 py-3 shadow-[var(--shadow-inset)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">
              Guia do {numeroGuiaAtual}º encontro ajustado pra vocês
            </p>
            {(souMentor || souStaff) && numeroGuiaAtual != null && (
              <VoltarGuiaButton duplaId={dupla.id} numero={numeroGuiaAtual} />
            )}
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {ajustesGuia.ajustes.map((a, i) => (
              <li key={i} className="text-sm">
                <p>{a.sugestao}</p>
                <p className="text-xs text-muted-foreground">{a.justificativa}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {souStaff && intervencoesAbertas.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">
            Intervenções sugeridas
          </p>
          <ul className="space-y-2.5">
            {intervencoesAbertas.map((i) => (
              <li
                key={i.id}
                className="rounded-lg bg-muted/50 px-3.5 py-3 shadow-[var(--shadow-inset)]"
              >
                <p className="text-sm font-medium">
                  {rotuloIntervencao(i.tipo)}
                </p>
                {i.motivo && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {i.motivo}
                  </p>
                )}
                <div className="mt-2">
                  <IntervencaoAcoes
                    intervencaoId={i.id}
                    duplaId={dupla.id}
                    tipo={i.tipo}
                    motivo={i.motivo}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function rotuloStatus(status: string): string {
  return (
    {
      concluido: "concluído",
      expirado: "expirado",
      contestado: "contestado",
    }[status] ?? status
  );
}
