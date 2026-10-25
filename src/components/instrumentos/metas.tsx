"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FlagPennant, Plus, X } from "@phosphor-icons/react";
import { agrupaEmSecoes, extraiGruposMeta } from "@/lib/forms/instrumentos";
import { campoRespondido } from "@/lib/forms/resposta";
import { type FormularioCampo } from "@/lib/forms/schema";
import { T } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RespostaApi } from "./use-resposta";
import { SubmetasEditor } from "./submetas-editor";
import {
  CampoGenerico,
  campoDomId,
  EntradaTexto,
  EntradaTextoLongo,
  ErroCampo,
  Segmentos,
  SimNao,
} from "./campos";

// Definindo Minhas Metas — metas como cards vivos: cada grupo meta_N +
// porque_N (+ submetas_N, o desdobramento da 0118) é uma ficha que
// acende quando preenchida (número vira lime).
// As metas opcionais (4–5) entram por "Adicionar meta" com animação de
// altura e saem pelo X — o conjunto fixo da definição não muda, só a
// apresentação. O fechamento (rev_* + meta_principal) vira revisão em
// bloco, com a escolha da principal em segmentos numerados que mostram a
// meta escrita embaixo.

const META_RE = /^meta_\d+$/;

export function Metas({
  campos,
  api,
}: {
  campos: FormularioCampo[];
  api: RespostaApi;
}) {
  const blocos = useMemo(() => agrupaEmSecoes(campos), [campos]);

  return (
    <>
      {blocos.map((b, bi) => {
        const ehMetas = b.campos.some((c) => META_RE.test(c.id));
        const ehVisao = b.campos.some((c) => c.id.startsWith("preciso_"));
        return (
          <Capitulo
            key={b.secao?.id ?? `bloco-${bi}`}
            secao={b.secao ?? null}
            primeiro={bi === 0}
          >
            {ehMetas ? (
              <CorpoMetas campos={b.campos} api={api} />
            ) : ehVisao ? (
              <CorpoVisao campos={b.campos} api={api} />
            ) : (
              <div className="space-y-3">
                {b.campos.map((c) => (
                  <CampoRevisao key={c.id} campo={c} api={api} />
                ))}
              </div>
            )}
          </Capitulo>
        );
      })}
    </>
  );
}

/** Cabeçalho de capítulo — a 'secao' vira divider editorial numerado, não
 *  só um rótulo solto. */
function Capitulo({
  secao,
  primeiro,
  children,
}: {
  secao: FormularioCampo | null;
  primeiro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(!primeiro && "pt-2")}>
      {secao && (
        <header className="px-1 pb-3">
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">
            {secao.label}
          </h2>
          {secao.descricao && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {secao.descricao}
            </p>
          )}
          <div aria-hidden className="mt-3 h-px bg-border" />
        </header>
      )}
      {children}
    </section>
  );
}

/** Bloco "Minha visão": a declaração em destaque + os quatro preciso_*
 *  como pílulas rápidas de reflexão (grade 2×2 no desktop). */
function CorpoVisao({
  campos,
  api,
}: {
  campos: FormularioCampo[];
  api: RespostaApi;
}) {
  const declaracao = campos.find((c) => c.id === "declaracao_visao");
  const precisos = campos.filter((c) => c.id.startsWith("preciso_"));
  const soltos = campos.filter(
    (c) => c !== declaracao && !precisos.includes(c)
  );

  return (
    <div className="space-y-3">
      {declaracao && (
        <div
          data-campo={declaracao.id}
          className={cn(
            "rounded-xl border-l-2 border-[var(--brand-lime)] bg-card p-4 shadow-[var(--shadow-border)] sm:p-5",
            api.erros[declaracao.id] && "ring-2 ring-destructive/60"
          )}
        >
          <label
            htmlFor={campoDomId(declaracao)}
            className="block text-[15px] font-semibold leading-snug sm:text-base"
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
              placeholder="Serei… Alcançarei… Conquistarei…"
            />
          </div>
          <ErroCampo campo={declaracao} msg={api.erros[declaracao.id]} />
        </div>
      )}

      {precisos.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {precisos.map((c) => (
            <div
              key={c.id}
              data-campo={c.id}
              className={cn(
                "space-y-1.5 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]",
                api.erros[c.id] && "ring-2 ring-destructive/60"
              )}
            >
              <label
                htmlFor={campoDomId(c)}
                className="block text-sm font-medium leading-snug"
              >
                {c.label}
              </label>
              <EntradaTexto
                campo={c}
                valor={api.valores[c.id]}
                definir={api.definir}
                erro={api.erros[c.id]}
              />
              <ErroCampo campo={c} msg={api.erros[c.id]} />
            </div>
          ))}
        </div>
      )}

      {soltos.map((c) => (
        <CampoGenerico key={c.id} campo={c} api={api} />
      ))}
    </div>
  );
}

/** Bloco "Minhas metas": as fichas vivas — obrigatórias sempre visíveis,
 *  opcionais entram pelo botão com animação de altura. */
