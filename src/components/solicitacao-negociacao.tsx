"use client";

import { useState, useTransition } from "react";
import {
  ArrowsClockwise,
  CheckCircle,
  ThumbsDown,
  WhatsappLogo,
  XCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  aceitarProposta,
  aceitarSolicitacao,
  cancelarSolicitacao,
  contraProporSolicitacao,
  recusarSolicitacao,
} from "@/lib/actions-especialista";
import type {
  AppRole,
  SolicitacaoEspecialista,
  SolicitacaoProposta,
} from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { rotuloSlot, tempoRelativo } from "@/lib/ciclo";
import { cn } from "@/lib/utils";

/** Quem pode recusar: só o especialista procurado/engajado (a recusa é um
 *  não pessoal — pedido broadcast o especialista simplesmente não pega). */
function podeRecusar(s: SolicitacaoEspecialista, meuId: string): boolean {
  return s.especialista_desejado_id === meuId || s.especialista_id === meuId;
}

/** " por Sofia" — quem recusou, quando o nome chega no mural. */
function quemRecusou(sol: SolicitacaoEspecialista) {
  const n = sol.especialista?.nome ?? sol.desejado?.nome;
  return n ? ` por ${n}` : "";
}

/** Nome do autor da proposta quando o embed `autor` vem null — o
 *  profiles_select da 0076 devolve null pro profile que o leitor não
 *  alcança (jovem fora da dupla dele; qualquer profile pro papel
 *  mentorado). A solicitação pai resolve os dois lados da mesa sem
 *  consultar profile: especialista engajado/dirigido pelos campos da
 *  própria solicitação; o autor do pedido é o created_by — jovem chega
 *  pelo mentorado_nome plano, staff sem nome plano vira "a equipe". */
function nomeAutor(
  p: SolicitacaoProposta,
  s: SolicitacaoEspecialista
): string | null {
  if (p.autor?.nome) return p.autor.nome;
  if (p.autor_id === s.especialista_id) return s.especialista?.nome ?? null;
  if (p.autor_id === s.especialista_desejado_id)
    return s.desejado?.nome ?? null;
  if (p.autor_id === s.created_by)
    return (
      s.solicitante?.nome ??
      (s.origem === "jovem" ? s.mentorado?.nome ?? null : "a equipe")
    );
  return null;
}

