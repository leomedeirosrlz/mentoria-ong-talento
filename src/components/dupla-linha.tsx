import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { DotsThree, Lifebuoy } from "@phosphor-icons/react/dist/ssr";
import { DuplaAvatares } from "@/components/dupla-avatares";
import { DuplaNomes } from "@/components/dupla-nomes";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================
// A linha canônica de dupla (/duplas e fila de acompanhamento).
// Anatomia fixa, uma gramática só:
//   [situação + apoio] · dupla (mentor e mentorado, quebram linha)
//   · motivo em até duas linhas · encontros n/total · nota do mentor
//   · UMA ação contextual + ⋯ para o resto + Ver ficha.
// Superfície neutra: a cor de status fica só na pill e nos quadrados.
// Só apresenta: quem calcula a situação é `saudeDoRecorte`/`saudadeDaDupla`.
// ============================================================

/** A grade das colunas. Responde ao CONTAINER da linha (container query), não
 *  à tela: a home põe a lista numa coluna de ~2/3 e ali a grade estoura. Abaixo
 *  de 56rem (@4xl) a linha empilha, como no celular. Seis colunas cabem a
 *  partir daí (≈ 894px com as gaps de 12px), e /duplas a 1280px tem ~1008px.
 *  Colunas de borda com largura FIXA: cada linha é o próprio container, então
 *  uma coluna `auto` faria cada linha medir diferente ("Lembrada 24/10" é mais
 *  larga que "Lembrar") e a tabela desalinhava. Só dupla e motivo são fluidas.
 *  O cabeçalho da lista usa a mesma grade e a mesma gap (@4xl:gap-x-3). */
export const GRID_DUPLA_LG =
  "@4xl:grid-cols-[108px_minmax(180px,1.2fr)_minmax(150px,1.3fr)_104px_76px_176px]";

export type PessoaLinha = {
  id: string;
  nome: string;
  avatar_path?: string | null;
  email?: string | null;
};

/** Tom da situação: risco e atenção pedem ação; "neutro" é a dupla em dia
 *  (sem cor de status); "pausa" cobre pausada e concluída. */
export type TomSituacao = "risco" | "atencao" | "neutro" | "pausa";

const PILL: Record<TomSituacao, string> = {
  risco: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
  atencao: "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-text)]",
  neutro: "border-border bg-muted text-foreground",
  pausa: "border-[var(--pausa-border)] bg-[var(--pausa-bg)] text-[var(--pausa-text)]",
};

const PONTO: Record<TomSituacao, string | null> = {
  risco: "bg-[var(--danger)]",
  atencao: "bg-[var(--warn)]",
  neutro: null,
  pausa: "bg-[var(--pausa)]",
};

const QUADRADO_ON: Record<TomSituacao, string> = {
  risco: "bg-[var(--danger)]",
  atencao: "bg-[var(--warn)]",
  neutro: "bg-muted-foreground",
  pausa: "bg-[var(--pausa)]",
};

/** Os quadradinhos de encontro: um por encontro da trilha, marcados os
 *  realizados; o traço mostra o esperado até hoje (só em dupla ativa). */
export type ProgressoDupla = {
  total: number;
  realizados: readonly number[];
  esperado?: number | null;
  /** texto à direita do "n de N": "esperado 4", "em pausa", "sessões" */
  legenda?: string;
};

export type DuplaLinhaProps = {
  mentor: PessoaLinha;
  mentorado: PessoaLinha;
  situacao: { rotulo: string; tom: TomSituacao };
  /** pedido de apoio aberto: pill à parte, nunca troca a situação */
  apoio?: { detalhe?: string } | null;
  /** "Turma 1 · sup. Paulo" — já montado pelo caller */
  meta?: string | null;
  /** o motivo em uma linha, na linguagem do guia */
  motivo?: string | null;
  progresso?: ProgressoDupla | null;
  /** nota do mentor: pill + rótulo curto ("3º enc."); o texto íntegro no title */
  nota?: ReactNode;
  /** a UMA ação contextual: Lembrar, Chamar, Registrar, Concluir rito */
  acao?: ReactNode;
  /** ⋯ — o resto das ações, só quando existe */
  menu?: ReactNode;
  fichaHref: string;
  /** primeiro nome do mentorado, pro aria-label do "Ver ficha" */
  fichaNome: string;
  /** índice do stagger (--i) */
  i?: number;
  className?: string;
};

