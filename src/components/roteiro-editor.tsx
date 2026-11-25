"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, PencilSimple, SpinnerGap } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import {
  gerarRoteiroSemana,
  publicarRoteiroSemana,
  salvarRoteiroSemana,
} from "@/lib/actions-roteiros";
import { escapeDocHtml, htmlParaTexto } from "@/lib/doc-bloco-schema";
import type { DocBloco } from "@/lib/materiais-documentos";
import { DocBlocos } from "@/components/material-documento";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Edição do rascunho (020): campos de texto puro por bloco editável —
 *  a tag permitida some na tela e volta escapada no save. Tabela e
 *  bloco-encontro seguem só leitura (a montagem não os emite; o editor
 *  não mente sobre o que dá pra mexer). */
type Edit = { titulo?: string; texto?: string };

const ROTULO: Partial<Record<DocBloco["kind"], string>> = {
  par: "Texto",
  subtitulo: "Título de seção",
  lista: "Lista (um item por linha)",
  pergunta: "Pergunta",
  callout: "Chamada",
  numero: "Passo",
  quote: "Citação",
};

function editavel(b: DocBloco): boolean {
  return b.kind !== "tabela" && b.kind !== "encontro";
}

function textoDoBloco(b: DocBloco): string {
  switch (b.kind) {
    case "lista":
      return b.itens.map(htmlParaTexto).join("\n");
    case "par":
    case "callout":
    case "quote":
    case "numero":
      return htmlParaTexto(b.html);
    default:
      return "texto" in b ? b.texto : "";
  }
}

function aplicaEdit(b: DocBloco, e: Edit | undefined): DocBloco {
  if (!e) return b;
  const html = (t: string) =>
    escapeDocHtml(t)
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join("<br>");
  switch (b.kind) {
    case "par":
      return e.texto != null ? { ...b, html: html(e.texto) } : b;
    case "callout":
      return e.texto != null ? { ...b, html: html(e.texto) } : b;
    case "quote":
      return e.texto != null ? { ...b, html: html(e.texto) } : b;
    case "numero":
      return {
        ...b,
        titulo: e.titulo?.trim() ? e.titulo.trim() : b.titulo,
        html: e.texto != null ? html(e.texto) : b.html,
      };
    case "lista":
      return e.texto != null
        ? {
            ...b,
            itens: e.texto
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .map(escapeDocHtml),
          }
        : b;
    case "pergunta":
    case "subj":
    case "subtitulo":
      return e.texto?.trim() ? { ...b, texto: e.texto.trim() } : b;
    default:
      return b;
  }
}

export function RoteiroEditor({
  duplaId,
  roteiroId,
  updatedAt,
  numero,
  blocos,
  podeRegerar,
}: {
  duplaId: string;
  roteiroId: string;
  /** carimbo da leitura — o save recusa se o rascunho mudou depois */
  updatedAt: string;
  numero: number;
  blocos: DocBloco[];
  podeRegerar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const mudou = Object.keys(edits).length > 0;
  const setCampo = (i: number, campo: keyof Edit, valor: string) =>
    setEdits((s) => ({ ...s, [i]: { ...s[i], [campo]: valor } }));

  const salvar = () => {
    setErro(null);
    iniciar(async () => {
      const novos = blocos.map((b, i) => aplicaEdit(b, edits[i]));
      const r = await salvarRoteiroSemana(
        duplaId,
        roteiroId,
        novos,
        updatedAt
      );
      if ("error" in r && r.error) {
        setErro(r.error);
        return;
      }
      toast.success("Rascunho salvo.");
      setEdits({});
      setEditando(false);
      router.refresh();
    });
  };

  const publicar = () => {
    if (!window.confirm("Publicar este roteiro pra dupla?")) return;
    setErro(null);
    iniciar(async () => {
      const r = await publicarRoteiroSemana(duplaId, roteiroId);
      if ("error" in r && r.error) {
        setErro(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Roteiro publicado.");
      router.refresh();
    });
  };

  const regerar = () => {
    if (
      !window.confirm(
        "Regerar do guia oficial? As edições do rascunho são descartadas."
      )
    )
      return;
    setErro(null);
    iniciar(async () => {
      const r = await gerarRoteiroSemana(duplaId, numero);
      if ("error" in r && r.error) {
        setErro(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Roteiro regerado do guia.");
      setEdits({});
      setEditando(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!editando ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pendente}
              onClick={() => setEditando(true)}
              className="min-h-11 sm:min-h-8"
            >
              <PencilSimple aria-hidden />
              Editar rascunho
            </Button>
            <Button
              size="sm"
              disabled={pendente}
              onClick={publicar}
              className="min-h-11 sm:min-h-8"
            >
              <Check aria-hidden />
              Publicar pra dupla
            </Button>
            {podeRegerar && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pendente}
                onClick={regerar}
                className="min-h-11 sm:min-h-8"
              >
                Regerar do guia
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              size="sm"
              disabled={pendente || !mudou}
              onClick={salvar}
              className="min-h-11 sm:min-h-8"
            >
              {pendente ? (
                <SpinnerGap aria-hidden className="animate-spin" />
              ) : (
                <Check aria-hidden />
              )}
              Salvar rascunho
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pendente}
              onClick={() => {
                setEdits({});
                setEditando(false);
              }}
              className="min-h-11 sm:min-h-8"
            >
              Cancelar
            </Button>
          </>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-sm text-[var(--warn-text)]">
          {erro}
        </p>
      )}

      {editando ? (
        <ol className="space-y-3">
          {blocos.map((b, i) => {
            if (!editavel(b))
              return (
                <li key={i} className="opacity-70">
                  <DocBlocos blocos={[b]} tom="lima" />
                </li>
              );
            const e = edits[i];
            const campoTexto = e?.texto ?? textoDoBloco(b);
            return (
              <li
                key={i}
                className="space-y-2 rounded-xl border border-border/70 p-3"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {ROTULO[b.kind] ?? b.kind}
                </p>
                {b.kind === "numero" && (
                  <Input
                    aria-label="Título do passo"
                    value={e?.titulo ?? b.titulo}
                    onChange={(ev) => setCampo(i, "titulo", ev.target.value)}
                  />
                )}
                <Textarea
                  aria-label={ROTULO[b.kind] ?? "Bloco"}
                  rows={b.kind === "lista" ? 5 : 3}
                  value={campoTexto}
                  onChange={(ev) => setCampo(i, "texto", ev.target.value)}
                />
              </li>
            );
          })}
        </ol>
      ) : (
        <DocBlocos blocos={blocos} tom="lima" />
      )}
    </div>
  );
}
