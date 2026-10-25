"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Collapsible } from "@base-ui/react/collapsible";
import {
  CaretDown,
  Eye,
  HandHeart,
  Star,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { definirVisibilidadeAvaliacao } from "@/lib/actions-avaliacao";
import type { JovemAvaliacao } from "@/lib/queries-avaliacao";
import {
  AVANCEI_AVALIACAO_LABEL,
  SENTIMENTO_AVALIACAO_LABEL,
  TEMA_AVALIACAO_LABEL,
  formatDiaMes,
  formatDateTime,
} from "@/lib/ciclo";
import { privacidadeAvaliacao, privacidadeAvaliacoes } from "@/lib/avaliacao-privacidade";
import { AvaliacaoEncontroForm } from "@/components/avaliacao-encontro-form";
import { Estrelas } from "@/components/estrelas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Quantas respostas ficam à vista na home; as demais recolhem em
 *  "Ver todas as avaliações". As pendentes sempre aparecem. */
const RECENTES = 2;

/** Uma pendência de avaliação: o encontro realizado que ainda não tem a
 *  estrela do jovem (o link já existe no banco; aqui o caminho é o logado,
 *  sem token). */
export type AvaliacaoPendente = {
  encontroId: string;
  numero: number;
  realizado_em: string | null;
  /** 'dpp' | 'especialista' — decide o toggle de visibilidade do mentor. */
  trilha: string;
  /** "5º encontro com Ricardo" ou "3ª sessão com Sofia", montado na página. */
  rotulo?: string;
};

/** Avaliação enviada + a trilha da dupla (resolvida na página — a tabela
 *  `duplas` não é legível pro papel mentorado, então o join é feito com o
 *  que a view jovem_duplas já entrega). */
export type AvaliacaoFeita = JovemAvaliacao & {
  trilha: string;
  /** Mesmo rótulo das pendências, pra lista ficar coerente. */
  rotulo?: string;
};

/** Botão "Avaliar" + dialog do form — usado na lista do /jovem, na linha
 *  da agenda e na página de materiais. O canal é o logado (encontroId, sem
 *  token): a RPC valida o vínculo pela sessão. */
export function AvaliarPendenteButton({
  pendente,
  primeiroNome,
  variant = "default",
  size = "sm",
}: {
  pendente: AvaliacaoPendente;
  primeiroNome: string;
  variant?: "default" | "outline";
  size?: "sm" | "xs";
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Star size={15} aria-hidden />
        Avaliar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* md: form de coluna única (estrelas, chips, cartões empilhados) —
            acima disso sobrava fundo ocioso lateral */}
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {pendente.numero}º encontro: como foi?
            </DialogTitle>
            <DialogDescription>
              1 minuto. {privacidadeAvaliacao(pendente.trilha)}
            </DialogDescription>
          </DialogHeader>
          <AvaliacaoEncontroForm
            embutido
            encontroId={pendente.encontroId}
            trilha={pendente.trilha}
            primeiroNome={primeiroNome}
            onEnviado={({ pedirApoio }) => {
              setOpen(false);
              toast.success(
                pedirApoio
                  ? "Pedido enviado. A coordenação foi avisada e fala com você."
                  : "Avaliação enviada. Obrigado por contar!"
              );
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Botão "ver resposta" + dialog do que o jovem escreveu — com o toggle
 *  de visibilidade do mentor (DPP) dentro. */
export function VerAvaliacaoButton({
  avaliacao,
  label = "Ver resposta",
}: {
  avaliacao: AvaliacaoFeita;
  label?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Eye size={15} aria-hidden />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {avaliacao.encontro?.numero
                ? `Sua avaliação do ${avaliacao.encontro.numero}º encontro`
                : "Sua avaliação"}
            </DialogTitle>
            <DialogDescription>
              Enviada em {formatDateTime(avaliacao.created_at)}
            </DialogDescription>
          </DialogHeader>
          <DetalheAvaliacao a={avaliacao} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function instante(iso: string | null | undefined): number {
  return iso ? Date.parse(iso) || 0 : 0;
}

/** Suas avaliações do /jovem (REALIZA-109): o histórico. As pendentes ficam
 *  recolhidas (a ação delas já está em "Para fazer agora"), as duas respostas
 *  mais recentes à vista, as demais em "Ver todas as avaliações" e a
 *  privacidade em "Quem vê suas respostas?". O toggle "meu mentor pode ler"
 *  mora no detalhe de cada uma. */
export function JovemAvaliacoes({
  pendentes,
  feitas,
  primeiroNome,
}: {
  pendentes: AvaliacaoPendente[];
  feitas: AvaliacaoFeita[];
  primeiroNome: string;
}) {
  if (!pendentes.length && !feitas.length) return null;

  const pendentesOrdenadas = [...pendentes].sort(
    (a, b) => instante(b.realizado_em) - instante(a.realizado_em)
  );
  const feitasOrdenadas = [...feitas].sort(
    (a, b) =>
      instante(b.encontro?.realizado_em ?? b.created_at) -
      instante(a.encontro?.realizado_em ?? a.created_at)
  );
  const recentes = feitasOrdenadas.slice(0, RECENTES);
  const anteriores = feitasOrdenadas.slice(RECENTES);
  // uma frase só: a da trilha única, ou a combinada quando há as duas
  const privacidade = privacidadeAvaliacoes([
    ...pendentes.map((p) => p.trilha),
    ...feitas.map((a) => a.trilha),
  ]);

  function renderPendente(p: AvaliacaoPendente) {
    return (
      <li key={`p-${p.encontroId}`} className="flex items-center gap-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {p.rotulo ?? `${p.numero}º encontro`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {p.realizado_em ? formatDiaMes(p.realizado_em) + " · " : ""}
            aguardando sua resposta
          </p>
        </div>
        <AvaliarPendenteButton
          pendente={p}
          primeiroNome={primeiroNome}
          variant="outline"
        />
      </li>
    );
  }

  function renderFeita(a: AvaliacaoFeita) {
    return (
      <li key={`f-${a.id}`} className="flex items-center gap-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
            {a.rotulo ??
              (a.encontro?.numero ? `${a.encontro.numero}º encontro` : "Encontro")}
            <Estrelas n={a.estrelas} size={12} />
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {formatDiaMes(a.encontro?.realizado_em ?? a.created_at)}
            {a.pedir_apoio && (
              <Badge
                variant="outline"
                className="border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info-text)]"
              >
                <HandHeart size={12} data-icon="inline-start" aria-hidden />
                Ajuda pedida
              </Badge>
            )}
          </p>
        </div>
        <VerAvaliacaoButton avaliacao={a} />
      </li>
    );
  }

  // as pendentes já moram em "Para fazer agora" (com "e mais N"): aqui ficam
  // recolhidas, pra seção ser o histórico e não repetir seis botões
  const trigger =
    "flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [&[aria-expanded=true]>svg]:rotate-180";

  return (
    <div>
      {pendentesOrdenadas.length > 0 && (
        <Collapsible.Root className="border-b border-border/60">
          <Collapsible.Trigger className={trigger}>
            <span className="text-foreground">
              {pendentesOrdenadas.length === 1
                ? "1 esperando sua resposta"
                : `${pendentesOrdenadas.length} esperando sua resposta`}
            </span>
            <CaretDown size={16} aria-hidden className="ms-auto shrink-0 transition-transform" />
          </Collapsible.Trigger>
          <Collapsible.Panel>
            <ul className="divide-y divide-border/60 px-4 pb-1">
              {pendentesOrdenadas.map(renderPendente)}
            </ul>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}

      {recentes.length > 0 && (
        <ul className="divide-y divide-border/60 px-4 pt-1">
          {recentes.map(renderFeita)}
        </ul>
      )}

      {anteriores.length > 0 && (
        <Collapsible.Root className="mt-1 border-t border-border/60">
          <Collapsible.Trigger className="flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [&[aria-expanded=true]>svg]:rotate-180">
            Ver todas as avaliações
            <span className="ms-auto text-xs font-normal">
              +{anteriores.length} anteriores
            </span>
            <CaretDown size={16} aria-hidden className="shrink-0 transition-transform" />
          </Collapsible.Trigger>
          <Collapsible.Panel>
            <ul className="divide-y divide-border/60 px-4 pb-1">
              {anteriores.map(renderFeita)}
            </ul>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}

      {/* a privacidade é o argumento pra responder de verdade, mas não
          precisa ocupar seis linhas fixas: abre sob demanda */}
      <Collapsible.Root className="border-t border-border/60">
        <Collapsible.Trigger className={trigger}>
          Quem vê suas respostas?
          <CaretDown size={16} aria-hidden className="ms-auto shrink-0 transition-transform" />
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <p className="px-4 pb-3 text-xs leading-relaxed text-muted-foreground">
            {privacidade}
          </p>
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}

function Linha({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-28 shrink-0 text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function DetalheAvaliacao({ a }: { a: AvaliacaoFeita }) {
  const [visivel, setVisivel] = useState(a.avaliacao_visivel_mentor);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(v: boolean) {
    const anterior = visivel;
    setVisivel(v); // otimista — o banco é a fronteira; desfaz em erro
    start(async () => {
      const r = await definirVisibilidadeAvaliacao(a.id, v);
      if (r.error) {
        setVisivel(anterior);
        toast.error(r.error);
      } else {
        toast.success(
          v
            ? "Seu mentor agora lê esta avaliação."
            : "Voltou a valer só na média."
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <dl className="space-y-2.5">
        <Linha rotulo="Nota">
          <span className="inline-flex items-center gap-2">
            <Estrelas n={a.estrelas} size={16} />
            <span className="text-xs text-muted-foreground">
              {a.estrelas} de 5
            </span>
          </span>
        </Linha>
        {a.sentimento && (
          <Linha rotulo="Você se sentiu">
            {SENTIMENTO_AVALIACAO_LABEL[a.sentimento] ?? a.sentimento}
          </Linha>
        )}
        {a.avancei && (
          <Linha rotulo="Avançou?">
            {AVANCEI_AVALIACAO_LABEL[a.avancei] ?? a.avancei}
          </Linha>
        )}
        {a.temas?.length ? (
          <Linha rotulo="Conversaram sobre">
            <span className="flex flex-wrap gap-1">
              {a.temas.map((t) => (
                <Badge key={t} variant="outline">
                  {TEMA_AVALIACAO_LABEL[t] ?? t}
                </Badge>
              ))}
            </span>
          </Linha>
        ) : null}
        {a.comentario && (
          <Linha rotulo="Seu comentário">
            <span className="whitespace-pre-wrap">{a.comentario}</span>
          </Linha>
        )}
        {a.pedir_apoio && (
          <Linha rotulo="Ajuda">
            <span className="inline-flex items-center gap-1.5 text-[var(--warn-text)]">
              <HandHeart size={15} aria-hidden />
              Você pediu ajuda nesta. A equipe já foi avisada.
            </span>
          </Linha>
        )}
      </dl>

      {/* quem lê, honesto por trilha (K6): na especialista a estrela SEMPRE
          aparece pro mentor DPP (decisão 0092) — o resto da resposta fica
          entre o jovem e a equipe; no DPP o mentor só lê a resposta
          inteira quando o toggle do jovem autoriza */}
      {a.trilha === "especialista" && (
        <p className="text-xs text-muted-foreground">
          Nas sessões de especialista, sua nota aparece pro seu mentor. O
          resto desta resposta fica entre você e a equipe.
        </p>
      )}
      {a.trilha === "dpp" && (
        <label
          className={cn(
            "flex items-start gap-3 rounded-lg border border-border px-3.5 py-3 text-sm",
            pending && "opacity-60"
          )}
        >
          <Switch
            checked={visivel}
            onCheckedChange={toggle}
            disabled={pending}
            aria-label="Meu mentor pode ler esta avaliação"
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">
              Meu mentor pode ler esta avaliação
            </span>{" "}
            <span className="text-muted-foreground">
              : normalmente ele só vê a média de vocês. Com a chave ligada,
              ele lê esta resposta inteira.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
