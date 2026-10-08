"use client";

// Builder de cronograma (REALIZA-103) — /turmas/novo em dois passos:
//   1. parâmetros — 1º encontro, cadência, exceções (intervalos e recesso),
//      preparação/encerramento e a fonte do conteúdo dos encontros;
//   2. prévia — a lista materializada editável (datas/títulos inline, o resto
//      no dialog) antes de gravar cronograma + ciclo_eventos de uma vez.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarBlank,
  CircleNotch,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { criarCronograma } from "@/lib/actions-cronogramas";
import {
  gerarEventos,
  totaisCronograma,
  validaEventos,
  type EventoRascunho,
  type TipoEvento,
} from "@/lib/gerador-cronograma";
import {
  formatDiaSemana,
  formatDiaSemanaMes,
  rotuloCronograma,
} from "@/lib/ciclo";
import type { CicloEvento, Cronograma } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EventoCronogramaDialog } from "@/components/evento-cronograma-dialog";
import { cn } from "@/lib/utils";

/** Linha da prévia — rascunho + chave React estável (não é o id do banco). */
type Linha = EventoRascunho & { key: string };

const novaChave = () => crypto.randomUUID();

const STATUS_OPCOES = {
  rascunho: "Rascunho — ainda não é o calendário de nenhuma dupla",
  ativo: "Ativo — já pode ser escolhido ao parear duplas",
} as const;

const CONTEUDO_OPCOES = {
  guia_dpp: "Guia DPP oficial — os 16 encontros com fases e instrumentos",
  copiar: "Copiar conteúdo de um cronograma existente",
  vazio: "Em branco — títulos genéricos pra editar depois",
} as const;

type ConteudoFonte = keyof typeof CONTEUDO_OPCOES;

const rascunhoVazio = (): EventoRascunho => ({
  tipo: "etapa_preparacao",
  numero: null,
  data: null,
  data_fim: null,
  titulo: "",
  fase: null,
  instrumentos: [],
  status: "pendente",
  observacao: null,
});

