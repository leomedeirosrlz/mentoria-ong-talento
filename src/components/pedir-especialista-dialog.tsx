"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  CircleNotch,
  Megaphone,
  UserFocus,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  buscarSlotsEspecialista,
  pedirEspecialistaJovem,
} from "@/lib/actions-jovem";
import { rotuloSlot } from "@/lib/ciclo";
import { pedidoPrecisaDemanda } from "@/lib/jovem-especialista";
import type { JovemEspecialista } from "@/lib/types";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const primeiro = (nome: string | null | undefined) =>
  (nome ?? "").split(" ")[0] || "o especialista";

/** Opção do passo "pra quem" — o card inteiro é um botão de escolha. */
function OpcaoAlvo({
  selecionado,
  icone,
  titulo,
  texto,
  onClick,
}: {
  selecionado: boolean;
  icone: React.ReactNode;
  titulo: string;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionado}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
        selecionado
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 shrink-0",
          selecionado ? "text-primary" : "text-muted-foreground"
        )}
      >
        {icone}
      </span>
      <span>
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {texto}
        </span>
      </span>
    </button>
  );
}

/** Chip clicável de horário — a mesma leitura dos slots da agenda. */
function ChipSlot({
  selecionado,
  onClick,
  children,
}: {
  selecionado: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selecionado}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-xs tabular-nums transition-colors",
        selecionado
          ? "border-primary bg-primary/10 font-medium text-foreground"
          : "border-border text-muted-foreground hover:border-primary hover:bg-primary/5"
      )}
    >
      {children}
    </button>
  );
}

/** Dialog do pedido de especialista do jovem (REALIZA-112): alvo (um
 *  especialista do catálogo jovem_especialistas ou o mural), horário
 *  opcional da grade real dele e o texto — demanda (10–1000) no primeiro
 *  pedido, motivo curto quando já existe trilha (o gate é o da RPC 0074).
 *  O que a UI mostra o banco revalida — o submit repassa os erros da RPC
 *  como vieram (dedup, teto, slot fora da agenda). */
