"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowSquareOut,
  CalendarBlank,
  CaretRight,
  ChatCircleText,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  Eye,
  EyeSlash,
  GraduationCap,
  Lifebuoy,
  Lightning,
  Lock,
  Monitor,
  Paperclip,
  PaperPlaneRight,
  Plus,
  Sparkle,
  Tag,
  UserPlus,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type {
  ChamadoAnexo,
  ChamadoCategoria,
  ChamadoFilaItem,
  ChamadoStatus,
  ChamadoTimelineItem,
  Profile,
} from "@/lib/types";
import {
  CHAMADO_CATEGORIA_LABEL,
  CHAMADO_ORIGEM_LABEL,
  CHAMADO_STATUS_LABEL,
  formatDiaMes,
  formatTamanho,
} from "@/lib/ciclo";
import {
  acrescentarInfoChamado,
  assumirChamado,
  atribuirChamado,
  comentarChamado,
  devolverChamadoFila,
  pedirReaberturaChamado,
  publicarAtualizacaoChamado,
  reabrirChamado,
  resolverChamado,
} from "@/lib/actions-chamados";
import { cn, normaliza } from "@/lib/utils";
import { EASE } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/avatar";
import { NovoChamadoDialog } from "@/components/novo-chamado-dialog";
import {
  AnexoThumb,
  AnexosPendentes,
  ChamadoAnexos,
  ROTULO_ANEXO,
  tipoAnexo,
  useAnexosPendentes,
} from "@/components/chamado-anexos";

type Papel = string;
type Equipe = Pick<Profile, "id" | "nome" | "nome_social" | "role">[];
export type EquipeLinha = Pick<Profile, "id" | "nome" | "nome_social" | "role">;

// ---------- escala semântica de status ----------
// A cor do status mora SÓ nas pills/ícones — card e superfície ficam neutros
// (o mock reserva tinta de status pra badge/stepper). Ícone + texto sempre:
// cor sozinha não carrega o significado.
const STATUS_ICON: Record<
  ChamadoStatus,
  ComponentType<{ size?: number | string; className?: string; "aria-hidden"?: boolean | "true" | "false" }>
> = {
  aberto: WarningCircle,
  em_atendimento: Clock,
  resolvido: CheckCircle,
};

const STATUS_TOM: Record<ChamadoStatus, string> = {
  aberto: "border-destructive/40 bg-destructive/10 text-destructive",
  em_atendimento:
    "border-[var(--warn)]/50 bg-[var(--warn)]/10 text-[var(--warn-text)]",
  resolvido: "border-[var(--ok)]/50 bg-[var(--ok)]/10 text-[var(--ok-text)]",
};

const primeiroNome = (n: string) => n.split(" ")[0];

/** Pill de status do chamado. `visao` muda a fala do "aberto": pra equipe é
 *  "sem dono" (a fila é o trabalho dela), pro autor é "aguardando" (o vazio
 *  de dono não é problema dele). Chamado restrito vira pill neutra — o
 *  "sem dono" não pode ser verificado por quem vê a máscara. */
export function ChamadoStatusBadge({
  status,
  dono,
  restrito,
  visao,
  className,
}: {
  status: ChamadoStatus;
  dono?: string | null;
  restrito?: boolean;
  visao: "staff" | "autor";
  className?: string;
}) {
  const Icone = STATUS_ICON[status];
  if (restrito) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-dashed border-border font-normal text-muted-foreground",
          className
        )}
      >
        <Lock size={11} aria-hidden />
        {CHAMADO_STATUS_LABEL[status]}
      </Badge>
    );
  }
  let texto = CHAMADO_STATUS_LABEL[status];
  if (status === "aberto" && !dono) {
    texto = visao === "staff" ? "Aberto · sem dono" : "Aberto · aguardando";
  } else if (status !== "resolvido" && dono) {
    texto = `${texto} · ${primeiroNome(dono)}`;
  }
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", STATUS_TOM[status], className)}
    >
      <Icone size={11} aria-hidden />
      {texto}
    </Badge>
  );
}

// ---------- categoria ----------
// Urgência carrega o sinal no ÍCONE (raio vermelho) — pill neutra evita dois
// vermelhos lado a lado quando o chamado urgente também está "aberto".
const CAT_ICON: Record<ChamadoCategoria, ComponentType<{ size?: number | string; className?: string; "aria-hidden"?: boolean | "true" | "false" }> | null> = {
  urgencia: Lightning,
  agenda: CalendarBlank,
  metodologia: GraduationCap,
  plataforma: Monitor,
  outro: Tag,
};

function CategoriaBadge({ categoria }: { categoria: ChamadoCategoria }) {
  const Icone = CAT_ICON[categoria];
  return (
    <Badge
      variant="outline"
      className="border-border bg-muted/60 font-normal text-muted-foreground"
    >
      {Icone && (
        <Icone
          size={11}
          aria-hidden
          className={categoria === "urgencia" ? "text-destructive" : undefined}
        />
      )}
      {CHAMADO_CATEGORIA_LABEL[categoria]}
    </Badge>
  );
}

function relTempo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 60) return `há ${Math.max(1, min)}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d}d`;
  return formatDiaMes(iso);
}

function idadeAberto(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "hoje";
  if (d === 1) return "há 1 dia";
  return `há ${d} dias`;
}