export function CronogramaBuilder({
  cronogramas,
  eventos,
}: {
  cronogramas: Cronograma[];
  /** todos os eventos — o modo "copiar" recorta o conteúdo do cronograma fonte */
  eventos: CicloEvento[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [etapa, setEtapa] = useState<"config" | "previa">("config");

  // ---------- parâmetros ----------
  const [turma, setTurma] = useState("");
  const [nome, setNome] = useState("Calendário oficial");
  const [status, setStatus] = useState<"rascunho" | "ativo">("rascunho");
  const [conteudo, setConteudo] = useState<ConteudoFonte>("guia_dpp");
  const [copiarDe, setCopiarDe] = useState(cronogramas[0]?.id ?? "");
  const [primeiro, setPrimeiro] = useState("");
  const [total, setTotal] = useState(16);
  const [cadencia, setCadencia] = useState(7);
  // folga oficial do guia: 14 dias entre o 8º e o 9º encontro — pré-preenchida
  // e removível; a quinta de encontro duplo da T2 é {5:2} + {6:5}
  const [intervalos, setIntervalos] = useState<{ apos: string; dias: string }[]>([
    { apos: "8", dias: "14" },
  ]);
  const [temRecesso, setTemRecesso] = useState(false);
  const [recesso, setRecesso] = useState({
    apos: "14",
    inicio: "",
    fim: "",
    titulo: "Recesso de fim de ano",
  });
  const [preparacao, setPreparacao] = useState(true);
  const [encerramento, setEncerramento] = useState(true);

  // ---------- prévia ----------
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novo, setNovo] = useState<EventoRascunho>(rascunhoVazio);

  const erroLista = useMemo(
    () => (linhas.length ? validaEventos(linhas) : null),
    [linhas]
  );
  const totais = useMemo(() => totaisCronograma(linhas), [linhas]);

  const opcoesCopia = cronogramas.filter((c) =>
    eventos.some((e) => e.cronograma_id === c.id && e.tipo === "encontro")
  );

  function gerar() {
    if (!turma.trim()) {
      toast.error("Dê um nome à turma (ex.: T3 · 2026/2027).");
      return;
    }
    if (!primeiro) {
      toast.error("Informe a data do 1º encontro.");
      return;
    }
    const fonte =
      conteudo === "copiar"
        ? {
            fonte: "copiar" as const,
            encontros: eventos.filter(
              (e) => e.cronograma_id === copiarDe && e.tipo === "encontro"
            ),
          }
        : { fonte: conteudo };
    const r = gerarEventos({
      primeiroEncontro: primeiro,
      totalEncontros: total,
      cadenciaDias: cadencia,
      intervalos: intervalos
        .filter((i) => i.apos.trim() && i.dias.trim())
        .map((i) => ({ apos: Number(i.apos), dias: Number(i.dias) })),
      recessos: temRecesso
        ? [
            {
              apos: Number(recesso.apos),
              inicio: recesso.inicio,
              fim: recesso.fim,
              titulo: recesso.titulo,
            },
          ]
        : [],
      conteudo: fonte,
      preparacao,
      encerramento,
    });
    if ("error" in r) {
      toast.error(r.error);
      return;
    }
    setLinhas(r.eventos.map((e) => ({ ...e, key: novaChave() })));
    setEtapa("previa");
  }

  function atualizarLinha(key: string, patch: Partial<EventoRascunho>) {
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function mover(key: string, dir: -1 | 1) {
    setLinhas((ls) => {
      const i = ls.findIndex((l) => l.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const out = [...ls];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  }

  function criar() {
    const erro = validaEventos(linhas);
    if (erro) {
      toast.error(erro);
      return;
    }
    start(async () => {
      try {
        const res = await criarCronograma({
          turma: turma.trim(),
          nome: nome.trim(),
          status,
          eventos: linhas,
        });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success("Cronograma criado.");
        router.push(`/turmas/${res.id}`);
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  const inputSm = "h-9";

  if (etapa === "previa") {
    const editandoLinha = linhas.find((l) => l.key === editando) ?? null;
    return (
      <div className="space-y-5">
        {/* resumo derivado — os mesmos campos que a action grava no cronograma */}
        <div className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)] sm:px-5">
          <p className="text-sm font-medium">
            {encontroCount(linhas)}{" "}
            {encontroCount(linhas) === 1 ? "encontro oficial" : "encontros oficiais"}{" "}
            · {linhas.length} {linhas.length === 1 ? "evento" : "eventos"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {totais.inicio_em
              ? `${formatDiaSemanaMes(totais.inicio_em)} → ${formatDiaSemanaMes(totais.fim_em)}`
              : "Sem datas — revise a prévia"}
          </p>
        </div>

        {erroLista && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
          >
            {erroLista}
          </p>
        )}

        {/* a prévia é a sequência do PDF: a posição aqui vira `ordem` */}
        <ol className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          {linhas.map((l, i) => (
            <li
              key={l.key}
              className={cn(
                "flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4",
                i > 0 && "border-t"
              )}
            >
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <Marcador tipo={l.tipo} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <Input
                  aria-label={`Título do item ${i + 1}`}
                  className={cn(inputSm, "min-w-0 flex-1")}
                  value={l.titulo}
                  onChange={(e) => atualizarLinha(l.key, { titulo: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Data do item ${i + 1}`}
                    type="date"
                    className={cn(inputSm, "w-36")}
                    value={l.data ?? ""}
                    onChange={(e) =>
                      atualizarLinha(l.key, { data: e.target.value || null })
                    }
                  />
                  {l.tipo === "encontro" && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      nº {l.numero}
                    </span>
                  )}
                  {l.tipo === "etapa_preparacao" && l.status === "concluida" && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      concluída
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <IconButton
                  dica="Editar detalhes"
                  label={`Editar detalhes do item ${i + 1}`}
                  onClick={() => setEditando(l.key)}
                >
                  <PencilSimple size={15} />
                </IconButton>
                <IconButton
                  dica="Mover para cima"
                  label={`Mover item ${i + 1} para cima`}
                  disabled={i === 0}
                  onClick={() => mover(l.key, -1)}
                >
                  <ArrowUp size={15} />
                </IconButton>
                <IconButton
                  dica="Mover para baixo"
                  label={`Mover item ${i + 1} para baixo`}
                  disabled={i === linhas.length - 1}
                  onClick={() => mover(l.key, 1)}
                >
                  <ArrowDown size={15} />
                </IconButton>
                <IconButton
                  dica="Remover da prévia"
                  label={`Remover item ${i + 1} da prévia`}
                  onClick={() => setLinhas((ls) => ls.filter((x) => x.key !== l.key))}
                >
                  <Trash size={15} />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNovo(rascunhoVazio());
              setNovoAberto(true);
            }}
          >
            <Plus aria-hidden />
            Adicionar evento
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEtapa("config")}>
              <ArrowLeft aria-hidden />
              Voltar aos parâmetros
            </Button>
            <Button size="sm" disabled={pending || !!erroLista} onClick={criar}>
              {pending && <CircleNotch className="animate-spin" />}
              {pending ? "Criando…" : "Criar cronograma"}
            </Button>
          </div>
        </div>

        {/* dialog de detalhes da linha em edição */}
        {editandoLinha && (
          <EventoCronogramaDialog
            open
            onOpenChange={(o) => !o && setEditando(null)}
            inicial={editandoLinha}
            titulo={`Item ${linhas.indexOf(editandoLinha) + 1} da sequência`}
            onSalvar={(r) => {
              atualizarLinha(editandoLinha.key, r);
              setEditando(null);
            }}
          />
        )}
        <EventoCronogramaDialog
          open={novoAberto}
          onOpenChange={setNovoAberto}
          inicial={novo}
          titulo="Novo evento"
          onSalvar={(r) => {
            setLinhas((ls) => [...ls, { ...r, key: novaChave() }]);
            setNovoAberto(false);
          }}
        />
      </div>
    );
  }

  // ---------- passo 1: parâmetros ----------
  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <h2 className="text-sm font-semibold">A turma</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cb-turma">Turma</Label>
            <Input
              id="cb-turma"
              required
              maxLength={80}
              placeholder="Ex.: T3 · 2026/2027"
              value={turma}
              onChange={(e) => setTurma(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A turma agrupa cronograma e duplas — duplas novas ganham esse selo.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cb-nome">Nome do cronograma</Label>
            <Input
              id="cb-nome"
              required
              maxLength={120}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Duas turmas podem dividir o mesmo nome — ex.: “Calendário oficial”.
            </p>
          </div>
          <div className="space-y-2">
            <Label id="cb-status-label">Status inicial</Label>
            <Select
              value={status}
              items={STATUS_OPCOES}
              onValueChange={(v) => setStatus(v as typeof status)}
            >
              <SelectTrigger aria-labelledby="cb-status-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_OPCOES).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label id="cb-conteudo-label">Conteúdo dos encontros</Label>
            <Select
              value={conteudo}
              items={CONTEUDO_OPCOES}
              onValueChange={(v) => setConteudo(v as ConteudoFonte)}
            >
              <SelectTrigger aria-labelledby="cb-conteudo-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONTEUDO_OPCOES).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {conteudo === "copiar" && (
              <Select
                value={copiarDe}
                items={Object.fromEntries(
                  opcoesCopia.map((c) => [c.id, rotuloCronograma(c)])
                )}
                onValueChange={(v) => v && setCopiarDe(v)}
              >
                <SelectTrigger aria-label="Cronograma fonte">
                  <SelectValue placeholder="Escolha o cronograma fonte" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesCopia.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {rotuloCronograma(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <h2 className="text-sm font-semibold">Mentoria ativa</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cb-primeiro">Data do 1º encontro</Label>
            <Input
              id="cb-primeiro"
              type="date"
              required
              value={primeiro}
              onChange={(e) => setPrimeiro(e.target.value)}
            />
            {primeiro && (
              <p className="text-xs text-muted-foreground">
                Cai numa {formatDiaSemana(primeiro)} — os encontros seguem esse
                dia da semana.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cb-total">Nº de encontros</Label>
            <Input
              id="cb-total"
              type="number"
              min={1}
              max={30}
              required
              value={total}
              onChange={(e) => setTotal(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cb-cadencia">Intervalo padrão (dias)</Label>
            <Input
              id="cb-cadencia"
              type="number"
              min={1}
              max={28}
              required
              value={cadencia}
              onChange={(e) => setCadencia(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">7 = semanal.</p>
          </div>
        </div>

        {/* exceções de intervalo: a folga do 8º→9º, a quinta de sessão dupla… */}
        <div className="mt-5 space-y-2">
          <Label>Exceções de intervalo</Label>
          <p className="text-xs text-muted-foreground">
            Sempre que um par de encontros não segue o intervalo padrão — a
            folga de 15 dias entre o 8º e o 9º é o exemplo do guia.
          </p>
          {intervalos.map((iv, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor={`cb-iv-a-${i}`} className="text-xs">
                  Após o encontro nº
                </Label>
                <Input
                  id={`cb-iv-a-${i}`}
                  type="number"
                  min={1}
                  max={total - 1}
                  className="w-28"
                  value={iv.apos}
                  onChange={(e) =>
                    setIntervalos((l) =>
                      l.map((x, j) => (j === i ? { ...x, apos: e.target.value } : x))
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`cb-iv-d-${i}`} className="text-xs">
                  Dias até o próximo
                </Label>
                <Input
                  id={`cb-iv-d-${i}`}
                  type="number"
                  min={1}
                  max={90}
                  className="w-28"
                  value={iv.dias}
                  onChange={(e) =>
                    setIntervalos((l) =>
                      l.map((x, j) => (j === i ? { ...x, dias: e.target.value } : x))
                    )
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remover exceção ${i + 1}`}
                onClick={() => setIntervalos((l) => l.filter((_, j) => j !== i))}
              >
                <Trash size={15} />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIntervalos((l) => [...l, { apos: "", dias: "7" }])}
          >
            <Plus aria-hidden />
            Adicionar exceção
          </Button>
        </div>

        {/* recesso — vira uma row própria na sequência */}
        <div className="mt-5 space-y-3 border-t pt-4">
          <div className="flex items-center gap-2">
            <Switch
              id="cb-recesso"
              aria-labelledby="cb-recesso-label"
              checked={temRecesso}
              onCheckedChange={setTemRecesso}
            />
            <Label
              id="cb-recesso-label"
              htmlFor="cb-recesso"
              className="cursor-pointer font-normal"
            >
              Tem recesso no meio do ciclo (fim de ano, férias…)
            </Label>
          </div>
          {temRecesso && (
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="cb-rec-apos">Após o encontro nº</Label>
                <Input
                  id="cb-rec-apos"
                  type="number"
                  min={1}
                  max={total - 1}
                  value={recesso.apos}
                  onChange={(e) =>
                    setRecesso((r) => ({ ...r, apos: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cb-rec-ini">Início</Label>
                <Input
                  id="cb-rec-ini"
                  type="date"
                  value={recesso.inicio}
                  onChange={(e) =>
                    setRecesso((r) => ({ ...r, inicio: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cb-rec-fim">Fim</Label>
                <Input
                  id="cb-rec-fim"
                  type="date"
                  value={recesso.fim}
                  onChange={(e) =>
                    setRecesso((r) => ({ ...r, fim: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cb-rec-tit">Título</Label>
                <Input
                  id="cb-rec-tit"
                  maxLength={160}
                  value={recesso.titulo}
                  onChange={(e) =>
                    setRecesso((r) => ({ ...r, titulo: e.target.value }))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-4">
                O encontro seguinte cai no primeiro dia-da-semana depois do fim
                — a retomada do PDF (“1ª terça de janeiro”).
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <h2 className="text-sm font-semibold">Antes e depois</h2>
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              id="cb-prep"
              aria-labelledby="cb-prep-label"
              checked={preparacao}
              onCheckedChange={setPreparacao}
            />
            <Label
              id="cb-prep-label"
              htmlFor="cb-prep"
              className="cursor-pointer font-normal"
            >
              Etapas de preparação do guia — inscrições, triagem e matching,
              onboardings e formações
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="cb-enc"
              aria-labelledby="cb-enc-label"
              checked={encerramento}
              onCheckedChange={setEncerramento}
            />
            <Label
              id="cb-enc-label"
              htmlFor="cb-enc"
              className="cursor-pointer font-normal"
            >
              Evento de encerramento do programa, 3 dias após o último encontro
            </Label>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={gerar}>
          <CalendarBlank aria-hidden />
          Gerar prévia do calendário
        </Button>
      </div>
    </div>
  );
}

function encontroCount(linhas: EventoRascunho[]) {
  return linhas.filter((l) => l.tipo === "encontro").length;
}

/** Glifo do tipo — mini-marcador da prévia, mesma paleta da agenda. */
function Marcador({ tipo }: { tipo: TipoEvento }) {
  const cls = "size-2 shrink-0 rounded-full";
  const title = { encontro: "encontro", recesso: "recesso", formacao: "formação", etapa_preparacao: "etapa", evento_encerramento: "encerramento" }[tipo];
  return (
    <span
      title={title}
      className={cn(
        cls,
        tipo === "encontro" && "bg-[var(--brand-lime)]",
        tipo === "formacao" && "bg-[var(--warn)]",
        tipo === "recesso" && "bg-muted-foreground/40",
        tipo === "etapa_preparacao" && "bg-muted-foreground/60",
        tipo === "evento_encerramento" && "bg-[var(--ok)]"
      )}
    />
  );
}

function IconButton({
  dica,
  label,
  disabled,
  onClick,
  children,
}: {
  dica: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{dica}</TooltipContent>
    </Tooltip>
  );
}
