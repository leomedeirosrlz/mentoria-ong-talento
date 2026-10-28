import Link from "next/link";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  CaretDown,
  DownloadSimple,
  FileText,
  User,
} from "@phosphor-icons/react/dist/ssr";
import {
  respostaFormatada,
  type FormularioCampo,
  type FormularioResposta,
  type RespostaValor,
} from "@/lib/forms/schema";
import type { FormularioAnexo, LinkResolvido } from "@/lib/forms/queries";
import { formatDateTime } from "@/lib/ciclo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PromoverIntakeButton } from "./promover-intake";

// Fila de candidatos do link de inscrição (REALIZA-70): no form oficial de
// intake, cada envio anônimo é uma INSCRIÇÃO — a unidade da lista é a
// resposta (não o link, que é um só). O cabeçalho nomeia a pessoa pelo
// próprio conteúdo da resposta; a expansão mostra a ficha completa, com
// documentos baixáveis (/api/form-anexo/<id>, signed URL coord-only) e a
// grade de horários verbatim. A promoção é sempre ação humana: "Revisar e
// cadastrar" abre o prefill e só a confirmação cria o cadastro.

/** Nome do candidato vem da resposta (o link é anônimo de propósito) —
 *  nome_civil primeiro; nome_social/campo "nome" de form variantes como
 *  fallback; sem nada disso, "Candidato(a)". */
function nomeCandidato(r: FormularioResposta): string {
  const v =
    r.respostas.nome_civil ?? r.respostas.nome ?? r.respostas.nome_social;
  return typeof v === "string" && v.trim() ? v.trim() : "Candidato(a)";
}

function contatoCandidato(r: FormularioResposta): string {
  const partes = [r.respostas.email, r.respostas.telefone].filter(
    (v): v is string => typeof v === "string" && !!v.trim()
  );
  return partes.join(" · ");
}

/** Resumo da grade pro cabeçalho — contagem de faixas, sem a lista
 *  (a expansão mostra os horários um a um). */
function resumoDisponibilidade(v: RespostaValor | undefined): string | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const cel = (v as { celulas?: unknown }).celulas;
  if (!Array.isArray(cel) || !cel.length) return null;
  return `${cel.length} faixa${cel.length === 1 ? "" : "s"} de disponibilidade`;
}

export function IntakeRespostas({
  campos,
  links,
  anexos,
}: {
  campos: FormularioCampo[];
  links: LinkResolvido[];
  anexos: FormularioAnexo[];
}) {
  // path → anexo: o valor gravado na resposta é {path,…} e o download é
  // por id — o mapa resolve sem query extra (anexos já veio na página)
  const anexoPorPath = new Map(anexos.map((a) => [a.path, a]));
  const campoPorId = new Map(campos.map((c) => [c.id, c]));
  const ordemCampos = new Map(campos.map((c, i) => [c.id, i]));

  const respostas = links
    .flatMap((l) => l.respostas)
    .sort((a, b) => b.respondido_em.localeCompare(a.respondido_em));

  if (!respostas.length) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Nenhuma inscrição ainda. Compartilhe o link de inscrição acima. Cada
        envio aparece aqui como um(a) candidato(a).
      </p>
    );
  }

  const formularioId = links[0]?.formulario_id;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a
          href={`/api/export?tipo=respostas&id=${formularioId}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <DownloadSimple aria-hidden />
          Exportar CSV
        </a>
      </div>
      <ol className="space-y-2">
        {respostas.map((r) => {
          // cada via carimba a própria coluna (profile × mentorado, 0129)
          const criadoId =
            r.promovido_profile_id ?? r.promovido_mentorado_id ?? null;
          const promovida = !!criadoId;
          const contato = contatoCandidato(r);
          const disp = resumoDisponibilidade(r.respostas.disponibilidade);
          return (
            <li key={r.id}>
              <Collapsible.Root className="rounded-xl bg-card shadow-[var(--shadow-border)]">
                <Collapsible.Trigger className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[panel-open]:rounded-b-none sm:px-5">
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                  >
                    <User size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="truncate text-sm font-medium">
                        {nomeCandidato(r)}
                      </span>
                      {promovida && (
                        <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
                          Cadastrada
                        </Badge>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[contato, disp].filter(Boolean).join(" · ") ||
                        "inscrição"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(r.respondido_em)}
                  </span>
                  <CaretDown
                    size={14}
                    aria-hidden
                    className="shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
                  />
                </Collapsible.Trigger>
                <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
                  <dl className="space-y-3 border-t border-border px-4 py-3 sm:px-5">
                    {Object.entries(r.respostas)
                      .sort(
                        ([a], [b]) =>
                          (ordemCampos.get(a) ?? Number.MAX_SAFE_INTEGER) -
                          (ordemCampos.get(b) ?? Number.MAX_SAFE_INTEGER)
                      )
                      .map(([campoId, valor]) => {
                        const campo = campoPorId.get(campoId);
                        if (campo?.tipo === "arquivo") {
                          const a = anexoPorPath.get(
                            (valor as { path?: string })?.path ?? ""
                          );
                          return (
                            <div key={campoId}>
                              <dt className="text-xs font-medium text-muted-foreground">
                                {campo.label}
                              </dt>
                              <dd className="mt-0.5 text-sm">
                                {a ? (
                                  <Link
                                    href={`/api/form-anexo/${a.id}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4"
                                  >
                                    <FileText aria-hidden size={14} />
                                    {a.nome}
                                  </Link>
                                ) : (
                                  respostaFormatada(campo, valor)
                                )}
                              </dd>
                            </div>
                          );
                        }
                        return (
                          <div key={campoId}>
                            <dt className="text-xs font-medium text-muted-foreground">
                              {campo?.label ?? (
                                <span className="italic">
                                  pergunta removida do formulário
                                </span>
                              )}
                            </dt>
                            <dd className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
                              {respostaFormatada(campo, valor)}
                            </dd>
                          </div>
                        );
                      })}
                  </dl>
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2.5 sm:px-5">
                    {promovida ? (
                      <Link
                        href={`/pessoas/${criadoId}`}
                        className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                      >
                        Abrir o cadastro criado
                      </Link>
                    ) : (
                      <PromoverIntakeButton respostaId={r.id} />
                    )}
                  </div>
                </Collapsible.Panel>
              </Collapsible.Root>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
