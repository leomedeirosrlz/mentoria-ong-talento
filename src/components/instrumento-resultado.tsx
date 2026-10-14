import {
  extraiMetas,
  extraiRodaDaVida,
  respostaFormatada,
  type FormularioCampo,
  type FormularioSistema,
  type RespostaValor,
  type RodaDaVida,
} from "@/lib/forms/schema";
import { cn } from "@/lib/utils";

// Leitura estruturada das respostas dos instrumentos oficiais (0080) —
// o form genérico guarda {campo_id: valor}; aqui o resultado vira o que o
// instrumento é de verdade: a roda desenhada, a lista de metas com IS e
// prazo, a declaração de visão. Usado na aba Respostas do /formularios/[id]
// e na seção Instrumentos da ficha da dupla. Server component puro — sem
// estado nem efeito.

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
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {titulo}
      </h4>
      {children}
    </section>
  );
}

/** A declaração é o norte do instrumento — blockquote hero, sempre no topo. */
function Declaracao({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <blockquote className="rounded-xl border-l-2 border-[var(--brand-lime)] bg-[var(--brand-lime)]/5 px-4 py-3">
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

const CX = 160;
const CY = 160;
const RAIO = 118;

/** Ponto do eixo i na fração 0–1 do raio — eixo 0 aponta pra cima. */
function pontoEixo(i: number, total: number, fracao: number) {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / total;
  return {
    x: CX + RAIO * fracao * Math.cos(ang),
    y: CY + RAIO * fracao * Math.sin(ang),
  };
}

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

/** Polígono SVG da roda: anéis de 2 em 2, um eixo por área e o traço das
 *  notas. Os quadrantes ganham o rótulo no meio do próprio arco. */
function RodaSvg({ roda }: { roda: RodaDaVida }) {
  const areas = roda.quadrantes.flatMap((q) => q.areas);
  const total = areas.length;
  if (!total) return null;
  const aneis = [2, 4, 6, 8, 10].map((nivel) =>
    areas
      .map((_, i) => {
        const p = pontoEixo(i, total, nivel / 10);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ")
  );
  const dados = areas
    .map((a, i) => {
      const p = pontoEixo(i, total, (a.nota ?? 0) / 10);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  // nome do quadrante no meio do arco dele (média dos índices das áreas)
  const comNome = roda.quadrantes.filter((q) => q.nome);
  const rotulosQuad = comNome
    .map((q) => {
      const ini = comNome
        .slice(0, comNome.indexOf(q))
        .reduce((acc, x) => acc + x.areas.length, 0);
      const meio = ini + (q.areas.length - 1) / 2;
      const ang = -Math.PI / 2 + (meio * 2 * Math.PI) / total;
      const x = CX + (RAIO + 14) * Math.cos(ang);
      const y = CY + (RAIO + 14) * Math.sin(ang);
      return { nome: q.nome, x, y };
    });

  return (
    <svg
      viewBox="0 0 320 320"
      role="img"
      aria-label={`Roda da Vida — média ${roda.media?.toLocaleString("pt-BR") ?? "sem notas"} em ${total} áreas`}
      className="mx-auto w-full max-w-[280px] shrink-0 sm:max-w-[300px]"
    >
      {aneis.map((pontos, i) => (
        <polygon
          key={i}
          points={pontos}
          fill="none"
          className="stroke-border"
          strokeWidth={i === aneis.length - 1 ? 1.4 : 0.7}
        />
      ))}
      {areas.map((a, i) => {
        const p = pontoEixo(i, total, 1);
        return (
          <line
            key={a.id}
            x1={CX}
            y1={CY}
            x2={p.x}
            y2={p.y}
            className="stroke-border"
            strokeWidth={0.7}
          />
        );
      })}
      <polygon
        points={dados}
        className="fill-[var(--brand-lime)]/25 stroke-[var(--ok-text)]"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {areas.map((a, i) => {
        const p = pontoEixo(i, total, (a.nota ?? 0) / 10);
        return (
          <circle key={a.id} cx={p.x} cy={p.y} r={3} className="fill-[var(--ok-text)]" />
        );
      })}
      {rotulosQuad.map((q) => (
        <text
          key={q.nome}
          x={q.x}
          y={q.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted-foreground text-[10px] font-medium"
        >
          {q.nome}
        </text>
      ))}
    </svg>
  );
}

function RodaResultado({
  campos,
  respostas,
}: {
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
}) {
  const roda = extraiRodaDaVida(campos, respostas);
  if (!roda) return null;
  const reflexao = valorDe(campos, respostas, "reflexao");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="text-center">
          <RodaSvg roda={roda} />
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
            do polígono pra quem precisa do número exato */}
        <div className="space-y-3">
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
                    <span className="min-w-0 flex-1 truncate" title={a.label}>
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
              className="rounded-lg border border-border/70 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
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
              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {m.porque && (
                  <p className="leading-relaxed">
                    <span className="text-xs font-medium">Por quê: </span>
                    {m.porque}
                  </p>
                )}
                {m.indicador && (
                  <p>
                    <span className="text-xs font-medium">Indicador: </span>
                    {m.indicador}
                  </p>
                )}
              </div>
              {m.prazo && (
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  Prazo: {dataBr(m.prazo)}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Bloco>

      {sistema === "pdm" &&
        [1, 2, 3].map((n) => {
          const v = valorDe(campos, respostas, `submetas_${n}`);
          if (!v) return null;
          return (
            <Bloco key={n} titulo={`Desdobramento da meta ${n}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{v}</p>
            </Bloco>
          );
        })}

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
                <span className="min-w-0 flex-1 text-muted-foreground">
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
  const narrativa = (
    [
      "filme",
      "aspectos",
      "ser_fazer",
      "deixou",
      "valoriza",
    ] as const
  )
    .map((id) => {
      const campo = campos.find((c) => c.id === id);
      const valor = valorDe(campos, respostas, id);
      return campo && valor ? { label: campo.label, valor } : null;
    })
    .filter((x): x is { label: string; valor: string } => x != null);

  return (
    <div className="space-y-4">
      <Declaracao texto={declaracao} />
      {narrativa.length > 0 && (
        <Bloco titulo="O filme da vida ideal">
          <dl className="space-y-3">
            {narrativa.map((n) => (
              <div key={n.label}>
                <dt className="text-xs font-medium text-muted-foreground">
                  {n.label}
                </dt>
                <dd className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {n.valor}
                </dd>
              </div>
            ))}
          </dl>
        </Bloco>
      )}
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
}: {
  sistema: FormularioSistema | null | undefined;
  campos: FormularioCampo[];
  respostas: Record<string, RespostaValor>;
}) {
  switch (sistema) {
    case "roda_vida":
      return <RodaResultado campos={campos} respostas={respostas} />;
    case "metas":
    case "pdm":
      return (
        <MetasResultado campos={campos} respostas={respostas} sistema={sistema} />
      );
    case "visao":
      return <VisaoResultado campos={campos} respostas={respostas} />;
    default:
      return null;
  }
}