export function PedirEspecialistaDialog({
  especialistas,
  trilhasAtivas,
  slotsPorEsp,
  semDuplaDpp,
  preEspId,
  preSlot,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  /** Catálogo jovem_especialistas — nome/social/avatar/áreas, sem contato. */
  especialistas: JovemEspecialista[];
  /** profile_ids dos especialistas com trilha ativa/pausada do jovem — vazia
   *  liga o gate da demanda (primeiro pedido conta o porquê). */
  trilhasAtivas: string[];
  /** Slots livres já trazidos pelo server (a agenda passa o do próprio
   *  especialista); o resto o dialog busca on-demand na escolha. */
  slotsPorEsp?: Record<string, string[]>;
  /** Jovem sem dupla DPP ativa — o pedido entra na triagem da coordenação
   *  antes do mural (status aguardando_coord). Só muda o texto do aviso. */
  semDuplaDpp?: boolean;
  /** Prefill — a agenda abre já apontando pro especialista/slot clicado. */
  preEspId?: string | null;
  preSlot?: string | null;
  trigger?: React.ReactElement;
  /** controlado externamente (os chips de slot da agenda são o trigger) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInt, setOpenInt] = useState(false);
  const open = openProp ?? openInt;
  const setOpen = onOpenChangeProp ?? setOpenInt;
  const [pending, start] = useTransition();
  const router = useRouter();

  const [modo, setModo] = useState<"dirigido" | "qualquer" | null>(null);
  const [espId, setEspId] = useState<string | null>(null);
  const [slotSel, setSlotSel] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [cacheSlots, setCacheSlots] = useState<Record<string, string[]>>({});
  const [carregandoEsp, setCarregandoEsp] = useState<string | null>(null);

  // reset ao abrir — ajuste durante o render, o padrão que o React recomenda
  // pra estado derivado de props (mesmo jeito do Avatar)
  const [estavaAberto, setEstavaAberto] = useState(open);
  if (open !== estavaAberto) {
    setEstavaAberto(open);
    if (open) {
      setModo(preEspId ? "dirigido" : null);
      setEspId(preEspId ?? null);
      setSlotSel(preSlot ?? null);
      setTexto("");
      setCarregandoEsp(null);
      setCacheSlots(slotsPorEsp ?? {});
    }
  }

  const esp = especialistas.find((e) => e.id === espId) ?? null;
  const slotsDoEsp = espId ? cacheSlots[espId] : undefined;
  // gate por PAR (trigger 0074): dirigido a um nome fora das trilhas ainda
  // é "primeiro pedido" e pede a demanda rica — motivo-curto só vale pra
  // trilha própria ou broadcast (qualquer trilha viva libera)
  const precisaDemanda = pedidoPrecisaDemanda(
    trilhasAtivas,
    modo === "dirigido" ? espId : null
  );

  function escolherEsp(id: string) {
    setEspId(id);
    setSlotSel(preSlot && id === preEspId ? preSlot : null);
    if (cacheSlots[id] === undefined && carregandoEsp !== id) {
      setCarregandoEsp(id);
      buscarSlotsEspecialista(id)
        .then((r) => setCacheSlots((c) => ({ ...c, [id]: r.slots })))
        .catch(() => setCacheSlots((c) => ({ ...c, [id]: [] })))
        .finally(() =>
          setCarregandoEsp((c) => (c === id ? null : c))
        );
    }
  }

  const podeEnviar =
    modo === "qualquer" ||
    (modo === "dirigido" && espId != null);
  const textoOk =
    !precisaDemanda || texto.trim().length >= 10;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dirigido = modo === "dirigido" && espId;
    start(async () => {
      try {
        const res = await pedirEspecialistaJovem({
          especialistaId: dirigido ? espId : null,
          slot: dirigido ? slotSel : null,
          demanda: precisaDemanda ? texto.trim() : null,
          motivo: precisaDemanda ? null : texto.trim() || null,
        });
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        if (res?.status === "aguardando_coord") {
          toast.success(
            "Pedido registrado! A coordenação dá uma olhada e libera pros especialistas."
          );
        } else {
          toast.success(
            esp
              ? `Pedido enviado pra ${primeiro(esp.nome_social || esp.nome)}!`
              : "Pedido enviado pro mural dos especialistas!"
          );
        }
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {openProp === undefined && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button size="sm">
                <UserFocus size={16} aria-hidden />
                Pedir um especialista
              </Button>
            )
          }
        />
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedir apoio de um especialista</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">
          Especialistas são mentors pra temas pontuais — uma prova, um
          projeto, uma decisão. Você manda o pedido, a pessoa responde e
          vocês marcam a sessão juntos.
        </DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <OpcaoAlvo
              selecionado={modo === "dirigido"}
              icone={<UserFocus size={18} />}
              titulo="Um especialista específico"
              texto="Você escolhe quem recebe o pedido."
              onClick={() => setModo("dirigido")}
            />
            <OpcaoAlvo
              selecionado={modo === "qualquer"}
              icone={<Megaphone size={18} />}
              titulo="Qualquer especialista"
              texto="O pedido vai pro mural de todos."
              onClick={() => {
                setModo("qualquer");
                setEspId(null);
                setSlotSel(null);
              }}
            />
          </div>

          {modo === "dirigido" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Quem você quer procurar?</p>
              <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {especialistas.map((e) => {
                  const nome = e.nome_social || e.nome;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => escolherEsp(e.id)}
                        aria-pressed={espId === e.id}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                          espId === e.id
                            ? "border-primary bg-primary/5"
                            : "border-border/70 hover:bg-muted/40"
                        )}
                      >
                        <Avatar
                          nome={nome}
                          src={
                            e.avatar_path
                              ? avatarPublicUrl(e.avatar_path)
                              : null
                          }
                          size={34}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {nome}
                          </span>
                          {e.areas?.length ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {e.areas.join(" · ")}
                            </span>
                          ) : null}
                        </span>
                        {espId === e.id && (
                          <CheckCircle
                            size={16}
                            weight="fill"
                            className="shrink-0 text-primary"
                            aria-hidden
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {modo === "dirigido" && esp && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Horário pra sessão{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </p>
              {slotsDoEsp === undefined ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CircleNotch size={13} className="animate-spin" aria-hidden />
                  Buscando os horários livres de{" "}
                  {primeiro(esp.nome_social || esp.nome)}…
                </p>
              ) : slotsDoEsp.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {primeiro(esp.nome_social || esp.nome)} não abriu horários
                  livres nas próximas semanas — manda o pedido e quem aceita
                  propõe um horário com você.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <ChipSlot
                    selecionado={slotSel === null}
                    onClick={() => setSlotSel(null)}
                  >
                    Deixar {primeiro(esp.nome_social || esp.nome)} propor
                  </ChipSlot>
                  {slotsDoEsp.slice(0, 12).map((s) => (
                    <ChipSlot
                      key={s}
                      selecionado={slotSel === s}
                      onClick={() => setSlotSel(s)}
                    >
                      {rotuloSlot(s)}
                    </ChipSlot>
                  ))}
                </div>
              )}
            </div>
          )}

          {modo === "qualquer" && (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Seu nome e o pedido aparecem no mural de todos os especialistas
              — quem puder te atender aceita e propõe um horário.
            </p>
          )}

          {modo && (
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
                    required
                    minLength={10}
                    maxLength={1000}
                    rows={4}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Conta por que você quer esse apoio — o especialista lê isso antes de aceitar."
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo de 10 caracteres.
                  </p>
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
                    minLength={3}
                    maxLength={500}
                    rows={2}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Ex.: próxima sessão da trilha."
                  />
                </>
              )}
            </div>
          )}

          {modo && semDuplaDpp && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Como você ainda não tá numa dupla do programa, a coordenação dá
              uma olhada no pedido antes dele chegar aos especialistas.
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!podeEnviar || !textoOk || pending}
            aria-busy={pending}
          >
            {pending ? (
              <CircleNotch size={16} className="animate-spin" aria-hidden />
            ) : (
              <CheckCircle size={16} aria-hidden />
            )}
            {pending ? "Enviando…" : "Enviar pedido"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Os chips de horário do especialista viram "pedir esse horário" — cada
 *  clique abre o dialog já com o especialista e o slot preenchidos. */
export function JovemEspSlots({
  espId,
  slots,
  ...dialogProps
}: Omit<
  React.ComponentProps<typeof PedirEspecialistaDialog>,
  "preEspId" | "preSlot" | "open" | "onOpenChange" | "trigger"
> & { espId: string; slots: string[] }) {
  const [open, setOpen] = useState(false);
  const [slotSel, setSlotSel] = useState<string | null>(null);
  return (
    <>
      <ul className="flex flex-wrap gap-1.5">
        {slots.slice(0, 10).map((s) => (
          <li key={s}>
            <button
              type="button"
              title={`Pedir sessão ${rotuloSlot(s)}`}
              onClick={() => {
                setSlotSel(s);
                setOpen(true);
              }}
              className="rounded-md border border-border px-2 py-1 text-xs tabular-nums transition-colors hover:border-primary hover:bg-primary/10"
            >
              {rotuloSlot(s)}
            </button>
          </li>
        ))}
      </ul>
      <PedirEspecialistaDialog
        {...dialogProps}
        open={open}
        onOpenChange={setOpen}
        preEspId={espId}
        preSlot={slotSel}
      />
    </>
  );
}
