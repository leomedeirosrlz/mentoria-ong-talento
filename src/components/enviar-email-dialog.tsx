"use client";

import { useState, useTransition } from "react";
import {
  Binoculars,
  BookOpen,
  Check,
  CircleNotch,
  EnvelopeSimple,
  FileText,
  Handshake,
  LinkSimple,
  MapTrifold,
  PuzzlePiece,
  Users,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  enviarMaterialEmail,
  reenviarComunicadoEmail,
} from "@/lib/actions-email";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// mesmas audiências dos materiais — cada uma vira um grupo de papéis lá no
// action (ROLES_POR_AUDIENCIA, @/lib/email). Ícones = os das personas da
// /demo (Binoculars coord, MapTrifold DPP, Handshake especialista)
const GRUPOS = [
  { valor: "todos", rotulo: "Todos", detalhe: "coordenação, supervisores e mentores", Icone: Users },
  { valor: "dpp", rotulo: "Mentores DPP", detalhe: "a trilha principal do programa", Icone: MapTrifold },
  { valor: "especialista", rotulo: "Mentores especialistas", detalhe: "a trilha temática", Icone: Handshake },
  { valor: "coordenacao", rotulo: "Coordenação", detalhe: "só a equipe do programa", Icone: Binoculars },
] as const;

// ícone do card de prévia do material — o mesmo mapa da página /materiais
const TIPO_ICONE = {
  guia: BookOpen,
  template: FileText,
  conteudo: PuzzlePiece,
  link: LinkSimple,
} as const;

/** Toast do resultado real do disparo — total e falhas vêm do resumo que o
 *  action devolve (parciais acontecem: endereço inválido não derruba o lote). */
function toastResultado(r: {
  error?: string;
  enviados?: number;
  destinatarios?: number;
  falhas?: string[];
}) {
  const enviados = r.enviados ?? 0;
  const falhas = r.falhas?.length ?? 0;
  const total = r.destinatarios ?? enviados + falhas;
  if (falhas) {
    toast.warning(
      `E-mail enviado para ${enviados} de ${total} — ${falhas} ${
        falhas === 1 ? "falhou" : "falharam"
      }.`
    );
  } else {
    toast.success(
      `E-mail enviado para ${enviados} ${enviados === 1 ? "pessoa" : "pessoas"}.`
    );
  }
}

/** Envio manual de um material por e-mail — a coordenação escolhe os grupos
 *  (a audiência natural do material já vem marcada, mas dá pra alcançar
 *  outra trilha ou reenviar pra quem entrou depois). */
export function EnviarEmailDialog({
  materialId,
  tituloMaterial,
  audienciaPadrao,
  tipoMaterial,
  open,
  onOpenChange,
}: {
  materialId: string;
  tituloMaterial: string;
  audienciaPadrao: string;
  tipoMaterial?: keyof typeof TIPO_ICONE;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, start] = useTransition();
  // remarcar a audiência natural a cada abertura — não dá pra usar
  // defaultChecked num dialog que sobrevive entre materiais/aberturas
  const [selecionados, setSelecionados] = useState<string[]>([]);
  // open é controlado pelo pai — onOpenChange do Base UI não dispara em
  // mudança programática, então a audiência natural é remarcada aqui
  // (padrão "adjust state during render": setState guardado pela comparação
  // com o render anterior, sem efeito)
  const [abertoAntes, setAbertoAntes] = useState(false);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) setSelecionados([audienciaPadrao]);
  }

  function onToggle(valor: string, marcado: boolean) {
    setSelecionados((atual) =>
      marcado ? [...atual, valor] : atual.filter((v) => v !== valor)
    );
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("material_id", materialId);
    start(async () => {
      try {
        const r = await enviarMaterialEmail(fd);
        if (r.error) {
          toast.error(r.error);
          return;
        }
        toastResultado(r);
        onOpenChange(false);
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar material por e-mail</DialogTitle>
          <DialogDescription>
            “{tituloMaterial}” vai para os e-mails cadastrados dos grupos
            marcados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {/* prévia do que vai sair — o cartão espelha o do e-mail */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-lime)]/20 text-foreground">
              {(() => {
                const IconeTipo = tipoMaterial ? TIPO_ICONE[tipoMaterial] : EnvelopeSimple;
                return <IconeTipo size={17} aria-hidden />;
              })()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{tituloMaterial}</p>
              <p className="text-xs text-muted-foreground">chega por e-mail com o link de acesso</p>
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium leading-none select-none">
              Quem recebe
            </legend>
            <div className="grid gap-1.5">
              {GRUPOS.map((g) => {
                const marcado = selecionados.includes(g.valor);
                return (
                  <label
                    key={g.valor}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted has-checked:border-[var(--brand-lime)]/70 has-checked:bg-[var(--brand-lime)]/10 has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background"
                  >
                    <input
                      type="checkbox"
                      name="audiencia"
                      value={g.valor}
                      checked={marcado}
                      onChange={(e) => onToggle(g.valor, e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors peer-checked:bg-[var(--brand-lime)]/25 peer-checked:text-foreground"
                    >
                      <g.Icone size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{g.rotulo}</span>
                      <span className="block text-xs text-muted-foreground">
                        {g.detalhe}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="grid size-5 shrink-0 place-items-center rounded-full border border-border text-transparent transition-colors peer-checked:border-[var(--brand-lime)] peer-checked:bg-[var(--brand-lime)] peer-checked:text-foreground"
                    >
                      <Check size={12} weight="bold" />
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="submit" disabled={pending || !selecionados.length}>
              {pending ? "Enviando…" : "Enviar e-mail"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Reenvio manual do e-mail de um aviso — a publicação já dispara pro
 *  destinatários; isso cobre quem entrou depois ou perdeu o primeiro envio. */
export function ReenviarComunicadoEmailButton({
  comunicadoId,
}: {
  comunicadoId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      disabled={pending}
      aria-busy={pending}
      // a linha de aviso abaixo de sm não tem espaço pro label — vira botão
      // de ícone; o aria-label fixo cobre os dois modos (precedente da
      // agenda: "Abrir dupla" usa hidden sm:inline)
      aria-label="Reenviar por e-mail"
      onClick={() =>
        start(async () => {
          try {
            const fd = new FormData();
            fd.set("comunicado_id", comunicadoId);
            const r = await reenviarComunicadoEmail(fd);
            if (r.error) toast.error(r.error);
            else toastResultado(r);
          } catch {
            toast.error("Sem conexão. Tente de novo.");
          }
        })
      }
    >
      {pending ? (
        <CircleNotch size={14} className="animate-spin" />
      ) : (
        <EnvelopeSimple size={14} />
      )}
      <span className="hidden sm:inline">Reenviar por e-mail</span>
    </Button>
  );
}