/** Linha da thread: quem propôs, o horário e o recado — append-only. */
function Thread({ propostas, s, meuId, agoraMs }: {
  propostas: SolicitacaoProposta[];
  s: SolicitacaoEspecialista;
  meuId: string;
  agoraMs: number;
}) {
  if (propostas.length === 0) return null;
  return (
    <ul className="space-y-2 border-l-2 border-border/60 pl-3">
      {propostas.map((p) => (
        <li key={p.id} className="space-y-0.5">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {p.autor_id === meuId ? "Você" : (nomeAutor(p, s) ?? "—")}
            </span>{" "}
            propôs {rotuloSlot(p.slot_proposto)} ·{" "}
            {tempoRelativo(p.created_at, agoraMs)}
          </p>
          {p.mensagem && (
            <p className="text-sm text-foreground/90">“{p.mensagem}”</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Form de contra-proposta — o slot sai SEMPRE da grade do especialista da
 *  negociação (a RPC rejeita horário fora dela, dos dois lados da mesa). */
function ContraPropostaForm({
  solicitacaoId,
  slots,
  onFechar,
}: {
  solicitacaoId: string;
  slots: string[];
  onFechar: () => void;
}) {
  const [slot, setSlot] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [pendente, start] = useTransition();
  if (slots.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sem horário livre na agenda do especialista nas próximas 3 semanas.
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      <Select
        value={slot}
        onValueChange={(v) => setSlot(v as string)}
        items={Object.fromEntries(slots.map((sl) => [sl, rotuloSlot(sl)]))}
      >
        <SelectTrigger size="sm" aria-label="Novo horário">
          <SelectValue placeholder="Escolha um horário da agenda" />
        </SelectTrigger>
        <SelectContent>
          {slots.map((sl) => (
            <SelectItem key={sl} value={sl}>
              {rotuloSlot(sl)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        placeholder="Mensagem (opcional)"
        rows={2}
        aria-label="Mensagem da contra-proposta"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!slot || pendente}
          onClick={() =>
            start(async () => {
              const r = await contraProporSolicitacao(
                solicitacaoId,
                slot!,
                mensagem.trim() || null
              );
              if (r.error) toast.error(r.error);
              else {
                toast.success("Contra-proposta enviada.");
                onFechar();
              }
            })
          }
        >
          <ArrowsClockwise size={15} />
          Propor
        </Button>
        <Button size="sm" variant="ghost" onClick={onFechar}>
          Fechar
        </Button>
      </div>
    </div>
  );
}

/** Form de recusa — a justificativa é obrigatória (a RPC exige ≥3 chars) e
 *  chega ao autor como notificação. */
function RecusaForm({
  solicitacaoId,
  onFechar,
}: {
  solicitacaoId: string;
  onFechar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [pendente, start] = useTransition();
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Por que não dá pra assumir? (obrigatório)"
        rows={2}
        aria-label="Motivo da recusa"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={texto.trim().length < 3 || pendente}
          onClick={() =>
            start(async () => {
              const r = await recusarSolicitacao(solicitacaoId, texto.trim());
              if (r.error) toast.error(r.error);
              else {
                toast.success("Pedido recusado — o autor foi avisado.");
                onFechar();
              }
            })
          }
        >
          <ThumbsDown size={15} />
          Recusar pedido
        </Button>
        <Button size="sm" variant="ghost" onClick={onFechar}>
          Voltar
        </Button>
      </div>
    </div>
  );
}

/** Bloco de negociação de um pedido de especialista (0074): mostra o horário
 *  na mesa, a thread de propostas e os botões do lado que age — o aceite do
 *  especialista vai por aceitar_solicitacao, o do autor por aceitar_proposta;
 *  a contra-proposta é bilateral; a recusa e o cancelamento têm dono. Fora da
 *  vez do visitante o bloco é só leitura com o "aguardando" honesto. */
export function SolicitacaoNegociacao({
  s,
  propostas,
  slots,
  meuId,
  papel,
  waCoord,
  onAceito,
}: {
  s: SolicitacaoEspecialista;
  propostas: SolicitacaoProposta[];
  /** Slots livres do especialista da negociação — o horário proposto sempre
   *  sai da grade dele (a RPC valida dos dois lados). Quem renderiza busca
   *  via getSlotsLivres; vazio desativa a contra-proposta. */
  slots: string[];
  /** profile.id do visitante — define a vez ("sua proposta" não se responde). */
  meuId: string;
  papel: AppRole | null;
  /** Link wa.me da coordenação — o fallback do jovem nos estados sem saída
   *  (expirou, idas e vindas demais): o especialista NÃO é contato dele
   *  antes do aceite (jovem_contatos), então "falar com alguém" = a equipe. */
  waCoord?: string | null;
  /** opcional — chamado com a dupla criada/efetivada quando o aceite fecha
   *  (o mural navega pra ficha da nova dupla). */
  onAceito?: (duplaId?: string) => void;
}) {
  const [agoraMs] = useState(() => Date.now());
  const [abrindo, setAbrindo] = useState<"proposta" | "recusa" | null>(null);
  const [pendente, start] = useTransition();
  const [slotAceite, setSlotAceite] = useState<string | null>(null);

  const efetivo = s.status_efetivo ?? s.status;
  const emNegociacao = efetivo === "aberta" || efetivo === "contra_proposta";

  // os dois lados da mesa — o coord não-autor é parte só pelo cancelamento
  const souAutor = s.created_by === meuId || papel === "coordenacao";
  const souEsp =
    papel === "mentor_especialista" &&
    (s.especialista_id === meuId ||
      s.especialista_desejado_id === meuId ||
      (s.especialista_id == null && s.especialista_desejado_id == null));

  const ultima = propostas.at(-1);
  // não se responde a própria proposta — a vez é do outro lado
  const espereOutro = ultima != null && ultima.autor_id === meuId;
  // o autor só responde quando a última proposta é do especialista engajado
  const autorPodeAceitar =
    efetivo === "contra_proposta" &&
    s.especialista_id != null &&
    ultima?.autor_id === s.especialista_id;

  if (!emNegociacao) {
    // estados encerrados — o que aconteceu conta história, não pede ação
    if (efetivo === "recusada" && s.justificativa_recusa) {
      // pro jovem, a voz é a dele: quem não pegou + a saída honesta
      const quem = s.especialista?.nome ?? s.desejado?.nome;
      return papel === "mentorado" ? (
        <p className="text-sm text-muted-foreground">
          {quem ? `${quem} não pôde pegar o pedido` : "O pedido não rolou"} —
          “{s.justificativa_recusa}”. Você pode fazer um novo pedido.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Recusado{quemRecusou(s)} — “{s.justificativa_recusa}”
        </p>
      );
    }
    if (efetivo === "expirada") {
      // a expiração é lazy — o registro segue "aberto" no banco; o autor (ou
      // a coord) pode cancelar pra limpar o mural, ou faz novo pedido
      const souAutorAqui = s.created_by === meuId || papel === "coordenacao";
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {papel === "mentorado"
              ? "O horário proposto passou e o pedido expirou — cancela esse pra pedir de novo, ou fala com a coordenação."
              : "O horário proposto passou — o pedido expirou. Um novo pedido precisa ser feito."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {souAutorAqui && (
              <ConfirmDeleteButton
                titulo="Cancelar pedido?"
                descricao="O pedido expirado sai da lista."
                acao="Cancelar pedido"
                sucesso="Pedido cancelado."
                onConfirm={() => cancelarSolicitacao(s.id)}
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                  >
                    <XCircle size={15} />
                    Cancelar pedido
                  </Button>
                }
              />
            )}
            {papel === "mentorado" && waCoord && (
              <a
                href={waCoord}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "text-muted-foreground"
                )}
              >
                <WhatsappLogo size={15} aria-hidden />
                Falar com a coordenação
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            )}
          </div>
        </div>
      );
    }
    return null;
  }

  const ultimoNome =
    ultima && ultima.autor_id !== meuId
      ? (nomeAutor(ultima, s) ?? "a outra parte")
      : null;

  return (
    <div className="space-y-3">
      {s.slot_proposto && (
        <p className="text-sm">
          <span className="text-muted-foreground">Horário na mesa: </span>
          <span className="font-medium">{rotuloSlot(s.slot_proposto)}</span>
          {ultimoNome && (
            <span className="text-muted-foreground"> · por {ultimoNome}</span>
          )}
        </p>
      )}

      <Thread propostas={propostas} s={s} meuId={meuId} agoraMs={agoraMs} />

      {espereOutro ? (
        <p className="text-xs text-muted-foreground">
          Aguardando resposta — sua proposta é a última da mesa.
        </p>
      ) : souEsp ? (
        <div className="space-y-2">
          {/* a vez do especialista: aceitar o horário na mesa (ou escolher
              um quando o pedido não trouxe) e/ou propor outro */}
          {abrindo !== "recusa" && (
            <div className="flex flex-wrap items-center gap-2">
              {s.slot_proposto ? (
                <Button
                  size="sm"
                  disabled={pendente}
                  onClick={() =>
                    start(async () => {
                      const r = await aceitarSolicitacao(s.id);
                      if (r.error) toast.error(r.error);
                      else {
                        toast.success("Pedido aceito — sessão marcada.");
                        onAceito?.(r.duplaId);
                      }
                    })
                  }
                >
                  <CheckCircle size={15} />
                  Aceitar {rotuloSlot(s.slot_proposto)}
                </Button>
              ) : slots.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem horário livre na sua agenda nas próximas semanas —
                  abra janelas na sua agenda pra aceitar.
                </p>
              ) : (
                <>
                  <div className="min-w-44">
                    <Select
                      value={slotAceite}
                      onValueChange={(v) => setSlotAceite(v as string)}
                      items={Object.fromEntries(
                        slots.map((sl) => [sl, rotuloSlot(sl)])
                      )}
                    >
                      <SelectTrigger size="sm" aria-label="Horário da sessão">
                        <SelectValue placeholder="Horário da agenda" />
                      </SelectTrigger>
                      <SelectContent>
                        {slots.map((sl) => (
                          <SelectItem key={sl} value={sl}>
                            {rotuloSlot(sl)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    disabled={!slotAceite || pendente}
                    onClick={() =>
                      start(async () => {
                        const r = await aceitarSolicitacao(s.id, slotAceite!);
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success("Pedido aceito — sessão marcada.");
                          onAceito?.(r.duplaId);
                        }
                      })
                    }
                  >
                    <CheckCircle size={15} />
                    Aceitar
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={abrindo === "proposta"}
                onClick={() => setAbrindo("proposta")}
              >
                <ArrowsClockwise size={15} />
                Propor outro horário
              </Button>
              {podeRecusar(s, meuId) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => setAbrindo("recusa")}
                >
                  <ThumbsDown size={15} />
                  Recusar
                </Button>
              )}
            </div>
          )}
          {abrindo === "proposta" && (
            <ContraPropostaForm
              solicitacaoId={s.id}
              slots={slots}
              onFechar={() => setAbrindo(null)}
            />
          )}
          {abrindo === "recusa" && (
            <RecusaForm
              solicitacaoId={s.id}
              onFechar={() => setAbrindo(null)}
            />
          )}
        </div>
      ) : souAutor ? (
        <div className="space-y-2">
          {/* a vez do autor só existe quando a proposta na mesa é do
              especialista — fora isso é cancelar ou esperar */}
          {abrindo !== "proposta" && (
            <div className="flex flex-wrap items-center gap-2">
              {autorPodeAceitar && s.slot_proposto && (
                <Button
                  size="sm"
                  disabled={pendente}
                  onClick={() =>
                    start(async () => {
                      const r = await aceitarProposta(s.id);
                      if (r.error) toast.error(r.error);
                      else {
                        toast.success("Horário aceito — sessão marcada.");
                        onAceito?.(r.duplaId);
                      }
                    })
                  }
                >
                  <CheckCircle size={15} />
                  Aceitar {rotuloSlot(s.slot_proposto)}
                </Button>
              )}
              {/* a RPC trava na 5ª proposta ("combinem por outro canal") —
                  o botão some no teto e a saída honesta é o canal humano */}
              {s.especialista_id && propostas.length < 4 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAbrindo("proposta")}
                >
                  <ArrowsClockwise size={15} />
                  Propor outro horário
                </Button>
              )}
              <ConfirmDeleteButton
                titulo="Cancelar pedido?"
                descricao={
                  papel === "mentorado"
                    ? "O pedido sai da negociação."
                    : "O pedido sai da negociação e o especialista é avisado."
                }
                acao="Cancelar pedido"
                sucesso="Pedido cancelado."
                onConfirm={() => cancelarSolicitacao(s.id)}
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                  >
                    <XCircle size={15} />
                    Cancelar pedido
                  </Button>
                }
              />
            </div>
          )}
          {abrindo === "proposta" && (
            <ContraPropostaForm
              solicitacaoId={s.id}
              slots={slots}
              onFechar={() => setAbrindo(null)}
            />
          )}
          {propostas.length >= 4 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {papel === "mentorado"
                  ? "Já foram muitas idas e vindas — se o horário não fechar, fala com a coordenação."
                  : "Limite de propostas na mesa — combinem o horário por outro canal."}
              </p>
              {papel === "mentorado" && waCoord && (
                <a
                  href={waCoord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "text-muted-foreground"
                  )}
                >
                  <WhatsappLogo size={15} aria-hidden />
                  Falar com a coordenação
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              )}
            </div>
          ) : !autorPodeAceitar && efetivo === "contra_proposta" ? (
            <p className="text-xs text-muted-foreground">
              Aguardando {s.especialista?.nome ?? "o especialista"} responder.
            </p>
          ) : efetivo === "aberta" ? (
            <p className="text-xs text-muted-foreground">
              {papel === "mentorado"
                ? s.desejado?.nome
                  ? `Aguardando ${s.desejado.nome} responder.`
                  : "Aguardando um especialista responder."
                : `Aguardando um especialista${
                    s.desejado?.nome ? ` (${s.desejado.nome})` : ""
                  } responder.`}
            </p>
          ) : null}
        </div>
      ) : papel === "mentorado" ? (
        // pedido aberto pela equipe no nome do jovem — ele enxerga, mas
        // quem senta na mesa é o staff
        <p className="text-xs text-muted-foreground">
          Esse pedido foi aberto pela equipe pra você — quem combina o
          horário é ela com {s.especialista?.nome ?? "o especialista"}.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Negociação em andamento entre o autor e{" "}
          {s.especialista?.nome ?? "os especialistas"}.
        </p>
      )}
    </div>
  );
}
