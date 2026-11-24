"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  CircleNotch,
  Megaphone,
  X,
} from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import {
  buscarSlotsEspecialista,
  pedirEspecialistaJovem,
} from "@/lib/actions-jovem";
import { rotuloSlot } from "@/lib/ciclo";
import { pedidoPrecisaDemanda } from "@/lib/jovem-especialista";
import { avatarPublicUrl } from "@/lib/avatar";
import type { JovemEspecialista } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { ConfirmarSlotDialog } from "@/components/pedir-especialista-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const primeiro = (nome: string | null | undefined) =>
  (nome ?? "").split(" ")[0] || "o especialista";

/** Painel inline do pedido de especialista (spec 023, FR-009/FR-011): a
 *  etapa de horário+texto que antes vivia no modal — a seleção do alvo já
 *  aconteceu na grade (card dirigido ou o card mural). Monta sob a grade
 *  com âncora `#pedir`, recebe o foco ao abrir e o wrapper o devolve ao
 *  card ao fechar. O caller remonta por alvo via `key`, então texto,
 *  slots e erro são sempre do alvo atual. Mesma action e mesmos gates do
 *  dialog antigo — o banco revalida dedup/teto/slot e a UI repassa o erro
 *  como veio: toast + inline no campo. O chip de horário abre o
 *  ConfirmarSlotDialog — o atalho da spec —, então o submit daqui é
 *  sempre "deixar quem aceita propor" (slot null). */
