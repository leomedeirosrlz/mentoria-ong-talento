"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WhatsappLogo } from "@phosphor-icons/react";
import { toast } from "sonner";
import { waLink } from "@/lib/ciclo";
import {
  textoCelula,
  type AlvoRelatorio,
  type CampoCadastro,
  type ColunaRelatorio,
  type LinhaRelatorio,
} from "@/lib/relatorio";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const LARGURA_MIN = 56;
const LARGURA_INICIAL = 168;

type Ordem = { col: string; dir: 1 | -1 } | null;

/** Célula em edição — `key` identifica o editor entre re-renders (o estado
 *  é recriado a cada keystroke) e `linha` guarda o objeto, não o índice:
 *  reordenar com a edição aberta deixa o editor grudado na row certa. */
type Edicao = {
  key: string;
  linha: LinhaRelatorio;
  col: string;
  alvos: AlvoRelatorio[];
  valores: string[];
  salvando: boolean;
};

/** Tom do chip de status da dupla — mesma gramática dos badges de /pessoas:
 *  ok/warn/danger com texto na versão -text (AA); pausada é neutra,
 *  encerrada é muted com borda vermelha suave (fim de ciclo, não alarme). */
const CHIP_STATUS: Record<string, string> = {
  ativa: "border-[var(--ok)]/60 text-[var(--ok-text)]",
  pausada: "text-muted-foreground",
  concluida: "border-[var(--ok)]/40 text-muted-foreground",
  encerrada: "border-[var(--danger)]/40 text-muted-foreground",
  sem_dupla: "border-[var(--warn)]/60 text-[var(--warn-text)]",
};

const CAMPO_PLACEHOLDER: Record<CampoCadastro, string> = {
  nome: "Nome",
  email: "E-mail",
  whatsapp: "WhatsApp",
  cidade: "Cidade",
  uf: "UF",
};

/** Grade livre estilo planilha: colunas redimensionáveis arrastando a borda
 *  do header, ordenação por clique, gutter de nº de linha (sticky à esquerda),
 *  seleção de intervalo e cópia TSV (cola direto no Excel/Sheets). O scroll é
 *  interno (header fixo) e devolve o gesto pra página no limite — sem
 *  overscroll-contain, que engolia a roda do mouse. Sem moldura de card —
 *  o canvas é a página.
 *
 *  Com `editavel` (só /relatorios, que é coord-only) as células de cadastro
 *  abrem edição inline por duplo clique ou Enter — os alvos de escrita chegam
 *  prontos em `__alvos` (montarLinhas paraApp), então a página pública nunca
 *  tem o que editar mesmo se a prop vazar. */
