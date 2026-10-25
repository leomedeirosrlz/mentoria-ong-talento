// Identidade visual da turma (REALIZA-200 · mock v1a "banner de perfil"):
// port do PessoaBanner pra turma — campo ink, tinta própria, sigla fantasma
// gigante, emblema-dial com N traços e linha de dados mono. O card junta o
// banner ao bloco funcional "semana do encontro N" e à faixa de stats; a
// página de detalhe reusa o mesmo banner como capa do perfil.
//
// Tinta por turma: T1 = lima e T2 = âmbar (a gramática aprovada no mock);
// de T3 em diante alterna uma paleta extra, e texto livre fora do padrão
// ("E2E Turma de teste") distribui por hash do label — nunca recicla o par
// lima/âmbar pra não fingir ser T1/T2. A cor NÃO vaza pros pills/chips de
// outras telas: identidade vive aqui, o PillTurma neutro segue valendo.
//
// A exibição deriva de `turma`/`nome` via @/lib/turma — o valor cru segue
// sendo a chave de igualdade (duplas.turma, filtros, snapshots).

import Link from "next/link";
import { Clock } from "@phosphor-icons/react/dist/ssr";
import { hashSeed, rand } from "@/lib/banner";
import { dowCurto } from "@/components/agenda-partes";
import {
  eventoDaSemana,
  formatDiaMes,
  formatMesAbrev,
  toDateStr,
  type EventoDatado,
} from "@/lib/ciclo";
import { turmaAno, turmaCurta, turmaLonga, turmaNumero } from "@/lib/turma";
import type { VinculoCronograma } from "@/lib/queries-cronogramas";
import type { CicloEvento, Cronograma, EncontroStatus } from "@/lib/types";
import { StatusBadge } from "@/components/cronograma-editor";
import { cn } from "@/lib/utils";

// ---------- tinta por turma ----------

type Tinta = {
  /** cor da marca — relevo, sigla fantasma, emblema, ícone e faixa-base */
  tt: string;
  /** versão escura pra texto/detalhe sobre o soft */
  ink: string;
  /** fundo tintado (bloco funcional, chip da sigla) */
  soft: string;
  /** borda do tint */
  border: string;
};

const TINTA_1: Tinta = {
  tt: "var(--brand-lime)",
  ink: "hsl(78 60% 17%)",
  soft: "hsl(78 56% 93%)",
  border: "hsl(78 45% 78%)",
};
const TINTA_2: Tinta = {
  tt: "var(--role-mentorado)",
  ink: "hsl(43 85% 20%)",
  soft: "hsl(48 90% 93%)",
  border: "hsl(46 75% 74%)",
};
/** T3+ / fora do padrão — matizes já tokenizados no app, fora do par T1/T2
 *  (azul do eixo info, violeta e teal da série chart). */
const TINTAS_EXTRA: Tinta[] = [
  {
    tt: "hsl(207 82% 45%)",
    ink: "hsl(207 82% 26%)",
    soft: "hsl(207 82% 94%)",
    border: "hsl(207 62% 80%)",
  },
  {
    tt: "hsl(262 45% 48%)",
    ink: "hsl(262 45% 27%)",
    soft: "hsl(262 60% 94%)",
    border: "hsl(262 40% 82%)",
  },
  {
    tt: "hsl(174 62% 32%)",
    ink: "hsl(174 62% 18%)",
    soft: "hsl(174 55% 92%)",
    border: "hsl(174 40% 78%)",
  },
];

/** Tinta da turma — determinística pelo label: T1 lima / T2 âmbar fixos;
 *  T3+ numeração segue alternando a paleta extra; fora do padrão distribui
 *  por hash do texto (estável, nunca chuta lima/âmbar). O número passa por
 *  parse antes do match — "T01"/"t1" resolvem pra T1, não pra cor solta. */
export function tintaTurma(turma: string | null | undefined): Tinta {
  const n = turmaNumero(turma);
  const num = /^\d+$/.test(n) ? Number(n) : null;
  if (num === 1) return TINTA_1;
  if (num === 2) return TINTA_2;
  const i = num != null ? num - 3 : hashSeed(turma ?? "");
  const len = TINTAS_EXTRA.length;
  return TINTAS_EXTRA[((i % len) + len) % len];
}

