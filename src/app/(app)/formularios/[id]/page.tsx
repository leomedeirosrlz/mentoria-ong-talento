import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMe, getMentorados, getPessoas } from "@/lib/queries";
import { getFormulario } from "@/lib/forms/queries";
import { CAMPO_TIPO_LABEL, SISTEMA_LABEL } from "@/lib/forms/schema";
import { formatDate, papelLabel } from "@/lib/ciclo";
import { Badge } from "@/components/ui/badge";
import { VoltarLink } from "@/components/voltar-link";
import { FormularioAcoes } from "../formulario-acoes";
import { FormularioBuilder } from "../formulario-builder";
import { FormularioLinks, type DestinoOpcao } from "../formulario-links";
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

  const destinatarios: DestinoOpcao[] = [
    ...pessoas
      .filter((p) => p.ativo)
      .map((p) => ({
        tipo: "profile" as const,
        id: p.id,
        nome: p.nome,
        detalhe: papelLabel(p.role),
      })),
    ...mentorados.map((m) => ({
      tipo: "mentorado" as const,
      id: m.id,
      nome: m.nome,
      detalhe: m.ong_origem ? `Mentorado · ${m.ong_origem}` : "Mentorado",
    })),
  ];

  const respondidos = links.filter((l) => l.resposta).length;

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
          <FormularioAcoes
            id={f.id}
            titulo={f.titulo}
            ativo={f.ativo}
            oficial={!!f.sistema}
          />
        </div>
      </header>

      <section aria-labelledby="sec-perguntas">
        <h2
          id="sec-perguntas"
          className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Perguntas
        </h2>
        {f.sistema ? (
          // instrumento oficial — a definição é catálogo (imutável via
          // trigger, 0042): vira lista de leitura, não editor
          <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
            <p className="mb-3 text-xs text-muted-foreground">
              Formulário oficial do programa — as perguntas vêm do guia e não
              são editáveis. Pra mudar o instrumento, a definição passa por
              migração.
            </p>
            <ol className="space-y-2">
              {f.campos.map((c, i) => (
                // meta na linha de baixo no mobile — o "Texto longo ·
                // obrigatória" shrink-0 esmagava o enunciado
                <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {i + 1}.
                  </span>
                  <span className="min-w-0 flex-1">{c.label}</span>
                  <span className="shrink-0 basis-full order-3 text-xs text-muted-foreground sm:basis-auto sm:order-none">
                    {CAMPO_TIPO_LABEL[c.tipo]}
                    {c.obrigatorio && " · obrigatória"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <FormularioBuilder
            formulario={{
              id: f.id,
              titulo: f.titulo,
              descricao: f.descricao,
              campos: f.campos,
              versao: f.versao,
            }}
          />
        )}
      </section>

      <section aria-labelledby="sec-links">
        <h2
          id="sec-links"
          className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground"
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
          className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Respostas{respondidos > 0 && ` (${respondidos})`}
        </h2>
        <RespostasSection campos={f.campos} links={links} />
      </section>
    </div>
  );
}
