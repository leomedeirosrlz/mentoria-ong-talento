import {
  camposPerguntas,
  COMPETENCIAS_MENTOR,
  COMPETENCIA_OPCOES,
  extraiMetas,
  extraiRodaDaVida,
  respostaFormatada,
  type FormularioCampo,
  type FormularioSistema,
  type RespostaValor,
} from "@/lib/forms/schema";
import {
  NumeroPergunta,
  PERGUNTA_TEXTO,
  RESPOSTA_TEXTO,
} from "@/components/forms/pergunta";
import { parseSubmetasLinhas } from "@/lib/pdm";
import { cn } from "@/lib/utils";
import { RodaSvg } from "./instrumentos/roda-svg";
import { RodaComparada } from "./instrumentos/roda-comparada";

// Leitura estruturada das respostas dos instrumentos oficiais (0080) —
// o form genérico guarda {campo_id: valor}; aqui o resultado vira o que o
// instrumento é de verdade: a roda desenhada (o mesmo SVG que a pessoa
// preencheu no /f/<token>), a lista de metas com IS e prazo, a declaração
// de visão. Usado na aba Respostas do /formularios/[id] e na seção
// Instrumentos da ficha da dupla. Server component puro — sem estado nem
// efeito.

/** Resposta de um campo pelo id, já formatada pra exibição. */
function valorDe(
  campos: FormularioCampo[],
  respostas: Record<string, RespostaValor>,
  id: string
): string {
  const campo = campos.find((c) => c.id === id);
  return respostaFormatada(campo, respostas[id]);
}