export function RelatorioCanvas({
  colunas,
  linhas,
  storageKey,
  editavel = false,
  onSalvarCampo,
}: {
  colunas: ColunaRelatorio[];
  linhas: LinhaRelatorio[];
  /** persiste larguras por relatório (ex.: "t2-pessoas") */
  storageKey?: string;
  /** modo edição inline — exige `__alvos` nas linhas + `onSalvarCampo` */
  editavel?: boolean;
  /** devolve mensagem de erro pra exibir em toast, ou null no sucesso */
  onSalvarCampo?: (alvo: AlvoRelatorio, novoValor: string) => Promise<string | null>;
}) {
  // larguras persistem por relatório — init lazy do localStorage; quem usa
  // deve passar key={storageKey} pra remontar quando o recorte mudar
  const [larguras, setLarguras] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined" || !storageKey) return {};
    try {
      return JSON.parse(localStorage.getItem(`relatorio-w:${storageKey}`) ?? "{}");
    } catch {
      return {};
    }
  });
  const [ordem, setOrdem] = useState<Ordem>(null);
  const [selAncora, setSelAncora] = useState<number | null>(null);
  const [selFim, setSelFim] = useState<number | null>(null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  // sequencial que dá identidade única a cada abertura de editor — o confirm
  // assíncrono só fecha o editor se ele ainda for o mesmo (key casa)
  const seqEdicao = useRef(0);
  // células recém-gravadas piscam verde (animate-flash-ok) — chave efêmera
  // `${id do alvo}|${col}`: o id é da pessoa, então acha a célula certa
  // depois do rebuild das linhas (o pai devolve objetos novos). O
  // animationend do td remove as chaves dela — efêmera por definição.
  const [flash, setFlash] = useState<Set<string> | null>(null);
  const drag = useRef<{ col: string; x0: number; w0: number; wAtual?: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const ordenadas = useMemo(() => {
    if (!ordem) return linhas;
    return [...linhas].sort(
      (a, b) =>
        textoCelula(a, ordem.col).localeCompare(textoCelula(b, ordem.col), "pt-BR") * ordem.dir
    );
  }, [linhas, ordem]);

  // o editor morre junto com a célula: save bem-sucedido reconstrói as
  // linhas (objetos novos), desligar o modo edição ou ocultar a coluna
  // também tira a célula debaixo dele
  if (
    edicao &&
    (!ordenadas.includes(edicao.linha) ||
      !editavel ||
      !colunas.some((c) => c.id === edicao.col))
  ) {
    setEdicao(null);
  }

  const selecionadas = useMemo(() => {
    if (selAncora === null || selFim === null) return null;
    const [a, b] = [Math.min(selAncora, selFim), Math.max(selAncora, selFim)];
    return new Set(ordenadas.slice(a, b + 1).map((_, i) => a + i));
  }, [selAncora, selFim, ordenadas]);

  const paraTsv = useCallback(
    (rows: LinhaRelatorio[]) =>
      [colunas.map((c) => c.label).join("\t"),
        ...rows.map((l) => colunas.map((c) => textoCelula(l, c.id)).join("\t"))].join("\n"),
    [colunas]
  );

  const copiar = useCallback(async () => {
    const rows =
      selecionadas === null
        ? ordenadas
        : ordenadas.filter((_, i) => selecionadas.has(i));
    try {
      await navigator.clipboard.writeText(paraTsv(rows));
    } catch {}
  }, [ordenadas, selecionadas, paraTsv]);

  // Ctrl+C com seleção ativa copia como TSV (mesmo gesto do Excel)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || selecionadas === null) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selecionadas.size > 0) {
        e.preventDefault();
        void copiar();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [selecionadas, copiar]);

  // ---------- edição inline ----------

  const abrirEdicao = useCallback(
    (linha: LinhaRelatorio, col: string) => {
      if (!editavel || !onSalvarCampo) return;
      const alvos = linha.__alvos?.[col];
      if (!alvos?.length) return;
      setEdicao({
        key: String(++seqEdicao.current),
        linha,
        col,
        alvos,
        valores: alvos.map((a) => a.valor),
        salvando: false,
      });
    },
    [editavel, onSalvarCampo]
  );

  const confirmarEdicao = useCallback(async () => {
    const ed = edicao;
    if (!ed || ed.salvando || !onSalvarCampo) return;
    // campo que voltou ao valor original não dispara escrita
    const mudancas = ed.alvos
      .map((a, j) => ({ a, novo: ed.valores[j].trim() }))
      .filter(({ a, novo }) => novo !== a.valor);
    if (!mudancas.length) {
      setEdicao(null);
      return;
    }
    setEdicao((cur) => (cur?.key === ed.key ? { ...ed, salvando: true } : cur));
    // sequencial e para no primeiro erro — campo errado não arrasta os outros
    for (const { a, novo } of mudancas) {
      const erro = await onSalvarCampo(a, novo);
      if (erro) {
        toast.error(erro);
        // o pai só aplicou os campos salvos — fechar devolve a célula ao
        // valor anterior sem reload
        setEdicao((cur) => (cur?.key === ed.key ? null : cur));
        return;
      }
    }
    // todos gravaram — marca a(s) célula(s) tocada(s) pro flash verde ao
    // voltar pra leitura (merge: um save rápido atrás do outro não apaga
    // o flash ainda correndo em outra célula)
    setFlash((f) => new Set([...(f ?? []), ...mudancas.map(({ a }) => `${a.id}|${ed.col}`)]));
    setEdicao((cur) => (cur?.key === ed.key ? null : cur));
  }, [edicao, onSalvarCampo]);

  // ---------- render ----------

  const iniciarDrag = (e: React.PointerEvent, col: string) => {
    e.preventDefault();
    drag.current = {
      col,
      x0: e.clientX,
      w0: larguras[col] ?? (e.target as HTMLElement).closest("th")?.offsetWidth ?? LARGURA_INICIAL,
    };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const w = Math.max(LARGURA_MIN, d.w0 + ev.clientX - d.x0);
      d.wAtual = w;
      setLarguras((prev) => ({ ...prev, [d.col]: w }));
    };
    const up = () => {
      const d = drag.current;
      if (storageKey && d) {
        setLarguras((prev) => {
          const next = { ...prev, [d.col]: d.wAtual ?? prev[d.col] ?? d.w0 };
          try {
            localStorage.setItem(`relatorio-w:${storageKey}`, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
      drag.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const clicarHeader = (col: string) => {
    setOrdem((o) =>
      o?.col !== col ? { col, dir: 1 } : o.dir === 1 ? { col, dir: -1 } : null
    );
  };

  // Sticky vai no th/td, não no thead/tr — Safari só respeita sticky em célula.
  // E a borda é por célula via border-separate: em border-collapse a borda não
  // acompanha a célula quando ela "descola". Cada célula desenha só direita +
  // baixo; topo fica com o header, esquerda com o gutter — sem dobras.
  const celula = "border-r border-b border-border";
  const gutter =
    "sticky left-0 border-r border-b border-l border-border bg-muted px-1 py-1 " +
    "text-center text-[10px] tabular-nums text-muted-foreground select-none";

  /** Conteúdo da célula por coluna — chips/links são leitura (a edição é por
   *  `__alvos`), então a mesma renderização serve o resumo público. */
  const conteudoCelula = (l: LinhaRelatorio, c: ColunaRelatorio) => {
    const texto = textoCelula(l, c.id);
    if (c.id === "status_dupla" && texto) {
      return (
        <Badge
          variant="outline"
          className={cn("font-normal", CHIP_STATUS[l.__status ?? ""])}
        >
          {texto}
        </Badge>
      );
    }
    if (!texto) {
      return <span className="text-muted-foreground/50">—</span>;
    }
    if (c.id === "papel") {
      // o dot amarelo é o marcador de papel do mentorado em toda a
      // plataforma (DuplaNomes, labels de parear) — o mentor não leva marca
      return (
        <span className="inline-flex items-center gap-1.5">
          {l.__papel === "mentorado" && (
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--role-mentorado)]" />
          )}
          {texto}
        </span>
      );
    }
    if (c.id === "par" && l.__links?.par) {
      // nome do par → ficha da dupla: o caminho pra mexer em status/demanda
      // (colunas derivadas, sem edição inline)
      return (
        <Link
          href={l.__links.par}
          onClick={(e) => e.stopPropagation()}
          className="break-words rounded-sm underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {texto}
        </Link>
      );
    }
    if (c.id === "whatsapp") {
      const wa = waLink(texto, "");
      return (
        <span className="inline-flex items-center gap-1">
          <span className="break-words">{texto}</span>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Chamar ${texto} no WhatsApp`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-sm p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <WhatsappLogo size={13} aria-hidden />
            </a>
          )}
        </span>
      );
    }
    return <span className="break-words">{texto}</span>;
  };

  return (
    <div>
      {/* scroller: overscroll-behavior padrão (auto) — roda/chaining sobem pra
          página quando a grade está no limite; NUNCA overscroll-contain aqui,
          que segura o gesto mesmo sem nada pra rolar */}
      <div
        ref={wrapRef}
        tabIndex={-1}
        className="scroll-fina max-h-[70dvh] overflow-auto overscroll-auto [scrollbar-gutter:stable]"
      >
        <table
          className="border-separate border-spacing-0 text-left text-[13px] leading-snug"
          style={{ tableLayout: "fixed", width: "max-content" }}
        >
          <thead>
            <tr className="bg-muted">
              <th
                aria-hidden
                className={cn(gutter, "sticky top-0 z-30 w-10 border-t font-normal")}
              />
              {colunas.map((c) => {
                const ativo = ordem?.col === c.id;
                return (
                  <th
                    key={c.id}
                    className={cn(
                      celula,
                      "sticky top-0 z-20 border-t bg-muted px-2.5 py-1.5 text-left text-xs font-medium text-foreground select-none",
                      "cursor-pointer hover:bg-accent"
                    )}
                    style={{ width: larguras[c.id] ?? LARGURA_INICIAL }}
                    onClick={() => clicarHeader(c.id)}
                    aria-sort={ativo ? (ordem!.dir === 1 ? "ascending" : "descending") : undefined}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="truncate">{c.label}</span>
                      {ativo && <span aria-hidden className="text-[10px]">{ordem!.dir === 1 ? "↑" : "↓"}</span>}
                    </span>
                    {/* alça de redimensionamento — borda direita, como no Sheets;
                        a linha lime aparece no hover pra entregar a affordance */}
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Redimensionar ${c.label}`}
                      className="group/hdl absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none"
                      onPointerDown={(e) => iniciarDrag(e, c.id)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[var(--brand-lime)] opacity-0 transition-opacity group-hover/hdl:opacity-100 group-active/hdl:opacity-100"
                      />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l, i) => (
              <tr
                key={i}
                className={cn(
                  "hover:bg-[var(--brand-lime)]/8",
                  selecionadas?.has(i) && "bg-[var(--brand-lime)]/15"
                )}
                onClick={(e) => {
                  if (e.shiftKey && selAncora !== null) setSelFim(i);
                  else { setSelAncora(i); setSelFim(i); }
                }}
              >
                <td className={cn(gutter, "z-10")}>
                  {i + 1}
                </td>
                {colunas.map((c) => {
                  const emEdicao = edicao?.linha === l && edicao.col === c.id;
                  const alvosCelula = l.__alvos?.[c.id];
                  const podeEditar =
                    !emEdicao &&
                    editavel &&
                    !!onSalvarCampo &&
                    (alvosCelula?.length ?? 0) > 0;
                  const piscando =
                    flash != null &&
                    (alvosCelula?.some((a) => flash.has(`${a.id}|${c.id}`)) ?? false);
                  return (
                    <td
                      key={c.id}
                      className={cn(
                        celula,
                        "px-2.5 py-1.5 align-top",
                        piscando && "animate-flash-ok",
                        podeEditar &&
                          "cursor-text hover:shadow-[inset_0_0_0_1.5px_var(--brand-lime)] focus-visible:shadow-[inset_0_0_0_1.5px_var(--brand-lime)] focus-visible:outline-none"
                      )}
                      // o flash termina de apagar → tira as chaves da célula
                      // (cada td limpa só as suas — o flash de outra segue).
                      // animationend borbulha do span filho (animate-in de
                      // entrada) — só o evento do próprio td conta
                      onAnimationEnd={
                        piscando
                          ? (e) => {
                              if (e.target !== e.currentTarget) return;
                              setFlash((f) => {
                                if (!f) return f;
                                const next = new Set(f);
                                for (const a of alvosCelula ?? [])
                                  next.delete(`${a.id}|${c.id}`);
                                return next.size ? next : null;
                              });
                            }
                          : undefined
                      }
                      style={{ width: larguras[c.id] ?? LARGURA_INICIAL }}
                      tabIndex={podeEditar ? 0 : undefined}
                      title={podeEditar ? "Duplo clique pra editar" : undefined}
                      onDoubleClick={podeEditar ? () => abrirEdicao(l, c.id) : undefined}
                      onKeyDown={
                        podeEditar
                          ? (e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                abrirEdicao(l, c.id);
                              }
                            }
                          : undefined
                      }
                    >
                      {emEdicao ? (
                        // o blur confirma só quando o foco sai do editor
                        // inteiro — Tab entre os inputs da célula composta
                        // (Cidade/UF, contato) não fecha a edição.
                        // O fade-in (e o da leitura ao fechar) suaviza a troca
                        // célula↔editor — CSS, não motion: é só enter/mount.
                        <span
                          className="flex animate-in fade-in duration-150 ease-snappy items-center gap-1"
                          onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                              void confirmarEdicao();
                            }
                          }}
                        >
                          {edicao.alvos.map((a, j) => (
                            <input
                              key={a.campo}
                              autoFocus={j === 0}
                              value={edicao.valores[j]}
                              disabled={edicao.salvando}
                              placeholder={CAMPO_PLACEHOLDER[a.campo]}
                              inputMode={
                                a.campo === "whatsapp"
                                  ? "tel"
                                  : a.campo === "email"
                                    ? "email"
                                    : undefined
                              }
                              aria-label={CAMPO_PLACEHOLDER[a.campo]}
                              onChange={(e) =>
                                setEdicao((cur) =>
                                  cur
                                    ? {
                                        ...cur,
                                        valores: cur.valores.map((v, k) =>
                                          k === j ? e.target.value : v
                                        ),
                                      }
                                    : cur
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void confirmarEdicao();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setEdicao(null);
                                }
                              }}
                              className={cn(
                                "min-w-0 flex-1 rounded-sm bg-background px-1.5 py-0.5 outline-none ring-1 ring-[var(--brand-lime)] disabled:opacity-60",
                                a.campo === "uf" && "w-12 flex-none uppercase"
                              )}
                            />
                          ))}
                        </span>
                      ) : (
                        // remonta só quando a célula sai da edição (o fade-in
                        // é a "volta" do valor gravado, junto do flash-ok)
                        <span className="block animate-in fade-in duration-150 ease-snappy">
                          {conteudoCelula(l, c)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {ordenadas.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhuma linha nesse recorte.
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Arraste a borda de uma coluna pra redimensionar · clique no título pra ordenar ·
        clique numa linha e Shift+clique em outra pra selecionar — Ctrl+C copia pra planilha.
        {editavel && " Duplo clique (ou Enter) numa célula clara edita o cadastro — Enter confirma, Esc desfaz."}
      </p>
    </div>
  );
}