export function PedirEspecialistaPainel({
  esp,
  trilhasAtivas,
  slotsIniciais,
  onFechar,
  onEnviado,
  onPendingChange,
}: {
  /** Alvo dirigido — null = o mural ("Qualquer especialista"). */
  esp: JovemEspecialista | null;
  /** profile_ids das trilhas esp ativas/pausadas do jovem — alimenta o
   *  gate demanda×motivo por par (trigger 0074). */
  trilhasAtivas: string[];
  /** Slots já trazidos pelo server pra este especialista; sem eles o
   *  painel busca a grade do alvo on-demand, como o dialog fazia. */
  slotsIniciais?: string[];
  /** Cancelar/Escape — o wrapper fecha o painel e devolve o foco ao card. */
  onFechar: () => void;
  /** Pedido enviado — limpa a seleção e devolve o foco ao card. */
  onEnviado: () => void;
  /** Reporta o pending do submit pro wrapper travar a seleção dos cards. */
  onPendingChange?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [slotAtalho, setSlotAtalho] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | undefined>(slotsIniciais);
  const refPainel = useRef<HTMLElement>(null);
  const refTexto = useRef<HTMLTextAreaElement>(null);

  const nome = esp ? esp.nome_social || esp.nome : null;
  const nome1 = primeiro(nome);
  const precisaDemanda = pedidoPrecisaDemanda(
    trilhasAtivas,
    esp?.id ?? null
  );

  // a região recebe o foco ao abrir — a montagem é sempre uma abertura (a
  // key por alvo no caller remonta a cada seleção), então roda uma vez
  useEffect(() => {
    refPainel.current?.focus();
  }, []);

  // a grade de horários do alvo chega lazy — seeds do server quando a mesa
  // já trouxe; `slots` definido encerra o carregamento (undefined = buscando)
  useEffect(() => {
    if (!esp || slots !== undefined) return;
    let vivo = true;
    buscarSlotsEspecialista(esp.id)
      .then((r) => {
        if (vivo) setSlots(r.slots);
      })
      .catch(() => {
        if (vivo) setSlots([]);
      });
    return () => {
      vivo = false;
    };
  }, [esp, slots]);

  // o pending sobe pro wrapper — a seleção dos cards trava até a resposta
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  // saneamento de forma espelhando a action — a RPC refaz as regras de
  // domínio (dedup, teto, slot dentro da grade), aqui só o formato do
  // texto vira erro inline antes do submit
  function validarTexto(): string | null {
    const t = texto.trim();
    if (precisaDemanda) {
      if (t.length < 10) {
        return "Conta um pouco mais: entre 10 e 1.000 caracteres.";
      }
    } else if (t.length > 0 && t.length < 3) {
      return "O motivo precisa ter entre 3 e 500 caracteres.";
    }
    return null;
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const falha = validarTexto();
    if (falha) {
      setErro(falha);
      refTexto.current?.focus();
      return;
    }
    start(async () => {
      try {
        const res = await pedirEspecialistaJovem({
          especialistaId: esp?.id ?? null,
          slot: null,
          demanda: precisaDemanda ? texto.trim() : null,
          motivo: precisaDemanda ? null : texto.trim() || null,
        });
        if (res?.error) {
          toast.error(res.error);
          setErro(res.error);
          refTexto.current?.focus();
          return;
        }
        toast.success(
          esp
            ? `Pedido enviado pra ${nome1}!`
            : "Pedido enviado pro mural dos especialistas!"
        );
        onEnviado();
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <>
      <section
        id="pedir"
        ref={refPainel}
        tabIndex={-1}
        aria-label={esp ? `Pedido para ${nome}` : "Pedido para o mural"}
        onKeyDown={(e) => {
          if (e.key === "Escape") onFechar();
        }}
        className="animate-enter mt-4 scroll-mt-20 outline-none"
      >
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {esp ? (
                  <Avatar
                    nome={nome ?? ""}
                    src={
                      esp.avatar_path
                        ? avatarPublicUrl(esp.avatar_path)
                        : null
                    }
                    size={40}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                  >
                    <Megaphone size={18} />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {esp ? `Pedido para ${nome}` : "Pedido para o mural"}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {esp
                      ? `Você manda o pedido, ${nome1} responde e vocês marcam a sessão juntos.`
                      : "Seu nome e o pedido aparecem no mural de todos os especialistas. Quem puder te atender aceita e propõe um horário."}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onFechar}
                aria-label="Fechar"
                className="shrink-0"
              >
                <X aria-hidden />
              </Button>
            </div>

            {esp && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Horário pra sessão{" "}
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </p>
                {slots === undefined ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CircleNotch
                      size={13}
                      className="animate-spin"
                      aria-hidden
                    />
                    Buscando os horários livres de {nome1}…
                  </p>
                ) : slots.length === 0 ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {nome1} não abriu horários livres nas próximas semanas.
                    Manda o pedido e quem aceita propõe um horário com você.
                  </p>
                ) : (
                  <>
                    <ul className="flex flex-wrap gap-1.5">
                      {slots.slice(0, 12).map((s) => (
                        <li key={s}>
                          <button
                            type="button"
                            title={`Pedir sessão ${rotuloSlot(s)}`}
                            onClick={() => setSlotAtalho(s)}
                            className="inline-flex min-h-11 items-center rounded-md border border-border px-2.5 text-xs tabular-nums text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10"
                          >
                            {rotuloSlot(s)}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Toca num horário pra já confirmar o pedido. Sem
                      escolher, manda o pedido e {nome1} propõe um com
                      você.
                    </p>
                  </>
                )}
              </div>
            )}

            <form onSubmit={submit} noValidate className="space-y-3">
              <div className="space-y-2">
                {precisaDemanda ? (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <Label htmlFor="pedido-texto">
                        Por que você quer esse apoio?
                      </Label>
                      <span
                        aria-hidden
                        className="text-xs tabular-nums text-muted-foreground"
                      >
                        {texto.length}/1.000
                      </span>
                    </div>
                    <Textarea
                      id="pedido-texto"
                      ref={refTexto}
                      required
                      minLength={10}
                      maxLength={1000}
                      rows={4}
                      value={texto}
                      onChange={(e) => {
                        setTexto(e.target.value);
                        setErro(null);
                      }}
                      placeholder="Conta por que você quer esse apoio. O especialista lê isso antes de aceitar."
                      aria-invalid={erro ? true : undefined}
                      aria-describedby={
                        erro ? "pedido-texto-erro" : "pedido-texto-hint"
                      }
                    />
                    {erro ? (
                      <p
                        id="pedido-texto-erro"
                        role="alert"
                        className="text-sm text-destructive"
                      >
                        {erro}
                      </p>
                    ) : (
                      <p
                        id="pedido-texto-hint"
                        className="text-xs text-muted-foreground"
                      >
                        Mínimo de 10 caracteres.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Label htmlFor="pedido-texto">
                      Pra que é a sessão?{" "}
                      <span className="font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    </Label>
                    <Textarea
                      id="pedido-texto"
                      ref={refTexto}
                      minLength={3}
                      maxLength={500}
                      rows={2}
                      value={texto}
                      onChange={(e) => {
                        setTexto(e.target.value);
                        setErro(null);
                      }}
                      placeholder="Ex.: próxima sessão da trilha."
                      aria-invalid={erro ? true : undefined}
                      aria-describedby={
                        erro ? "pedido-texto-erro" : undefined
                      }
                    />
                    {erro && (
                      <p
                        id="pedido-texto-erro"
                        role="alert"
                        className="text-sm text-destructive"
                      >
                        {erro}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onFechar}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    pending || (precisaDemanda && texto.trim().length < 10)
                  }
                  aria-busy={pending}
                >
                  {pending ? (
                    <CircleNotch
                      size={16}
                      className="animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <CheckCircle size={16} aria-hidden />
                  )}
                  {pending ? "Enviando…" : "Enviar pedido"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* atalho da spec: o chip de horário abre a confirmação curta —
          "mudar especialista ou horário" fecha ela e devolve o fluxo ao
          painel, que já é o caminho completo (chips aqui, cards na grade) */}
      {esp && slotAtalho != null && (
        <ConfirmarSlotDialog
          espId={esp.id}
          espNome={nome ?? "o especialista"}
          slot={slotAtalho}
          precisaDemanda={precisaDemanda}
          open
          onOpenChange={(o) => {
            if (!o) setSlotAtalho(null);
          }}
          onExpandir={() => setSlotAtalho(null)}
          onEnviado={onEnviado}
        />
      )}
    </>
  );
}
