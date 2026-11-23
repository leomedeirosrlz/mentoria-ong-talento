"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Plus, X } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import {
  agrupaEmSecoes,
  extraiGruposMeta,
  idsEmGruposMeta,
  type BlocoSecao,
} from "@/lib/forms/instrumentos";
import { campoRespondido } from "@/lib/forms/resposta";
import {
  camposPerguntas,
  type FormularioCampo,
} from "@/lib/forms/schema";
import { T } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  NumeroPergunta,
  RotuloPergunta,
} from "@/components/forms/pergunta";
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
// + instrução), fichas de meta com os campos do guia juntos (meta,
// indicador de sucesso, prazo e o desdobramento em submetas sob a meta —
// REALIZA-512: o submetas_N se resolve pelo grupo, não pelo capítulo que o
// declarou, então o "Mapa de submetas" da 0080 some do fluxo e fica só
// como fallback de campos órfãos). Metas extras entram por "Nova meta"
// até o teto do template. Em telas extra-largas um sumário lateral
// acompanha o preenchimento — cada capítulo acende o check quando suas
// obrigatórias estão respondidas; abaixo disso o documento segue em
// coluna única.

const META_RE = /^meta_\d+$/;
const SUBMETAS_RE = /^submetas_(\d+)$/;

export function Pdm({
  campos,
  api,
}: {
  campos: FormularioCampo[];
  api: RespostaApi;
}) {
  const blocos = useMemo(() => agrupaEmSecoes(campos), [campos]);
  const grupos = useMemo(() => extraiGruposMeta(campos), [campos]);
  const idsDeMeta = useMemo(() => idsEmGruposMeta(grupos), [grupos]);
  // posição na régua do form pros campos soltos — as fichas de meta têm a
  // identidade "Meta N" própria e não repetem a régua
  const numeroPorId = useMemo(() => {
    const m = new Map<string, number>();
    camposPerguntas(campos).forEach((c, i) => m.set(c.id, i + 1));
    return m;
  }, [campos]);

  // as fichas moram no 1º capítulo que declara meta_N — nos demais os
  // campos de grupo já renderizam dentro delas (o capítulo cai quando só
  // tinha eles, como o "Mapa de submetas" do template oficial antigo)
  const capMetasIdx = blocos.findIndex((b) =>
    b.campos.some((c) => META_RE.test(c.id))
  );

  const capitulos = blocos
    .map((b, i) => ({
      bloco: b,
      ehMetas: i === capMetasIdx,
      // fora do capítulo das metas, o que pertence a um grupo já está
      // aninhado — sobra só o órfão e os campos comuns
      restantes:
        i === capMetasIdx
          ? b.campos
          : b.campos.filter((c) => !idsDeMeta.has(c.id)),
      completo:
        b.campos.filter((c) => c.obrigatorio).length > 0 &&
        b.campos
          .filter((c) => c.obrigatorio)
          .every((c) => campoRespondido(c, api.valores[c.id])),
    }))
    .filter((c) => c.ehMetas || c.restantes.length > 0)
    .map((c, i) => ({ ...c, numero: i + 1, id: `pdm-cap-${i + 1}` }));

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

        <div className="min-w-0 space-y-5">
          {capitulos.map((c) => (
            <CapituloDoc
              key={c.id}
              capitulo={c}
              api={api}
              grupos={grupos}
              numeroPorId={numeroPorId}
            />
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
  numeroPorId,
}: {
  capitulo: {
    bloco: BlocoSecao;
    numero: number;
    id: string;
    ehMetas: boolean;
    restantes: FormularioCampo[];
  };
  api: RespostaApi;
  grupos: ReturnType<typeof extraiGruposMeta>;
  numeroPorId: Map<string, number>;
}) {
  const { bloco, numero, id, ehMetas, restantes } = capitulo;

  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-xl bg-card shadow-[var(--shadow-border)]"
    >
      <div className="p-5 @xl:p-7">
        {bloco.secao && (
          <header className="flex items-start gap-3">
            {/* número de capítulo, não de pergunta — mesma tinta destaque
                da gramática, canto quadrado pra ler como seção do doc */}
            <NumeroPergunta
              n={numero}
              className="rounded-lg text-sm"
            />
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
          {ehMetas ? (
            <FichasPdm
              campos={bloco.campos}
              grupos={grupos}
              api={api}
              numeroPorId={numeroPorId}
            />
          ) : (
            restantes.map((c) => (
              <CampoDoc key={c.id} campo={c} api={api} numeroPorId={numeroPorId} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/** Campo de capítulo fora das fichas de meta — o submetas_N órfão (sem
 *  meta_M correspondente, form legado/editado) mantém o editor de linhas;
 *  a serialização é a mesma de qualquer lugar. */
function CampoDoc({
  campo,
  api,
  numeroPorId,
}: {
  campo: FormularioCampo;
  api: RespostaApi;
  numeroPorId?: Map<string, number>;
}) {
  const subN = SUBMETAS_RE.exec(campo.id)?.[1];
  if (campo.tipo === "texto_longo" && subN) {
    return <SubmetasEditor campo={campo} api={api} metaN={Number(subN)} />;
  }
  if (campo.tipo === "texto_longo") {
    return (
      <div data-campo={campo.id} className="space-y-1.5">
        <RotuloPergunta
          campo={campo}
          n={numeroPorId?.get(campo.id)}
          htmlFor={campoDomId(campo)}
        />
        <EntradaTextoLongo
          campo={campo}
          valor={api.valores[campo.id]}
          definir={api.definir}
          erro={api.erros[campo.id]}
          rows={5}
          className={cn(api.erros[campo.id] && "border-destructive")}
        />
        <ErroCampo campo={campo} msg={api.erros[campo.id]} />
      </div>
    );
  }
  return (
    <CampoGenerico
      campo={campo}
      api={api}
      sombra={false}
      n={numeroPorId?.get(campo.id)}
    />
  );
}

/** Declaração + fichas de meta do capítulo "Visão e metas": cada meta é
 *  uma ficha com meta, IS, prazo e o desdobramento juntos — o grupo se
 *  resolve pelo N no template inteiro, não pelo capítulo. As metas
 *  opcionais entram por "Nova meta" (rascunho com conteúdo reabre sozinho)
 *  e o teto do template aparece escrito quando tudo já está aberto. */
function FichasPdm({
  campos,
  grupos,
  api,
  numeroPorId,
}: {
  campos: FormularioCampo[];
  grupos: ReturnType<typeof extraiGruposMeta>;
  api: RespostaApi;
  numeroPorId: Map<string, number>;
}) {
  const idsDeMeta = idsEmGruposMeta(grupos);
  const soltos = campos.filter(
    (c) => !idsDeMeta.has(c.id) && c.id !== "declaracao_visao"
  );
  const declaracao = campos.find((c) => c.id === "declaracao_visao");

  // metas opcionais nascem fechadas — o conteúdo segura a ficha aberta:
  // o rascunho restaura depois do mount e a meta 4 salva volta aberta
  const [abertas, setAbertas] = useState<Set<number>>(new Set());
  const addRef = useRef<HTMLButtonElement>(null);

  const temConteudo = (g: (typeof grupos)[number]) =>
    campoRespondido(g.meta, api.valores[g.meta.id]) ||
    [g.is, g.prazo, g.porque, g.submetas].some(
      (c) => c != null && campoRespondido(c, api.valores[c.id])
    );

  const opcionais = grupos.filter((g) => !g.meta.obrigatorio);
  const proximaFechada = opcionais.find(
    (g) => !abertas.has(g.n) && !temConteudo(g)
  );
  const preenchidas = grupos.filter((g) =>
    campoRespondido(g.meta, api.valores[g.meta.id])
  ).length;

  function remover(n: number) {
    const g = grupos.find((x) => x.n === n);
    if (!g) return;
    // snapshot pra Desfazer — a remoção limpa todos os campos do grupo
    const backup = [g.meta, g.is, g.prazo, g.porque, g.submetas]
      .filter((c): c is FormularioCampo => c != null)
      .map((c) => [c.id, api.valores[c.id]] as const);
    for (const c of [g.meta, g.is, g.prazo, g.porque, g.submetas]) {
      if (c) api.definir(c.id, undefined);
    }
    setAbertas((prev) => {
      const next = new Set(prev);
      next.delete(n);
      return next;
    });
    toast(`Meta ${n} removida`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          for (const [id, v] of backup) api.definir(id, v);
          setAbertas((prev) => new Set(prev).add(n));
        },
      },
    });
    // foco cai no gatilho que reabre a ficha — sem ele o teclado órfão
    requestAnimationFrame(() => addRef.current?.focus());
  }

  return (
    <>
      {declaracao && (
        <div
          data-campo={declaracao.id}
          className={cn(
            "rounded-xl border-l-2 border-[var(--brand-lime)] bg-[var(--brand-lime)]/5 p-4 @xl:p-5",
            api.erros[declaracao.id] && "ring-2 ring-destructive/60"
          )}
        >
          <label
            htmlFor={campoDomId(declaracao)}
            className="block text-[15px] font-semibold leading-snug text-[var(--ok-text)]"
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

      <p className="px-1 text-xs font-medium tabular-nums text-muted-foreground">
        {preenchidas}{" "}
        {preenchidas === 1 ? "meta definida" : "metas definidas"} ·{" "}
        {grupos.filter((g) => g.meta.obrigatorio).length} obrigatórias
      </p>

      <AnimatePresence initial={false}>
        {grupos.map((g) => {
          const opcional = !g.meta.obrigatorio;
          if (opcional && !abertas.has(g.n) && !temConteudo(g)) return null;
          return (
            <FichaMetaPdm
              key={g.n}
              grupo={g}
              api={api}
              onRemover={opcional ? () => remover(g.n) : undefined}
            />
          );
        })}
      </AnimatePresence>

      {proximaFechada ? (
        <Button
          ref={addRef}
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={() => {
            const alvo = proximaFechada;
            setAbertas((prev) => new Set(prev).add(alvo.n));
            // ficha nova entra focada — o input da meta é o primeiro
            // controle e já vem com o rascunho de volta se houver
            requestAnimationFrame(() =>
              document.getElementById(campoDomId(alvo.meta))?.focus()
            );
          }}
        >
          <Plus aria-hidden />
          Nova meta
        </Button>
      ) : (
        // o teto é do template — fica escrito em vez de esconder o botão
        opcionais.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Limite de {grupos.length} metas no PDM.
          </p>
        )
      )}

      {soltos.map((c) => (
        <CampoDoc key={c.id} campo={c} api={api} numeroPorId={numeroPorId} />
      ))}
    </>
  );
}

/** A ficha de uma meta do PDM — meta, IS e prazo em linha curta e o
 *  desdobramento em submetas embaixo, no editor de linhas da 0118.
 *  Opcionais ganham o X que limpa e recolhe com Desfazer. */
function FichaMetaPdm({
  grupo,
  api,
  onRemover,
}: {
  grupo: ReturnType<typeof extraiGruposMeta>[number];
  api: RespostaApi;
  onRemover?: () => void;
}) {
  const g = grupo;
  const errosDoGrupo = [g.meta, g.is, g.prazo, g.porque, g.submetas]
    .filter(Boolean)
    .some((c) => api.erros[c!.id]);

  return (
    <motion.div
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
        "rounded-lg border border-border/80 p-4",
        errosDoGrupo && "ring-2 ring-destructive/60"
      )}
    >
      <h3 className="flex items-center gap-2.5 text-sm font-semibold">
        <NumeroPergunta n={g.n} compacto />
        <span className="tabular-nums">Meta {g.n}</span>
        {!g.meta.obrigatorio && (
          <span className="text-xs font-normal text-muted-foreground">
            (opcional)
          </span>
        )}
        {onRemover && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemover}
            aria-label={`Remover meta ${g.n}`}
            className="ml-auto shrink-0 text-muted-foreground"
          >
            <X aria-hidden />
          </Button>
        )}
      </h3>
      <div className="mt-2.5 space-y-3">
        <div className="space-y-1.5" data-campo={g.meta.id}>
          <RotuloPergunta
            campo={g.meta}
            htmlFor={campoDomId(g.meta)}
            className="text-sm"
          />
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
              <RotuloPergunta
                campo={g.is}
                htmlFor={campoDomId(g.is)}
                className="text-sm"
              />
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
              <RotuloPergunta
                campo={g.prazo}
                htmlFor={campoDomId(g.prazo)}
                className="text-sm"
              />
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
        {/* desdobramento e demais subcampos do grupo, resolvidos pelo N
            no template inteiro — onde quer que o capítulo os declare,
            eles leem dentro da meta (0118 + REALIZA-512) */}
        {[g.submetas, g.porque]
          .filter((c): c is FormularioCampo => c != null)
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
    </motion.div>
  );
}
