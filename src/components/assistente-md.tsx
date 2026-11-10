"use client";

// Markdown-lite da resposta do assistente (saiu da conversa no v3): bold,
// listas (com um nível de sub-item), citação agrupada, separador ---,
// links, código, tabela pipe e as linhas-marca da genUI — blocos por
// linha, inline por regex. O modelo só emite esse subconjunto (system
// prompt). A análise (extrairBlocos) roda uma vez por render da bolha em
// `analisarResposta`; o MdLite só desenha.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ehTabelaMd,
  extrairBlocos,
  HR_LINHA,
  MARCA_BLOCO,
  MARCA_PENDENTE,
  parseTabelaMd,
  segurarParcial,
  type BlocoKind,
  type BlocoMd,
  type Stat,
  type StatTom,
  type TabelaMd,
} from "@/lib/ia/render";
import { BlocoSkeleton, BlocoView } from "@/components/assistente-blocos";
import { CodeBlock } from "@/components/assistente-genui";
import { cn, pathInterno } from "@/lib/utils";

export type Analise = ReturnType<typeof extrairBlocos>;

/** Uma passada por resposta: no stream segura a linha parcial (tabela sem
 *  separador, fence sendo digitado) e troca fence aberto por skeleton. */
export function analisarResposta(texto: string, streaming: boolean): Analise {
  return extrairBlocos(streaming ? segurarParcial(texto) : texto, {
    streaming,
  });
}

/** Resposta "rica" sai da bolha e ocupa a largura (prosa de documento);
 *  conversa curta de texto fica no balão. Decide pelo conteúdo, não por
 *  preferência: gráfico, card, tabela ou código precisam de largura. */
