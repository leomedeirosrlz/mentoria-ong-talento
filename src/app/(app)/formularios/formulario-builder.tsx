"use client";

import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  Reorder,
  useDragControls,
  type DragControls,
} from "motion/react";
import { toast } from "sonner";
import {
  CalendarBlank,
  CaretDown,
  CaretUp,
  CheckSquare,
  Circle,
  CircleNotch,
  Copy,
  DotsSixVertical,
  DotsThreeVertical,
  Eye,
  FileArrowUp,
  Gauge,
  GridFour,
  ListBullets,
  ListChecks,
  PencilSimple,
  Plus,
  RadioButton,
  Rows,
  Star,
  TextAlignLeft,
  TextT,
  Trash,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { salvarFormulario } from "@/lib/forms/actions";
import {
  CAMPO_FORMATO_LABEL,
  CAMPO_TIPO_LABEL,
  camposPerguntas,
  MAX_CAMPOS,
  MAX_OPCOES,
  TIPOS_COM_OPCOES,
  type FormularioCampo,
  type FormularioCampoFormato,
  type FormularioCampoTipo,
} from "@/lib/forms/schema";
import { FormularioPublico } from "@/app/f/[token]/formulario-publico";
import { fade, T } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Rascunho de campo no editor — `opcoes` já é array de linhas (o textarea
 *  "uma por linha" morreu); `id` é estável entre edições porque as respostas
 *  gravadas apontam pra ele — duplicar sempre gera id novo. */
type DraftCampo = {
  id: string;
  tipo: FormularioCampoTipo;
  label: string;
  obrigatorio: boolean;
  opcoes: string[];
  /** só secao (0080) — texto de apoio sob o título */
  descricao: string;
  /** só texto (REALIZA-118) — ausente = texto livre, sem normalização */
  formato?: FormularioCampoFormato;
};

const novoId = () => `c_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

const CAMPO_TIPO_ICONE: Record<FormularioCampoTipo, Icon> = {
  texto: TextT,
  texto_longo: TextAlignLeft,
  select: ListBullets,
  multi_select: ListChecks,
  escala_1_5: Star,
  escala_1_10: Gauge,
  data: CalendarBlank,
  checkbox: CheckSquare,
  sim_nao: RadioButton,
  secao: Rows,
  arquivo: FileArrowUp,
  grid_disponibilidade: GridFour,
};

/** Tipos nascidos no intake oficial (0115): o builder não configura
 *  accept/max_mb do upload nem o fluxo privado do anexo, então forms
 *  custom não oferecem — chegam à base via migration (catálogo oficial).
 *  O ícone segue no mapa porque o picker itera CAMPO_TIPO_LABEL inteiro. */
const TIPOS_SO_OFICIAL: ReadonlySet<FormularioCampoTipo> = new Set([
  "arquivo",
  "grid_disponibilidade",
]);

function paraDraft(c: FormularioCampo): DraftCampo {
  return {
    id: c.id,
    tipo: c.tipo,
    label: c.label,
    obrigatorio: c.obrigatorio,
    opcoes: [...(c.opcoes ?? [])],
    descricao: c.descricao ?? "",
    formato: c.formato,
  };
}

function novoCampo(): DraftCampo {
  return {
    id: novoId(),
    tipo: "texto",
    label: "",
    obrigatorio: false,
    opcoes: [],
    descricao: "",
    formato: undefined,
  };
}

/** Opções do seletor de formato do campo 'texto' — "livre" é o sentinela
 *  do `formato` ausente (o Select não aceita item de valor vazio). */
const FORMATO_OPCOES = { livre: "Texto livre", ...CAMPO_FORMATO_LABEL };

/** Numeração do builder — o MESMO mapa do /f/<token> e da leitura da
 *  ficha (REALIZA-199): perguntas e seções têm réguas próprias. "Pergunta
 *  2" é a 2ª pergunta (secao não consome número — é rótulo de estrutura),
 *  "seção 1" é a 1ª seção. Antes o builder usava i+1 cru e a seção comia
 *  um número que o respondente nunca veria. */
function numera(campos: DraftCampo[]) {
  const numeroPorId = new Map<string, number>();
  const secaoPorId = new Map<string, number>();
  let np = 0;
  let ns = 0;
  for (const c of campos) {
    if (c.tipo === "secao") secaoPorId.set(c.id, ++ns);
    else numeroPorId.set(c.id, ++np);
  }
  return { numeroPorId, secaoPorId };
}

/** Rótulo ordinal do campo pra aria-labels e anúncios — "a pergunta 2" /
 *  "a seção 1", combinando com "Ações d…", "Arrastar pra reordenar …". */
function rotuloCampo(c: DraftCampo, n: number, sn: number): string {
  return c.tipo === "secao" ? `a seção ${sn}` : `a pergunta ${n}`;
}

/** DragControls do Reorder.Item do card — a alça no rodapé dispara o gesto
 *  sem transformar o card inteiro em alça: inputs, selects e switches
 *  precisam do pointerdown deles. Um contexto por card, não um por lista. */
const AlcaControlsContext = createContext<DragControls | null>(null);

/** Form existente que o builder edita (ausente = criação em /novo). */
export type FormularioEdicao = {
  id: string;
  titulo: string;
  descricao: string | null;
  campos: FormularioCampo[];
  versao: number;
};

export function FormularioBuilder({
  formulario,
}: {
  /** presente = edição; ausente = criação */
  formulario?: FormularioEdicao;
}) {
  const [titulo, setTitulo] = useState(formulario?.titulo ?? "");
  const [descricao, setDescricao] = useState(formulario?.descricao ?? "");
  // useId semeia o id do 1º campo em /novo — randomUUID aqui geraria ids
  // diferentes no SSR e na hidratação (mismatch em todo atributo derivado)
  const seedId = useId();
  const [campos, setCampos] = useState<DraftCampo[]>(() =>
    formulario?.campos.length
      ? formulario.campos.map(paraDraft)
      : [{ ...novoCampo(), id: `c_${seedId.replace(/[^a-zA-Z0-9]/g, "")}` }]
  );
  /** erros de validação client-side por campo (espelho de validaCampos) —
   *  ancorados no card; erro de action/rede vai por toast. */
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroTitulo, setErroTitulo] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pending, start] = useTransition();
  /** anúncio de reordenação pra leitor de tela — mover pelo menu ⋯ e
   *  soltar o arraste passam por aqui; sem isso o AT não sabe que a ordem
   *  mudou (a reordenação em si é silenciosa). */
  const [dragMsg, setDragMsg] = useState("");
  /** ordem no momento em que o arraste começou — o dirty de um gesto de
   *  reordenação só liga se a posição solta for diferente da posição
   *  pega (pegar e devolver no lugar não suja o rascunho). */
  const antesDoArraste = useRef<DraftCampo[] | null>(null);
  const router = useRouter();
  const edicao = Boolean(formulario);
  const maxCampos = campos.length >= MAX_CAMPOS;
  // a régua de numeração do builder é a do /f/<token>: perguntas e seções
  // contam separado — recalculado a cada render (reorder/insert/remove
  // já reflete no chip e nos aria-labels sem esperar save)
  const { numeroPorId, secaoPorId } = numera(campos);

  /* Alvos de foco por chave — `en:<id>` enunciado, `op:<id>:<j>` opção.
   * pendingFocus é consumido no ref callback: foca o elemento assim que ele
   * monta (inserir/duplicar/Enter na opção), sem effect extra. */
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<string | null>(null);

  function reg(k: string) {
    return (el: HTMLInputElement | null) => {
      if (!el) {
        inputRefs.current.delete(k);
        return;
      }
      inputRefs.current.set(k, el);
      if (pendingFocus.current === k) {
        pendingFocus.current = null;
        el.focus();
      }
    };
  }

  /* Rascunho local não persiste (localStorage é backlog) — o guard de saída
   *  cobre refresh/fechar aba enquanto houver alteração não salva. */
  useEffect(() => {
    if (!dirty) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [dirty]);

  function limpaErro(id: string) {
    setErros((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function alteraCampos(fn: (cs: DraftCampo[]) => DraftCampo[]) {
    setDirty(true);
    setCampos(fn);
  }

  function update(i: number, patch: Partial<DraftCampo>) {
    limpaErro(campos[i].id);
    alteraCampos((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  function mudaTipo(i: number, tipo: FormularioCampoTipo) {
    limpaErro(campos[i].id);
    alteraCampos((cs) =>
      cs.map((c, j) =>
        j === i
          ? {
              ...c,
              tipo,
              // trocar pra tipo com opções semeia 2 linhas vazias — o mínimo
              // que a validação aceita, já com foco óbvio pra preencher
              ...(TIPOS_COM_OPCOES.includes(tipo) && c.opcoes.length === 0
                ? { opcoes: ["", ""] }
                : {}),
              // secao não espera resposta — obrigatória é conceito inválido
              // (o servidor também força false em validaCampos)
              ...(tipo === "secao" ? { obrigatorio: false } : {}),
              // formato é coisa de 'texto' — trocar de tipo limpa o hint,
              // senão ficaria lixo invisível no payload
              ...(tipo !== "texto" && c.formato
                ? { formato: undefined }
                : {}),
            }
          : c
      )
    );
  }

  /** Anuncia a posição nova de um campo depois de mover/arrastar — o
   *  número sai da régua certa ("pergunta N" conta só perguntas). */
  function anunciaPosicao(campo: DraftCampo, lista: DraftCampo[]) {
    const mapa = numera(lista);
    const ehSecao = campo.tipo === "secao";
    const titulo = campo.label.trim();
    const nome = titulo
      ? `“${titulo.length > 40 ? `${titulo.slice(0, 40)}…` : titulo}”`
      : ehSecao
        ? "A seção"
        : "A pergunta";
    const pos = ehSecao
      ? `seção ${mapa.secaoPorId.get(campo.id)}`
      : `pergunta ${mapa.numeroPorId.get(campo.id)}`;
    setDragMsg(`${nome} agora é a ${pos}.`);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= campos.length) {
      // borda: o menu ⋯ desabilita o item, mas a seta ↑/↓ do grip chega
      // aqui sem barreira — sem anúncio o AT fica no escuro sobre a tecla
      // não ter feito nada (mesma régua pergunta×seção de anunciaPosicao)
      const c = campos[i];
      const rotulo = rotuloCampo(
        c,
        c.tipo === "secao" ? 0 : (numeroPorId.get(c.id) ?? 0),
        c.tipo === "secao" ? (secaoPorId.get(c.id) ?? 0) : 0
      );
      setDragMsg(
        `${rotulo.charAt(0).toUpperCase()}${rotulo.slice(1)} já é ${
          dir === -1 ? "a primeira" : "a última"
        }.`
      );
      return;
    }
    const out = [...campos];
    [out[i], out[j]] = [out[j], out[i]];
    alteraCampos(() => out);
    anunciaPosicao(out[j], out);
  }

  function remove(i: number) {
    limpaErro(campos[i].id);
    alteraCampos((cs) => (cs.length > 1 ? cs.filter((_, j) => j !== i) : cs));
  }

  /** insere um campo novo na posição i (o "+" entre cards usa i+1 do card
   *  de cima) e foca o enunciado assim que montar */
  function inserir(i: number) {
    if (maxCampos) return;
    const c = novoCampo();
    pendingFocus.current = `en:${c.id}`;
    alteraCampos((cs) => [...cs.slice(0, i), c, ...cs.slice(i)]);
  }

  function duplicar(i: number) {
    if (maxCampos) return;
    const src = campos[i];
    const clone: DraftCampo = {
      ...src,
      // respostas referenciam c.id — clone com id novo, nunca reuso
      id: novoId(),
      opcoes: [...src.opcoes],
    };
    pendingFocus.current = `en:${clone.id}`;
    alteraCampos((cs) => [...cs.slice(0, i + 1), clone, ...cs.slice(i + 1)]);
  }

  function updateOpcao(i: number, j: number, v: string) {
    limpaErro(campos[i].id);
    alteraCampos((cs) =>
      cs.map((c, k) =>
        k === i
          ? { ...c, opcoes: c.opcoes.map((o, l) => (l === j ? v : o)) }
          : c
      )
    );
  }

  function addOpcao(i: number, depoisDe?: number) {
    const c = campos[i];
    if (c.opcoes.length >= MAX_OPCOES) return;
    const pos = depoisDe ?? c.opcoes.length;
    pendingFocus.current = `op:${c.id}:${pos}`;
    alteraCampos((cs) =>
      cs.map((d, k) =>
        k === i
          ? {
              ...d,
              opcoes: [
                ...d.opcoes.slice(0, pos),
                "",
                ...d.opcoes.slice(pos),
              ],
            }
          : d
      )
    );
  }

  function removeOpcao(i: number, j: number) {
    limpaErro(campos[i].id);
    alteraCampos((cs) =>
      cs.map((c, k) =>
        k === i ? { ...c, opcoes: c.opcoes.filter((_, l) => l !== j) } : c
      )
    );
  }

  /** Espelho de validaCampos (lib/forms/schema) — um erro por campo. Opção
   *  em branco/repetida o servidor dropa em silêncio; aqui a gente marca
   *  pra pessoa decidir, sem perda silenciosa. */
  function validaRascunho(): Record<string, string> {
    const mapa: Record<string, string> = {};
    for (const c of campos) {
      if (!c.label.trim()) {
        mapa[c.id] = "Escreva o texto da pergunta.";
        continue;
      }
      if (!TIPOS_COM_OPCOES.includes(c.tipo)) continue;
      const limpas = c.opcoes.map((o) => o.trim());
      const cheias = limpas.filter(Boolean);
      if (cheias.length < 2) {
        mapa[c.id] = "Inclua pelo menos 2 opções.";
        continue;
      }
      if (limpas.some((o) => !o)) {
        mapa[c.id] = "Preencha ou remova a opção em branco.";
        continue;
      }
      const vistas = new Set<string>();
      let repetida = false;
      for (const o of cheias) {
        const k = o.toLocaleLowerCase("pt-BR");
        if (vistas.has(k)) {
          repetida = true;
          break;
        }
        vistas.add(k);
      }
      if (repetida) {
        mapa[c.id] = "Remova a opção repetida.";
        continue;
      }
      if (cheias.length > MAX_OPCOES) {
        mapa[c.id] = `No máximo ${MAX_OPCOES} opções.`;
      }
    }
    return mapa;
  }

  function paraPayload(): FormularioCampo[] {
    return campos.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      label: c.label.trim(),
      obrigatorio: c.tipo === "secao" ? false : c.obrigatorio,
      ...(TIPOS_COM_OPCOES.includes(c.tipo)
        ? { opcoes: c.opcoes.map((o) => o.trim()).filter(Boolean) }
        : {}),
      ...(c.tipo === "secao" && c.descricao.trim()
        ? { descricao: c.descricao.trim() }
        : {}),
      ...(c.tipo === "texto" && c.formato ? { formato: c.formato } : {}),
    }));
  }

  function salvar() {
    // mesma regra do servidor (3–140) — marcada no campo, não em toast
    if (titulo.trim().length < 3) {
      setErroTitulo("O título precisa de pelo menos 3 letras.");
      const el = document.getElementById("form-titulo");
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    setErroTitulo(null);
    const mapa = validaRascunho();
    if (Object.keys(mapa).length) {
      setErros(mapa);
      const primeiro = campos.find((c) => mapa[c.id]);
      const el = primeiro && inputRefs.current.get(`en:${primeiro.id}`);
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    setErros({});
    start(async () => {
      try {
        const r = await salvarFormulario({
          id: formulario?.id,
          titulo,
          descricao: descricao.trim() || null,
          campos: paraPayload(),
        });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        setDirty(false);
        if (edicao) {
          toast.success("Formulário atualizado.");
          router.refresh();
        } else {
          toast.success("Formulário criado. Agora gere os links.");
          router.push(`/formularios/${r.id}`);
        }
      } catch {
        toast.error("Sem conexão. Confira a internet e tente de novo.");
      }
    });
  }

  // a <p> do resumo é estável no DOM — entra/sai por sr-only, pro leitor de
  // tela anunciar sempre que aparecer
  const resumoErro = Object.keys(erros).length
    ? "Revise as perguntas marcadas."
    : null;

  if (preview) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-3 py-2">
          <p className="text-sm text-muted-foreground">
            Pré-visualização do rascunho: é assim que a pessoa vê. Envio
            desligado.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreview(false)}
          >
            <PencilSimple aria-hidden />
            Voltar a editar
          </Button>
        </div>
        <FormularioPublico
          preview
          token=""
          titulo={titulo.trim() || "Formulário sem título"}
          descricao={descricao.trim() || null}
          campos={paraPayload()}
          destinatario={null}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-busy={pending}>
      {/* fieldset disabled trava o miolo inteiro durante o save */}
      <fieldset disabled={pending} className="m-0 min-w-0 space-y-4 border-0 p-0">
        <div className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
          <div className="space-y-1.5">
            <Label htmlFor="form-titulo">Título</Label>
            <Input
              id="form-titulo"
              autoFocus={!edicao}
              className="text-lg font-semibold"
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                setDirty(true);
                if (erroTitulo) setErroTitulo(null);
              }}
              maxLength={140}
              placeholder="Ex.: Avaliação do encontro"
              aria-invalid={erroTitulo ? true : undefined}
              aria-describedby={erroTitulo ? "form-titulo-erro" : undefined}
            />
            {erroTitulo && (
              <p
                id="form-titulo-erro"
                className="text-sm leading-snug text-destructive"
              >
                {erroTitulo}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="form-descricao">
              Descrição{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="form-descricao"
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                setDirty(true);
              }}
              rows={2}
              maxLength={2000}
              placeholder="Aparece no topo da página que a pessoa abre pelo link."
            />
          </div>
        </div>

        <p className="sr-only">
          Pra reordenar pelo teclado, foque a alça no rodapé do campo e
          use as setas pra cima e pra baixo, ou abra o menu de ações e
          escolha Mover pra cima ou Mover pra baixo. Pelo ponteiro,
          arraste pela alça.
        </p>
        {/* Reorder do motion (a lib já era da casa — sem dependência nova):
            FLIP dos irmãos no reorder, auto-scroll na borda do viewport e
            snap-back no drop. O gesto começa só na alça (dragControls) —
            o card inteiro é cheio de controle, listener nele quebraria
            input/select. O menu ⋯ de cada card segue como caminho de
            teclado (mover ↑/↓), não substituído pelo arraste */}
        <Reorder.Group
          as="ol"
          axis="y"
          values={campos}
          // sempre converte pro estado a ordem que o Group calculou —
          // comparar com o closure aqui abriria race (2 cruzamentos no
          // mesmo batch veriam o campos velho). O dirty sai no drop: se a
          // ordem final for a de antes do arraste, nada mudou de verdade
          onReorder={(nova) => setCampos(nova)}
          className="space-y-3"
        >
          {campos.map((c, i) => {
            const msg = erros[c.id];
            const erroId = `erro-${c.id}`;
            const ehSecao = c.tipo === "secao";
            // n = posição na régua de perguntas (o "N." que o respondente
            // vê); sn = posição na régua de seções — nunca se misturam
            const n = ehSecao ? 0 : (numeroPorId.get(c.id) ?? 0);
            const sn = ehSecao ? (secaoPorId.get(c.id) ?? 0) : 0;
            const rotulo = rotuloCampo(c, n, sn);
            return (
              <Fragment key={c.id}>
                {i > 0 && (
                  // separador também é layout: insere/remove/reordena deslizando
                  // junto em vez de teletransportar enquanto o card anima.
                  // role="none" tira a semântica de listitem do <li> — sem
                  // ele o <ol> conta os separadores e o AT anuncia "2N-1
                  // itens". O botão dentro segue exposto normal (padrão
                  // APG de li-padrão com conteúdo interativo).
                  <motion.li
                    role="none"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={T.micro}
                    className="-my-1 flex h-8 items-center justify-center"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Adicionar pergunta aqui"
                      disabled={maxCampos}
                      onClick={() => inserir(i)}
                      className="rounded-full text-muted-foreground"
                    >
                      <Plus aria-hidden />
                    </Button>
                  </motion.li>
                )}
                {/* continuidade espacial no editor: reorder (menu ⋯ e
                    arraste) desliza os cards; inserir/duplicar entra com o
                    fade+y:4 padrão; remover sai direto e os irmãos deslizam
                    pra ocupar o espaço (§2) */}
                <CampoReorderItem
                  value={c}
                  onDragStart={() => {
                    antesDoArraste.current = campos;
                    setDragMsg(
                      `Arrastando ${rotulo}. Solte na nova posição.`
                    );
                  }}
                  onDragEnd={() => {
                    const antes = antesDoArraste.current;
                    antesDoArraste.current = null;
                    const mudou =
                      antes !== null &&
                      (antes.length !== campos.length ||
                        antes.some((d, idx) => d !== campos[idx]));
                    // drop que não mudou a ordem (drag-no-op, clique seco
                    // no grip) fica em silêncio — anunciar posição seria
                    // mentir que algo moveu
                    if (mudou) {
                      setDirty(true);
                      anunciaPosicao(c, campos);
                    }
                  }}
                  className={cn(
                    "rounded-xl bg-card shadow-[var(--shadow-border)]",
                    msg && "ring-2 ring-destructive/60"
                  )}
                >
                  <div className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      {/* o "N." do builder é o mesmo do /f/<token> — seção
                          ganha selo próprio (com ícone) fora da contagem,
                          igual à linha-divisória que ela vira pro público */}
                      <span
                        className={cn(
                          "inline-flex h-9 shrink-0 items-center justify-center gap-1 self-start rounded-lg px-2.5 text-xs font-semibold tabular-nums sm:self-auto",
                          ehSecao
                            ? "bg-[var(--brand-lime)]/15 text-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {ehSecao ? (
                          <>
                            <Rows size={12} aria-hidden />
                            Seção {sn}
                          </>
                        ) : (
                          `${n}.`
                        )}
                      </span>
                      <Input
                        ref={reg(`en:${c.id}`)}
                        aria-label={
                          ehSecao
                            ? `Título da seção ${sn}`
                            : `Texto da pergunta ${n}`
                        }
                        aria-invalid={msg ? true : undefined}
                        aria-describedby={msg ? erroId : undefined}
                        className="flex-1"
                        value={c.label}
                        onChange={(e) => update(i, { label: e.target.value })}
                        maxLength={200}
                        placeholder={
                          c.tipo === "secao"
                            ? "Ex.: Antes de responder"
                            : "Ex.: Como foi o encontro desta semana?"
                        }
                      />
                      <div className="w-full shrink-0 sm:w-44">
                        <Select
                          value={c.tipo}
                          items={CAMPO_TIPO_LABEL}
                          onValueChange={(v) =>
                            mudaTipo(i, v as FormularioCampoTipo)
                          }
                        >
                          <SelectTrigger aria-label={`Tipo d${rotulo}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CAMPO_TIPO_LABEL)
                              .filter(
                                ([v]) =>
                                  !TIPOS_SO_OFICIAL.has(
                                    v as FormularioCampoTipo
                                  )
                              )
                              .map(([v, l]) => {
                                const Icone =
                                  CAMPO_TIPO_ICONE[v as FormularioCampoTipo];
                                return (
                                  <SelectItem key={v} value={v}>
                                    <Icone
                                      className="text-muted-foreground"
                                      aria-hidden
                                    />
                                    {l}
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {TIPOS_COM_OPCOES.includes(c.tipo) ? (
                      <OpcoesEditor
                        campo={c}
                        n={n}
                        regOpcao={(j) => reg(`op:${c.id}:${j}`)}
                        onUpdate={(j, v) => updateOpcao(i, j, v)}
                        onAdd={(depoisDe) => addOpcao(i, depoisDe)}
                        onRemove={(j) => removeOpcao(i, j)}
                      />
                    ) : c.tipo === "texto" ? (
                      // 'texto' pode declarar formato — o /f/<token> troca
                      // o teclado e normaliza a resposta na entrada
                      // (e-mail com @@, telefone com máscara, link sem
                      // https — o mesmo resgate do import CSV, REALIZA-118)
                      <div className="space-y-2">
                        <MockTipo tipo={c.tipo} />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Formato
                          </span>
                          <div className="w-full sm:w-56">
                            <Select
                              value={c.formato || "livre"}
                              items={FORMATO_OPCOES}
                              onValueChange={(v) =>
                                update(i, {
                                  formato:
                                    v === "livre"
                                      ? undefined
                                      : (v as FormularioCampoFormato),
                                })
                              }
                            >
                              <SelectTrigger
                                aria-label={`Formato da resposta da pergunta ${n}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(FORMATO_OPCOES).map(
                                  ([v, l]) => (
                                    <SelectItem key={v} value={v}>
                                      {l}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          {c.formato && (
                            <span className="text-xs leading-snug text-muted-foreground">
                              A resposta é normalizada na entrada
                            </span>
                          )}
                        </div>
                      </div>
                    ) : c.tipo === "secao" ? (
                      // a seção leva texto de apoio (instrução do bloco),
                      // não maquete de resposta — não há o que responder
                      <Textarea
                        aria-label={`Texto de apoio da seção ${sn}`}
                        value={c.descricao}
                        onChange={(e) =>
                          update(i, { descricao: e.target.value })
                        }
                        rows={2}
                        maxLength={1000}
                        placeholder="Texto de apoio sob o título (opcional): instruções do bloco."
                      />
                    ) : (
                      <MockTipo tipo={c.tipo} />
                    )}

                    {msg && (
                      <p
                        id={erroId}
                        className="text-sm leading-snug text-destructive"
                      >
                        {msg}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5 sm:px-3">
                    {/* REALIZA-186/199: alça de arraste (ponteiro) + ⋯
                        (teclado) — dois caminhos de reordenar lado a lado.
                        ⋯ por campo é o padrão do pdm-arvore; tudo é estado
                        local do builder, não há confirm pra preservar */}
                    <div className="flex items-center gap-0.5">
                      <AlcaArraste
                        rotulo={rotulo}
                        onMove={(dir) => move(i, dir)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Ações d${rotulo}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" }),
                            // md:, não sm: — tablet 640–767 segue touch e
                            // precisa dos 44px; o 32px é coisa de desktop
                            "size-11 shrink-0 md:size-8"
                          )}
                        >
                          <DotsThreeVertical
                            size={18}
                            weight="bold"
                            aria-hidden
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            disabled={maxCampos}
                            onClick={() => duplicar(i)}
                          >
                            <Copy size={16} data-icon="inline-start" aria-hidden />
                            Duplicar {ehSecao ? "seção" : "pergunta"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                          >
                            <CaretUp size={16} data-icon="inline-start" aria-hidden />
                            Mover pra cima
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={i === campos.length - 1}
                            onClick={() => move(i, 1)}
                          >
                            <CaretDown
                              size={16}
                              data-icon="inline-start"
                              aria-hidden
                            />
                            Mover pra baixo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={campos.length === 1}
                            onClick={() => remove(i)}
                          >
                            <Trash size={16} data-icon="inline-start" aria-hidden />
                            Remover {ehSecao ? "seção" : "pergunta"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {c.tipo !== "secao" && (
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`obr-${c.id}`}
                          aria-labelledby={`obr-label-${c.id}`}
                          checked={c.obrigatorio}
                          disabled={pending}
                          onCheckedChange={(v) =>
                            update(i, { obrigatorio: v })
                          }
                        />
                        <Label
                          id={`obr-label-${c.id}`}
                          htmlFor={`obr-${c.id}`}
                          className="cursor-pointer font-normal"
                        >
                          Obrigatória
                        </Label>
                      </div>
                    )}
                  </div>
                </CampoReorderItem>
              </Fragment>
            );
          })}
        </Reorder.Group>

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inserir(campos.length)}
            disabled={maxCampos}
          >
            <Plus aria-hidden />
            Adicionar pergunta
          </Button>
        </div>
      </fieldset>

      {/* anúncio de reordenação — live region estável (sempre montada), o
          texto muda por gesto: menu ⋯ e drop do arraste escrevem aqui */}
      <p aria-live="polite" className="sr-only">
        {dragMsg}
      </p>

      <p
        role="alert"
        className={cn(
          "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
          !resumoErro && "sr-only"
        )}
      >
        {resumoErro}
      </p>

      {/* barra persistente — o contador segue o scroll: "N perguntas · ~M
          min" com a mesma régua de 15s/pergunta que a página pública
          anuncia, então o número que a coord vê aqui é o que a pessoa lê
          lá no link */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-[var(--shadow-border)] backdrop-blur-sm md:bottom-3">
        <p
          aria-live="polite"
          className="text-xs tabular-nums text-muted-foreground"
        >
          {/* seções não contam — a régua de tempo é de perguntas */}
          {camposPerguntas(campos).length}{" "}
          {camposPerguntas(campos).length === 1 ? "pergunta" : "perguntas"}
          {" · ~"}
          {Math.max(
            1,
            Math.round((camposPerguntas(campos).length * 15) / 60)
          )}{" "}
          min
        </p>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreview(true)}
          >
            <Eye aria-hidden />
            Pré-visualizar
          </Button>
          <Button type="button" onClick={salvar} disabled={pending}>
            {pending && <CircleNotch className="animate-spin" aria-hidden />}
            {pending
              ? "Salvando…"
              : edicao
                ? "Salvar alterações"
                : "Criar formulário"}
          </Button>
        </div>
        {edicao && (
          <p className="basis-full text-xs text-muted-foreground">
            Mudar as perguntas não apaga respostas já recebidas. O formulário
            sobe pra versão {formulario!.versao + 1}.
          </p>
        )}
      </div>
    </div>
  );
}

/** O <details> "Editar formulário" da ficha — monta o builder só no
 *  primeiro open. Montado dentro de um details fechado, o Reorder.Item
 *  media 0×0 e o primeiro arraste reordenava em cima de medida vazia;
 *  com o mount adiado a lista já nasce com dimensões reais. Depois de
 *  aberto o builder fica montado — o rascunho local não pode morrer
 *  quando a pessoa fecha o details no meio da edição. */
export function FormularioBuilderDetails({
  formulario,
}: {
  formulario: FormularioEdicao;
}) {
  const [montado, setMontado] = useState(false);
  return (
    <details
      className="group"
      onToggle={(e) => {
        if (e.currentTarget.open) setMontado(true);
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg py-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        Editar formulário
        <CaretDown
          size={14}
          aria-hidden
          className="transition-transform group-open:rotate-180"
        />
      </summary>
      {montado && <FormularioBuilder formulario={formulario} />}
    </details>
  );
}

/** Card arrastável do builder — Reorder.Item com o gesto preso na alça
 *  (dragListener={false} + dragControls): o card é cheio de input/select/
 *  switch, um listener nele sequestraria o pointerdown de todo controle.
 *  O `value` é o DraftCampo — o Group reordena o array e devolve em
 *  onReorder; layout/zIndex/medida são internos do Reorder (irmãos
 *  deslizam via FLIP, o arrastado flutua por cima com zIndex próprio).
 *  O y do fade de entrada escreve no MESMO motion value do offset de
 *  arraste — a animação de entrada não briga com o gesto, é o mesmo canal. */
function CampoReorderItem({
  value,
  className,
  onDragStart,
  onDragEnd,
  children,
}: {
  value: DraftCampo;
  className?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  children: ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="li"
      value={value}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      initial={fade.initial}
      animate={fade.animate}
      transition={T.enter}
      // "card levantado": sombra de overlay + respiro de 1% — uma passada
      // só no lift, nada anima durante o arraste (o movimento é o gesto)
      whileDrag={{ scale: 1.01, boxShadow: "var(--shadow-overlay)" }}
      className={className}
    >
      <AlcaControlsContext.Provider value={controls}>
        {children}
      </AlcaControlsContext.Provider>
    </Reorder.Item>
  );
}

/** A alça do card (rodapé, ao lado do ⋯) — controle de reordenação com
 *  dois gestos: ponteiro arrasta (dragControls → controls.start no
 *  pointerdown), teclado move com as setas ↑/↓ pelo mesmo `move` do menu
 *  ⋯ (o anúncio da posição nova cai na live region igual). Um botão
 *  focável que não faz nada no Enter/Tab é controle morto — por isso a
 *  seta no grip, convenção do padrão drag-handle. `touch-none` é
 *  obrigatório: sem ele o gesto vertical vira scroll da página antes do
 *  drag começar — em qualquer outro ponto do card o scroll segue normal.
 *  size-11 no mobile garante os ≥44px do gesto. */
function AlcaArraste({
  rotulo,
  onMove,
}: {
  rotulo: string;
  onMove: (dir: -1 | 1) => void;
}) {
  const controls = useContext(AlcaControlsContext);
  return (
    <button
      type="button"
      aria-label={`Reordenar ${rotulo}`}
      aria-keyshortcuts="ArrowUp ArrowDown"
      title="Arraste pra reordenar. Pelo teclado, as setas ↑/↓ movem"
      onPointerDown={(e) => controls?.start(e)}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          // sem preventDefault a seta rolaria a página atrás do card
          e.preventDefault();
          onMove(e.key === "ArrowUp" ? -1 : 1);
        }
      }}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        // md:, não sm: — tablet 640–767 segue touch e precisa dos 44px
        "size-11 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing md:size-8"
      )}
    >
      <DotsSixVertical size={18} weight="bold" aria-hidden />
    </button>
  );
}

/** Editor de opções: uma linha por opção — marcador que espelha o tipo +
 *  Input + ✕; Enter cria e foca a próxima; "Adicionar opção" no fim. */
function OpcoesEditor({
  campo,
  n,
  regOpcao,
  onUpdate,
  onAdd,
  onRemove,
}: {
  campo: DraftCampo;
  n: number;
  regOpcao: (j: number) => (el: HTMLInputElement | null) => void;
  onUpdate: (j: number, v: string) => void;
  onAdd: (depoisDe?: number) => void;
  onRemove: (j: number) => void;
}) {
  const Marcador = campo.tipo === "select" ? Circle : CheckSquare;
  const lotado = campo.opcoes.length >= MAX_OPCOES;
  return (
    <div className="space-y-1.5">
      <ol className="space-y-1.5">
        {campo.opcoes.map((op, j) => (
          <li key={j} className="flex items-center gap-2">
            <Marcador
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <Input
              ref={regOpcao(j)}
              aria-label={`Opção ${j + 1} da pergunta ${n}`}
              value={op}
              onChange={(e) => onUpdate(j, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAdd(j + 1);
                }
              }}
              maxLength={120}
              placeholder={`Opção ${j + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remover opção ${j + 1}`}
              onClick={() => onRemove(j)}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2">
        <Marcador
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground/40"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={lotado}
          onClick={() => onAdd()}
          className="text-muted-foreground"
        >
          <Plus aria-hidden />
          Adicionar opção
        </Button>
      </div>
    </div>
  );
}

/** Maquete inerte do tipo — mostra a cara da resposta sem extrair o
 *  CampoRenderer do público (mock simples, não acopla). aria-hidden +
 *  pointer-events-none + disabled: zero interação, zero ruído pro leitor
 *  de tela. */
function MockTipo({ tipo }: { tipo: FormularioCampoTipo }) {
  return (
    <div aria-hidden="true" className="pointer-events-none opacity-60">
      {tipo === "texto" && <Input disabled placeholder="Resposta curta" />}
      {tipo === "texto_longo" && (
        <Textarea disabled rows={2} placeholder="Resposta longa" />
      )}
      {tipo === "data" && (
        <Input type="date" disabled className="max-w-48" />
      )}
      {tipo === "escala_1_5" && (
        <div className="grid max-w-sm grid-cols-5 gap-1 rounded-xl bg-muted p-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className="flex h-9 items-center justify-center rounded-lg text-sm font-semibold tabular-nums text-muted-foreground"
            >
              {n}
            </span>
          ))}
        </div>
      )}
      {tipo === "escala_1_10" && (
        <div className="grid max-w-xl grid-cols-5 gap-1 rounded-xl bg-muted p-1 sm:grid-cols-10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <span
              key={n}
              className="flex h-9 items-center justify-center rounded-lg text-sm font-semibold tabular-nums text-muted-foreground"
            >
              {n}
            </span>
          ))}
        </div>
      )}
      {tipo === "secao" && (
        <span className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Rows aria-hidden className="size-4 shrink-0" />
          Título de bloco · organiza as perguntas, não espera resposta
        </span>
      )}
      {tipo === "sim_nao" && (
        <div className="grid max-w-sm grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {["Sim", "Não"].map((l) => (
            <span
              key={l}
              className="flex h-9 items-center justify-center rounded-lg text-sm font-medium text-muted-foreground"
            >
              {l}
            </span>
          ))}
        </div>
      )}
      {tipo === "checkbox" && (
        <span className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            disabled
            className="size-4 shrink-0 accent-primary"
          />
          A pessoa marca a caixa pra confirmar
        </span>
      )}
    </div>
  );
}
