"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle,
  CircleNotch,
  Clock,
  PaperPlaneTilt,
  Plus,
  UserPlus,
} from "@phosphor-icons/react";
import {
  atualizarContatoTerceiro,
  cancelarContatoTerceiro,
  criarContatoTerceiro,
  reemitirConviteTerceiro,
  salvarConsolidadoTerceiros,
} from "@/lib/actions-terceiros";
import type {
  TerceiroContato,
  TerceiroConsolidacao,
  TerceiroVinculo,
} from "@/lib/terceiros/queries";
import { formatDate } from "@/lib/ciclo";
import { CopiarLink } from "@/components/forms/copiar-link";
import { primeiroNome, urlPublica } from "@/components/forms/link-shared";
import { useOrigem } from "@/components/forms/use-origem";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { NudgeButton } from "@/components/nudge-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Painel "Avaliação por terceiros" da ficha da dupla (0103 — guia DPP
// semana 1→2). O jovem indica até 9 pessoas (3 amigos + 3 familiares + 3
// colegas); o mentor manda a cada uma um link com 2 perguntas abertas,
// lê as respostas identificadas e consolida ANONIMAMENTE pro jovem — que
// só vê a síntese depois de publicada.

const VINCULO_LABEL: Record<TerceiroVinculo, string> = {
  amigo: "amigo(a)",
  familiar: "familiar",
  colega: "colega",
  outro: "outro",
};

const STATUS_BADGE: Record<
  TerceiroContato["status"],
  { label: string; className: string }
> = {
  respondido: {
    label: "respondeu",
    className: "bg-[var(--ok)]/15 text-[var(--ok-text)]",
  },
  pendente: {
    label: "aguardando",
    className: "bg-[var(--warn)]/15 text-[var(--warn-text)]",
  },
  expirado: { label: "expirado", className: "" },
};

/** primeiroNome capitalizado — "Olá, Carlos!" (o compartilhado devolve cru) */
function nomeExib(nome: string | null | undefined): string {
  const p = primeiroNome(nome);
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : "";
}

function msgConviteWhatsApp(
  convidadoNome: string,
  jovemNome: string,
  token: string,
  origem: string
): string {
  return `Olá, ${nomeExib(convidadoNome)}! ${nomeExib(jovemNome)} indicou você pra contar como vê essa pessoa — é a avaliação por terceiros do Programa de Mentoria Realiza.vc. São só 2 perguntas rápidas e sua resposta é confidencial: ${urlPublica(token, origem, "/t")}`;
}

/** Expiração é lazy no banco (só vira 'expirado' quando o link é tocado) —
 *  a tela já trata um pendente vencido como expirado pra não entregar
 *  badge "aguardando" + link morto (molde da lista de links do /f). */
function statusEfetivo(c: TerceiroContato): TerceiroContato["status"] {
  if (c.status === "pendente" && new Date(c.expira_em) < new Date())
    return "expirado";
  return c.status;
}

