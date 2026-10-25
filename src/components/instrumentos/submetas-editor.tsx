"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, X } from "@phosphor-icons/react";
import { parseSubmetasLinhas, PDM_MAX_SUBITENS } from "@/lib/pdm";
import type { FormularioCampo } from "@/lib/forms/schema";
import { T } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { campoErroId, ErroCampo, RotuloCampo } from "./campos";
import type { RespostaApi } from "./use-resposta";

// Submetas — o desdobramento "uma por linha" (0118). O campo segue
// texto_longo no banco, no rascunho e no submit (o contrato de
// pdm_parse_submetas que projeta as linhas em pdm_itens não muda), mas
// a pessoa não escreve num textarea: cada submeta é uma linha da lista
// — "+ Adicionar submeta" abre uma, o X tira, Enter dentro de uma linha
// abre a próxima logo abaixo. Serialização: join("\n") das não-vazias;
// um rascunho de N linhas volta como N linhas (o parse normaliza
// marcadores "1." / "-" digitados à mão, igual a RPC faz no submit).

type Linha = { k: number; t: string };

export function SubmetasEditor({
  campo,
  api,
  metaN,
}: {
  campo: FormularioCampo;
  api: RespostaApi;
  /** número da meta — compõe o nome falado de cada linha */
  metaN?: number;
}) {
  const valor = String(api.valores[campo.id] ?? "");
  const erro = api.erros[campo.id];
  const rootRef = useRef<HTMLFieldSetElement>(null);

  // depois do primeiro toque o estado local manda (linhas vazias somem
  // da serialização mas ficam na tela enquanto se digita). Antes disso
  // deriva do valor — o rascunho restaura DEPOIS do mount e precisa
  // aparecer sem interação nenhuma.
  const [editadas, setEditadas] = useState<Linha[] | null>(null);
  const seq = useRef(0);
  const linhas = useMemo<Linha[]>(
    // derivadas levam chave negativa, as criadas na sessão positiva — os
    // dois mundos nunca colidem num mesmo render
    () =>
      editadas ??
      parseSubmetasLinhas(valor).map((t, i) => ({ k: -(i + 1), t })),
    [editadas, valor]
  );

  function commit(next: Linha[]) {
    setEditadas(next);
    const texto = next
      .map((l) => l.t.trim())
      .filter(Boolean)
      .join("\n");
    api.definir(campo.id, texto || undefined);
  }

  /** Nova linha logo depois de `depoisDe` (default: no fim) — e o foco
   *  vai junto (Enter numa linha ou toque no "+"). */
  function adicionar(depoisDe?: number) {
    const k = ++seq.current;
    const idx = depoisDe ?? linhas.length - 1;
    commit([
      ...linhas.slice(0, idx + 1),
      { k, t: "" },
      ...linhas.slice(idx + 1),
    ]);
    requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLInputElement>(`input[data-sub="${k}"]`)
        ?.focus();
    });
  }

  const rotulo = metaN != null ? ` da meta ${metaN}` : "";
  const cheio = linhas.length >= PDM_MAX_SUBITENS;

  return (
    <fieldset
      ref={rootRef}
      data-campo={campo.id}
      className="min-w-0 space-y-2"
    >
      <legend>
        <RotuloCampo campo={campo} className="text-sm sm:text-sm" />
      </legend>
      {campo.descricao && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {campo.descricao}
        </p>
      )}

      {/* o <ol> fica sempre montado (empty:hidden some com ele vazio) —
          assim a última linha removida ainda anima a saída */}
      <ol className="space-y-1.5 empty:hidden">
        <AnimatePresence initial={false}>
          {linhas.map((l, i) => (
            <motion.li
              key={l.k}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{
                opacity: 0,
                height: 0,
                paddingTop: 0,
                paddingBottom: 0,
                marginTop: 0,
                marginBottom: 0,
              }}
              transition={T.panel}
              style={{ overflow: "clip" }}
              className="flex items-center gap-1.5"
            >
              <span
                aria-hidden
                className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground"
              >
                {i + 1}
              </span>
              <Input
                data-sub={l.k}
                value={l.t}
                onChange={(e) =>
                  commit(
                    linhas.map((x) =>
                      x.k === l.k ? { ...x, t: e.target.value } : x
                    )
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Enter abre a linha seguinte — o submit continua
                    // sendo o botão do instrumento, como no textarea
                    e.preventDefault();
                    adicionar(i);
                  }
                }}
                placeholder="Um passo pequeno e concreto…"
                maxLength={500}
                enterKeyHint="next"
                aria-label={`Submeta ${i + 1}${rotulo}`}
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? campoErroId(campo) : undefined}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => commit(linhas.filter((x) => x.k !== l.k))}
                aria-label={`Remover submeta ${i + 1}${rotulo}`}
                className="shrink-0 text-muted-foreground"
              >
                <X aria-hidden />
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      {cheio ? (
        <p className="text-xs text-muted-foreground">
          Até {PDM_MAX_SUBITENS} submetas por meta.
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={() => adicionar()}
        >
          <Plus aria-hidden />
          Adicionar submeta
        </Button>
      )}

      <ErroCampo campo={campo} msg={erro} />
    </fieldset>
  );
}
