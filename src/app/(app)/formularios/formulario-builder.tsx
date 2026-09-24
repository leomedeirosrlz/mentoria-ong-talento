"use client";

import { Fragment, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarBlank,
  CaretDown,
  CaretUp,
  CheckSquare,
  Circle,
  CircleNotch,
  Copy,
  Eye,
  ListBullets,
  ListChecks,
  PencilSimple,
  Plus,
  RadioButton,
  Star,
  TextAlignLeft,
  TextT,
  Trash,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { salvarFormulario } from "@/lib/forms/actions";
import {
  CAMPO_TIPO_LABEL,
  MAX_CAMPOS,
  MAX_OPCOES,
  TIPOS_COM_OPCOES,
  type FormularioCampo,
  type FormularioCampoTipo,
} from "@/lib/forms/schema";
import { FormularioPublico } from "@/app/f/[token]/formulario-publico";
import { Button } from "@/components/ui/button";
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
};

const novoId = () => `c_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

const CAMPO_TIPO_ICONE: Record<FormularioCampoTipo, Icon> = {
  texto: TextT,
  texto_longo: TextAlignLeft,
  select: ListBullets,
  multi_select: ListChecks,
  escala_1_5: Star,
  data: CalendarBlank,
  checkbox: CheckSquare,
  sim_nao: RadioButton,
};

function paraDraft(c: FormularioCampo): DraftCampo {
  return {
    id: c.id,
    tipo: c.tipo,
    label: c.label,
    obrigatorio: c.obrigatorio,
    opcoes: [...(c.opcoes ?? [])],
  };
}

function novoCampo(): DraftCampo {
  return {
    id: novoId(),
    tipo: "texto",
    label: "",
    obrigatorio: false,
    opcoes: [],
  };
}

export function FormularioBuilder({
  formulario,
}: {
  /** presente = edição; ausente = criação */
  formulario?: {
    id: string;
    titulo: string;
    descricao: string | null;
    campos: FormularioCampo[];
    versao: number;
  };
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
  const router = useRouter();
  const edicao = Boolean(formulario);
  const maxCampos = campos.length >= MAX_CAMPOS;

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
            }
          : c
      )
    );
  }

  function move(i: number, dir: -1 | 1) {
    alteraCampos((cs) => {
      const j = i + dir;
      if (j < 0 || j >= cs.length) return cs;
      const out = [...cs];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
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
      obrigatorio: c.obrigatorio,
      ...(TIPOS_COM_OPCOES.includes(c.tipo)
        ? { opcoes: c.opcoes.map((o) => o.trim()).filter(Boolean) }
        : {}),
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
          toast.success("Formulário criado — agora gere os links.");
          router.push(`/formularios/${r.id}`);
        }
      } catch {
        toast.error("Sem conexão — confira a internet e tente de novo.");
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
            Pré-visualização do rascunho — é assim que a pessoa vê; envio
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

        <ol className="space-y-3">
          {campos.map((c, i) => {
            const msg = erros[c.id];
            const erroId = `erro-${c.id}`;
            return (
              <Fragment key={c.id}>
                {i > 0 && (
                  <li className="-my-1 flex h-8 items-center justify-center">
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
                  </li>
                )}
                <li
                  className={cn(
                    "rounded-xl bg-card shadow-[var(--shadow-border)]",
                    msg && "ring-2 ring-destructive/60"
                  )}
                >
                  <div className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Input
                        ref={reg(`en:${c.id}`)}
                        aria-label={`Texto da pergunta ${i + 1}`}
                        aria-invalid={msg ? true : undefined}
                        aria-describedby={msg ? erroId : undefined}
                        className="flex-1"
                        value={c.label}
                        onChange={(e) => update(i, { label: e.target.value })}
                        maxLength={200}
                        placeholder="Ex.: Como foi o encontro desta semana?"
                      />
                      <div className="w-full shrink-0 sm:w-44">
                        <Select
                          value={c.tipo}
                          items={CAMPO_TIPO_LABEL}
                          onValueChange={(v) =>
                            mudaTipo(i, v as FormularioCampoTipo)
                          }
                        >
                          <SelectTrigger
                            aria-label={`Tipo da pergunta ${i + 1}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CAMPO_TIPO_LABEL).map(([v, l]) => {
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
                        n={i + 1}
                        regOpcao={(j) => reg(`op:${c.id}:${j}`)}
                        onUpdate={(j, v) => updateOpcao(i, j, v)}
                        onAdd={(depoisDe) => addOpcao(i, depoisDe)}
                        onRemove={(j) => removeOpcao(i, j)}
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
                    <div className="flex items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Duplicar pergunta ${i + 1}`}
                        disabled={maxCampos}
                        onClick={() => duplicar(i)}
                      >
                        <Copy aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Mover pergunta ${i + 1} pra cima`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <CaretUp aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Mover pergunta ${i + 1} pra baixo`}
                        disabled={i === campos.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <CaretDown aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remover pergunta ${i + 1}`}
                        disabled={campos.length === 1}
                        onClick={() => remove(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash aria-hidden />
                      </Button>
                    </div>
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
                  </div>
                </li>
              </Fragment>
            );
          })}
        </ol>

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

      <p
        role="alert"
        className={cn(
          "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
          !resumoErro && "sr-only"
        )}
      >
        {resumoErro}
      </p>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={salvar} disabled={pending}>
          {pending && <CircleNotch className="animate-spin" aria-hidden />}
          {pending
            ? "Salvando…"
            : edicao
              ? "Salvar alterações"
              : "Criar formulário"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPreview(true)}
        >
          <Eye aria-hidden />
          Pré-visualizar
        </Button>
        {edicao && (
          <p className="text-xs text-muted-foreground">
            Mudar as perguntas não apaga respostas já recebidas — o formulário
            sobe pra versão {formulario!.versao + 1}.
          </p>
        )}
      </div>
    </div>
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