/** Nº de traços do emblema-dial — o número da turma (T2 → 2 traços), teto
 *  de 6 pra não virar ruído; fora do padrão → 0 (o selo fica anel + ponto). */
function tracosDial(turma: string): number {
  const n = turmaNumero(turma);
  return /^\d+$/.test(n) ? Math.min(Number(n), 6) : 0;
}

const DOW_PLURAL = [
  "Domingos",
  "Segundas",
  "Terças",
  "Quartas",
  "Quintas",
  "Sextas",
  "Sábados",
];

/** Linha de dados mono do banner — o ano sai do título e fica aqui,
 *  pequeno ("CICLO 2026/2027 · TERÇAS · SEMANA DO ENC. 5/16"). O dia da
 *  semana é o modal das datas oficiais (o "às terças" do mock — ainda não
 *  há campo de dia/hora no cronograma, então deriva; turma com datas
 *  espalhadas não ganha o trecho). */
export function linhaDadosTurma(
  c: Cronograma,
  eventos: CicloEvento[],
  hoje: Date
): string {
  const ano = turmaAno(c.turma);
  const total = eventos.filter(
    (e) => e.tipo === "encontro" && e.numero != null
  ).length;
  const vig = eventoDaSemana(eventos, hoje);
  const porDow = new Map<number, number>();
  for (const e of eventos) {
    if (e.tipo === "encontro" && e.data) {
      const g = new Date(`${e.data}T12:00:00`).getDay();
      porDow.set(g, (porDow.get(g) ?? 0) + 1);
    }
  }
  const modal = [...porDow.entries()].sort((a, b) => b[1] - a[1])[0];
  return [
    ano ? `Ciclo ${ano}` : c.turma || "Cronograma",
    c.nome,
    modal && modal[1] >= 2 ? DOW_PLURAL[modal[0]] : null,
    c.status === "rascunho"
      ? "Em preparação"
      : c.status === "encerrado"
        ? "Encerrado"
        : vig?.numero != null
          ? `Semana do enc. ${vig.numero}/${total}`
          : `${total} encontros`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "ter 7/out" — com hoje/amanhã quando a data é a da semana corrente. */
function quandoEncontro(data: string, hojeStr: string): string {
  const d = `${dowCurto(data)} ${Number(data.slice(8, 10))}/${formatMesAbrev(data)}`;
  const amanha = toDateStr(
    new Date(Date.parse(`${hojeStr}T12:00:00Z`) + 86400000)
  );
  return data === hojeStr
    ? `hoje, ${d}`
    : data === amanha
      ? `amanhã, ${d}`
      : d;
}

/** Chip da sigla na cor da turma — só aparece quando a sigla difere do nome
 *  ("T1" junto de "Turma 1"); fora do padrão seria eco do próprio nome. */
export function SiglaTurma({
  turma,
  className,
}: {
  turma: string;
  className?: string;
}) {
  const sigla = turmaCurta(turma);
  if (!sigla || sigla === turmaLonga(turma)) return null;
  const tinta = tintaTurma(turma);
  return (
    <span
      // decorativo ao lado do nome — sem aria-hidden o nome acessível do
      // heading virava "Turma 1 T1" (sigla duplicada)
      aria-hidden
      className={cn(
        "rounded-md border px-1.5 py-0.5 align-[2px] text-xs font-extrabold",
        className
      )}
      style={{
        color: tinta.ink,
        background: tinta.soft,
        borderColor: tinta.border,
      }}
    >
      {sigla}
    </span>
  );
}

/** Emblema-dial do canto — anel + N traços de índice perto do topo + ponto
 *  cheio (o "relógio da turma" do mock; T1 = um traço, T2 = dois). */
function EmblemaDial({ turma, tinta }: { turma: string; tinta: Tinta }) {
  const n = tracosDial(turma);
  const passo = n > 1 ? Math.min(46, 220 / n) : 0;
  const tracos = Array.from({ length: n }, (_, i) => {
    const a = ((i - (n - 1) / 2) * passo * Math.PI) / 180;
    return {
      x1: 26 + 9 * Math.sin(a),
      y1: 26 - 9 * Math.cos(a),
      x2: 26 + 15 * Math.sin(a),
      y2: 26 - 15 * Math.cos(a),
    };
  });
  return (
    <svg
      aria-hidden
      width={52}
      height={52}
      viewBox="0 0 52 52"
      className="absolute right-3.5 top-2"
    >
      <circle
        cx={26}
        cy={26}
        r={22}
        fill="none"
        stroke={tinta.tt}
        strokeWidth={2.5}
      />
      {tracos.map((t, i) => (
        <line
          key={i}
          {...t}
          stroke={tinta.tt}
          strokeWidth={3.5}
          strokeLinecap="round"
        />
      ))}
      <circle cx={26} cy={26} r={4} fill={tinta.tt} />
    </svg>
  );
}

/** Banner de perfil da turma — campo ink + relevo de arcos seedado pelo id
 *  do cronograma (a "impressão" dela), sigla fantasma sangrando na base,
 *  emblema-dial no canto e linha de dados mono. Decorativo: nome, ano e
 *  status aparecem como texto real no corpo. */
export function TurmaBanner({
  cronograma: c,
  dados,
  className,
}: {
  cronograma: Cronograma;
  /** linha de dados mono (linhaDadosTurma) */
  dados: string;
  className?: string;
}) {
  const tinta = tintaTurma(c.turma);
  const r = rand(hashSeed(c.id));

  // relevo — dois agrupamentos de arcos (o mock fixa um embaixo-esquerda e
  // um menor sangrando no topo); o sorteio move os centros sem virar alvo
  const c1x = 110 + r() * 150;
  const c1y = 128 + r() * 60;
  const a1: number[] = [];
  let raio = 30 + r() * 24;
  for (let i = 0, n = 5 + Math.floor(r() * 3); i < n; i++) {
    a1.push(raio);
    raio += 26 + r() * 26;
  }
  const c2x = 430 + r() * 160;
  const c2y = -46 + r() * 30;
  const a2: number[] = [];
  let raio2 = 36 + r() * 22;
  for (let i = 0, n = 3 + Math.floor(r() * 2); i < n; i++) {
    a2.push(raio2);
    raio2 += 30 + r() * 24;
  }

  // sigla fantasma — gigante a 16%, baseline sangrando na borda inferior;
  // encolhe conforme o comprimento (mesma régua do nome fantasma da pessoa)
  const ghost = turmaCurta(c.turma).toUpperCase();
  const ghostSize = ghost
    ? Math.max(48, Math.min(150, Math.round(860 / (ghost.length * 0.62))))
    : 0;

  return (
    <div
      aria-hidden
      className={cn("relative h-[118px] w-full sm:h-[132px]", className)}
    >
      <svg
        viewBox="0 0 800 150"
        preserveAspectRatio="xMidYMid slice"
        className="block h-full w-full"
      >
        <rect width={800} height={150} fill="var(--brand-ink)" />
        <g fill="none" stroke={tinta.tt} strokeOpacity={0.13}>
          {a1.map((rr) => (
            <circle key={rr} cx={c1x} cy={c1y} r={rr} />
          ))}
        </g>
        <g fill="none" stroke={tinta.tt} strokeOpacity={0.09}>
          {a2.map((rr) => (
            <circle key={rr} cx={c2x} cy={c2y} r={rr} />
          ))}
        </g>
        {ghost && (
          <text
            x={400}
            y={140}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontWeight={800}
            fontSize={ghostSize}
            letterSpacing="-0.05em"
            fill={tinta.tt}
            fillOpacity={0.16}
          >
            {ghost}
          </text>
        )}
      </svg>
      {dados && (
        <p className="absolute left-4 top-2.5 max-w-[calc(100%-5.5rem)] truncate font-mono text-xs sm:text-[10.5px] uppercase tracking-[0.12em] text-white/80">
          {dados}
        </p>
      )}
      <EmblemaDial turma={c.turma} tinta={tinta} />
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[3px]"
        style={{ background: tinta.tt }}
      />
    </div>
  );
}

/** Encontros que contam como "semana coberta" no bloco funcional — a dupla
 *  tem a semana coberta quando o nº vigente tem row marcada ou já
 *  realizada; nao_aconteceu/cancelado deixam a semana descoberta.
 *  Divergência intencional do "agendadas" do resumo da coordenação
 *  (agenda-coordenacao.ts), que conta só agendado/remarcado e reporta
 *  `realizaram` em balde próprio: aqui a métrica é cobertura da semana —
 *  quem já realizou também está coberto. */
const AGENDADO_OK: ReadonlySet<EncontroStatus> = new Set([
  "agendado",
  "remarcado",
  "realizado",
]);

/** Card da turma em /turmas (v1a) — o Link inteiro abre o cronograma; a
 *  gramática visual é a do PessoaBanner. `eventos`/`vinculos` já chegam
 *  recortados pro cronograma (a página filtra antes). */
export function TurmaCard({
  cronograma: c,
  eventos,
  vinculos,
  hoje,
}: {
  cronograma: Cronograma;
  /** eventosDoCronograma(eventos, c.id) — já recortado */
  eventos: CicloEvento[];
  /** vínculos das duplas que seguem este cronograma */
  vinculos: VinculoCronograma[];
  hoje: Date;
}) {
  const tinta = tintaTurma(c.turma);
  const hojeStr = toDateStr(hoje);
  const nome = turmaLonga(c.turma);
  const ano = turmaAno(c.turma);

  const encontrosEv = eventos.filter(
    (e) => e.tipo === "encontro" && e.numero != null
  );
  const total = encontrosEv.length;
  const vig: EventoDatado | null = eventoDaSemana(eventos, hoje);

  const ativas = vinculos.filter((v) => v.status === "ativa").length;
  const foraDaConta = vinculos.length - ativas;
  // headcount de pessoas (a faixa do mock: duplas | mentores | jovens) —
  // dedup por nome resolve "Renata com 2 duplas" sem custo de query
  const porMentor = new Map<string, number>();
  const jovensN = new Set(
    vinculos.map((v) => v.mentoradoNome).filter((n) => n && n !== "—")
  ).size;
  // "em andamento" conta JOVENS distintos entre as duplas ativas — contar
  // vínculo inflava quem tinha 2 duplas vivas no mesmo cronograma
  const jovensAtivos = new Set(
    vinculos
      .filter((v) => v.status === "ativa")
      .map((v) => v.mentoradoNome)
      .filter((n) => n && n !== "—")
  ).size;
  for (const v of vinculos) {
    if (v.mentorNome && v.mentorNome !== "—")
      porMentor.set(v.mentorNome, (porMentor.get(v.mentorNome) ?? 0) + 1);
  }
  const mentoresN = porMentor.size;
  const multiMentor = [...porMentor.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])[0];
  const cobertas =
    vig?.numero != null
      ? vinculos.filter(
          (v) =>
            v.status === "ativa" &&
            v.encontros.some(
              (e) => e.numero === vig.numero && AGENDADO_OK.has(e.status)
            )
        ).length
      : null;
  // próximo evento oficial fora do eixo encontro-a-encontro (formação,
  // encerramento, recesso) — o MAIS PRÓXIMO NO TEMPO, não o primeiro na
  // `ordem` do PDF: um evento anexado no fim da sequência (a roda de casos
  // continuada da demo) pode vencer antes de um recesso que vem antes na
  // ordem. É a nota de rodapé do bloco funcional.
  const proxEvento = eventos
    .filter(
      (e): e is EventoDatado =>
        e.tipo !== "encontro" && e.data != null && e.data >= hojeStr
    )
    .sort((a, b) => a.data.localeCompare(b.data))[0];

  return (
    <Link
      href={`/turmas/${c.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] transition-[background-color,box-shadow,translate] ease-snappy hover:-translate-y-px hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <TurmaBanner cronograma={c} dados={linhaDadosTurma(c, eventos, hoje)} />

      <div className="flex flex-1 flex-col gap-2.5 px-4 py-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-lg font-bold tracking-tight">
            {nome}
            <SiglaTurma turma={c.turma} className="ml-1.5" />
          </h2>
          <StatusBadge status={c.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {ano && (
            <>
              Ciclo <b className="font-semibold text-foreground">{ano}</b>
              {" · "}
            </>
          )}
          {c.inicio_em
            ? `${formatDiaMes(c.inicio_em)} → ${formatDiaMes(c.fim_em)}`
            : "sem datas definidas"}
        </p>

        {/* semana do encontro N — bloco funcional tintado na cor da turma;
            só corre com cronograma ativo (rascunho não tem semana e
            encerrado já fechou a régua) */}
        {c.status === "ativo" && vig?.numero != null && (
          <div
            className="flex items-start gap-2.5 rounded-[10px] border p-2.5"
            style={{ background: tinta.soft, borderColor: tinta.border }}
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-lg"
              style={{ background: tinta.tt, color: tinta.ink }}
            >
              <Clock size={16} />
            </span>
            <div className="min-w-0 flex-1 text-[13px] leading-snug">
              <b className="block font-semibold">
                Semana do encontro {vig.numero} ·{" "}
                {quandoEncontro(vig.data, hojeStr)}
              </b>
              {cobertas != null && (
                <span className="mt-0.5 block text-muted-foreground">
                  {cobertas} de {ativas}{" "}
                  {ativas === 1 ? "dupla" : "duplas"} com a semana coberta
                </span>
              )}
              {proxEvento && (
                <small className="mt-0.5 block text-muted-foreground/80">
                  {proxEvento.titulo} ·{" "}
                  {quandoEncontro(proxEvento.data, hojeStr)} (evento
                  oficial)
                </small>
              )}
            </div>
            <div className="shrink-0 text-right">
              <b
                className="text-base font-bold tabular-nums"
                style={{ color: tinta.ink }}
              >
                {vig.numero}
                <span className="text-[11px] font-semibold text-muted-foreground">
                  /{total}
                </span>
              </b>
              <small className="block text-xs sm:text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                encontros
              </small>
              <span
                aria-hidden
                className="mt-1 block h-[5px] w-[74px] overflow-hidden rounded-full border"
                style={{
                  borderColor: tinta.border,
                  background: "hsl(0 0% 100% / 0.9)",
                }}
              >
                <i
                  className="block h-full rounded-full"
                  style={{
                    width: `${total > 0 ? Math.min((vig.numero / total) * 100, 100) : 0}%`,
                    background: tinta.ink,
                  }}
                />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* stats em faixa — edge-to-edge com divisão vertical (o trio do
          mock: duplas | mentores | jovens; mentores/jovens dedup por nome
          pra ler headcount, não par) */}
      <div
        role="group"
        aria-label={`Números da ${nome}`}
        className="grid grid-cols-3 border-t border-border bg-muted/50"
      >
        <div className="px-3.5 py-2.5">
          <b className="block text-lg font-bold leading-tight tabular-nums">
            {vinculos.length}
          </b>
          <span className="block text-xs sm:text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            {vinculos.length === 1 ? "dupla" : "duplas"}
          </span>
          <small className="block text-xs sm:text-[10.5px] text-muted-foreground">
            {vinculos.length === 0
              ? "nenhuma ainda"
              : foraDaConta > 0
                ? `${foraDaConta} fora da conta`
                : "todas no ciclo"}
          </small>
        </div>
        <div className="border-l border-border px-3.5 py-2.5">
          <b className="block text-lg font-bold leading-tight tabular-nums">
            {mentoresN}
          </b>
          <span className="block text-xs sm:text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            {mentoresN === 1 ? "mentor" : "mentores"}
          </span>
          <small className="block text-xs sm:text-[10.5px] text-muted-foreground">
            {multiMentor
              ? `${multiMentor[0].split(" ")[0]} com ${multiMentor[1]} duplas`
              : mentoresN > 0
                ? "1 dupla por mentor"
                : "nenhum ainda"}
          </small>
        </div>
        <div className="border-l border-border px-3.5 py-2.5">
          <b className="block text-lg font-bold leading-tight tabular-nums">
            {jovensN}
          </b>
          <span className="block text-xs sm:text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            {jovensN === 1 ? "jovem" : "jovens"}
          </span>
          <small className="block text-xs sm:text-[10.5px] text-muted-foreground">
            {jovensAtivos > 0
              ? `${jovensAtivos} em andamento`
              : "nenhum no ciclo"}
          </small>
        </div>
      </div>
    </Link>
  );
}
