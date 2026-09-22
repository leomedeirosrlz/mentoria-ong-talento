"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CircleNotch,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { salvarFormulario } from "@/lib/forms/actions";
import {
  CAMPO_TIPO_LABEL,
  MAX_CAMPOS,
  TIPOS_COM_OPCOES,
  type FormularioCampo,
  type FormularioCampoTipo,
} from "@/lib/forms/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Rascunho de campo no editor — `opcoes` é texto livre (uma por linha),
 *  convertido pra array no salvar; `id` é estável entre edições porque as
 *  respostas gravadas apontam pra ele. */
type DraftCampo = {
  id: string;
  tipo: FormularioCampoTipo;
  label: string;
  obrigatorio: boolean;
  opcoes: string;
};

const novoId = () => `c_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

function paraDraft(c: FormularioCampo): DraftCampo {
  return {
    id: c.id,
    tipo: c.tipo,
    label: c.label,
    obrigatorio: c.obrigatorio,
    opcoes: (c.opcoes ?? []).join("\n"),
  };
}

function novoCampo(): DraftCampo {
  return {
    id: novoId(),
    tipo: "texto",
    label: "",
    obrigatorio: false,
    opcoes: "",
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
  const [campos, setCampos] = useState<DraftCampo[]>(
    formulario?.campos.length ? formulario.campos.map(paraDraft) : [novoCampo()]
  );
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const edicao = Boolean(formulario);

  function update(i: number, patch: Partial<DraftCampo>) {
    setCampos((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  function move(i: number, dir: -1 | 1) {
    setCampos((cs) => {
      const j = i + dir;
      if (j < 0 || j >= cs.length) return cs;
      const out = [...cs];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  }

  function remove(i: number) {
    setCampos((cs) => (cs.length > 1 ? cs.filter((_, j) => j !== i) : cs));
  }

  function salvar() {
    setErro(null);
    const payload: FormularioCampo[] = campos.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      label: c.label.trim(),
      obrigatorio: c.obrigatorio,
      ...(TIPOS_COM_OPCOES.includes(c.tipo)
        ? {
            opcoes: c.opcoes
              .split("\n")
              .map((o) => o.trim())
              .filter(Boolean),
          }
        : {}),
    }));
    start(async () => {
      const r = await salvarFormulario({
        id: formulario?.id,
        titulo,
        descricao: descricao.trim() || null,
        campos: payload,
      });
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      if (edicao) {
        toast.success("Formulário atualizado.");
        router.refresh();
      } else {
        toast.success("Formulário criado — agora gere os links.");
        router.push(`/formularios/${r.id}`);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <div className="space-y-1.5">
          <Label htmlFor="form-titulo">Título</Label>
          <Input
            id="form-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={140}
            placeholder="Ex.: Avaliação do encontro"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="form-descricao">
            Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="form-descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Aparece no topo da página que a pessoa abre pelo link."
          />
        </div>
      </div>

      <ol className="space-y-3">
        {campos.map((c, i) => (
          <li
            key={c.id}
            className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5"
          >
            <div className="mb-3 flex items-center gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Pergunta {i + 1}
              </span>
              <div className="ml-auto flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Mover pergunta ${i + 1} pra cima`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Mover pergunta ${i + 1} pra baixo`}
                  disabled={i === campos.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown aria-hidden />
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
            </div>

            <div className="space-y-3">
              <Input
                aria-label={`Texto da pergunta ${i + 1}`}
                value={c.label}
                onChange={(e) => update(i, { label: e.target.value })}
                maxLength={200}
                placeholder="Ex.: Como foi o encontro desta semana?"
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="min-w-44">
                  <Select
                    value={c.tipo}
                    onValueChange={(v) =>
                      update(i, { tipo: v as FormularioCampoTipo })
                    }
                  >
                    <SelectTrigger aria-label={`Tipo da pergunta ${i + 1}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CAMPO_TIPO_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm md:min-h-8">
                  <input
                    type="checkbox"
                    checked={c.obrigatorio}
                    onChange={(e) => update(i, { obrigatorio: e.target.checked })}
                    className="size-4 shrink-0 accent-primary"
                  />
                  Resposta obrigatória
                </label>
              </div>
              {TIPOS_COM_OPCOES.includes(c.tipo) && (
                <div className="space-y-1.5">
                  <Label htmlFor={`opcoes-${c.id}`}>
                    Opções <span className="font-normal text-muted-foreground">(uma por linha)</span>
                  </Label>
                  <Textarea
                    id={`opcoes-${c.id}`}
                    value={c.opcoes}
                    onChange={(e) => update(i, { opcoes: e.target.value })}
                    rows={3}
                    placeholder={"Opção A\nOpção B\nOpção C"}
                    className="font-mono text-[0.8rem]"
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setCampos((cs) => [...cs, novoCampo()])}
        disabled={campos.length >= MAX_CAMPOS}
      >
        <Plus aria-hidden />
        Adicionar pergunta
      </Button>

      {erro && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erro}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={salvar} disabled={pending}>
          {pending && <CircleNotch className="animate-spin" aria-hidden />}
          {pending
            ? "Salvando…"
            : edicao
              ? "Salvar alterações"
              : "Criar formulário"}
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