function CorpoMetas({
  campos,
  api,
}: {
  campos: FormularioCampo[];
  api: RespostaApi;
}) {
  const grupos = useMemo(() => extraiGruposMeta(campos), [campos]);
  // metas abertas além das obrigatórias — deriva do conteúdo também (o
  // rascunho restaura DEPOIS do mount: meta_4 salva volta aberta sozinha)
  const [abertas, setAbertas] = useState<Set<number>>(new Set());

  // conteúdo segura a ficha aberta — desdobramento/is/prazo também
  // contam (a pessoa pode ter começado pelas submetas)
  const temConteudo = (g: (typeof grupos)[number]) =>
    campoRespondido(g.meta, api.valores[g.meta.id]) ||
    [g.porque, g.is, g.prazo, g.submetas].some(
      (c) => c != null && campoRespondido(c, api.valores[c.id])
    );

  const obrigatorias = grupos.filter((g) => g.meta.obrigatorio);
  const opcionais = grupos.filter((g) => !g.meta.obrigatorio);
  const visiveis = opcionais.filter((g) => abertas.has(g.n) || temConteudo(g));
  const proximaFechada = opcionais.find(
    (g) => !abertas.has(g.n) && !temConteudo(g)
  );
  const preenchidas = grupos.filter((g) =>
    campoRespondido(g.meta, api.valores[g.meta.id])
  ).length;
  // campos fora de qualquer grupo meta_N (stray de form editado) — sempre
  // renderizados no fim pra nenhuma pergunta sumir da tela
  const emGrupo = new Set(
    grupos.flatMap((g) =>
      [g.meta, g.is, g.prazo, g.porque, g.submetas]
        .filter(Boolean)
        .map((c) => c!.id)
    )
  );
  const fora = campos.filter((c) => !emGrupo.has(c.id));

  function remover(n: number) {
    const g = grupos.find((x) => x.n === n);
    if (!g) return;
    api.definir(g.meta.id, undefined);
    if (g.porque) api.definir(g.porque.id, undefined);
    if (g.is) api.definir(g.is.id, undefined);
    if (g.prazo) api.definir(g.prazo.id, undefined);
    if (g.submetas) api.definir(g.submetas.id, undefined);
    setAbertas((prev) => {
      const next = new Set(prev);
      next.delete(n);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-xs font-medium tabular-nums text-muted-foreground">
        {preenchidas}{" "}
        {preenchidas === 1 ? "meta definida" : "metas definidas"} ·{" "}
        {obrigatorias.length} obrigatórias
      </p>

      <AnimatePresence initial={false}>
        {obrigatorias.map((g) => (
          <FichaMeta key={g.n} grupo={g} api={api} />
        ))}
        {visiveis.map((g) => (
          <FichaMeta
            key={g.n}
            grupo={g}
            api={api}
            onRemover={() => remover(g.n)}
          />
        ))}
      </AnimatePresence>

      {proximaFechada && (
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={() =>
            setAbertas((prev) => new Set(prev).add(proximaFechada.n))
          }
        >
          <Plus aria-hidden />
          Adicionar meta {proximaFechada.n}
        </Button>
      )}

      {fora.map((c) => {
        // submetas_N órfão de meta (form editado) — mesmo editor de
        // linhas, só sem o número da meta no rótulo falado
        const subN = /^submetas_(\d+)$/.exec(c.id)?.[1];
        return c.tipo === "texto_longo" && subN ? (
          <SubmetasEditor key={c.id} campo={c} api={api} metaN={Number(subN)} />
        ) : (
          <CampoGenerico key={c.id} campo={c} api={api} />
        );
      })}
    </div>
  );
}

/** A ficha de uma meta — acende quando a meta está escrita; opcionais
 *  ganham o X que limpa e recolhe. */
function FichaMeta({
  grupo,
  api,
  onRemover,
}: {
  grupo: ReturnType<typeof extraiGruposMeta>[number];
  api: RespostaApi;
  onRemover?: () => void;
}) {
  const g = grupo;
  const pronta = campoRespondido(g.meta, api.valores[g.meta.id]);
  const completa =
    pronta && (!g.porque || campoRespondido(g.porque, api.valores[g.porque.id]));
  const erroMeta = api.erros[g.meta.id];
  const erroPorque = g.porque ? api.erros[g.porque.id] : undefined;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{
        opacity: 0,
        height: 0,
        paddingTop: 0,
        paddingBottom: 0,
        marginTop: 0,
        marginBottom: 0,
      }}
      transition={T.panel}
      style={{ overflow: "clip" }}
      className={cn(
        "rounded-xl bg-card shadow-[var(--shadow-border)]",
        (erroMeta || erroPorque) && "ring-2 ring-destructive/60"
      )}
    >
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums transition-colors",
              completa
                ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
                : "bg-[var(--brand-lime)]/15 text-[var(--ok-text)]"
            )}
          >
            {g.n}
          </span>
          <h3 className="flex-1 text-[15px] font-semibold">
            Meta {g.n}
            {!g.meta.obrigatorio && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                (opcional)
              </span>
            )}
          </h3>
          {completa && (
            <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
              pronta
            </Badge>
          )}
          {onRemover && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRemover}
              aria-label={`Remover meta ${g.n}`}
              className="shrink-0 text-muted-foreground"
            >
              <X aria-hidden />
            </Button>
          )}
        </div>

        <div className="space-y-1.5" data-campo={g.meta.id}>
          <label
            htmlFor={campoDomId(g.meta)}
            className="block text-sm font-medium leading-snug"
          >
            {g.meta.label}
          </label>
          <EntradaTexto
            campo={g.meta}
            valor={api.valores[g.meta.id]}
            definir={api.definir}
            erro={erroMeta}
            placeholder="Desenvolver, Concluir, Aprender, Conseguir…"
          />
          <ErroCampo campo={g.meta} msg={erroMeta} />
        </div>

        {g.porque && (
          <div className="space-y-1.5" data-campo={g.porque.id}>
            <label
              htmlFor={campoDomId(g.porque)}
              className="block text-sm font-medium leading-snug"
            >
              {g.porque.label}
              {!g.porque.obrigatorio && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  (opcional)
                </span>
              )}
            </label>
            <EntradaTextoLongo
              campo={g.porque}
              valor={api.valores[g.porque.id]}
              definir={api.definir}
              erro={erroPorque}
              rows={3}
              placeholder="O que essa conquista muda na minha vida?"
            />
            <ErroCampo campo={g.porque} msg={erroPorque} />
          </div>
        )}

        {/* desdobramento (0118): uma linha por submeta — o valor segue
            texto_longo serializado no contrato de pdm_parse_submetas */}
        {g.submetas && (
          <SubmetasEditor campo={g.submetas} api={api} metaN={g.n} />
        )}

        {/* subcampos fora da convenção do instrumento (is_/prazo_ num
            form de Metas editado) — renderizados em vez de sumir */}
        {[g.is, g.prazo]
          .filter((c): c is FormularioCampo => c != null)
          .map((c) => (
            <div key={c.id} data-campo={c.id}>
              <CampoGenerico campo={c} api={api} sombra={false} />
            </div>
          ))}
      </div>
    </motion.article>
  );
}

