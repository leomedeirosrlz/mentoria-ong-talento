import { PlanoAcordosCard } from "@/components/plano-acordos";
import { CombinarPlano } from "@/components/combinar-plano";
import { RoteirosPlano } from "@/components/roteiros-plano";
import { aceitesDoPlano } from "@/lib/plano-combinado";
import type { RecessoDaFicha } from "@/components/recesso-dupla-card";
import type { SeletorSugestoes } from "@/components/seletor-dia-hora";
import {
  IntervencaoAcoes,
  VoltarGuiaButton,
} from "@/components/acordos-acoes";
import { rotuloIntervencao } from "@/lib/intervencoes";
import type { Dupla, DuplaPlanoRoteiro } from "@/lib/types";

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
  recessos = [],
  sugestoesPlano,
  roteiros = [],
}: {
  dupla: Dupla;
  souMentor: boolean;
  /** coordenacao ou supervisor da dupla — leem/fecham intervenções */
  souStaff: boolean;
  /** número do encontro do guia vigente — os ajustes ancora nele */
  numeroGuiaAtual: number | null;
  /** recessos vigentes do cronograma (518) — a dupla repensa a decisão
   *  no aceite da proposta */
  recessos?: RecessoDaFicha[];
  /** pacote do motor pras linhas do combinado (482) — a ficha monta com
   *  o mesmo adaptador da agenda do jovem */
  sugestoesPlano?: SeletorSugestoes | null;
  /** roteiros do plano da dupla (020) — a ficha carrega com lazy */
  roteiros?: readonly DuplaPlanoRoteiro[];
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
            plano={{
              ...planoVivo,
              aceites: aceitesDoPlano(planoVivo),
              // a coluna não existe na tabela: "avisado em" ancora no
              // carimbo que ativou (ou na criação, proposta de lado nasce
              // em vigor) — a mesma régua do recorte do jovem
              proposto_em: planoVivo.aprovado_em ?? planoVivo.created_at,
            }}
            duplaId={dupla.id}
            podeResponder={souMentor}
            podeAplicar={souMentor}
            meuLado={souMentor ? "mentor" : null}
            nomes={{
              mentor: (dupla.mentor.nome_social ?? dupla.mentor.nome).split(" ")[0],
              mentorado: (
                dupla.mentorado.nome_social ?? dupla.mentorado.nome
              ).split(" ")[0],
            }}
            realizados={dupla.encontros
              .filter((e) => e.status === "realizado")
              .map((e) => e.numero)}
            recessos={recessos}
            sugestoes={sugestoesPlano}
            combinadoHref={`/duplas/${dupla.id}/combinado`}
          />
          {(planoVivo.status === "aceito" || planoVivo.status === "ativo") && (
            <div className="mt-3">
              <RoteirosPlano
                roteiros={roteiros.filter((r) => r.plano_id === planoVivo.id)}
                planoVersao={planoVivo.versao}
                hrefDe={(n) => `/duplas/${dupla.id}/roteiro/${n}`}
                podeGerar={souStaff}
                faltantes={(planoVivo.escopo?.numeros ?? []).filter(
                  (n) => !roteiros.some((r) => r.plano_id === planoVivo.id && r.numero === n)
                )}
              />
            </div>
          )}
        </div>
      )}

      {!planoVivo && ultimoFechado && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-muted-foreground">
            Último plano: {rotuloStatus(ultimoFechado.status)}
            {ultimoFechado.contestado_motivo
              ? `. ${ultimoFechado.contestado_motivo}`
              : ""}
            {ultimoFechado.status === "contestado"
              ? " Uma nova versão pode ser combinada."
              : " Um novo acordo pode ser proposto a qualquer momento."}
          </p>
          {ultimoFechado.status === "contestado" &&
            dupla.status === "ativa" && (
              <CombinarPlano
                duplaId={dupla.id}
                lado={souMentor ? "mentor" : "staff"}
                variante="outline"
              />
            )}
        </div>
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
