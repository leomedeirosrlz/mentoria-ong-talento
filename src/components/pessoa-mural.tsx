"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { addPessoaNota, deletePessoaNota } from "@/lib/actions";
import { demoAtivoClient } from "@/lib/demo/shared";
import { Textarea } from "@/components/ui/textarea";
import { formatDiaMes } from "@/lib/ciclo";

export type MuralNota = {
  id: string;
  texto: string;
  created_at: string;
};

/** Mural de notas do perfil — caderneta PRIVADA do autor (RLS: só
 *  `created_by` lê e apaga). Composer sem botão: o rascunho mora no
 *  localStorage e publica sozinho no Enter/blur/unmount — "sair do campo"
 *  é o envio. Feed = data + texto + apagar (toda nota visível é sua). */
export function PessoaMural({
  pessoaId,
  tipo,
  notas,
  podeAnotar,
  nomePessoa,
}: {
  pessoaId: string;
  tipo: "profile" | "mentorado";
  notas: MuralNota[];
  podeAnotar: boolean;
  nomePessoa: string;
}) {
  const router = useRouter();
  const draftKey = `mural-nota:${pessoaId}`;
  // na demo o rascunho não existe — o que o visitante digita não pode sobrar
  // em localStorage pro próximo (capturado no mount, como no registro-form)
  const [demo] = useState(demoAtivoClient);
  // rascunho restaurado no init — no SSR o localStorage não existe, então o
  // textarea leva suppressHydrationWarning (o mismatch é o rascunho mesmo)
  const [texto, setTexto] = useState(() =>
    typeof window === "undefined" || demo ? "" : (localStorage.getItem(draftKey) ?? "")
  );
  const [pending, start] = useTransition();
  const [apagando, setApagando] = useState<string | null>(null);
  // refs pro cleanup do unmount enxergar o valor atual sem re-subscrever o
  // effect — atualizados pós-commit (escrever ref no render é proibido)
  const textoRef = useRef(texto);
  const pendingRef = useRef(pending);
  const publicarRef = useRef(() => {});
  useEffect(() => {
    textoRef.current = texto;
    pendingRef.current = pending;
    publicarRef.current = publicar;
  });

  function publicar(agora?: string) {
    const valor = (agora ?? textoRef.current).trim();
    if (!valor || pendingRef.current) return;
    start(async () => {
      const res = await addPessoaNota({
        profileId: tipo === "profile" ? pessoaId : undefined,
        mentoradoId: tipo === "mentorado" ? pessoaId : undefined,
        texto: valor,
      });
      if (res?.error) {
        toast.error(res.error);
        return; // rascunho segue no campo e no localStorage
      }
      localStorage.removeItem(draftKey);
      // só limpa se o campo ainda tem o que foi publicado — o que a pessoa
      // digitou durante o voo da action não se perde
      setTexto((cur) => (cur.trim() === valor ? "" : cur));
      router.refresh();
    });
  }

  // sair da página/aba publica o rascunho — melhor esforço (a action dispara
  // o fetch; se a aba fechar de verdade, o rascunho continua no localStorage)
  useEffect(() => {
    return () => publicarRef.current();
  }, []);

  function apagar(notaId: string) {
    setApagando(notaId);
    deletePessoaNota(notaId, pessoaId).then((res) => {
      if (res?.error) toast.error(res.error);
      else router.refresh();
      setApagando(null);
    });
  }

  return (
    <div className="space-y-4">
      {podeAnotar && (
        <div className="space-y-1.5">
          <Textarea
            value={texto}
            suppressHydrationWarning
            onChange={(e) => {
              setTexto(e.target.value);
              if (demo) return;
              if (e.target.value.trim()) localStorage.setItem(draftKey, e.target.value);
              else localStorage.removeItem(draftKey);
            }}
            onBlur={() => publicar()}
            onKeyDown={(e) => {
              // convenção de chat: Enter envia, Shift+Enter quebra linha, Esc limpa
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                publicar();
              } else if (e.key === "Escape") {
                setTexto("");
                localStorage.removeItem(draftKey);
                e.currentTarget.blur();
              }
            }}
            enterKeyHint="send"
            maxLength={10000}
            rows={3}
            placeholder={`Escreva uma nota sobre ${nomePessoa.split(" ")[0]} — observação, combinado, contexto…`}
            aria-label="Nova nota"
            aria-describedby="mural-hint"
          />
          <p id="mural-hint" className="text-xs text-muted-foreground" aria-live="polite">
            {pending ? "Publicando…" : "Só você vê suas notas aqui"}
          </p>
        </div>
      )}

      {notas.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Nenhuma nota sua ainda.
          {podeAnotar && " Observações e combinados sobre a pessoa ficam aqui — só você lê."}
        </p>
      ) : (
        <ul className="space-y-3">
          {notas.map((n) => (
            <li key={n.id} className="group flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{formatDiaMes(n.created_at)}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{n.texto}</p>
              </div>
              <button
                type="button"
                onClick={() => apagar(n.id)}
                disabled={apagando === n.id}
                aria-label="Apagar nota"
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-6 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              >
                {apagando === n.id ? (
                  <CircleNotch size={13} className="animate-spin" aria-hidden />
                ) : (
                  <Trash size={13} aria-hidden />
                )}
                Apagar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
