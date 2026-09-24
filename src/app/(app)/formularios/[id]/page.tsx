import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { getMe, getMentorados, getPessoas } from "@/lib/queries";
import { getFormulario } from "@/lib/forms/queries";
import {
  CAMPO_TIPO_LABEL,
  linkStatus,
  SISTEMA_LABEL,
  type LinkStatus,
} from "@/lib/forms/schema";
import { formatDate, papelLabel } from "@/lib/ciclo";
import { Badge } from "@/components/ui/badge";
import { VoltarLink } from "@/components/voltar-link";
import { FormularioAcoes, FormularioExcluir } from "../formulario-acoes";
import { FormularioBuilder } from "../formulario-builder";
import { FormularioLinks, type DestinoOpcao } from "../formulario-links";
import { FormularioPreview } from "../formulario-preview";
import { RespostasSection } from "../respostas-section";

export const metadata: Metadata = { title: "Formulário" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FormularioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const [detalhe, pessoas, mentorados] = await Promise.all([
    getFormulario(id),
    getPessoas(),
    getMentorados(),
  ]);
  if (!detalhe) notFound();
  const { formulario: f, links } = detalhe;

  // elegíveis = todo mundo ativo menos a própria coordenação (ela opera o
  // form, nunca responde). O papel alimenta o agrupamento do dialog.
  const destinatarios: DestinoOpcao[] = [
    ...pessoas
      .filter((p) => p.ativo && p.role !== "coordenacao")
      .map((p) => ({
        tipo: "profile" as const,
        id: p.id,
        nome: p.nome,
        whatsapp: p.whatsapp,
        papel: p.role,
        detalhe: papelLabel(p.role),
      })),
    ...mentorados.map((m) => ({
      tipo: "mentorado" as const,
      id: m.id,
      nome: m.nome,
      whatsapp: m.whatsapp,
      papel: "mentorado" as const,
      detalhe: m.ong_origem ? `Mentorado · ${m.ong_origem}` : "Mentorado",
    })),
  ];

  const respondidos = links.filter((l) => l.resposta).length;
  const status: Record<LinkStatus, number> = {
    pendente: 0,
    respondido: 0,
    expirado: 0,
  };
  for (const l of links) status[linkStatus(l)]++;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <VoltarLink fallback="/formularios" />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {f.titulo}
              </h1>
              {f.ativo ? (
                <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
                  Ativo
                </Badge>
              ) : (
                <Badge variant="secondary">Encerrado</Badge>
              )}
              {f.sistema && (
                <Badge
                  variant="outline"
                  className="border-[var(--brand-lime)]/60 bg-[var(--brand-lime)]/10"
                >
                  oficial · {SISTEMA_LABEL[f.sistema]}
                </Badge>
              )}
              {f.versao > 1 && (
                <Badge variant="outline">v{f.versao}</Badge>
              )}
            </div>
            {f.descricao && (
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {f.descricao}
              </p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Criado em {formatDate(f.created_at)}
              {" · "}
              {f.campos.length}{" "}
              {f.campos.length === 1 ? "pergunta" : "perguntas"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FormularioPreview
              titulo={f.titulo}
              descricao={f.descricao}
              campos={f.campos}
              sistema={f.sistema}
            />
            <FormularioAcoes id={f.id} ativo={f.ativo} />
          </div>
        </div>
      </header>

      {/* faixa de status dos links — o número acionável ("quem falta?")
          em warn logo sob o header */}
      {links.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <span
            className={
              status.pendente > 0
                ? "font-medium text-[var(--warn-text)]"
                : undefined
            }
          >
            {status.pendente}{" "}
            {status.pendente === 1 ? "pendente" : "pendentes"}
          </span>
          {" · "}
          {status.respondido}{" "}
          {status.respondido === 1 ? "respondido" : "respondidos"}
          {" · "}
          {status.expirado} {status.expirado === 1 ? "expirado" : "expirados"}
        </p>
      )}

      <section aria-labelledby="sec-perguntas">
        <h2
          id="sec-perguntas"
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Perguntas
        </h2>
        {/* leitura por padrão — editar versiona o form e é job raro, então
            o editor fica atrás de um details ("edição por intenção") */}
        <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
          {f.sistema && (
            // instrumento oficial — a definição é catálogo (imutável via
            // trigger, 0042)
            <p className="mb-3 text-xs text-muted-foreground">
              Formulário oficial do programa — as perguntas vêm do guia e não
              são editáveis. Pra mudar o instrumento, a definição passa por
              migração.
            </p>
          )}
          <ol className="space-y-2">
            {f.campos.map((c, i) => (
              // meta na linha de baixo no mobile — o "Texto longo ·
              // obrigatória" shrink-0 esmagava o enunciado
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {i + 1}.
                </span>
                <span className="min-w-0 flex-1">
                  {c.label}
                  {!!c.opcoes?.length && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {c.opcoes.join(" · ")}
                    </span>
                  )}
                </span>
                <span className="shrink-0 basis-full order-3 text-xs text-muted-foreground sm:basis-auto sm:order-none">
                  {CAMPO_TIPO_LABEL[c.tipo]}
                  {c.obrigatorio && " · obrigatória"}
                </span>
              </li>
            ))}
          </ol>
        </div>
        {!f.sistema && (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg py-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              Editar perguntas
              <CaretDown
                size={14}
                aria-hidden
                className="transition-transform group-open:rotate-180"
              />
            </summary>
            <FormularioBuilder
              formulario={{
                id: f.id,
                titulo: f.titulo,
                descricao: f.descricao,
                campos: f.campos,
                versao: f.versao,
              }}
            />
          </details>
        )}
      </section>

      <section aria-labelledby="sec-links">
        <h2
          id="sec-links"
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Links de resposta
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Cada link é único e de uso único — a pessoa responde sem login pelo
          endereço /f/&lt;token&gt;.
        </p>
        <FormularioLinks
          formularioId={f.id}
          formularioTitulo={f.titulo}
          formularioAtivo={f.ativo}
          formularioSistema={f.sistema}
          links={links}
          destinatarios={destinatarios}
        />
      </section>

      <section aria-labelledby="sec-respostas">
        <h2
          id="sec-respostas"
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Respostas{respondidos > 0 && ` (${respondidos})`}
        </h2>
        <RespostasSection campos={f.campos} links={links} />
      </section>

      {/* zona de perigo — destrutivo no fim da página, fora do header */}
      {!f.sistema && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Excluir apaga o formulário junto com todos os links e todas as
            respostas recebidas — não dá pra desfazer.
          </p>
          <FormularioExcluir id={f.id} titulo={f.titulo} />
        </div>
      )}
    </div>
  );
}
