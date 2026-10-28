"use client";

import { useMemo } from "react";
import { Check } from "@phosphor-icons/react";
import {
  agrupaEmSecoes,
  extraiGruposMeta,
  type BlocoSecao,
} from "@/lib/forms/instrumentos";
import { campoRespondido } from "@/lib/forms/resposta";
import { type FormularioCampo } from "@/lib/forms/schema";
import { cn } from "@/lib/utils";
import type { RespostaApi } from "./use-resposta";
import { SubmetasEditor } from "./submetas-editor";
import {
  CampoGenerico,
  campoDomId,
  EntradaData,
  EntradaTexto,
  EntradaTextoLongo,
  ErroCampo,
} from "./campos";

// PDM — o "documento que se constrói". Os capítulos da definição viram
// seções numeradas de uma folha contínua: hierarquia editorial (nº + título
// + instrução), fichas de meta com os três campos do guia juntos (meta,
// indicador de sucesso, prazo) e o mapa de submetas no editor de linhas
// da 0118. Em telas extra-largas um sumário lateral acompanha o
// preenchimento — cada capítulo acende o check quando suas obrigatórias
// estão respondidas; abaixo disso o documento segue em coluna única.

const META_RE = /^meta_\d+$/;

export function Pdm({
  campos,
  api,
}: {
  campos: FormularioCampo[];
  api: RespostaApi;
}) {
  const blocos = useMemo(() => agrupaEmSecoes(campos), [campos]);
  const grupos = useMemo(() => extraiGruposMeta(campos), [campos]);

  // capítulo fechado = todas as perguntas obrigatórias dele respondidas
  const capitulos = blocos.map((b, i) => ({
    bloco: b,
    numero: i + 1,
    id: `pdm-cap-${i + 1}`,
    completo:
      b.campos.filter((c) => c.obrigatorio).length > 0 &&
      b.campos
        .filter((c) => c.obrigatorio)
        .every((c) => campoRespondido(c, api.valores[c.id])),
  }));

  return (
    <div className="@container">
      <div className="@[34rem]:grid @[34rem]:grid-cols-[180px_1fr] @[34rem]:items-start @[34rem]:gap-5">
        {/* sumário lateral — só quando o container é largo: abaixo disso o
            documento fica em fluxo único (é assim que o preview do form
            cabe inteiro no dialog). Container, não viewport (REALIZA-248) */}
        <nav
          aria-label="Capítulos do PDM"
          className="sticky top-16 hidden self-start space-y-1 @[34rem]:block"
        >
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Seu PDM
          </p>
          {capitulos.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold tabular-nums",
                  c.completo
                    ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {c.completo ? <Check size={11} weight="bold" /> : c.numero}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {c.bloco.secao?.label ?? `Capítulo ${c.numero}`}
              </span>
            </a>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          {capitulos.map((c) => (
            <CapituloDoc key={c.id} capitulo={c} api={api} grupos={grupos} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Uma seção do documento — cartão amplo com cabeçalho de capítulo. */
function CapituloDoc({
  capitulo,
  api,
  grupos,
}: {
  capitulo: { bloco: BlocoSecao; numero: number; id: string };
  api: RespostaApi;
  grupos: ReturnType<typeof extraiGruposMeta>;
}) {
  const { bloco, numero, id } = capitulo;
  const temMetas = bloco.campos.some((c) => META_RE.test(c.id));

  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-xl bg-card shadow-[var(--shadow-border)]"
    >
      <div className="p-5 sm:p-7">
        {bloco.secao && (
          <header className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-lime)]/15 text-sm font-bold tabular-nums text-[var(--ok-text)]"
            >
              {numero}
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">
                {bloco.secao.label}
              </h2>
              {bloco.secao.descricao && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {bloco.secao.descricao}
                </p>
              )}
            </div>
          </header>
        )}

        <div className={cn("space-y-4", bloco.secao && "mt-5")}>
          {temMetas ? (
            <FichasPdm campos={bloco.campos} grupos={grupos} api={api} />
          ) : (
            bloco.campos.map((c) => {
              // mapa de submetas (0080): o capítulo dedicado rende o
              // editor de linhas — uma linha por submeta, mesmo
              // contrato texto_longo de pdm_parse_submetas
              const subN = /^submetas_(\d+)$/.exec(c.id)?.[1];
              return c.tipo === "texto_longo" && subN ? (
                <SubmetasEditor
                  key={c.id}
                  campo={c}
                  api={api}
                  metaN={Number(subN)}
                />
              ) : c.tipo === "texto_longo" ? (
                <div key={c.id} data-campo={c.id} className="space-y-1.5">
                  <label
                    htmlFor={campoDomId(c)}
                    className="block text-[15px] font-medium leading-snug"
                  >
                    {c.label}
                    {!c.obrigatorio && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    )}
                  </label>
                  <EntradaTextoLongo
                    campo={c}
                    valor={api.valores[c.id]}
                    definir={api.definir}
                    erro={api.erros[c.id]}
                    rows={5}
                    className={cn(api.erros[c.id] && "border-destructive")}
                  />
                  <ErroCampo campo={c} msg={api.erros[c.id]} />
                </div>
              ) : (
                <CampoGenerico key={c.id} campo={c} api={api} sombra={false} />
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

/** Declaração + fichas de meta do capítulo "Visão e metas": cada meta é
 *  uma ficha com meta, IS e prazo juntos — o trio do guia DPP. */
function FichasPdm({
  campos,
  grupos,
  api,
}: {
  campos: FormularioCampo[];
  grupos: ReturnType<typeof extraiGruposMeta>;
  api: RespostaApi;
}) {
  const idsDeMeta = new Set(
    grupos.flatMap((g) =>
      [g.meta, g.is, g.prazo, g.porque, g.submetas]
        .filter(Boolean)
        .map((c) => c!.id)
    )
  );
  const soltos = campos.filter(
    (c) => !idsDeMeta.has(c.id) && c.id !== "declaracao_visao"
  );
  const declaracao = campos.find((c) => c.id === "declaracao_visao");
  // ids declarados neste capítulo — o grupo é montado do template todo;
  // um subcampo que mora em outro capítulo renderiza lá, não aqui
  const nesteCapitulo = new Set(campos.map((c) => c.id));

  return (
    <>
      {declaracao && (
        <div
          data-campo={declaracao.id}
          className={cn(
            "rounded-xl border-l-2 border-[var(--brand-lime)] bg-[var(--brand-lime)]/5 p-4 sm:p-5",
            api.erros[declaracao.id] && "ring-2 ring-destructive/60"
          )}
        >
          <label
            htmlFor={campoDomId(declaracao)}
            className="block text-[15px] font-semibold leading-snug"
          >
            {declaracao.label}
          </label>
          <div className="mt-2">
            <EntradaTextoLongo
              campo={declaracao}
              valor={api.valores[declaracao.id]}
              definir={api.definir}
              erro={api.erros[declaracao.id]}
              rows={3}
              placeholder="O norte da mentoria, em uma frase…"
            />
          </div>
          <ErroCampo campo={declaracao} msg={api.erros[declaracao.id]} />
        </div>
      )}

      {grupos.map((g) => {
        const errosDoGrupo = [g.meta, g.is, g.prazo, g.porque, g.submetas]
          .filter(Boolean)
          .some((c) => api.erros[c!.id]);
        return (
          <div
            key={g.n}
            className={cn(
              "rounded-lg border border-border/80 p-4",
              errosDoGrupo && "ring-2 ring-destructive/60"
            )}
          >
            <h3 className="flex items-baseline gap-2 text-sm font-semibold">
              <span className="tabular-nums text-muted-foreground">
                Meta {g.n}
              </span>
              {!g.meta.obrigatorio && (
                <span className="text-xs font-normal text-muted-foreground">
                  (opcional)
                </span>
              )}
            </h3>
            <div className="mt-2.5 space-y-3">
              <div className="space-y-1.5" data-campo={g.meta.id}>
                <label
                  htmlFor={campoDomId(g.meta)}
                  className="block text-sm font-medium"
                >
                  {g.meta.label}
                </label>
                <EntradaTexto
                  campo={g.meta}
                  valor={api.valores[g.meta.id]}
                  definir={api.definir}
                  erro={api.erros[g.meta.id]}
                />
                <ErroCampo campo={g.meta} msg={api.erros[g.meta.id]} />
              </div>
              <div className="grid gap-3 @[30rem]:grid-cols-[1fr_180px]">
                {g.is && (
                  <div className="space-y-1.5" data-campo={g.is.id}>
                    <label
                      htmlFor={campoDomId(g.is)}
                      className="block text-sm font-medium"
                    >
                      {g.is.label}
                      {!g.is.obrigatorio && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      )}
                    </label>
                    <EntradaTexto
                      campo={g.is}
                      valor={api.valores[g.is.id]}
                      definir={api.definir}
                      erro={api.erros[g.is.id]}
                      placeholder="Como vou saber que cumpri?"
                    />
                    <ErroCampo campo={g.is} msg={api.erros[g.is.id]} />
                  </div>
                )}
                {g.prazo && (
                  <div className="space-y-1.5" data-campo={g.prazo.id}>
                    <label
                      htmlFor={campoDomId(g.prazo)}
                      className="block text-sm font-medium"
                    >
                      {g.prazo.label}
                      {!g.prazo.obrigatorio && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      )}
                    </label>
                    <EntradaData
                      campo={g.prazo}
                      valor={api.valores[g.prazo.id]}
                      definir={api.definir}
                      erro={api.erros[g.prazo.id]}
                      className="max-w-none"
                    />
                    <ErroCampo campo={g.prazo} msg={api.erros[g.prazo.id]} />
                  </div>
                )}
              </div>
              {/* subcampos do grupo declarados NESTE capítulo, fora da
                  posição-convenção (ex.: submetas_N dentro de s_visao
                  num form editado) — a filtragem por capítulo evita
                  renderizar aqui o que vive no capítulo "Mapa de
                  submetas" (era duplicado antes da 0118) */}
              {[g.porque, g.submetas]
                .filter(
                  (c): c is FormularioCampo =>
                    c != null && nesteCapitulo.has(c.id)
                )
                .map((c) =>
                  c === g.submetas ? (
                    <SubmetasEditor
                      key={c.id}
                      campo={c}
                      api={api}
                      metaN={g.n}
                    />
                  ) : (
                    <div key={c.id} data-campo={c.id}>
                      <CampoGenerico campo={c} api={api} sombra={false} />
                    </div>
                  )
                )}
            </div>
          </div>
        );
      })}

      {soltos.map((c) => (
        <CampoGenerico key={c.id} campo={c} api={api} />
      ))}
    </>
  );
}