export function ChamadosApp({
  papel,
  meuId,
  meuNome,
  itens,
  selecionadoInicial,
  detalheInicial,
}: {
  papel: Papel;
  meuId: string;
  meuNome: string;
  itens: ChamadoFilaItem[];
  selecionadoInicial: string | null;
  detalheInicial: {
    chamado: ChamadoFilaItem;
    timeline: ChamadoTimelineItem[];
    equipe: Equipe;
  } | null;
}) {
  const router = useRouter();
  const staff = papel === "coordenacao" || papel === "supervisor";
  const [busca, setBusca] = useState("");
  const [fFila, setFFila] = useState<
    "todos" | "fila" | "semdono" | "meus" | "resolvidos"
  >("todos");
  const [fCategoria, setFCategoria] = useState<string>("todas");
  const [fStatus, setFStatus] = useState<string>("todos");

  const filtrados = useMemo(() => {
    let l = itens;
    if (staff) {
      if (fFila === "fila") l = l.filter((c) => c.status === "aberto");
      // "sem dono" exclui restrito: pro auxiliar o atribuido_a chega
      // mascarado (null) e a linha contaria errado como sem-dono
      if (fFila === "semdono")
        l = l.filter(
          (c) => c.status === "aberto" && !c.atribuido_a && !c.restrito
        );
      if (fFila === "meus")
        l = l.filter((c) => c.atribuido_a === meuId && c.status !== "resolvido");
      if (fFila === "resolvidos") l = l.filter((c) => c.status === "resolvido");
      if (fCategoria !== "todas")
        l = l.filter((c) => c.categoria === fCategoria);
      if (fStatus !== "todos") l = l.filter((c) => c.status === fStatus);
    }
    const q = busca.trim().toLowerCase();
    if (q) {
      l = l.filter(
        (c) =>
          c.numero.toLowerCase().includes(q) ||
          (c.assunto ?? "").toLowerCase().includes(q) ||
          (c.autor_nome ?? "").toLowerCase().includes(q)
      );
    }
    return l;
  }, [itens, staff, fFila, fCategoria, fStatus, busca, meuId]);

  // contagens dos chips da fila (mock: "Todos 8 · Sem dono 3 · ...") — o
  // predicado é o mesmo do filtro, então chip e resultado nunca divergem
  const contFila = useMemo(
    () => ({
      todos: itens.length,
      fila: itens.filter((c) => c.status === "aberto").length,
      semdono: itens.filter(
        (c) => c.status === "aberto" && !c.atribuido_a && !c.restrito
      ).length,
      meus: itens.filter(
        (c) => c.atribuido_a === meuId && c.status !== "resolvido"
      ).length,
      resolvidos: itens.filter((c) => c.status === "resolvido").length,
    }),
    [itens, meuId]
  );

  const naFila = itens.filter((c) => c.status === "aberto" && !c.restrito);
  const maisAntigo = naFila.length
    ? naFila.reduce((a, b) =>
        new Date(a.created_at) < new Date(b.created_at) ? a : b
      )
    : null;

  const sel = selecionadoInicial;
  const detalhe = detalheInicial;

  function abrir(id: string) {
    router.push(`/chamados?c=${id}`);
  }
  function fechar() {
    router.push("/chamados");
  }

  // mobile: lista OU detalhe; desktop: lado a lado
  return (
    <div
      className={cn(
        "grid gap-4",
        staff && "lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start"
      )}
    >
      <section
        aria-label={staff ? "Fila de chamados" : "Seus chamados"}
        className={cn("min-w-0", sel && staff && "hidden lg:block")}
      >
        {staff && (
          <div className="mb-3 space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lifebuoy size={15} aria-hidden className="shrink-0" />
              <span>
                <strong className="text-foreground">{naFila.length}</strong> na
                fila
                {maisAntigo && (
                  <>
                    {" "}· mais antigo {idadeAberto(maisAntigo.created_at)}
                  </>
                )}
              </span>
            </div>
            <div
              role="group"
              aria-label="Filtrar por fila"
              className="flex flex-wrap gap-1.5"
            >
              {(
                [
                  ["todos", "Todos"],
                  ["fila", "Na fila"],
                  ["semdono", "Sem dono"],
                  ["meus", "Meus"],
                  ["resolvidos", "Resolvidos"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setFFila(v)}
                  aria-pressed={fFila === v}
                  className={cn(
                    "min-h-11 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8",
                    fFila === v
                      ? "border-transparent bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  {l}{" "}
                  <span
                    className={cn(
                      "text-[10px] font-semibold tabular-nums",
                      fFila === v ? "opacity-70" : "text-muted-foreground"
                    )}
                  >
                    {contFila[v]}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={fCategoria}
                onValueChange={(v) => setFCategoria(v ?? "todas")}
              >
                <SelectTrigger
                  className="h-11 w-auto min-w-32 max-w-48 text-xs md:h-8"
                  aria-label="Filtrar por categoria"
                >
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {Object.entries(CHAMADO_CATEGORIA_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={fStatus}
                onValueChange={(v) => setFStatus(v ?? "todos")}
              >
                <SelectTrigger
                  className="h-11 w-auto min-w-32 max-w-48 text-xs md:h-8"
                  aria-label="Filtrar por estado"
                >
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os estados</SelectItem>
                  {Object.entries(CHAMADO_STATUS_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nº, assunto ou autor…"
                aria-label="Buscar chamado"
                className="h-11 w-full text-sm md:h-8 md:max-w-52"
              />
            </div>
          </div>
        )}
        {!staff && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nos seus chamados…"
              aria-label="Buscar chamado"
              className="h-11 max-w-72 text-sm md:h-9"
            />
            <NovoChamadoDialog
              papel={papel}
              trigger={
                <Button size="sm">
                  <Plus size={15} aria-hidden />
                  Novo pedido
                </Button>
              }
            />
          </div>
        )}
        {staff && (
          <div className="mb-3 flex justify-end">
            <NovoChamadoDialog
              papel={papel}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus size={15} aria-hidden />
                  Abrir chamado
                </Button>
              }
            />
          </div>
        )}
        <ul className="space-y-2">
          {filtrados.length === 0 && (
            <li className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
              {staff
                ? "Nenhum chamado nessa visão. Bom trabalho de fila!"
                : "Você ainda não abriu nenhum pedido. Se precisar, é só tocar em “Novo pedido”."}
            </li>
          )}
          {filtrados.map((c) => (
            <li key={c.id} className="min-w-0">
              <button
                onClick={() => abrir(c.id)}
                aria-current={sel === c.id ? "true" : undefined}
                className={cn(
                  "block w-full min-w-0 rounded-xl border bg-card px-4 py-3 text-left shadow-[var(--shadow-border)] transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sel === c.id ? "border-foreground/30 ring-1 ring-foreground/20" : "border-transparent"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.numero}
                  </span>
                  <CategoriaBadge categoria={c.categoria} />
                  <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <time dateTime={c.created_at}>{relTempo(c.created_at)}</time>
                    <CaretRight size={12} aria-hidden />
                  </span>
                </div>
                <p className="mt-1 break-words text-sm font-medium leading-snug">
                  {c.restrito
                    ? "Chamado restrito à coordenação"
                    : c.assunto}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.restrito
                    ? "Assunto e autor visíveis só pra coordenação."
                    : staff
                      ? [
                          c.autor_nome ? `por ${c.autor_nome}` : null,
                          CHAMADO_ORIGEM_LABEL[c.origem],
                          c.contexto,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : `Atualizado ${relTempo(c.updated_at)}`}
                </p>
                <div className="mt-1.5">
                  <ChamadoStatusBadge
                    status={c.status}
                    dono={c.restrito ? null : c.atribuido_nome}
                    restrito={c.restrito}
                    visao={staff ? "staff" : "autor"}
                    className="text-[11px]"
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {staff && (
        <section aria-label="Detalhe do chamado" className={cn("min-w-0", !sel && "hidden lg:block")}>
          {detalhe ? (
            <ChamadoDetalhe
              key={detalhe.chamado.id}
              papel={papel}
              meuId={meuId}
              meuNome={meuNome}
              chamado={detalhe.chamado}
              timeline={detalhe.timeline}
              equipe={detalhe.equipe}
              onVoltar={fechar}
            />
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              <ChatCircleText size={28} aria-hidden />
              Selecione um chamado da fila pra ver a conversa.
            </div>
          )}
        </section>
      )}
      {!staff && sel && detalhe && (
        <section aria-label="Detalhe do pedido" className="min-w-0">
          <ChamadoDetalhe
            key={detalhe.chamado.id}
            papel={papel}
            meuId={meuId}
            meuNome={meuNome}
            chamado={detalhe.chamado}
            timeline={detalhe.timeline}
            equipe={detalhe.equipe}
            onVoltar={fechar}
          />
        </section>
      )}
    </div>
  );
}

export function ChamadoDetalhe({
  papel,
  meuId,
  meuNome,
  chamado,
  timeline,
  equipe,
  onVoltar,
  voltarDesktop,
}: {
  papel: Papel;
  meuId: string;
  meuNome: string;
  chamado: ChamadoFilaItem;
  timeline: ChamadoTimelineItem[];
  equipe: Equipe;
  onVoltar: () => void;
  /** O voltar some no desktop quando a lista continua visível ao lado
   *  (master-detail do staff). Onde o detalhe SUBSTITUI a lista (perfil
   *  do jovem), ele fica sempre — senão vira beco sem saída. */
  voltarDesktop?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const staff = papel === "coordenacao" || papel === "supervisor";
  const souDono = chamado.atribuido_a === meuId;
  const podeTratar = !chamado.restrito && chamado.status !== "resolvido";
  const [resolveOpen, setResolveOpen] = useState(false);
  const [atribuirOpen, setAtribuirOpen] = useState(false);
  const [resumo, setResumo] = useState("");
  const [para, setPara] = useState<string>(chamado.atribuido_a ?? "");
  /** "acabou de chegar" por identidade, não por janela de relógio: no envio
   *  a gente fotografa os ids da trilha — o que volta do refresh com id
   *  fora da foto (o item postado, ou algo que chegou junto) entra com
   *  animação + chip "agora". A foto expira em ~5s pra não eternizar. */
  const [fotoTrilha, setFotoTrilha] = useState<Set<string> | null>(null);
  const timerMarca = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timerMarca.current) clearTimeout(timerMarca.current);
    },
    []
  );

  function registrarEnvio() {
    setFotoTrilha(new Set(timeline.map((t) => t.item.id)));
    if (timerMarca.current) clearTimeout(timerMarca.current);
    timerMarca.current = setTimeout(() => setFotoTrilha(null), 5000);
  }

  function acao(fn: () => Promise<{ ok?: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else {
        toast.success(okMsg);
        router.refresh();
      }
    });
  }

  const passos = [
    {
      rotulo: "Recebido",
      feito: true,
      atual: false,
      detalhe: formatDiaMes(chamado.created_at),
    },
    chamado.status === "resolvido"
      ? {
          rotulo: "Em atendimento",
          feito: true,
          atual: false,
          detalhe: "",
        }
      : chamado.status === "em_atendimento"
        ? {
            rotulo: "Em atendimento",
            feito: false,
            atual: true,
            detalhe: chamado.atribuido_nome
              ? `com ${primeiroNome(chamado.atribuido_nome)}`
              : "a equipe está vendo",
          }
        : {
            rotulo: "Aguardando",
            feito: false,
            atual: true,
            detalhe: "ninguém assumiu ainda",
          },
    {
      rotulo: "Resolvido",
      feito: chamado.status === "resolvido",
      atual: chamado.status === "resolvido",
      detalhe: chamado.resolvido_em ? formatDiaMes(chamado.resolvido_em) : "—",
    },
  ];

  return (
    <article className="min-w-0 overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      <div className="border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex items-start gap-3">
          <button
            onClick={onVoltar}
            aria-label="Voltar pra lista"
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8",
              voltarDesktop ? "lg:grid" : "lg:hidden"
            )}
          >
            <ArrowLeft size={17} aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-xs text-muted-foreground">
                {chamado.numero}
              </span>
              <CategoriaBadge categoria={chamado.categoria} />
              <ChamadoStatusBadge
                status={chamado.status}
                dono={chamado.restrito ? null : chamado.atribuido_nome}
                restrito={chamado.restrito}
                visao={staff ? "staff" : "autor"}
              />
              {staff && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {CHAMADO_ORIGEM_LABEL[chamado.origem]}
                </span>
              )}
            </div>
            <h2 className="mt-1.5 break-words text-base font-semibold leading-snug sm:text-lg">
              {chamado.restrito ? "Chamado restrito à coordenação" : chamado.assunto}
            </h2>
          </div>
        </div>

        {/* stepper do "seu pedido" — só pro autor; a equipe lê a fila */}
        {!staff && (
          <ol
            className="mt-4 grid grid-cols-3 gap-2"
            aria-label="Andamento do chamado"
          >
            {passos.map((p, i) => {
              // mock: cor semântica mora SÓ no ícone — etapa atual ganha a
              // borda marcada neutra, feito fica neutro, futuro é tracejado
              const cor = p.atual
                ? "border-foreground/40"
                : p.feito
                  ? "border-border"
                  : "border-dashed border-border";
              const IconePasso = p.feito
                ? CheckCircle
                : i === 2
                  ? CheckCircle
                  : p.atual && chamado.status === "aberto"
                    ? WarningCircle
                    : Clock;
              const iconeCor = p.atual
                ? chamado.status === "aberto"
                  ? "text-destructive"
                  : chamado.status === "resolvido"
                    ? "text-[var(--ok-text)]"
                    : "text-[var(--warn-text)]"
                : p.feito
                  ? "text-[var(--ok-text)]"
                  : "text-muted-foreground";
              return (
                <li
                  key={p.rotulo}
                  aria-current={p.atual ? "step" : undefined}
                  className={cn("rounded-lg border px-2.5 py-2", cor)}
                >
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs font-medium",
                      p.feito || p.atual ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <IconePasso size={13} aria-hidden className={iconeCor} />
                    {p.rotulo}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                    {p.detalhe}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {/* fatos do chamado — a linha "quem/o quê/com quem" do mock */}
        {!chamado.restrito && (
          <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {staff ? (
              <>
                <FatoChamado
                  rotulo="Autor(a)"
                  valor={chamado.autor_nome ?? "—"}
                />
                <FatoChamado
                  rotulo="Contexto"
                  valor={chamado.contexto ?? "—"}
                />
                <FatoChamado
                  rotulo="Responsável"
                  valor={
                    chamado.atribuido_nome ??
                    (chamado.status === "aberto" ? "Sem dono" : "—")
                  }
                />
                <FatoChamado
                  rotulo="Aberto em"
                  valor={`${formatDiaMes(chamado.created_at)} · ${relTempo(chamado.created_at)}`}
                />
              </>
            ) : (
              <>
                <FatoChamado
                  rotulo="Quem cuida"
                  valor={
                    chamado.atribuido_nome
                      ? primeiroNome(chamado.atribuido_nome)
                      : "Ainda sem responsável"
                  }
                />
                <FatoChamado
                  rotulo="Aberto em"
                  valor={formatDiaMes(chamado.created_at)}
                />
              </>
            )}
          </dl>
        )}

        {/* pedido original — a mensagem que abriu o chamado não aparecia */}
        {!chamado.restrito && chamado.mensagem && (
          <div className="mt-3.5 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {staff
                ? `Pedido original · ${chamado.autor_nome ?? "autor"}`
                : "Você escreveu"}
            </h3>
            <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-foreground/90">
              {chamado.mensagem}
            </p>
          </div>
        )}
      </div>

      {/* ações da equipe */}
      {staff && !chamado.restrito && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5 sm:px-5">
          {chamado.status !== "resolvido" && (
            <>
              {(!chamado.atribuido_a || papel === "coordenacao") && !souDono && (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => acao(() => assumirChamado(chamado.id), "Chamado assumido — é com você.")}
                >
                  {chamado.atribuido_nome
                    ? `Assumir de ${chamado.atribuido_nome}`
                    : "Assumir"}
                </Button>
              )}
              {(souDono || papel === "coordenacao") && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setResolveOpen(true)}
                >
                  Resolver
                </Button>
              )}
              {papel === "coordenacao" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => setAtribuirOpen(true)}
                >
                  Atribuir
                </Button>
              )}
              {(souDono || papel === "coordenacao") && chamado.atribuido_a && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => acao(() => devolverChamadoFila(chamado.id), "Chamado devolvido à fila.")}
                >
                  Devolver à fila
                </Button>
              )}
            </>
          )}
          {chamado.status === "resolvido" && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => acao(() => reabrirChamado(chamado.id), "Chamado reaberto.")}
            >
              Reabrir
            </Button>
          )}
        </div>
      )}
      {staff && chamado.restrito && (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-5">
          <Lock size={15} aria-hidden className="shrink-0" />
          <span>
            <strong className="text-foreground">Chamado restrito à coordenação.</strong>{" "}
            Chamados de plataforma são tratados pela coordenação — assunto,
            autor e conversa não aparecem pra supervisão.
          </span>
        </div>
      )}

      {/* linha do tempo — restrito (plataforma pro auxiliar) não revela nem
          a existência da conversa: no banco a RLS já devolve vazio */}
      {!chamado.restrito && (
        <div>
          {staff && (
            <div
              role="group"
              aria-label="Legenda da trilha"
              className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-5"
            >
              <span className="font-medium text-foreground/80">Legenda</span>
              <span className="flex items-center gap-1">
                <Eye size={12} aria-hidden /> Pública — o autor vê
              </span>
              <span className="flex items-center gap-1">
                <EyeSlash size={12} aria-hidden /> Interna — só a equipe
              </span>
              <span className="flex items-center gap-1">
                <Sparkle size={12} aria-hidden /> Automática — do sistema
              </span>
            </div>
          )}
          {!staff && timeline.length > 0 && (
            <p className="border-b border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-5">
              Você vê o que a equipe publica pra você — e o que acrescentou.
            </p>
          )}
          <ol className="divide-y divide-border/60 px-4 sm:px-5" aria-label="Conversa">
            {timeline.map((t) => (
              <TimelineItem
                key={`${t.tipo}-${t.item.id}`}
                entry={t}
                meuId={meuId}
                staff={staff}
                recente={
                  fotoTrilha !== null && !fotoTrilha.has(t.item.id)
                }
              />
            ))}
            {timeline.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                A conversa começa quando a equipe responder.
              </li>
            )}
          </ol>
        </div>
      )}

      {/* resolução visível pra todos */}
      {chamado.status === "resolvido" && chamado.resolucao_resumo && (
        <div className="border-t border-border bg-[var(--ok)]/10 px-4 py-3.5 text-sm sm:px-5">
          <strong className="flex items-center gap-1.5 text-[var(--ok-text)]">
            <CheckCircle size={15} aria-hidden />
            Resolvido
          </strong>
          {chamado.resolvido_em && (
            <span className="text-muted-foreground">
              {" "}· {formatDiaMes(chamado.resolvido_em)}
            </span>
          )}
          <p className="mt-1 break-words leading-relaxed">{chamado.resolucao_resumo}</p>
        </div>
      )}

      {/* composer */}
      {staff && podeTratar && (
        <ChamadoComposer
          chamadoId={chamado.id}
          equipe={equipe}
          meuId={meuId}
          autorId={chamado.autor_id}
          autorNome={chamado.autor_nome ?? "o autor"}
          pending={pending}
          onEnviou={registrarEnvio}
        />
      )}
      {!staff && (
        <div className="border-t border-border px-4 py-4 sm:px-5">
          {chamado.status === "resolvido" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ainda precisa de ajuda com isso? Peça a reabertura — a equipe é
                avisada e o chamado volta pra fila.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  acao(() => pedirReaberturaChamado(chamado.id), "Pedido enviado — a equipe retoma o chamado.")
                }
              >
                Pedir reabertura
              </Button>
            </div>
          ) : (
            <AutorComposer
              chamadoId={chamado.id}
              meuId={meuId}
              meuNome={meuNome}
              pending={pending}
              onEnviou={registrarEnvio}
            />
          )}
        </div>
      )}

      {/* dialog resolver */}
      <Dialog
        open={resolveOpen}
        onOpenChange={(o) => {
          setResolveOpen(o);
          if (!o) setResumo(""); // fechar (ou resolver) larga o rascunho
        }}
      >
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Resolver {chamado.numero}</DialogTitle>
            <DialogDescription>
              O resumo vai pro autor como resposta final e fica na trilha do
              chamado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="resumo-resolucao">Resumo da resolução</Label>
            <Textarea
              id="resumo-resolucao"
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Ex.: conversei com o mentor e o encontro foi reagendado pra quinta."
            />
          </div>
          <DialogFooter>
            <Button
              disabled={pending || resumo.trim().length < 2}
              onClick={() => {
                acao(
                  () => resolverChamado(chamado.id, resumo),
                  "Chamado resolvido."
                );
                setResolveOpen(false);
              }}
            >
              Marcar como resolvido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* dialog atribuir */}
      <Dialog
        open={atribuirOpen}
        onOpenChange={(o) => {
          setAtribuirOpen(o);
          // ressincroniza com o dono atual — abre espelhando o real e não
          // carrega uma seleção abandonada da vez passada
          setPara(chamado.atribuido_a ?? "");
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Atribuir {chamado.numero}</DialogTitle>
            <DialogDescription>
              Quem assumir trata. Auxiliar executivo só recebe chamado não
              técnico.
            </DialogDescription>
          </DialogHeader>
          <Select value={para} onValueChange={(v) => setPara(v ?? "")}>
            <SelectTrigger aria-label="Responsável">
              <SelectValue placeholder="Escolha o responsável" />
            </SelectTrigger>
            <SelectContent>
              {equipe.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome_social || p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending || !chamado.atribuido_a}
              onClick={() => {
                acao(() => atribuirChamado(chamado.id, null), "Chamado devolvido à fila.");
                setAtribuirOpen(false);
              }}
            >
              Tirar responsável
            </Button>
            <Button
              disabled={pending || !para}
              onClick={() => {
                acao(
                  () => atribuirChamado(chamado.id, para),
                  "Chamado atribuído."
                );
                setAtribuirOpen(false);
              }}
            >
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function FatoChamado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {rotulo}
      </dt>
      <dd className="mt-0.5 truncate text-xs font-medium text-foreground">
        {valor}
      </dd>
    </div>
  );
}