function Bloco({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/** A declaração é o norte do instrumento — blockquote hero, sempre no topo. */
function Declaracao({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <blockquote id="pdm-resposta-declaracao" className="rounded-xl border-l-2 border-[var(--brand-lime)] bg-[var(--brand-lime)]/5 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Declaração de Visão
      </p>
      <p className="mt-1 text-[15px] font-medium leading-relaxed whitespace-pre-wrap">
        “{texto}”
      </p>
    </blockquote>
  );
}

// ---------- Roda da Vida ----------

function corNota(n: number | null): string {
  if (n == null) return "text-muted-foreground";
  if (n <= 4) return "text-[var(--warn-text)]";
  if (n >= 8) return "text-[var(--ok-text)]";
  return "text-foreground";
}

/** Prazo gravado como ISO date (campo tipo data) → dd/mm/aaaa. */
function dataBr(iso: string): string {
  const d = new Date(`${iso}T12:00:00-03:00`);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** As linhas do desdobramento numeradas — mesma leitura sob a meta e no
 *  bloco solto das órfãs. */
function SubmetasLidas({ linhas }: { linhas: string[] }) {
  return (
    <ol className="mt-1 space-y-1">
      {linhas.map((l, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed">
          <span
            aria-hidden
            className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground"
          >
            {i + 1}.
          </span>
          <span className="min-w-0">{l}</span>
        </li>
      ))}
    </ol>
  );
}

function RodaResultado({
  campos,
  respostas,
  respostasAnterior = null,
}: {
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
  /** initial application payload — when the two moments share the area
   *  structure the view becomes the REALIZA-18 comparison; otherwise it
   *  is ignored and the single wheel renders as before */
  respostasAnterior?: Record<string, RespostaValor> | null;
}) {
  const roda = extraiRodaDaVida(campos, respostas);
  if (!roda) return null;
  const reflexao = valorDe(campos, respostas, "reflexao");
  const numeroPorId = new Map(
    camposPerguntas(campos).map((c, i) => [c.id, i + 1])
  );

  const rodaAnterior = respostasAnterior
    ? extraiRodaDaVida(campos, respostasAnterior)
    : null;
  if (rodaAnterior) {
    return (
      <RodaComparada
        rodaAtual={roda}
        rodaAnterior={rodaAnterior}
        reflexao={reflexao}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* roda e lista empilham sempre: o lado a lado da faixa sm–lg
          espremia os nomes das áreas e deixava vazio sob o desenho dentro
          do dialog estreito (REALIZA-253). Em container largo a roda veste
          a coroa de nomes de área (variante A — REALIZA-143). Breakpoints
          de container: o mesmo desenho abre na ficha da dupla e no dialog
          de respostas (REALIZA-248) */}
      <div className="grid gap-4">
        <div className="text-center">
          <RodaSvg
            roda={roda}
            className="max-w-[280px] @[24rem]:max-w-[300px] @[34rem]:hidden"
          />
          <RodaSvg
            roda={roda}
            rotuloEixos
            className="hidden @[34rem]:block @[34rem]:max-w-[460px]"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {roda.media != null && (
              <>
                Média geral{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {roda.media.toLocaleString("pt-BR")}
                </strong>
                /10
                {" · "}
              </>
            )}
            {roda.respondidas} de {roda.total} áreas
          </p>
        </div>
        {/* nota por área agrupada por quadrante — a barra repete a leitura
            do polígono pra quem precisa do número exato. O nº verde repete
            a posição na régua que a pessoa viu ao preencher (442/010) */}
        <div className="space-y-3 @[30rem]:grid @[30rem]:grid-cols-2 @[30rem]:gap-x-6 @[30rem]:gap-y-4 @[30rem]:space-y-0 @[30rem]:self-start">
          {roda.quadrantes.map((q) => (
            <div key={q.nome || "geral"}>
              {q.nome && (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {q.nome}
                </p>
              )}
              <ul className="space-y-1">
                {q.areas.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <NumeroPergunta
                      n={numeroPorId.get(a.id) ?? 0}
                      compacto
                    />
                    <span
                      className="min-w-0 flex-1 truncate font-semibold text-foreground"
                      title={a.label}
                    >
                      {a.label}
                    </span>
                    <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:w-20">
                      <span
                        className="block h-full rounded-full bg-[var(--brand-lime)]"
                        style={{ width: `${((a.nota ?? 0) / 10) * 100}%` }}
                      />
                    </span>
                    <span
                      className={cn(
                        "w-7 shrink-0 text-right font-semibold tabular-nums",
                        corNota(a.nota)
                      )}
                    >
                      {a.nota ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      {reflexao && (
        <Bloco titulo="Reflexão sobre a roda">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {reflexao}
          </p>
        </Bloco>
      )}
    </div>
  );
}

// ---------- metas / PDM ----------

function MetasResultado({
  campos,
  respostas,
  sistema,
}: {
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
  sistema: "metas" | "pdm";
}) {
  const metas = extraiMetas(campos, respostas);
  const declaracao = valorDe(campos, respostas, "declaracao_visao");
  // "Meta N" → marca a escolhida como a mais importante agora (Definindo
  // Minhas Metas fecha com essa eleição)
  const principalTxt =
    sistema === "metas" ? valorDe(campos, respostas, "meta_principal") : "";
  const principalN = /^Meta (\d+)$/.exec(principalTxt)?.[1];

  const reflexoes = (
    [
      ["preciso_criar", "Criar"],
      ["preciso_aprender", "Aprender"],
      ["preciso_melhorar", "Melhorar"],
      ["preciso_eliminar", "Eliminar"],
    ] as const
  )
    .map(([id, rotulo]) => ({ rotulo, valor: valorDe(campos, respostas, id) }))
    .filter((r) => r.valor);

  const revisao = (
    [
      "rev_ajudam",
      "rev_importantes",
      "rev_claras",
    ] as const
  ).map((id) => {
    const campo = campos.find((c) => c.id === id);
    const v = respostas[id];
    if (!campo || v == null) return null;
    return { label: campo.label, ok: v === "sim" };
  }).filter((r): r is { label: string; ok: boolean } => r != null);

  // desdobramento por meta — Metas (0118) e PDM: cada submetas_N respondido
  // vira uma lista lida pelo mesmo parser que projeta pdm_itens. A leitura
  // aninha sob a meta N (REALIZA-512: o "Mapa de submetas" solto saía do
  // contexto); submetas órfãs de meta (resposta/edit que trouxe submetas_M
  // sem meta_M respondida) seguem lidas em bloco próprio — nunca somem.
  const desdobramentosPorN = new Map<number, string[]>();
  for (const c of campos) {
    const n = /^submetas_(\d+)$/.exec(c.id)?.[1];
    const v = respostas[c.id];
    if (!n || typeof v !== "string" || !v.trim()) continue;
    const linhas = parseSubmetasLinhas(v);
    if (linhas.length) desdobramentosPorN.set(Number(n), linhas);
  }
  const metasN = new Set(metas.map((m) => m.n));
  const desdobramentosOrfaos = [...desdobramentosPorN.entries()]
    .filter(([n]) => !metasN.has(n))
    .sort(([a], [b]) => a - b);

  return (
    <div className="space-y-4">
      <Declaracao texto={declaracao} />

      {reflexoes.length > 0 && (
        <Bloco titulo="Pra chegar na visão">
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {reflexoes.map((r) => (
              <div key={r.rotulo}>
                <dt className="text-xs font-medium text-muted-foreground">
                  {r.rotulo}
                </dt>
                <dd className="text-sm leading-relaxed">{r.valor}</dd>
              </div>
            ))}
          </dl>
        </Bloco>
      )}

      <Bloco titulo={sistema === "pdm" ? "Metas, indicadores e prazos" : "Metas"}>
        <ol className="space-y-2.5">
          {metas.map((m) => (
            <li
              key={m.n}
              id={`pdm-resposta-meta-${m.n}`}
              className="scroll-mt-4 rounded-lg border border-border/70 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  Meta {m.n}
                </span>
                {principalN === String(m.n) && (
                  <span className="rounded-full bg-[var(--brand-lime)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--ok-text)]">
                    a mais importante agora
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm font-medium leading-snug">
                {m.meta}
              </p>
              <div className="mt-1 space-y-0.5 text-sm">
                {m.porque && (
                  <p className="leading-relaxed">
                    <span className="text-xs font-medium text-muted-foreground">
                      Por quê:{" "}
                    </span>
                    {m.porque}
                  </p>
                )}
                {m.indicador && (
                  <p>
                    <span className="text-xs font-medium text-muted-foreground">
                      Indicador:{" "}
                    </span>
                    {m.indicador}
                  </p>
                )}
              </div>
              {m.prazo && (
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  Prazo: {dataBr(m.prazo)}
                </p>
              )}
              {desdobramentosPorN.has(m.n) && (
                <div className="mt-2 border-t border-border/60 pt-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Desdobramento da meta {m.n}
                  </p>
                  <SubmetasLidas linhas={desdobramentosPorN.get(m.n)!} />
                </div>
              )}
            </li>
          ))}
        </ol>
      </Bloco>

      {desdobramentosOrfaos.map(([n, linhas]) => (
        <Bloco key={n} titulo={`Desdobramento da meta ${n}`}>
          <SubmetasLidas linhas={linhas} />
        </Bloco>
      ))}

      {revisao.length > 0 && (
        <Bloco titulo="Revisão">
          <ul className="space-y-1">
            {revisao.map((r) => (
              <li key={r.label} className="flex items-baseline gap-2 text-sm">
                <span
                  aria-hidden
                  className={cn(
                    "font-semibold",
                    r.ok ? "text-[var(--ok-text)]" : "text-[var(--warn-text)]"
                  )}
                >
                  {r.ok ? "✓" : "✗"}
                </span>
                <span className="min-w-0 flex-1 text-foreground">
                  {r.label}
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
      )}
    </div>
  );
}

// ---------- visão ----------

function VisaoResultado({
  campos,
  respostas,
}: {
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
}) {
  const declaracao = valorDe(campos, respostas, "declaracao_visao");
  const numeroPorId = new Map(
    camposPerguntas(campos).map((c, i) => [c.id, i + 1])
  );
  const narrativa = (
    [
      "filme",
      "aspectos",
      "ser_fazer",
      "deixou",
      "valoriza",
    ] as const
  )
    .map((id) => campos.find((c) => c.id === id))
    .filter((c): c is FormularioCampo => c != null);
  const temNarrativa = narrativa.some((c) => respostas[c.id] != null);

  return (
    <div className="space-y-4">
      <Declaracao texto={declaracao} />
      {temNarrativa && (
        <Bloco titulo="O filme da vida ideal">
          {/* hierarquia da gramática compartilhada (REALIZA-442): o nº
              verde em texto é a posição na régua — uma opcional vazia
              não renumera as seguintes —, pergunta em primeiro plano,
              resposta em primeiro plano */}
          <ol className="space-y-4">
            {narrativa.map((c) => {
              const valor = valorDe(campos, respostas, c.id);
              if (valor === "—") return null;
              return (
                <li key={c.id} className="flex items-baseline gap-2">
                  <NumeroPergunta n={numeroPorId.get(c.id) ?? 0} />
                  <div className="min-w-0">
                    <p className={PERGUNTA_TEXTO}>{c.label}</p>
                    <p
                      className={cn(
                        "mt-1 whitespace-pre-wrap",
                        RESPOSTA_TEXTO
                      )}
                    >
                      {valor}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Bloco>
      )}
    </div>
  );
}

// ---------- checklist de competências do mentor (0190) ----------

/** Mentor checklist marking — one row per competency with the "Já faço
 *  bem / Preciso desenvolver" choice. With `respostasInicio` the row shows
 *  the início × fim pair (REALIZA-359); without it, a single marking. */
export function CompetenciasResultado({
  campos,
  respostas,
  respostasInicio = null,
}: {
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
  respostasInicio?: Record<string, RespostaValor> | null;
}) {
  const linhas = COMPETENCIAS_MENTOR.map((texto, i) => {
    const campo = campos.find((c) => c.id === `comp_${i + 1}`);
    const atual = campo ? respostaFormatada(campo, respostas[campo.id]) : "";
    const inicio =
      campo && respostasInicio
        ? respostaFormatada(campo, respostasInicio[campo.id])
        : "";
    return { texto, atual, inicio };
  });
  const bem = COMPETENCIA_OPCOES[0];
  const dev = COMPETENCIA_OPCOES[1];
  const totalBem = linhas.filter((l) => l.atual === bem).length;
  const inicioBem = respostasInicio
    ? linhas.filter((l) => l.inicio === bem).length
    : null;

  return (
    <div className="space-y-3">
      {respostasInicio != null && (
        <p className="text-sm text-muted-foreground">
          “{bem}”{" "}
          <strong className="font-semibold tabular-nums text-foreground">
            {inicioBem ?? "—"} → {totalBem}
          </strong>{" "}
          de {COMPETENCIAS_MENTOR.length} competências
        </p>
      )}
      <ul className="space-y-1.5">
        {linhas.map((l, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="min-w-0 flex-1 leading-snug">{l.texto}</span>
            {respostasInicio != null ? (
              <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                <span>{l.inicio || "—"}</span>
                <span className="mx-1" aria-hidden>
                  →
                </span>
                <span
                  className={cn(
                    "font-medium",
                    l.atual === bem ? "text-[var(--ok-text)]" : "text-foreground"
                  )}
                >
                  {l.atual || "—"}
                </span>
              </span>
            ) : (
              <span
                className={cn(
                  "shrink-0 text-xs font-medium tabular-nums",
                  l.atual === bem
                    ? "text-[var(--ok-text)]"
                    : l.atual === dev
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {l.atual || "—"}
              </span>
            )}
          </li>
        ))}
      </ul>
      {/* campo livre do instrumento ("o que quero desenvolver") — a frase
          de intenção que o mentor escreveu; some quando não respondeu */}
      {(() => {
        const campoDev = campos.find((c) => c.id === "desenvolver");
        const textoDev = campoDev
          ? respostaFormatada(campoDev, respostas[campoDev.id])
          : "";
        const textoDevInicio =
          campoDev && respostasInicio
            ? respostaFormatada(campoDev, respostasInicio[campoDev.id])
            : "";
        if (!textoDev && !textoDevInicio) return null;
        return (
          <div className="border-t border-border/60 pt-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {campoDev?.label ?? "O que quer desenvolver"}
            </p>
            {textoDevInicio && textoDev !== textoDevInicio && (
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {textoDevInicio}
              </p>
            )}
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
              {textoDev || textoDevInicio}
            </p>
          </div>
        );
      })()}
    </div>
  );
}

/** Vista estruturada de uma resposta de instrumento oficial. Devolve null
 *  quando o sistema não é instrumento de dupla (0080) ou o payload não tem
 *  o que extrair — o chamador cai na lista crua campo a campo. */
export function InstrumentoResultado({
  sistema,
  campos,
  respostas,
  respostasAnterior = null,
}: {
  sistema: FormularioSistema | null | undefined;
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
  /** earlier-moment payload of the same instrument (initial roda / início
   *  checklist) — turns the view into the before/after comparison */
  respostasAnterior?: Record<string, RespostaValor> | null;
}) {
  const conteudo = (() => {
    switch (sistema) {
      case "roda_vida":
        return (
          <RodaResultado
            campos={campos}
            respostas={respostas}
            respostasAnterior={respostasAnterior}
          />
        );
      case "metas":
      case "pdm":
        return (
          <MetasResultado
            campos={campos}
            respostas={respostas}
            sistema={sistema}
          />
        );
      case "visao":
        return <VisaoResultado campos={campos} respostas={respostas} />;
      case "competencias_mentor":
        return (
          <CompetenciasResultado
            campos={campos}
            respostas={respostas}
            respostasInicio={respostasAnterior}
          />
        );
      default:
        return null;
    }
  })();
  if (!conteudo) return null;
  // @container: os breakpoints do desenho medem o espaço real (ficha da
  // dupla, dialog de respostas), não a viewport (REALIZA-248)
  return <div className="@container">{conteudo}</div>;
}
