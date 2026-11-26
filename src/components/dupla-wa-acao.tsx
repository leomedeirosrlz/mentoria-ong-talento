"use client";

import { useId, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChatsCircle,
  CircleNotch,
  Copy,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { enviarLembrete, type LembreteDestino } from "@/lib/actions-lembrete";
import { superficieDoPath } from "@/lib/produto-eventos";
import { formatDiaMes, LEMBRETE_INTERVALO_MS, waLink } from "@/lib/ciclo";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type NudgeWA = {
  destino: LembreteDestino;
  /** Título da notificação in-app — o corpo é `mensagem`. */
  titulo: string;
  /** Deep-link da notificação pra quem recebe. */
  href: string;
  /** `lembreteBloqueadoAte()` — futuro = cap de 48h em curso. */
  bloqueadoAte: Date | string | null;
  /** Rótulo da primária quando "Lembrar" mente — apoio do jovem vira
   *  "Chamar" (resposta a um pedido, não cobrança; mesma semântica da
   *  fila-acompanhar) e a fila da agenda mantém o caso dominante
   *  ("Lembrar registro"). Continua mandando notificação + wa.me. */
  rotulo?: "Lembrar" | "Lembrar registro" | "Chamar";
};

/** Uma ponta da dupla no seletor do preview: nome pro título, telefone pro
 *  wa.me e o texto já na língua dela — o mentorado nunca recebe a cobrança
 *  operacional que é do mentor (check-in neutro ou a resposta de apoio). */
export type DestinatarioWA = {
  nome: string;
  telefone: string | null | undefined;
  mensagem: string;
};

/** As duas pontas com mensagem própria + quem a ação mira por padrão (a
 *  mesma regra de sempre: mentor nas pendências operacionais, jovem quando
 *  o pedido de apoio é dele). Presente, o preview vira um seletor "Quem
 *  recebe"; ausente, o comportamento é o de um destinatário só. */
export type DestinatariosWA = {
  padrao: "mentor" | "mentorado";
  mentor: DestinatarioWA;
  mentorado: DestinatarioWA;
};

/** Ação WhatsApp da linha de dupla (REALIZA-255): UMA entrada por card —
 *  o botão abre o texto da mensagem antes de qualquer envio. No preview
 *  moram os dois caminhos distintos, sem botão duplicado:
 *    · "Lembrar pelo app" = só a notificação in-app (`enviar_lembrete`,
 *      cap de 48h por dupla → vira "Lembrada dd/mm" desabilitado), nunca
 *      abre WhatsApp;
 *    · "Abrir WhatsApp" = contato direto wa.me com o mesmo texto — o
 *      clique loga `nudge` via /api/nudge e entra no MESMO cap de 48h:
 *      capada, a âncora vira botão desabilitado "Destrava dd/mm" em vez
 *      de cair na página de bloqueio do redirect.
 *  Sem telefone o wa.me fica desabilitado com o motivo visível; o lembrete
 *  in-app segue (a notificação sai mesmo sem número). */
export function DuplaWaAcao({
  duplaId,
  destNome,
  telefone,
  mensagem,
  nudge,
  bloqueadoAte,
  destinatarios,
}: {
  duplaId: string;
  /** Primeiro nome de quem recebe — compõe os aria-labels. Com
   *  `destinatarios` é o nome da ponta `padrao` (o alvo da regra). */
  destNome: string;
  telefone: string | null | undefined;
  /** Texto pronto — preview, cópia, wa.me e (no Lembrar) a notificação. */
  mensagem: string;
  /** Presente = há pendência apontável (libera o Lembrar in-app); ausente =
   *  contato livre — só WhatsApp/copiar. */
  nudge?: NudgeWA;
  /** Cap de 48h pra linha SEM nudge (contato livre): o "Chamar" também
   *  loga nudge, então a dupla pode estar capada mesmo sem pendência —
   *  `acaoWhatsAppDupla` manda a data solta por aqui. Com nudge, vale o
   *  `nudge.bloqueadoAte` (mesma fonte). */
  bloqueadoAte?: Date | string | null;
  /** As duas pontas com texto próprio — o preview vira seletor de quem
   *  recebe. O Lembrar in-app continua fixo no `nudge.destino`: escolhida
   *  a outra ponta, o dialog vira contato direto (só WhatsApp/copiar). */
  destinatarios?: DestinatariosWA;
}) {
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [quem, setQuem] = useState<"mentor" | "mentorado">(
    destinatarios?.padrao ?? "mentor"
  );
  const uid = useId();
  const router = useRouter();
  const pathname = usePathname();
  // "agora" congelado na montagem — mesmo contrato do LembreteButton
  const [agoraMs] = useState(() => Date.now());

  // cada abertura volta na ponta da regra (a escolha da sessão anterior do
  // preview não vaza — mesmo padrão de reset dos dialogs da casa)
  const [abertoAntes, setAbertoAntes] = useState(aberto);
  if (aberto !== abertoAntes) {
    setAbertoAntes(aberto);
    if (aberto && destinatarios) setQuem(destinatarios.padrao);
  }

  const dest: DestinatarioWA = destinatarios?.[quem] ?? {
    nome: destNome,
    telefone,
    mensagem,
  };
  const nomeCurto = dest.nome.split(" ")[0];
  // "Lembrar pelo app" manda a notificação pra quem a pendência aponta
  // (nudge.destino) — escolhida a outra ponta, o dialog vira contato
  // direto e o botão some: rotular "Lembrar" pro WhatsApp seria mentira
  const mostraLembrar =
    nudge != null && (destinatarios == null || quem === nudge.destino);
  const wa = waLink(dest.telefone, dest.mensagem);
  // "Abrir WhatsApp" loga `nudge` — mesmo tipo do Lembrar: o cap de 48h
  // cobre o contato manual também (o clique passa por /api/nudge; sem
  // telefone cai pra null e o item exibe o motivo). `s` anota a
  // superfície do gesto pra telemetria — noreferrer tira o referer
  const sup = superficieDoPath(pathname);
  const waNudge = wa
    ? `/api/nudge?d=${encodeURIComponent(duplaId)}&to=${encodeURIComponent(wa)}&t=nudge&s=${encodeURIComponent(sup)}`
    : null;

  const capAte = nudge?.bloqueadoAte ?? bloqueadoAte ?? null;
  const ate = capAte != null ? new Date(capAte) : null;
  const bloqueado = ate != null && ate.getTime() > agoraMs;
  const diaMes = (d: Date) =>
    formatDiaMes(d.toISOString()).replace(/\/\d{4}$/, "");
  const enviadoEm = bloqueado
    ? diaMes(new Date(ate!.getTime() - LEMBRETE_INTERVALO_MS))
    : null;
  const destravaEm = bloqueado ? diaMes(ate!) : null;

  const rotulo = nudge ? (nudge.rotulo ?? "Lembrar") : "Chamar";
  const rotuloPassado = rotulo === "Chamar" ? "Chamada" : "Lembrada";

  function lembrar() {
    if (!nudge) return;
    start(async () => {
      try {
        const res = await enviarLembrete(duplaId, nudge.destino, {
          titulo: nudge.titulo,
          corpo: dest.mensagem,
          href: nudge.href,
        });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        // Lembrar é SÓ a notificação in-app (REALIZA-255) — o WhatsApp tem
        // o próprio botão no mesmo preview, nada de canal duplicado
        toast.success(
          res.demo
            ? "Modo demo: nada é enviado de verdade."
            : "Lembrete enviado."
        );
        setAberto(false);
        router.refresh();
      } catch {
        toast.error("Sem conexão. Tente de novo.");
      }
    });
  }

  async function copiar() {
    if (!navigator.clipboard?.writeText) {
      toast.error("Não consegui copiar a mensagem.");
      return;
    }
    try {
      await navigator.clipboard.writeText(dest.mensagem);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não consegui copiar a mensagem.");
    }
  }

  const icone = (
    <WhatsappLogo weight="fill" aria-hidden className="text-[var(--ok-text)]" />
  );

  return (
    <>
      {/* a primária abre o preview — o envio escolhe o canal lá dentro.
          44px no mobile (size icon), rótulo curto no desktop */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setAberto(true)}
        aria-label={`${rotulo} ${destNome.split(" ")[0]}: ver a mensagem antes de enviar`}
        title={
          waNudge
            ? `${rotulo} ${destNome.split(" ")[0]}`
            : `${rotulo} ${destNome.split(" ")[0]} (sem WhatsApp cadastrado)`
        }
        className={cn(
          "md:w-auto md:px-3",
          !waNudge && !nudge && "opacity-50"
        )}
      >
        {icone}
        <span className="hidden md:inline">{rotulo}</span>
      </Button>

      {/* o texto antes do envio — a escolha do canal mora aqui, não num
          menu separado: Lembrar é só app, WhatsApp é só wa.me */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {mostraLembrar
                ? `${rotulo} ${nomeCurto}`
                : `Mensagem pra ${nomeCurto}`}
            </DialogTitle>
            <DialogDescription>
              {destinatarios
                ? "Escolha quem recebe e por onde a mensagem sai."
                : "O mesmo texto pros dois canais: escolha onde sai."}
            </DialogDescription>
          </DialogHeader>
          {destinatarios && (
            <fieldset>
              <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Quem recebe
              </legend>
              <div className="grid grid-cols-2 gap-1.5">
                {(["mentorado", "mentor"] as const).map((papel) => {
                  const p = destinatarios[papel];
                  return (
                    <label
                      key={papel}
                      title={p.nome}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-2 transition-colors has-checked:border-primary/60 has-checked:bg-primary/5"
                    >
                      <input
                        type="radio"
                        name={`${uid}-dest`}
                        checked={quem === papel}
                        onChange={() => setQuem(papel)}
                        className="accent-primary"
                      />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-sm font-medium">
                          {p.nome.split(" ")[0]}
                        </span>
                        <span className="block text-xs text-muted-foreground sm:text-[11px]">
                          {papel === "mentorado" ? "mentorado(a)" : "mentor(a)"}
                          {p.telefone ? "" : " · sem WhatsApp"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          <p className="whitespace-pre-wrap break-words rounded-lg bg-muted px-3 py-2.5 text-sm leading-relaxed">
            {dest.mensagem}
          </p>
          {/* wrap: Lembrar + WhatsApp + Copiar não cabem numa linha só
              no modal md — sem wrap a fila justify-end empurrava o
              primeiro botão pra fora do popup (overflow-x-clip cortava).
              mr-auto separa a utilidade (copiar) das ações de envio. */}
          <DialogFooter className="sm:flex-wrap">
            <Button variant="ghost" onClick={copiar} className="sm:mr-auto">
              <Copy aria-hidden />
              Copiar texto
            </Button>
            {mostraLembrar &&
              (bloqueado ? (
                <Button
                  variant="outline"
                  disabled
                  title={`1 lembrete a cada 48h por dupla. Destrava ${destravaEm}`}
                >
                  <ChatsCircle aria-hidden />
                  {rotuloPassado} {enviadoEm}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={lembrar}
                  disabled={pending}
                  title="Só a notificação dentro do app, não abre WhatsApp"
                >
                  {pending ? (
                    <CircleNotch className="animate-spin" aria-hidden />
                  ) : (
                    <ChatsCircle aria-hidden />
                  )}
                  {pending ? "Enviando…" : "Lembrar pelo app"}
                </Button>
              ))}
            {/* o cap cobre o wa.me também (t=nudge): capada, a âncora vira
                botão desabilitado com a data — a rota continuaria servindo
                a página de bloqueio, mas chegar nela por engano é surpresa */}
            {waNudge ? (
              bloqueado ? (
                <Button
                  variant="outline"
                  disabled
                  title={`1 lembrete a cada 48h por dupla, WhatsApp incluso. ${rotuloPassado} ${enviadoEm}`}
                >
                  <WhatsappLogo aria-hidden />
                  Destrava {destravaEm}
                </Button>
              ) : (
                <a
                  href={waNudge}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants()}
                >
                  <WhatsappLogo weight="fill" aria-hidden />
                  Abrir WhatsApp
                </a>
              )
            ) : (
              <Button variant="outline" disabled title="Sem WhatsApp cadastrado">
                <WhatsappLogo aria-hidden />
                Sem WhatsApp cadastrado
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
