"use client";

// Inline dossier of one executed item (one rep of a matrix cell): the
// question as a user bubble, the answer excerpt styled like a Liza
// bubble, the rubrica as a ✓/✗ checklist (not the raw detalhe string),
// called tools as chips and the metrics with run-average context.

import { Check, Minus, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { rotuloTool } from "@/lib/ia/fontes";
import {
  assertsDoItem,
  ms,
  num,
  STATUS_ITEM,
  usd,
  type Item,
} from "./tipos";

/** Bolha de resposta com a gramática do chat da Liza (arredondamento +
 *  sombra do assistente), reduzida pro contexto do dossiê. */
function BolhaLiza({ item }: { item: Item }) {
  if (item.status === "rodando") {
    return (
      <div
        role="status"
        aria-label="A Liza está respondendo"
        className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted/60 px-4 py-3"
      >
        {[0, 1, 2].map((d) => (
          <span
            key={d}
            aria-hidden
            className="ia-digitando size-1.5 rounded-full bg-muted-foreground/70"
            style={{ animationDelay: `${d * 160}ms` }}
          />
        ))}
      </div>
    );
  }
  if (!item.resposta_trecho) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {item.status === "pendente" ? "Ainda não executado." : "Sem resposta gravada."}
      </p>
    );
  }
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-[var(--shadow-border)]">
      {item.resposta_trecho}
      {item.resposta_trecho.length >= 500 && (
        <span className="text-muted-foreground">…</span>
      )}
    </div>
  );
}

function IconeAssert({ ok }: { ok: boolean | null }) {
  const [Icon, cls] =
    ok === true
      ? [Check, "bg-[var(--ok-bg)] text-[var(--ok-text)]"]
      : ok === false
        ? [X, "bg-[var(--danger-bg)] text-[var(--danger-text)]"]
        : [Minus, "bg-muted text-muted-foreground"];
  return (
    <span
      aria-hidden
      className={cn(
        "mt-px grid size-4 shrink-0 place-items-center rounded-full",
        cls
      )}
    >
      <Icon size={10} weight="bold" />
    </span>
  );
}

/** Dossiê de um item: usado dentro da linha expandida da matriz e nos
 *  cards mobile. `latMedia` (ms) contextualiza a latência do item. */
export function DossieItem({
  item,
  latMedia,
}: {
  item: Item;
  latMedia: number | null;
}) {
  const s = STATUS_ITEM[item.status];
  const asserts = assertsDoItem(item);
  const tools = item.tools_usadas ?? [];
  const executado =
    item.status === "ok" || item.status === "falhou" || item.status === "erro";
  const deltaMedia =
    executado && item.latencia_ms != null && latMedia != null && latMedia > 0
      ? item.latencia_ms - latMedia
      : null;
  const modeloDifere =
    item.modelo_usado != null && item.modelo_usado !== item.modelo;
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            s.cls
          )}
        >
          {s.rotulo}
        </span>
        <span className="text-xs font-medium">rep {item.repeticao}</span>
        {modeloDifere && (
          <span className="text-xs text-muted-foreground">
            respondeu <span className="font-medium">{item.modelo_usado}</span>
          </span>
        )}
        {item.pagina && (
          <span
            title={`página de contexto: ${item.pagina}`}
            className="max-w-40 truncate rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          >
            {item.pagina}
          </span>
        )}
        {executado && (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {ms(item.latencia_ms)}
            {deltaMedia != null && Math.abs(deltaMedia) >= 400 && (
              <span>
                {" "}
                ({deltaMedia > 0 ? "+" : "−"}
                {ms(Math.abs(Math.round(deltaMedia)))} da média)
              </span>
            )}{" "}
            · {num.format(item.tokens_in ?? 0)}+
            {num.format(item.tokens_out ?? 0)} tok · {usd(item.custo_usd)}
          </span>
        )}
      </div>

      {/* case question in the user's voice + Liza's reply — same bubble
          grammar as the real chat */}
      <div className="space-y-1.5">
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--brand-lime)] px-4 py-2 text-sm text-[var(--brand-ink)]">
          {item.msg}
        </p>
        <BolhaLiza item={item} />
      </div>

      {(asserts.length > 1 || asserts[0]?.ok === false) && (
        <ul className="space-y-1">
          {asserts.map((a) => (
            <li key={a.id} className="flex items-start gap-1.5 text-xs">
              <IconeAssert ok={a.ok} />
              <span
                className={cn(
                  a.ok === false
                    ? "text-[var(--danger-text)]"
                    : a.ok === null
                      ? "text-muted-foreground"
                      : "text-foreground"
                )}
              >
                {a.rotulo}
                {a.detalhe && (
                  <span className="text-muted-foreground"> {a.detalhe}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {tools.length > 0 && (
        <ul
          aria-label="Ferramentas que a Liza chamou"
          className="flex flex-wrap gap-1.5"
        >
          {tools.map((t) => (
            <li
              key={t}
              title={t}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-[var(--shadow-border)]"
            >
              {rotuloTool(t)}
            </li>
          ))}
        </ul>
      )}

      {item.request_id && (
        <p className="text-[11px] text-muted-foreground">
          req <span className="font-mono">{item.request_id.slice(0, 8)}</span>
          {item.executado_em &&
            ` · ${new Date(item.executado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
        </p>
      )}
    </div>
  );
}