export function DuplaLinha({
  mentor,
  mentorado,
  situacao,
  apoio,
  meta,
  motivo,
  progresso,
  nota,
  acao,
  menu,
  fichaHref,
  fichaNome,
  i = 0,
  className,
}: DuplaLinhaProps) {
  const realizados = new Set(progresso?.realizados ?? []);
  const feitos = realizados.size;
  const total = progresso?.total ?? 0;
  const esperadoPct =
    progresso && progresso.esperado != null && total > 0
      ? Math.min(progresso.esperado / total, 1)
      : null;

  // o wrapper é o container: a linha e seus filhos leem a largura dele, não a
  // da tela. Em uma lista de cards o wrapper tem a largura da lista inteira.
  return (
    <div className="@container">
      <div
        style={{ "--i": Math.min(i, 10) } as CSSProperties}
        className={cn(
          "relative animate-enter flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/50",
          // container largo: a grade densa; estreito: a mesma linha empilhada do celular
          "@4xl:grid @4xl:gap-x-3 @4xl:gap-y-0 @4xl:rounded-none @4xl:border-0 @4xl:bg-transparent @4xl:px-5 @4xl:py-3",
          GRID_DUPLA_LG,
          className
        )}
      >
        {/* card inteiro abre a ficha (stretched link, REALIZA-241): cobre a
            linha em z-10 — inclusive os discos do avatar, que são relative
            por estilo. Só os controles de verdade (ação, ⋯) e a pill de
            apoio com title sobem pra z-20; o "Ver ficha" visual é decorativo
            — 1 tab por card */}
        <Link
          href={fichaHref}
          aria-label={`Ver ficha da dupla de ${fichaNome}`}
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @4xl:rounded-none"
        />
        {/* situação e apoio — pill de estado e pill de apoio, sempre separadas */}
        <div className="order-1 flex flex-wrap items-center gap-1.5 @4xl:order-none @4xl:flex-col @4xl:items-start @4xl:gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
              PILL[situacao.tom]
            )}
          >
            {PONTO[situacao.tom] && (
              <span aria-hidden className={cn("size-1.5 rounded-full", PONTO[situacao.tom])} />
            )}
            {situacao.rotulo}
          </span>
          {apoio && (
            <span
              title={apoio.detalhe}
              className="relative z-20 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-2 py-1 text-[11px] font-semibold leading-none text-[var(--info-text)]"
            >
              <Lifebuoy size={12} aria-hidden />
              Apoio pedido
              {apoio.detalhe && <span className="sr-only">, {apoio.detalhe}</span>}
            </span>
          )}
        </div>

        {/* a dupla — o nome não trunca: quebra linha */}
        <div className="order-3 flex min-w-0 basis-full items-start gap-2.5 @4xl:order-none @4xl:basis-auto">
          <DuplaAvatares mentor={mentor} mentorado={mentorado} size={32} />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">
              <DuplaNomes mentor={mentor.nome} mentorado={mentorado.nome} />
            </p>
            {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
          </div>
        </div>

        {/* o motivo é a informação que decide a ação: até duas linhas; o texto
            íntegro fica no title */}
        <div className="order-4 min-w-0 basis-full text-[13px] leading-snug @4xl:order-none @4xl:basis-auto">
          <p className="line-clamp-2" title={motivo ?? undefined}>
            {motivo ?? "Sem pendências"}
          </p>
        </div>

        {/* encontros: um quadrado por encontro da trilha */}
        <div
          className={cn(
            "order-5 min-w-0 basis-full @4xl:order-none @4xl:basis-auto",
            !progresso && "@max-4xl:hidden"
          )}
        >
          {progresso && (
            <>
              <p className="text-xs">
                <b className="font-semibold tabular-nums whitespace-nowrap text-foreground">
                  {feitos} de {total}
                </b>
              </p>
              <div className="relative mt-1">
                <div
                  role="img"
                  aria-label={`${feitos} de ${total} encontros realizados${
                    esperadoPct != null ? `, esperados ${progresso.esperado} até hoje` : ""
                  }`}
                  className="flex h-2 gap-px"
                >
                  {Array.from({ length: total }, (_, n) => (
                    <span
                      key={n}
                      className={cn(
                        "min-w-0 flex-1 rounded-[2px] bg-muted shadow-[inset_0_0_0_1px_var(--border)]",
                        realizados.has(n + 1) && QUADRADO_ON[situacao.tom]
                      )}
                    />
                  ))}
                </div>
                {esperadoPct != null && (
                  <span
                    aria-hidden
                    className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded bg-foreground/50"
                    style={{ left: `${esperadoPct * 100}%` }}
                  />
                )}
              </div>
              {/* legenda sob a barra: na coluna de 104px ela não cabe ao lado
                  do "n de N" e truncava ("espera…") */}
              {progresso.legenda && (
                <p className="mt-1 text-xs text-muted-foreground">{progresso.legenda}</p>
              )}
            </>
          )}
        </div>

        {/* nota do mentor: pill + rótulo curto, nunca "Boa" solta */}
        <div
          className={cn(
            "order-6 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 @4xl:order-none @4xl:flex-col @4xl:items-start",
            nota == null && "@max-4xl:hidden"
          )}
        >
          {nota}
        </div>

        {/* ação contextual, ⋯ e o Ver ficha decorativo. No celular ficam no
            topo à direita. Os controles reais sobem com `relative` pra ficar
            acima do link esticado; o "Ver ficha" é um span aria-hidden sem
            posição — o clique passa pro link do card (pointer-events-none) */}
        <div className="order-2 ml-auto flex items-center gap-1.5 @4xl:order-none @4xl:ml-0 @4xl:flex-col @4xl:items-end @4xl:gap-1">
          {acao != null && <span className="relative z-20">{acao}</span>}
          <span className="flex items-center gap-1 @4xl:justify-end">
            {menu != null && <span className="relative z-20">{menu}</span>}
            <span
              aria-hidden
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "pointer-events-none w-11 shrink-0 px-0 text-muted-foreground md:w-auto md:px-2.5"
              )}
            >
              <span className="hidden whitespace-nowrap md:inline">Ações</span>
              <DotsThree weight="bold" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
