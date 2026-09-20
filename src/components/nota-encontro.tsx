"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { toast } from "sonner";
import { salvarNotaEncontro } from "@/lib/actions";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** Anotações/plano de aula do mentor por encontro do ciclo — `<details>`
 *  nativo (mesma gramática do "Próximos encontros") com autosave por
 *  debounce + flush no blur. Com nota, o summary mostra a 1ª linha como
 *  preview — scent real em vez de um dot que só diz "existe". */
export function NotaEncontro({
  duplaId,
  numero,
  nota,
  rotulo,
  somenteLeitura,
}: {
  duplaId: string;
  numero: number;
  nota: string | null;
  /** contexto extra no summary — nome do mentorado (>1 dupla) ou "Nº encontro" */
  rotulo?: string;
  /** dupla inativa / não-mentor com nota existente: leitura, sem editor */
  somenteLeitura?: boolean;
}) {
  const inicial = nota ?? "";
  const [texto, setTexto] = useState(inicial);
  const [salvo, setSalvo] = useState(inicial);
  const [status, setStatus] = useState<"idle" | "salvando" | "salvo" | "erro">("idle");
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const seq = useRef(0);

  // prop mudou no servidor (outra sessão salvou): adota se não está editando;
  // dirty preserva o texto local — o blur/debounce leva ele por último
  const [propAnterior, setPropAnterior] = useState(inicial);
  if (inicial !== propAnterior) {
    setPropAnterior(inicial);
    setSalvo(inicial);
    if (texto === salvo) setTexto(inicial);
  }

  async function save(t: string) {
    if (t.trim() === salvo.trim()) return;
    const minha = ++seq.current;
    setStatus("salvando");
    const r = await salvarNotaEncontro(duplaId, numero, t);
    if (minha !== seq.current) return; // uma save mais nova já saiu — ela decide o estado
    if (r.error) {
      setStatus("erro");
      toast.error(r.error);
    } else {
      setSalvo(t);
      setSalvoEm(new Date());
      setStatus("salvo");
    }
  }

  function agendar(t: string) {
    setTexto(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(t), 800);
  }

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    void save(texto);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // somente leitura: conteúdo direto, sem disclosure — é texto pra ler, não ação
  if (somenteLeitura) {
    if (!inicial) return null;
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Anotações{rotulo ? ` · ${rotulo}` : ""}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{inicial}</p>
      </div>
    );
  }

  const preview = texto.split("\n", 1)[0].trim();

  return (
    <details className="group">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-md py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 font-medium text-foreground/80">
          Anotações{rotulo ? ` · ${rotulo}` : ""}
        </span>
        {preview && (
          <span className="min-w-0 flex-1 truncate text-muted-foreground/70">
            — {preview}
          </span>
        )}
        <CaretDown
          size={14}
          aria-hidden
          className={cn(
            "shrink-0 text-muted-foreground transition-transform group-open:rotate-180",
            !preview && "ml-auto"
          )}
        />
      </summary>
      <div className="pb-1 pl-0.5">
        <Textarea
          value={texto}
          onChange={(e) => agendar(e.target.value)}
          onBlur={flush}
          maxLength={10000}
          placeholder="Plano do encontro, lembretes, links…"
          aria-label={`Anotações do ${numero}º encontro`}
          className="border-0 bg-muted/40 px-3 py-2 shadow-none focus-visible:ring-1"
        />
        <p aria-live="polite" className="mt-1 h-4 px-1 text-xs text-muted-foreground">
          {status === "salvando" && "Salvando…"}
          {status === "salvo" && salvoEm && `Salvo às ${fmtHora.format(salvoEm)}`}
          {status === "erro" && (
            <span className="text-[var(--danger)]">Não salvou — saia e volte no campo pra tentar de novo.</span>
          )}
        </p>
      </div>
    </details>
  );
}