/** Tag de audiência do item da trilha (molde .tag do v5) — só a equipe vê:
 *  o autor recebe uma trilha única e limpa, sem jargão de "pública". */
function TagTrilha({ tipo }: { tipo: "publica" | "interno" | "sistema" }) {
  const conf = {
    publica: { rotulo: "Pública", Icone: Eye, cls: "border-border text-muted-foreground" },
    interno: { rotulo: "Interna", Icone: EyeSlash, cls: "border-dashed border-[var(--warn)]/60 text-[var(--warn-text)]" },
    sistema: { rotulo: "Automática", Icone: Sparkle, cls: "border-dashed border-border text-muted-foreground" },
  }[tipo];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider",
        conf.cls
      )}
    >
      <conf.Icone size={10} aria-hidden />
      {conf.rotulo}
    </span>
  );
}

function TimelineItem({
  entry,
  meuId,
  staff,
  recente,
}: {
  entry: ChamadoTimelineItem;
  meuId: string;
  staff: boolean;
  /** acabou de chegar por envio meu — entra animado com halo + chip "agora" */
  recente?: boolean;
}) {
  const reduz = useReducedMotion();
  // scroll pro item novo — uma vez só. O callback-ref recriado a cada
  // render re-disparava o scroll em qualquer re-render do detalhe; com
  // effect + flag ele acontece só na chegada do item.
  const liRef = useRef<HTMLLIElement | null>(null);
  const rolouRef = useRef(false);
  useEffect(() => {
    if (!recente || rolouRef.current) return;
    rolouRef.current = true;
    liRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduz ? "auto" : "smooth",
    });
  }, [recente, reduz]);
  const quando = (
    <time
      dateTime={entry.item.created_at}
      className="shrink-0 text-[11px] text-muted-foreground"
    >
      {relTempo(entry.item.created_at)}
    </time>
  );
  const chipAgora = recente && (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--ok)]/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-[var(--ok-text)]">
      agora
    </span>
  );
  // halo ok-tinted que evapora — a "chegada" do item novo na trilha
  const halo = recente && (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-0 -mx-4 rounded-lg bg-[var(--ok)]/10 sm:-mx-5"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
    />
  );

  if (entry.tipo === "sistema") {
    return (
      <ItemTrilha recente={recente} refEl={liRef} halo={halo} className="py-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkle size={13} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1 break-words">{entry.item.texto}</span>
          {staff && <TagTrilha tipo="sistema" />}
          {chipAgora}
          {quando}
        </div>
      </ItemTrilha>
    );
  }
  if (entry.tipo === "anexo") {
    const a = entry.item as ChamadoAnexo;
    const href = `/api/chamado-anexo/${a.id}`;
    const tipo = tipoAnexo(a.mime);
    return (
      <ItemTrilha recente={recente} refEl={liRef} halo={halo} className="py-3">
        <div className="flex items-center gap-2 text-xs">
          <Paperclip size={13} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            <strong className="font-medium text-foreground">Anexo</strong>
            <span className="text-muted-foreground">
              {a.autor_nome ? ` · ${a.autor_nome}` : ""}
            </span>
          </span>
          {staff && <TagTrilha tipo={a.interno ? "interno" : "publica"} />}
          {chipAgora}
          {quando}
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 flex w-full max-w-md min-w-0 items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-2 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AnexoThumb src={href} mime={a.mime} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{a.nome}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {ROTULO_ANEXO[tipo]}
              {a.tamanho ? ` · ${formatTamanho(a.tamanho)}` : ""}
              {" · "}abre em nova aba
            </span>
          </span>
          <ArrowSquareOut size={14} aria-hidden className="shrink-0 text-muted-foreground" />
        </a>
      </ItemTrilha>
    );
  }
  const interno = entry.tipo === "interno";
  const autor =
    "autor_nome" in entry.item ? entry.item.autor_nome : null;
  const souEu = "autor_id" in entry.item && entry.item.autor_id === meuId;
  return (
    <ItemTrilha
      recente={recente}
      refEl={liRef}
      halo={halo}
      className={cn(
        "py-3.5",
        interno &&
          "my-1 rounded-lg border border-dashed border-[var(--warn)]/50 bg-[var(--warn)]/8 px-3.5"
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar nome={autor ?? "Equipe"} size={20} />
        <span className="min-w-0 truncate text-sm font-medium">
          {souEu ? "Você" : (autor ?? "Equipe")}
        </span>
        {staff && <TagTrilha tipo={interno ? "interno" : "publica"} />}
        {chipAgora}
        <span className="ml-auto">{quando}</span>
      </div>
      <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-foreground/90">
        {entry.item.texto}
      </p>
    </ItemTrilha>
  );
}

/** <li> da trilha que vira motion.li quando `recente` — entrada ~300ms com
 *  halo verde evaporando (o "acabou de chegar" do mock, tl-in). */
function ItemTrilha({
  recente,
  refEl,
  halo,
  className,
  children,
}: {
  recente?: boolean;
  refEl: React.RefObject<HTMLLIElement | null>;
  halo: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  if (recente) {
    return (
      <motion.li
        ref={refEl}
        className={cn("relative", className)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: EASE }}
      >
        {halo}
        {children}
      </motion.li>
    );
  }
  return <li className={className}>{children}</li>;
}

// ---------- composer da equipe ----------

type Mencao = { id: string; nome: string; token: string | null };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "@prefixo" imediatamente antes do cursor → {inicio, prefixo}. O @ precisa
 *  estar no início do texto ou depois de espaço — e-mail (a@b) não dispara. */
function consultaMencao(
  valor: string,
  caret: number
): { inicio: number; prefixo: string } | null {
  const antes = valor.slice(0, caret);
  const ultimo = antes.lastIndexOf("@");
  if (ultimo === -1) return null;
  if (ultimo > 0 && !/[\s(]/.test(antes[ultimo - 1])) return null;
  const prefixo = antes.slice(ultimo + 1);
  if (/[\s@]/.test(prefixo)) return null;
  return { inicio: ultimo, prefixo };
}

const rotuloEquipe = (role: string | null | undefined) =>
  role === "coordenacao" ? "Coordenação" : role === "supervisor" ? "Auxiliar executivo" : null;

/** Composer da equipe: comentário interno × atualização pública. O "@" abre
 *  autocomplete da equipe (listbox), quem é marcado vira chip removível e
 *  recebe notificação no app — o comentário interno nunca sai por e-mail.
 *  O autor do chamado e quem escreve não entram como alvo. Mentor não vê
 *  este composer (o dele é o AutorComposer, sem menções). */
function ChamadoComposer({
  chamadoId,
  equipe,
  meuId,
  autorId,
  autorNome,
  pending,
  onEnviou,
}: {
  chamadoId: string;
  equipe: Equipe;
  meuId: string;
  autorId: string | null;
  autorNome: string;
  pending: boolean;
  onEnviou?: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [modo, setModo] = useState<"interno" | "publico">("interno");
  const [texto, setTexto] = useState("");
  const [mencoes, setMencoes] = useState<Mencao[]>([]);
  const [consulta, setConsulta] = useState<{
    inicio: number;
    prefixo: string;
  } | null>(null);
  const [ativo, setAtivo] = useState(0);
  // "texto" × "anexo" — o ✓ do botão diz o que de fato saiu
  const [enviado, setEnviado] = useState<"texto" | "anexo" | null>(null);
  const anexos = useAnexosPendentes(chamadoId, meuId);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const timerOk = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listaId = useId();
  useEffect(
    () => () => {
      if (timerOk.current) clearTimeout(timerOk.current);
    },
    []
  );

  const nomeDe = (p: EquipeLinha) => p.nome_social || p.nome;
  const marcadasIds = useMemo(
    () => new Set(mencoes.map((m) => m.id)),
    [mencoes]
  );

  /** linhas do listbox: equipe filtrada pelo prefixo — eu, o autor e quem já
   *  está marcada entram como linhas desabilitadas (transparência do "por
   *  que não dá pra marcar") em vez de sumir em silêncio. */
  const linhasMencao = useMemo(() => {
    if (!consulta || modo !== "interno") return [];
    const q = normaliza(consulta.prefixo);
    return equipe
      .filter((p) => normaliza(nomeDe(p)).includes(q))
      .map((p) => ({
        pessoa: p,
        estado:
          p.id === meuId
            ? ("voce" as const)
            : p.id === autorId
              ? ("autor" as const)
              : marcadasIds.has(p.id)
                ? ("marcada" as const)
                : ("livre" as const),
      }));
  }, [consulta, modo, equipe, meuId, autorId, marcadasIds]);

  const selecionaveis = linhasMencao.filter((l) => l.estado === "livre");
  const ativoOk = Math.min(ativo, Math.max(0, selecionaveis.length - 1));
  const popAberto = consulta !== null && modo === "interno" && equipe.length > 0;

  /** Fim de token: espaço, fim do texto OU pontuação que fecha a menção —
   *  "@Paula)," e "@Paula." mantêm o chip (antes só \s|$ desmarcava). */
  function tokenPresente(t: string, token: string) {
    return new RegExp(`${escapeRe(token)}(?=[\\s.,;:!?)]|$)`).test(t);
  }

  function marcar(p: EquipeLinha, comToken: boolean) {
    if (p.id === meuId || p.id === autorId || marcadasIds.has(p.id)) return;
    const nome = nomeDe(p);
    let novoCaret: number | null = null;
    let token: string | null = null;
    if (comToken) {
      const el = taRef.current;
      const caret = el?.selectionStart ?? texto.length;
      const c = consulta ?? consultaMencao(texto, caret);
      token = `@${nome}`;
      let novo: string;
      if (c) {
        novo = texto.slice(0, c.inicio) + token + " " + texto.slice(caret);
        novoCaret = c.inicio + token.length + 1;
      } else {
        const base = texto.replace(/\s+$/, "");
        novo = base ? `${base} ${token} ` : `${token} `;
        novoCaret = novo.length;
      }
      setTexto(novo);
      setMencoes((m) => [...m, { id: p.id, nome, token }]);
      setConsulta(null);
    } else {
      setMencoes((m) => [...m, { id: p.id, nome, token: null }]);
    }
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      if (novoCaret !== null) el.setSelectionRange(novoCaret, novoCaret);
    });
  }

  function desmarcar(id: string) {
    const m = mencoes.find((x) => x.id === id);
    const token = m?.token;
    if (token) {
      // flag global: primeira ocorrência podia ser texto solto idêntico ao
      // token — tirar todas garante que chip e texto nunca divergem
      setTexto((t) =>
        t.replace(new RegExp(`${escapeRe(token)}(?=[\\s.,;:!?)]|$)`, "g"), "")
      );
    }
    setMencoes((l) => l.filter((x) => x.id !== id));
  }

  function mudarTexto(e: ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setTexto(v);
    // token apagado no texto desmarca a pessoa — chip e texto nunca divergem
    setMencoes((l) =>
      l.filter((m) => !m.token || tokenPresente(v, m.token))
    );
    const c = consultaMencao(v, e.target.selectionStart ?? v.length);
    setConsulta(modo === "interno" ? c : null);
    if (c) setAtivo(0);
  }

  function teclaTexto(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!popAberto) return;
    if (e.key === "ArrowDown" && selecionaveis.length) {
      e.preventDefault();
      setAtivo((i) => (i + 1) % selecionaveis.length);
    } else if (e.key === "ArrowUp" && selecionaveis.length) {
      e.preventDefault();
      setAtivo((i) => (i - 1 + selecionaveis.length) % selecionaveis.length);
    } else if (e.key === "Enter" && selecionaveis[ativoOk]) {
      e.preventDefault();
      marcar(selecionaveis[ativoOk].pessoa, true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setConsulta(null);
    }
  }

  function aoMoverCursor(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const c = consultaMencao(el.value, el.selectionStart ?? 0);
    if ((c === null) !== (consulta === null) || c?.prefixo !== consulta?.prefixo) {
      setConsulta(modo === "interno" ? c : null);
    }
  }

  function enviar() {
    const t = texto.trim();
    if (!t && anexos.pendentes.length === 0) return;
    start(async () => {
      let falhou = false;
      let saiu = false;
      if (t) {
        const r =
          modo === "interno"
            ? await comentarChamado(chamadoId, t, mencoes.map((m) => m.id))
            : await publicarAtualizacaoChamado(chamadoId, t);
        if (r.error) {
          toast.error(r.error);
          falhou = true;
        } else {
          saiu = true;
          // o texto já publicou — limpa agora: se um anexo falhar, o retry
          // manda só o arquivo (antes repostava o comentário)
          setTexto("");
          setMencoes([]);
          setConsulta(null);
        }
      }
      if (!falhou && anexos.pendentes.length) {
        const falhas = await anexos.enviar(modo === "interno");
        if (falhas) {
          toast.error(
            falhas === 1
              ? "Um anexo não subiu — ele continua na lista pra você tentar de novo."
              : `${falhas} anexos não subiram — eles continuam na lista pra você tentar de novo.`
          );
          falhou = true;
        }
        if (falhas < anexos.pendentes.length) saiu = true;
      }
      // publicação parcial também já tá na trilha — refresh/marca mesmo com
      // retry de anexo pendente (o usuário vê que o texto foi)
      if (saiu) {
        onEnviou?.();
        router.refresh();
      }
      if (falhou) return;
      toast.success(
        t
          ? modo === "interno"
            ? "Comentário interno registrado — só a equipe vê."
            : "Atualização enviada ao autor."
          : modo === "interno"
            ? "Anexo enviado — só a equipe vê."
            : "Anexo enviado ao autor."
      );
      setEnviado(t ? "texto" : "anexo");
      if (timerOk.current) clearTimeout(timerOk.current);
      timerOk.current = setTimeout(() => setEnviado(null), 1600);
    });
  }

  return (
    <div
      className={cn(
        "border-t px-4 py-4 sm:px-5",
        modo === "interno"
          ? "border-[var(--warn)]/40 bg-[var(--warn)]/[0.05]"
          : "border-border"
      )}
    >
      <div
        role="group"
        aria-label="Tipo de mensagem"
        className="mb-3 inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm"
      >
        {(
          [
            ["interno", "Comentário interno", EyeSlash],
            ["publico", "Resposta ao autor", PaperPlaneRight],
          ] as const
        ).map(([v, l, Icone]) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setModo(v);
              setConsulta(null);
            }}
            aria-pressed={modo === v}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8",
              modo === v
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icone size={13} aria-hidden />
            {l}
          </button>
        ))}
      </div>

      {/* chips de quem será marcado — vivem acima do campo, como no mock */}
      {modo === "interno" && mencoes.length > 0 && (
        <div
          role="group"
          className="mb-2 flex flex-wrap items-center gap-1.5"
          aria-label="Pessoas marcadas"
        >
          {mencoes.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--warn)]/50 bg-card py-0.5 pl-1.5 pr-1 text-xs"
            >
              <Avatar nome={m.nome} size={18} />
              <span className="font-medium">{m.nome}</span>
              <button
                type="button"
                onClick={() => desmarcar(m.id)}
                aria-label={`Remover marcação de ${m.nome}`}
                className="-my-1.5 -ml-0.5 -mr-1 grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8"
              >
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
          <span className="text-[11px] text-[var(--warn-text)]">
            {mencoes.length === 1
              ? "1 pessoa será notificada no app"
              : `${mencoes.length} pessoas serão notificadas no app`}
          </span>
        </div>
      )}

      <div className="relative">
        <Textarea
          ref={taRef}
          value={texto}
          onChange={mudarTexto}
          onKeyDown={teclaTexto}
          onSelect={aoMoverCursor}
          onClick={aoMoverCursor}
          onBlur={() => setConsulta(null)}
          rows={3}
          maxLength={4000}
          aria-label={modo === "interno" ? "Comentário interno" : "Resposta ao autor"}
          aria-expanded={popAberto}
          aria-controls={popAberto ? listaId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            popAberto && selecionaveis[ativoOk]
              ? `${listaId}-${selecionaveis[ativoOk].pessoa.id}`
              : undefined
          }
          placeholder={
            modo === "interno"
              ? `Só a equipe vê — ${autorNome} não é notificado. Digite @ pra marcar alguém da equipe.`
              : `Escreva a resposta que vai pra ${autorNome}…`
          }
        />
        {/* listbox do "@" — popover ancorado acima do campo (molde .m-pop) */}
        {popAberto && (
          <div className="absolute bottom-full left-0 z-10 mb-1.5 w-full min-w-0 max-w-80">
            <ul
              role="listbox"
              id={listaId}
              aria-label="Marcar alguém da equipe"
              className="overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-[var(--shadow-overlay)]"
            >
              <li
                role="presentation"
                className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Marcar alguém — continue digitando pra filtrar
              </li>
              {linhasMencao.map((l) => {
                const nome = nomeDe(l.pessoa);
                const idxSel = l.estado === "livre"
                  ? selecionaveis.findIndex((s) => s.pessoa.id === l.pessoa.id)
                  : -1;
                const desabilitada = l.estado !== "livre";
                return (
                  <li
                    key={l.pessoa.id}
                    id={idxSel >= 0 ? `${listaId}-${l.pessoa.id}` : undefined}
                    role="option"
                    aria-selected={idxSel === ativoOk && idxSel >= 0}
                    aria-disabled={desabilitada || undefined}
                    onMouseDown={(e) => e.preventDefault()} // clique não tira o foco do campo
                    onClick={() => !desabilitada && marcar(l.pessoa, true)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 px-3 py-1.5 text-sm",
                      idxSel === ativoOk && idxSel >= 0 && "bg-muted",
                      desabilitada
                        ? "cursor-default opacity-55"
                        : "hover:bg-muted"
                    )}
                  >
                    <Avatar nome={nome} size={20} />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {nome}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {l.estado === "voce"
                        ? "você"
                        : l.estado === "autor"
                          ? "autor(a) do chamado"
                          : l.estado === "marcada"
                            ? "marcada"
                            : rotuloEquipe(l.pessoa.role)}
                    </span>
                  </li>
                );
              })}
              {linhasMencao.length === 0 && (
                <li
                  role="option"
                  aria-selected={false}
                  aria-disabled="true"
                  className="px-3 py-2 text-xs text-muted-foreground"
                >
                  Ninguém da equipe com esse nome.
                </li>
              )}
              <li
                role="presentation"
                aria-hidden
                className="border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground"
              >
                <kbd className="rounded border border-border bg-muted px-1">↑↓</kbd>{" "}
                navega ·{" "}
                <kbd className="rounded border border-border bg-muted px-1">Enter</kbd>{" "}
                marca ·{" "}
                <kbd className="rounded border border-border bg-muted px-1">Esc</kbd>{" "}
                fecha
              </li>
            </ul>
          </div>
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {modo === "interno" ? (
          <>
            Só a equipe vê. {autorNome} não é notificado. Digite{" "}
            <kbd className="rounded border border-border bg-muted px-1">@</kbd>{" "}
            pra marcar alguém — ou use “+ pessoas”. Marcados recebem
            notificação no app.
          </>
        ) : (
          <>
            Visível para {autorNome} — recebe notificação por e-mail e no app.
            Evite dados sensíveis de terceiros.
          </>
        )}
      </p>

      <AnexosPendentes
        itens={anexos.pendentes}
        interno={modo === "interno"}
        onRemover={anexos.remover}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <ChamadoAnexos onArquivo={anexos.adicionar} disabled={busy || pending} />
          {modo === "interno" && equipe.length > 0 && (
            <Popover>
              <PopoverTrigger
                // Label-in-Name: o nome acessível começa pelo rótulo visível
                aria-label="+ pessoas — marcar alguém da equipe"
                className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9"
              >
                <UserPlus size={15} aria-hidden />+ pessoas
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-72 max-w-[calc(100vw-2rem)] p-1.5">
                <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Marcar alguém da equipe
                </p>
                <ul>
                  {equipe.map((p) => {
                    const nome = nomeDe(p);
                    const souEu = p.id === meuId;
                    const eAutor = p.id === autorId;
                    const marcada = marcadasIds.has(p.id);
                    const travada = souEu || eAutor;
                    return (
                      <li key={p.id}>
                        <label
                          className={cn(
                            "flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-sm",
                            travada
                              ? "opacity-55"
                              : "cursor-pointer hover:bg-muted"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={marcada}
                            disabled={travada}
                            onChange={(e) =>
                              e.target.checked
                                ? marcar(p, false)
                                : desmarcar(p.id)
                            }
                            className="size-4 shrink-0 accent-[var(--brand-lime)]"
                          />
                          <Avatar nome={nome} size={20} />
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {nome}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {souEu
                              ? "você"
                              : eAutor
                                ? "autor(a)"
                                : marcada
                                  ? "marcada"
                                  : rotuloEquipe(p.role)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <p className="border-t border-border/60 px-2.5 py-2 text-[10px] text-muted-foreground">
                  Marcados viram chips acima do campo e recebem notificação no
                  app — nunca e-mail.
                </p>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <Button
          size="sm"
          disabled={
            !enviado &&
            (busy ||
              pending ||
              (!texto.trim() && anexos.pendentes.length === 0) ||
              anexos.pendentes.some((a) => a.status === "enviando"))
          }
          onClick={enviar}
          className={cn(
            "min-w-28 transition-colors",
            // o ✓ ficaria disabled (campo limpo) — fora do disabled E sem
            // o opacity-50, senão o verde de sucesso saía apagado
            enviado &&
              "bg-[var(--ok)] text-white hover:bg-[var(--ok)] disabled:opacity-100"
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {enviado ? (
              <motion.span
                key="ok"
                className="flex items-center gap-1.5"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.15, ease: EASE }}
              >
                <Check size={14} weight="bold" aria-hidden />
                {enviado === "texto" && modo === "interno"
                  ? "Comentário registrado"
                  : "Enviado"}
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                className="flex items-center gap-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: EASE }}
              >
                {busy && <CircleNotch size={14} className="animate-spin" aria-hidden />}
                {modo === "interno" ? "Comentar" : "Enviar ao autor"}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}

/** Composer do autor: acrescenta informação à trilha pública — sem menções
 *  (decisão do produto: @ é só pra equipe), anexos públicos pro staff. */
function AutorComposer({
  chamadoId,
  meuId,
  meuNome,
  pending,
  onEnviou,
}: {
  chamadoId: string;
  meuId: string;
  meuNome: string;
  pending: boolean;
  onEnviou?: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [texto, setTexto] = useState("");
  const [enviado, setEnviado] = useState(false);
  const anexos = useAnexosPendentes(chamadoId, meuId);
  const timerOk = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timerOk.current) clearTimeout(timerOk.current);
    },
    []
  );

  function enviar() {
    const t = texto.trim();
    if (!t && anexos.pendentes.length === 0) return;
    start(async () => {
      let falhou = false;
      let saiu = false;
      if (t) {
        const r = await acrescentarInfoChamado(chamadoId, t);
        if (r.error) {
          toast.error(r.error);
          falhou = true;
        } else {
          saiu = true;
          // saiu — o retry de um anexo falho não reposta o texto
          setTexto("");
        }
      }
      if (!falhou && anexos.pendentes.length) {
        const falhas = await anexos.enviar(false);
        if (falhas) {
          toast.error(
            falhas === 1
              ? "Um anexo não subiu — ele continua na lista pra você tentar de novo."
              : `${falhas} anexos não subiram — eles continuam na lista pra você tentar de novo.`
          );
          falhou = true;
        }
        if (falhas < anexos.pendentes.length) saiu = true;
      }
      // publicação parcial também já tá na trilha
      if (saiu) {
        onEnviou?.();
        router.refresh();
      }
      if (falhou) return;
      toast.success("Informação enviada à equipe.");
      setEnviado(true);
      if (timerOk.current) clearTimeout(timerOk.current);
      timerOk.current = setTimeout(() => setEnviado(false), 1600);
    });
  }

  return (
    <div>
      <Label htmlFor="autor-info" className="text-sm font-medium">
        Acrescentar informação
      </Label>
      <Textarea
        id="autor-info"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        maxLength={4000}
        className="mt-1.5"
        placeholder={`${meuNome.split(" ")[0]}, conte pra equipe se algo mudou ou se faltou detalhe…`}
      />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Só você e a equipe veem — ninguém mais recebe cópia.
      </p>
      <AnexosPendentes
        itens={anexos.pendentes}
        interno={false}
        visaoAutor
        onRemover={anexos.remover}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ChamadoAnexos onArquivo={anexos.adicionar} disabled={busy || pending} />
        <Button
          size="sm"
          disabled={
            !enviado &&
            (busy ||
              pending ||
              (!texto.trim() && anexos.pendentes.length === 0) ||
              anexos.pendentes.some((a) => a.status === "enviando"))
          }
          onClick={enviar}
          className={cn(
            "min-w-20 transition-colors",
            // o ✓ ficaria disabled (campo limpo) — fora do disabled E sem
            // o opacity-50, senão o verde de sucesso saía apagado
            enviado &&
              "bg-[var(--ok)] text-white hover:bg-[var(--ok)] disabled:opacity-100"
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {enviado ? (
              <motion.span
                key="ok"
                className="flex items-center gap-1.5"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.15, ease: EASE }}
              >
                <Check size={14} weight="bold" aria-hidden />
                Enviado
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                className="flex items-center gap-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: EASE }}
              >
                {busy && <CircleNotch size={14} className="animate-spin" aria-hidden />}
                Enviar
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}