function LinhaContato({
  contato,
  duplaId,
  jovemNome,
  podeGerenciar,
  jornadaViva,
}: {
  contato: TerceiroContato;
  duplaId: string;
  jovemNome: string;
  podeGerenciar: boolean;
  jornadaViva: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState(false);
  const origem = useOrigem();
  const status = statusEfetivo(contato);
  const badge = STATUS_BADGE[status];

  function reemitir() {
    start(async () => {
      const r = await reemitirConviteTerceiro(contato.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      // o token novo (ou o reutilizado) já vai pra área de transferência —
      // senão o mentor fecha o toast e o link "novo" continua invisível
      try {
        await navigator.clipboard.writeText(
          urlPublica(r.token, origem, "/t")
        );
        toast.success(
          r.reutilizado
            ? "O link pendente é o mesmo — copiado de novo."
            : "Link novo copiado — o anterior morreu."
        );
      } catch {
        toast.success(
          r.reutilizado
            ? "O link pendente é o mesmo — copie na linha do contato."
            : "Link novo gerado — copie na linha do contato."
        );
      }
      router.refresh();
    });
  }

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{contato.nome}</p>
            <Badge variant="outline" className="font-normal">
              {VINCULO_LABEL[contato.vinculo]}
            </Badge>
            <Badge
              variant={status === "expirado" ? "secondary" : "default"}
              className={badge.className}
            >
              {badge.label}
            </Badge>
          </div>
          {status === "respondido" && contato.respondido_em && (
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              Respondeu em {formatDate(contato.respondido_em)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {status === "pendente" && podeGerenciar && jornadaViva && (
            <>
              <CopiarLink token={contato.token} caminho="/t" />
              {contato.whatsapp && (
                <NudgeButton
                  telefone={contato.whatsapp}
                  mensagem={msgConviteWhatsApp(
                    contato.nome,
                    jovemNome,
                    contato.token,
                    origem
                  )}
                  duplaId={duplaId}
                  label="Enviar no WhatsApp"
                  t="contato"
                />
              )}
            </>
          )}
          {status === "expirado" && podeGerenciar && jornadaViva && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reemitir}
              disabled={pending}
            >
              {pending ? (
                <CircleNotch className="animate-spin" aria-hidden />
              ) : (
                <PaperPlaneTilt aria-hidden />
              )}
              Reemitir link
            </Button>
          )}
          {/* expirado também edita: o caminho de consertar indicação errada
              é editar a row + reemitir (a delete policy segue só-pendente —
              cancelar um expirado não tem efeito prático) */}
          {(status === "pendente" || status === "expirado") &&
            podeGerenciar &&
            jornadaViva && (
            <>
              <Dialog open={editando} onOpenChange={setEditando}>
                <DialogTrigger
                  render={
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      Editar
                    </Button>
                  }
                />
                {editando && (
                  <EditarContatoDialog
                    contato={contato}
                    onFechar={() => setEditando(false)}
                  />
                )}
              </Dialog>
              {status === "pendente" && (
                <ConfirmDeleteButton
                  titulo={`Cancelar o convite de ${primeiroNome(contato.nome)}?`}
                  descricao="O link para de funcionar na hora — quem ainda não respondeu perde o acesso."
                  acao="Cancelar convite"
                  dica="Cancelar convite — o link morre"
                  onConfirm={() => cancelarContatoTerceiro(contato.id)}
                  sucesso={`Convite de ${primeiroNome(contato.nome)} cancelado.`}
                />
              )}
            </>
          )}
        </div>
      </div>

      {status === "respondido" && contato.resposta && (
        <details className="group mt-2">
          <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground underline-offset-2 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            Ver resposta de {primeiroNome(contato.nome)}
          </summary>
          <div className="mt-2 space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pontos fortes
              </p>
              <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">
                {contato.resposta.pontos_fortes}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aspectos a melhorar
              </p>
              <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">
                {contato.resposta.a_melhorar}
              </p>
            </div>
          </div>
        </details>
      )}
    </li>
  );
}

function EditarContatoDialog({
  contato,
  onFechar,
}: {
  contato: TerceiroContato;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nome, setNome] = useState(contato.nome);
  const [vinculo, setVinculo] = useState<TerceiroVinculo>(contato.vinculo);
  const [whatsapp, setWhatsapp] = useState(contato.whatsapp ?? "");

  function salvar() {
    start(async () => {
      const r = await atualizarContatoTerceiro(contato.id, {
        nome,
        vinculo,
        whatsapp: whatsapp || null,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Contato atualizado.");
      onFechar();
      router.refresh();
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Editar contato</DialogTitle>
        <DialogDescription>
          O link continua o mesmo — só o cadastro muda.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`nome-${contato.id}`}>Nome</Label>
          <Input
            id={`nome-${contato.id}`}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`vinculo-${contato.id}`}>Vínculo</Label>
          <select
            id={`vinculo-${contato.id}`}
            value={vinculo}
            onChange={(e) => setVinculo(e.target.value as TerceiroVinculo)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="amigo">Amigo(a)</option>
            <option value="familiar">Familiar</option>
            <option value="colega">Colega</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`wa-${contato.id}`}>WhatsApp (opcional)</Label>
          <Input
            id={`wa-${contato.id}`}
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="11999998888"
            inputMode="tel"
            maxLength={25}
          />
        </div>
        <Button onClick={salvar} disabled={pending} className="w-full">
          {pending ? <CircleNotch className="animate-spin" aria-hidden /> : null}
          Salvar
        </Button>
      </div>
    </DialogContent>
  );
}

function NovoContatoDialog({
  duplaId,
  vagas,
  onClose,
}: {
  duplaId: string;
  vagas: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nome, setNome] = useState("");
  const [vinculo, setVinculo] = useState<TerceiroVinculo>("amigo");
  const [whatsapp, setWhatsapp] = useState("");
  const origem = useOrigem();

  function criar() {
    start(async () => {
      const r = await criarContatoTerceiro(duplaId, {
        nome,
        vinculo,
        whatsapp: whatsapp || null,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(urlPublica(r.token, origem, "/t"));
        toast.success("Convite criado — link copiado pra enviar.");
      } catch {
        toast.success("Convite criado — copie o link na linha do contato.");
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Indicar pessoa</DialogTitle>
        <DialogDescription>
          O guia prevê até 9 pessoas: 3 amigos, 3 familiares e 3 colegas
          (restam {vagas}). Cada uma recebe um link próprio — sem login.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="novo-nome">Nome</Label>
          <Input
            id="novo-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome da pessoa indicada"
            maxLength={120}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="novo-vinculo">Vínculo</Label>
          <select
            id="novo-vinculo"
            value={vinculo}
            onChange={(e) => setVinculo(e.target.value as TerceiroVinculo)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="amigo">Amigo(a)</option>
            <option value="familiar">Familiar</option>
            <option value="colega">Colega</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="novo-wa">WhatsApp (opcional)</Label>
          <Input
            id="novo-wa"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="11999998888 — pra enviar o link direto"
            inputMode="tel"
            maxLength={25}
          />
        </div>
        <Button onClick={criar} disabled={pending || nome.trim().length < 2} className="w-full">
          {pending ? (
            <CircleNotch className="animate-spin" aria-hidden />
          ) : (
            <UserPlus aria-hidden />
          )}
          Criar convite
        </Button>
      </div>
    </DialogContent>
  );
}

function Consolidacao({
  duplaId,
  consolidacao,
  podeGerenciar,
}: {
  duplaId: string;
  consolidacao: TerceiroConsolidacao | null;
  podeGerenciar: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [texto, setTexto] = useState(consolidacao?.consolidado ?? "");
  const publicado = consolidacao?.publicado_em != null;

  function salvar(publicar: boolean) {
    start(async () => {
      const r = await salvarConsolidadoTerceiros(duplaId, texto, publicar);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        publicar
          ? "Consolidação publicada — o jovem já vê na área dele."
          : publicado
            ? "Despublicado — o jovem não vê mais."
            : "Rascunho salvo."
      );
      router.refresh();
    });
  }

  if (!podeGerenciar) {
    if (!consolidacao?.consolidado) return null;
    return (
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Consolidação pro jovem
          </p>
          {publicado ? (
            <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
              publicada
            </Badge>
          ) : (
            <Badge variant="secondary">rascunho — o jovem não vê</Badge>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
          {consolidacao.consolidado}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-border/60 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Consolidação pro jovem
        </p>
        {publicado ? (
          <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
            <CheckCircle aria-hidden /> publicada
          </Badge>
        ) : (
          <Badge variant="secondary">rascunho — o jovem não vê</Badge>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Reescreva o que se repete nas respostas SEM dizer quem falou — o
        jovem lê só este texto, nunca as respostas individuais.
      </p>
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ex.: O que mais apareceu foi… Os pontos a olhar são…"
        rows={4}
        maxLength={8000}
        className="text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => salvar(false)}
          disabled={pending}
        >
          {pending ? <CircleNotch className="animate-spin" aria-hidden /> : null}
          {publicado ? "Despublicar" : "Salvar rascunho"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => salvar(true)}
          disabled={pending || !texto.trim()}
        >
          {publicado ? "Atualizar publicação" : "Publicar pro jovem"}
        </Button>
      </div>
    </div>
  );
}

export function TerceirosDupla({
  duplaId,
  contatos,
  consolidacao,
  mentoradoNome,
  podeGerenciar,
  jornadaViva,
  className,
}: {
  duplaId: string;
  contatos: TerceiroContato[];
  consolidacao: TerceiroConsolidacao | null;
  mentoradoNome: string;
  /** mentor da dupla + coord gerenciam; supervisor lê identificado
   *  (RLS deixa) mas não cria nem consolida */
  podeGerenciar: boolean;
  /** ativa|pausada — dupla fechada vira só leitura */
  jornadaViva: boolean;
  className?: string;
}) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const respondidos = contatos.filter((c) => c.status === "respondido").length;
  const vagas = 9 - contatos.length;
  const aberto = contatos.length > 0;

  return (
    <section
      className={cn(
        "rounded-xl bg-card p-4 shadow-[var(--shadow-border)]",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--info)]" />
          Avaliação por terceiros
        </h2>
        {aberto && (
          <Badge variant="secondary" className="tabular-nums">
            {respondidos}/{contatos.length} respostas
          </Badge>
        )}
        {aberto && respondidos === contatos.length && contatos.length > 0 && (
          <Badge className="bg-[var(--ok)]/15 text-[var(--ok-text)]">
            <CheckCircle aria-hidden /> completo
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Guia semana 1→2: o jovem indica até 9 pessoas (3 amigos, 3 familiares,
        3 colegas); cada uma responde 2 perguntas por link próprio. Você lê
        identificado e consolida anônimo — o jovem só vê a síntese publicada.
      </p>

      {aberto && (
        <ul className="mt-2 divide-y divide-border/60">
          {contatos.map((c) => (
            <LinhaContato
              key={c.id}
              contato={c}
              duplaId={duplaId}
              jovemNome={mentoradoNome}
              podeGerenciar={podeGerenciar}
              jornadaViva={jornadaViva}
            />
          ))}
        </ul>
      )}

      {!aberto && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Clock aria-hidden />
          Nenhuma pessoa indicada ainda — comece pela lista do jovem.
        </p>
      )}

      {podeGerenciar && jornadaViva && vagas > 0 && (
        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm" className="mt-3">
                <Plus aria-hidden />
                Indicar pessoa
              </Button>
            }
          />
          {dialogAberto && (
            <NovoContatoDialog
              duplaId={duplaId}
              vagas={vagas}
              onClose={() => setDialogAberto(false)}
            />
          )}
        </Dialog>
      )}

      {(aberto || consolidacao?.consolidado) && (
        <div className="mt-3">
          <Consolidacao
            duplaId={duplaId}
            consolidacao={consolidacao}
            podeGerenciar={podeGerenciar && jornadaViva}
          />
        </div>
      )}
    </section>
  );
}
