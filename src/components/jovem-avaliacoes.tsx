"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
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
  formatDate,
  formatDateTime,
} from "@/lib/ciclo";
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

/** Uma pendência de avaliação — o encontro realizado que ainda não tem a
 *  estrela do jovem (o link já existe no banco; aqui o caminho é o logado,
 *  sem token). */
export type AvaliacaoPendente = {
  encontroId: string;
  numero: number;
  realizado_em: string | null;
  /** 'dpp' | 'especialista' — decide o toggle de visibilidade do mentor. */
  trilha: string;
};

/** Avaliação enviada + a trilha da dupla (resolvida na página — a tabela
 *  `duplas` não é legível pro papel mentorado, então o join é feito com o
 *  que a view jovem_duplas já entrega). */
export type AvaliacaoFeita = JovemAvaliacao & { trilha: string };

/** Botão "Avaliar" + dialog do form — usado na lista do /jovem e na linha
 *  da agenda. O canal é o logado (encontroId, sem token): a RPC valida o
 *  vínculo pela sessão. */
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {pendente.numero}º encontro — como foi?
            </DialogTitle>
            <DialogDescription>
              {pendente.trilha === "especialista"
                ? "1 minuto. Suas respostas ficam entre você e a equipe da Realiza.vc — só a sua nota aparece pro seu mentor."
                : "1 minuto. Suas respostas ficam entre você e a equipe da Realiza.vc — pro seu mentor só aparece a média, e você escolhe o que ele lê."}
            </DialogDescription>
          </DialogHeader>
          <AvaliacaoEncontroForm
            encontroId={pendente.encontroId}
            trilha={pendente.trilha}
            primeiroNome={primeiroNome}
            onEnviado={({ pedirApoio }) => {
              setOpen(false);
              toast.success(
                pedirApoio
                  ? "Pedido enviado — a coordenação foi avisada e fala com você."
                  : "Avaliação enviada — obrigado por contar!"
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
        <DialogContent>
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

/** Suas avaliações do /jovem (REALIZA-109): pendências com CTA pro form e
 *  o histórico do que já foi dito — incluindo o toggle "meu mentor pode
 *  ler esta", que é do jovem e só existe na trilha DPP. */
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

  return (
    <ul className="divide-y divide-border/60">
      {pendentes.map((p) => (
        <li
          key={p.encontroId}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)]/20 text-[var(--brand-ink)]">
            <Star size={16} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <p className="text-sm font-medium">
              {p.numero}º encontro — como foi?
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {p.realizado_em ? formatDate(p.realizado_em) + " · " : ""}
              {p.trilha === "especialista"
                ? "Conte em 1 minuto. Pro seu mentor aparece a sua nota."
                : "Conte em 1 minuto. Pro seu mentor só aparece a média."}
            </p>
          </div>
          <AvaliarPendenteButton pendente={p} primeiroNome={primeiroNome} />
        </li>
      ))}
      {feitas.map((a) => (
        <li
          key={a.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5"
        >
          <div className="min-w-0 flex-1 basis-48">
            <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
              {a.encontro?.numero ? `${a.encontro.numero}º encontro` : "Encontro"}
              <Estrelas n={a.estrelas} />
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {formatDateTime(a.created_at)}
              {a.pedir_apoio && (
                <Badge
                  variant="outline"
                  className="border-[var(--warn)]/50 text-[var(--warn-text)]"
                >
                  <HandHeart size={12} data-icon="inline-start" aria-hidden />
                  Ajuda pedida
                </Badge>
              )}
            </p>
          </div>
          <VerAvaliacaoButton avaliacao={a} />
        </li>
      ))}
    </ul>
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
              Você pediu ajuda nesta — a equipe já foi avisada.
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
          Nas sessões de especialista, sua nota aparece pro seu mentor — o
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
              — normalmente ele só vê a média de vocês. Com a chave ligada,
              ele lê esta resposta inteira.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