export function ehRica(a: Analise, temUi: boolean): boolean {
  if (temUi || a.stats.length || a.blocos.length) return true;
  const t = a.textoSemBloco;
  return (
    t.length > 320 ||
    t.includes("\u0000pendente:") ||
    /^\s*```/m.test(t) ||
    /^\s*\|.*\|\s*$/m.test(t)
  );
}

// itálico em CommonMark simplificado: o conteúdo não começa nem termina
// com espaço e o * de abertura não cola em caractere de palavra — sem a
// régua, "2 * 3 = 6 e 4 * 5" virava <em> no meio da conta
const INLINE = /(\*\*[^\s*](?:[^*\n]*[^\s*])?\*\*|(?<!\w)\*[^\s*](?:[^*\n]*[^\s*])?\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/** Texto fatiado em ~6 chars com fade por fatia (stream): o conteúdo
 *  só cresce no fim, então spans anteriores não re-animam e as novas
 *  entram suave — a velocidade de exibição continua a da rede (sem
 *  throttle de TPS), só a aparição é amortecida. */
function Tokens({ texto }: { texto: string }) {
  // fatias de ~6 code points — for..of itera code point (não unidade
  // UTF-16), então um emoji nunca é partido em dois spans (surrogate
  // solto renderizaria "�")
  const pedacos: string[] = [];
  let cur = "";
  let n = 0;
  for (const ch of texto) {
    cur += ch;
    if (++n === 6) {
      pedacos.push(cur);
      cur = "";
      n = 0;
    }
  }
  if (cur) pedacos.push(cur);
  return (
    <>
      {pedacos.map((p, i) => (
        <span key={i} className="ia-tok">
          {p}
        </span>
      ))}
    </>
  );
}

const LINK_CLS =
  "underline underline-offset-2 decoration-muted-foreground/50 hover:decoration-foreground";

export function Inline({ texto, animar }: { texto: string; animar?: boolean }) {
  return (
    <>
      {texto.split(INLINE).map((parte, i) => {
        // split com grupo de captura: índice ímpar = trecho que casou o
        // INLINE; par = texto solto ("* fora *" não pode virar <em>)
        const casou = i % 2 === 1;
        if (casou && parte.startsWith("**") && parte.endsWith("**"))
          return (
            <strong key={i}>
              {animar ? <Tokens texto={parte.slice(2, -2)} /> : parte.slice(2, -2)}
            </strong>
          );
        if (
          casou &&
          parte.length > 2 &&
          parte.startsWith("*") &&
          parte.endsWith("*") &&
          !parte.startsWith("**")
        )
          return (
            <em key={i}>
              {animar ? <Tokens texto={parte.slice(1, -1)} /> : parte.slice(1, -1)}
            </em>
          );
        if (parte.startsWith("`") && parte.endsWith("`"))
          return (
            <code
              key={i}
              className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono"
            >
              {animar ? <Tokens texto={parte.slice(1, -1)} /> : parte.slice(1, -1)}
            </code>
          );
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(parte);
        if (link) {
          const [, rotulo, href] = link;
          // link seguro: http(s) ou interno — javascript:/data: viram texto
          // interno vai por next/link: navegação SPA mantém o fetch do
          // stream vivo; <a> puro dava full nav e matava a resposta
          // (REALIZA-332)
          if (pathInterno(href))
            return (
              <Link key={i} href={href} className={LINK_CLS}>
                {animar ? <Tokens texto={rotulo} /> : rotulo}
              </Link>
            );
          if (/^https?:/.test(href))
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLS}
              >
                {animar ? <Tokens texto={rotulo} /> : rotulo}
              </a>
            );
        }
        return animar ? <Tokens key={i} texto={parte} /> : parte;
      })}
    </>
  );
}

// célula de tabela que é situação de dupla vira pill (mesma cor da
// DuplaLinha) — "em dia" segue neutra, a cor marca só o que pede ação
const PILL_SITUACAO: Record<string, { cls: string; rotulo: string }> = {
  risco: { cls: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]", rotulo: "Risco" },
  "em risco": { cls: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]", rotulo: "Em risco" },
  atenção: { cls: "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-text)]", rotulo: "Atenção" },
  atencao: { cls: "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-text)]", rotulo: "Atenção" },
  apoio: { cls: "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info-text)]", rotulo: "Apoio" },
  pausada: { cls: "border-border bg-muted text-muted-foreground", rotulo: "Pausada" },
};

function Celula({ texto }: { texto: string }) {
  const pill = PILL_SITUACAO[texto.replace(/\*/g, "").trim().toLowerCase()];
  if (pill)
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none",
          pill.cls
        )}
      >
        {pill.rotulo}
      </span>
    );
  return <Inline texto={texto} />;
}

const ALINHA = { esq: "text-left", dir: "text-right", centro: "text-center" };

/** Tabela pipe → <table> de verdade (REALIZA-281): coluna numérica alinha
 *  à direita em tabular-nums (o alinhamento GFM explícito manda quando
 *  vier), situação vira pill; rolagem horizontal no estreito. */
function Tabela({ t }: { t: TabelaMd }) {
  const alinha = (j: number) =>
    ALINHA[
      t.alinhamento[j] !== "esq" ? t.alinhamento[j] : t.numerica[j] ? "dir" : "esq"
    ];
  return (
    <div
      role="region"
      aria-label="Tabela. Role horizontalmente"
      tabIndex={0}
      className="scroll-fina animate-enter overflow-x-auto rounded-lg border border-border/70 bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table className="w-full text-[0.9em]">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {t.cab.map((c, j) => (
              <th
                key={j}
                className={cn("whitespace-nowrap px-3 py-2 font-semibold", alinha(j))}
              >
                <Inline texto={c} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {t.linhas.map((l, i) => (
            <tr key={i} className="transition-colors hover:bg-muted/40">
              {l.map((c, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-3 py-2 align-top",
                    alinha(j),
                    t.numerica[j] && "tabular-nums"
                  )}
                >
                  <Celula texto={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cartões do bloco ```stats (REALIZA-281): fileira compacta de
 *  indicadores com o tom semântico do dado — mesmo mapa da situação. */
const TOM_STAT: Record<StatTom, string> = {
  danger: "text-[var(--danger-text)]",
  warn: "text-[var(--warn-text)]",
  ok: "text-[var(--ok-text)]",
  info: "text-[var(--info-text)]",
  neutro: "text-foreground",
};

export function StatCards({ stats }: { stats: Stat[] }) {
  // auto-fit + piso de 7rem: o painel varia de ~300 a ~900px úteis —
  // grid-cols fixo esmagava o card no estreito (REALIZA-334)
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-1.5">
      {stats.slice(0, 4).map((s, i) => (
        <div
          key={i}
          className="animate-enter min-w-0 rounded-lg border border-border bg-card px-2.5 py-2 shadow-[var(--shadow-border)]"
          style={{ "--i": i } as CSSProperties}
        >
          <p className={cn("break-words text-base font-semibold leading-tight tabular-nums", TOM_STAT[s.tom])}>
            {s.valor}
          </p>
          <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground sm:text-[11px]">
            {s.rotulo}
          </p>
          {s.detalhe ? (
            <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground sm:text-[11px]">
              {s.detalhe}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export type ContextoBlocos = {
  onEnviar: (texto: string) => void;
  respondida: boolean;
  resposta?: string;
  streaming: boolean;
};

function MdLite({
  texto,
  blocos,
  animar,
  ctx,
}: {
  texto: string;
  blocos: BlocoMd[];
  animar?: boolean;
  ctx: ContextoBlocos;
}) {
  const linhas = texto.split("\n");
  const saida: ReactNode[] = [];
  // item com `sub` = marcador indentado ≥2 espaços embaixo dele — vira
  // <ul> filha do <li> (só 1 nível de aninhamento)
  type ItemLista = { texto: string; sub?: string[] };
  let lista: ItemLista[] | null = null;
  let listaOrd = false;
  // linhas ">" seguidas acumulam num blockquote só (um <p> por linha)
  let citacao: string[] | null = null;
  let emCodigo = false;
  let codigo: string[] = [];
  // tag do fence corrente (```sql) — vira o rótulo do header do CodeBlock
  let langCodigo: string | undefined;
  let key = 0;
  // ```nota é a observação de rodapé — texto menor e apagado, não código
  // (chatgpt-style footnote; o prompt a usa p/ "não se aplica quando…",
  // detalhe de cálculo, lembrete fino). Vale no fence fechado e no aberto
  // (stream ou fim truncado): já renderiza como rodapé, nunca CodeBlock.
  // Tolerant match: "```Nota"/"``` nota" from the model must not fall
  // into CodeBlock — a nota never renders as code
  const ehNota = () => langCodigo?.toLowerCase() === "nota";
  const notaRodape = () => (
    <div
      key={key++}
      className="text-xs leading-relaxed text-muted-foreground opacity-80"
    >
      {codigo.map((l, i) => (
        <p key={i}>
          <Inline texto={l} animar={animar} />
        </p>
      ))}
    </div>
  );
  const flushLista = () => {
    if (!lista?.length) return;
    const items = lista.map((item, i) => (
      <li key={i}>
        <Inline texto={item.texto} animar={animar} />
        {item.sub?.length ? (
          <ul className="mt-1.5 list-disc space-y-1 pl-4 marker:text-muted-foreground">
            {item.sub.map((s, j) => (
              <li key={j}>
                <Inline texto={s} animar={animar} />
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    ));
    saida.push(
      listaOrd ? (
        <ol key={key++} className="list-decimal space-y-1.5 pl-5 marker:text-muted-foreground">
          {items}
        </ol>
      ) : (
        <ul key={key++} className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
          {items}
        </ul>
      )
    );
    lista = null;
  };
  // fecha o que estiver aberto na posição do texto: a citação agrupada e
  // a lista nunca coexistem (uma fecha a outra), então a ordem é neutra
  const flush = () => {
    if (citacao?.length) {
      saida.push(
        <blockquote
          key={key++}
          className="space-y-1 border-l-[3px] border-border pl-3 text-muted-foreground"
        >
          {citacao.map((l, i) => (
            <p key={i}>
              <Inline texto={l} animar={animar} />
            </p>
          ))}
        </blockquote>
      );
      citacao = null;
    }
    flushLista();
  };
  let pularAte = -1;
  linhas.forEach((linha, idx) => {
    if (idx <= pularAte) return;
    // fenced code: tudo entre ``` vira CodeBlock (header com a linguagem
    // e copiar), sem inline
    if (emCodigo) {
      if (/^\s*```/.test(linha)) {
        if (ehNota()) saida.push(notaRodape());
        else
          saida.push(
            <CodeBlock key={key++} codigo={codigo.join("\n")} linguagem={langCodigo} />
          );
        emCodigo = false;
        codigo = [];
        langCodigo = undefined;
      } else codigo.push(linha);
      return;
    }
    const abreFence = /^\s*```\s*(\S*)/.exec(linha);
    if (abreFence) {
      flush();
      emCodigo = true;
      langCodigo = abreFence[1] || undefined;
      return;
    }
    // linhas-marca da genUI (extrairBlocos já rodou): bloco válido vira o
    // componente na posição em que o modelo o escreveu; fence ainda aberto
    // no stream vira skeleton do mesmo tamanho (nada de JSON cru)
    const marca = MARCA_BLOCO.exec(linha);
    if (marca) {
      flush();
      const b = blocos[Number(marca[1])];
      if (b) saida.push(<BlocoView key={key++} bloco={b} {...ctx} />);
      return;
    }
    const pend = MARCA_PENDENTE.exec(linha);
    if (pend) {
      flush();
      saida.push(<BlocoSkeleton key={key++} kind={pend[1] as BlocoKind} />);
      return;
    }
    // pipe-table GFM (REALIZA-281): linha com pipes externos tenta virar
    // tabela de verdade — não validou, segue como texto comum
    if (ehTabelaMd(linha)) {
      const t = parseTabelaMd(linhas.slice(idx));
      if (t) {
        flush();
        pularAte = idx + 1 + t.linhas.length;
        saida.push(<Tabela key={key++} t={t} />);
        return;
      }
    }
    // separador de bloco temático: 3+ do mesmo char colado ("---", "***",
    // "___"). Vem antes do bullet: "- - -" não casa aqui (o regex exige
    // os chars colados) e segue como lista; "---" puro já não casaria no
    // bullet de qualquer forma (ele pede espaço depois do marcador)
    if (HR_LINHA.test(linha)) {
      flush();
      saida.push(<hr key={key++} className="border-border/70" />);
      return;
    }
    const quote = /^>\s?(.*)$/.exec(linha);
    if (quote) {
      // ">" seguidas formam UMA citação (não uma barra por linha): só a
      // lista pendente fecha aqui; a citação em si sai no próximo flush
      flushLista();
      (citacao ??= []).push(quote[1]);
      return;
    }
    const bullet = /^(\s*)[-*•]\s+(.+)$/.exec(linha);
    const num = /^(\s*)\d+[.)]\s+(.+)$/.exec(linha);
    if (bullet || num) {
      const m = (bullet ?? num)!;
      // marcador indentado ≥2 espaços = sub-item do anterior (a sublista
      // é sempre <ul>, numerado ou não); sem lista aberta cai como item
      // de topo — conteúdo nunca some
      if (m[1].length >= 2 && lista?.length) {
        (lista[lista.length - 1].sub ??= []).push(m[2]);
        return;
      }
      if (!lista || listaOrd !== Boolean(num)) {
        flush();
        lista = [];
        listaOrd = Boolean(num);
      }
      lista.push({ texto: m[2] });
      return;
    }
    flush();
    if (!linha.trim()) return;
    const h = /^(#{1,4})\s+(.+)$/.exec(linha);
    if (h) {
      // títulos curtos na hierarquia do painel: ## = seção, ### =
      // subseção, #### = nível miúdo — a bolha vive dentro da página (o
      // h1 já é dela), então nem o modelo emite h1 e um eventual # cai
      // no mesmo nível do ##. pt-N abre a seção de verdade e first:pt-0
      // zera quando o título é o 1º bloco da resposta
      const nivel = h[1].length;
      const Tag = (nivel >= 4 ? "h4" : nivel >= 3 ? "h3" : "h2") as
        | "h2"
        | "h3"
        | "h4";
      saida.push(
        <Tag
          key={key++}
          className={
            nivel >= 4
              ? "text-sm font-semibold pt-2 first:pt-0"
              : nivel >= 3
                ? "text-base font-semibold tracking-tight pt-3 first:pt-0"
                : "text-lg font-semibold tracking-tight pt-4 first:pt-0"
          }
        >
          <Inline texto={h[2]} animar={animar} />
        </Tag>
      );
      return;
    }
    saida.push(
      <p key={key++}>
        <Inline texto={linha} animar={animar} />
      </p>
    );
  });
  flush();
  // fence aberto no fim do stream (ou texto truncado sem fechamento):
  // fence comum mostra o que chegou com copiar desabilitado; ```nota
  // aberto já renderiza como rodapé — nunca vira bloco de código
  if (emCodigo && codigo.length) {
    if (ehNota()) saida.push(notaRodape());
    else
      saida.push(
        <CodeBlock key={key++} codigo={codigo.join("\n")} linguagem={langCodigo} pronto={false} />
      );
  }
  // overflow-wrap: links longos e código sem quebra não vazam da coluna
  // estreita do painel (REALIZA-334). ia-stream põe o caret no fim do
  // último parágrafo/item (CSS), não numa linha própria
  return (
    <div
      className={cn(
        "space-y-3 leading-relaxed [overflow-wrap:anywhere]",
        animar && "ia-stream"
      )}
    >
      {saida}
    </div>
  );
}

/** Corpo da resposta: stats no topo, markdown com os blocos no lugar. */
export function RespostaMd({
  analise,
  ctx,
}: {
  analise: Analise;
  ctx: ContextoBlocos;
}) {
  const { stats, blocos, textoSemBloco } = analise;
  return (
    <div className="space-y-2.5">
      {stats.length ? <StatCards stats={stats} /> : null}
      {textoSemBloco ? (
        <MdLite texto={textoSemBloco} blocos={blocos} animar={ctx.streaming} ctx={ctx} />
      ) : null}
    </div>
  );
}
