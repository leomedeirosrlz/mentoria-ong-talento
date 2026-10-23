import {
  extraiMetas,
  extraiRodaDaVida,
  respostaFormatada,
  type FormularioCampo,
  type FormularioSistema,
  type RespostaValor,
} from "@/lib/forms/schema";
import { parseSubmetasLinhas } from "@/lib/pdm";
import { cn } from "@/lib/utils";
import { RodaSvg } from "./instrumentos/roda-svg";

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
      {/* ≥lg: a roda veste a coroa de nomes de área (variante A —
          REALIZA-143) e empilha com a lista; abaixo disso fica a
          moldura compacta de sempre lado a lado com as notas */}
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center lg:grid-cols-1">
        <div className="text-center">
          <RodaSvg
            roda={roda}
            className="max-w-[280px] sm:max-w-[300px] lg:hidden"
          />
          <RodaSvg
            roda={roda}
            rotuloEixos
            className="hidden lg:block lg:max-w-[460px]"
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
            do polígono pra quem precisa do número exato */}
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-4 lg:space-y-0 lg:self-start">
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

  // desdobramento por meta — Metas (0118) e PDM: cada submetas_N respondido
  // vira uma lista lida pelo mesmo parser que projeta pdm_itens
  const desdobramentos = campos
    .map((c) => ({
      n: /^submetas_(\d+)$/.exec(c.id)?.[1],
      valor: respostas[c.id],
    }))
    .filter(
      (x): x is { n: string; valor: RespostaValor } =>
        x.n != null && typeof x.valor === "string" && x.valor.trim() !== ""
    )
    .map((x) => ({
      n: Number(x.n),
      linhas: parseSubmetasLinhas(String(x.valor)),
    }))
    .filter((x) => x.linhas.length > 0)
    .sort((a, b) => a.n - b.n);

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

      {desdobramentos.map((d) => (
        <Bloco key={d.n} titulo={`Desdobramento da meta ${d.n}`}>
          <ol className="space-y-1">
            {d.linhas.map((l, i) => (
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