/** Campos do bloco de revisão: sim_nao agrupados numa ficha de checklist,
 *  meta_principal em segmentos com o texto da meta embaixo. */
function CampoRevisao({
  campo,
  api,
}: {
  campo: FormularioCampo;
  api: RespostaApi;
}) {
  // um submetas_N fora do capítulo das metas (form editado) mantém o
  // editor de linhas — a serialização é a mesma de qualquer lugar
  const subN = /^submetas_(\d+)$/.exec(campo.id)?.[1];
  if (campo.tipo === "texto_longo" && subN) {
    return <SubmetasEditor campo={campo} api={api} metaN={Number(subN)} />;
  }

  if (campo.tipo === "sim_nao") {
    return (
      <div
        data-campo={campo.id}
        className={cn(
          "rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5",
          api.erros[campo.id] && "ring-2 ring-destructive/60"
        )}
      >
        <p className="text-[15px] font-medium leading-snug">{campo.label}</p>
        <div className="mt-2">
          <SimNao
            campo={campo}
            valor={api.valores[campo.id]}
            definir={api.definir}
            erro={api.erros[campo.id]}
          />
        </div>
        <ErroCampo campo={campo} msg={api.erros[campo.id]} />
      </div>
    );
  }

  // a meta principal — segmentos numerados com o texto da meta escolhida
  if (campo.id === "meta_principal" && campo.opcoes?.length) {
    const escolhida = String(api.valores[campo.id] ?? "");
    const nEscolhida = /^Meta (\d+)$/.exec(escolhida)?.[1];
    const textoDaMeta = nEscolhida
      ? String(api.valores[`meta_${nEscolhida}`] ?? "")
      : "";
    return (
      <div
        data-campo={campo.id}
        className={cn(
          "rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5",
          api.erros[campo.id] && "ring-2 ring-destructive/60"
        )}
      >
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)]/15 text-[var(--ok-text)]"
          >
            <FlagPennant size={15} />
          </span>
          <p className="flex-1 text-[15px] font-medium leading-snug">
            {campo.label}
          </p>
        </div>
        <div className="mt-2">
          <Segmentos
            campo={campo}
            valor={api.valores[campo.id]}
            definir={api.definir}
            erro={api.erros[campo.id]}
            opcoes={campo.opcoes.map((o) => ({
              v: o,
              l: o.replace(/^Meta\s+/i, ""),
            }))}
          />
        </div>
        {textoDaMeta && (
          <p className="mt-2 truncate text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{escolhida}:</span>{" "}
            {textoDaMeta}
          </p>
        )}
        <ErroCampo campo={campo} msg={api.erros[campo.id]} />
      </div>
    );
  }

  return <CampoGenerico campo={campo} api={api} />;
}
