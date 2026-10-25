import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  CaretDown,
  Check,
  Circle,
  Clock,
  Quotes,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";
import { formatDate, formatDateTime, linkSeguro, rotuloSlot } from "@/lib/ciclo";
import {
  efetivoDe,
  resumoPedidoJovem,
  stepperCicloDeVida,
} from "@/lib/jovem-especialista";
import type {
  Devolutiva,
  Dupla,
  JovemDupla,
  SolicitacaoEspecialista,
} from "@/lib/types";
import type { JovemEncontro } from "@/lib/queries-jovem";
import { avatarPublicUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  estadoPasso,
  JovemTrilhaStepper,
} from "@/components/jovem-trilha-stepper";
import { cn } from "@/lib/utils";

/** Situação da trilha na pill — "em andamento" é o caso neutro (a cor fica
 *  pras exceções, mesma régua do semáforo). */
const PIL: Record<string, { rotulo: string; cls: string }> = {
  ativa: { rotulo: "Em andamento", cls: "text-muted-foreground" },
  pausada: {
    rotulo: "Pausada",
    cls: "border-[var(--pausa-border)] text-[var(--pausa-text)]",
  },
  concluida: {
    rotulo: "Concluída",
    cls: "border-[var(--ok)]/50 text-[var(--ok-text)]",
  },
  encerrada: {
    rotulo: "Encerrada",
    cls: "border-[var(--pausa-border)] text-[var(--pausa-text)]",
  },
};

/** Trilha de especialista do jovem (WP6), versão compacta: quem é o
 *  especialista e o foco, a situação em pill, o progresso "N de 5 sessões"
 *  com barra e o próximo passo numa frase com UMA ação quando a bola tá
 *  com o jovem (responder proposta, entrar na chamada). O resto — ciclo
 *  de vida pedido→trilha, linha do tempo das sessões, feed completo de
 *  devolutivas e o motivo de encerramento — fica no "Ver trilha completa"
 *  (details nativo, sem animação de altura). A devolutiva mais recente
 *  fica à vista com 3 linhas; as anteriores moram no recolhível. */
export function JovemTrilhaCard({
  dupla,
  solicitacao,
  pedidoAberto = null,
  passos,
  encontros,
  devolutivas,
  agoraMs,
  indice = 0,
}: {
  dupla: JovemDupla;
  /** A solicitação que originou a trilha (resolvida pela página — a view
   *  jovem_duplas não carrega solicitacao_id). Alimenta o stepper de ciclo
   *  de vida; null = trilha sem pedido à vista (dado antigo/staff). */
  solicitacao?: SolicitacaoEspecialista | null;
  /** Pedido em aberto amarrado à trilha (follow-up de sessão — nasce com
   *  dupla_id). Em contra_proposta a bola é do jovem e vira a ação do card. */
  pedidoAberto?: SolicitacaoEspecialista | null;
  passos: { numero: number; titulo: string; foco: string | null }[];
  encontros: JovemEncontro[];
  devolutivas: Devolutiva[];
  /** o "agora" vem da página (server component) — fixado uma vez por
   *  request, como a agenda faz */
  agoraMs: number;
  /** índice do stagger de entrada (.animate-enter + --i) */
  indice?: number;
}) {
  const nome = dupla.mentor_nome_social || dupla.mentor_nome || "Especialista";
  const primeiro = nome.split(/\s+/)[0];
  const daTrilha = encontros.filter((e) => e.dupla_id === dupla.id);
  const feed = devolutivas.filter((v) => v.dupla_id === dupla.id);
  const encerrada =
    dupla.status === "concluida" ||
    dupla.status === "encerrada" ||
    dupla.encerrada_em != null;
  const ativa = !encerrada;
  const feitos = passos.filter(
    (p) => estadoPasso(daTrilha, p.numero, agoraMs).estado === "feito"
  ).length;
  const proximoPasso = ativa
    ? (passos.find(
        (p) =>
          estadoPasso(daTrilha, p.numero, agoraMs).estado !== "feito"
      )?.numero ?? null)
    : null;
  const passoVivo =
    proximoPasso != null
      ? estadoPasso(daTrilha, proximoPasso, agoraMs)
      : null;
  const linkChamada = passoVivo?.encontro
    ? linkSeguro(passoVivo.encontro.link)
    : null;

  // a view jovem_duplas é achatada (sem a árvore encontros/mentor que o
  // tipo Dupla carrega) — o stepper de ciclo de vida lê só
  // status/iniciada_em/encerrada_em, o nome do mentor e numero+status dos
  // encontros, todos à mão aqui: a montagem entrega exatamente isso
  const duplaVida = {
    id: dupla.id,
    status: dupla.status,
    iniciada_em: dupla.iniciada_em,
    encerrada_em: dupla.encerrada_em,
    mentor: {
      nome: dupla.mentor_nome,
      nome_social: dupla.mentor_nome_social,
    },
    encontros: daTrilha,
  } as unknown as Dupla;
  const vida = stepperCicloDeVida({
    solicitacao: solicitacao ?? null,
    dupla: duplaVida,
    hoje: new Date(agoraMs),
  });

  // próximo passo: uma frase no máximo + UMA ação quando o gesto é do jovem.
  // Ordem: resposta pendente (contra-proposta) > chamada do dia > mesa do
  // pedido > estado da sessão viva
  let frase: string;
  let acao: ReactNode = null;
  const efetivoAberto = pedidoAberto ? efetivoDe(pedidoAberto) : null;
  if (encerrada) {
    frase =
      (dupla.status === "encerrada" ? "Trilha encerrada" : "Trilha concluída") +
      (dupla.encerrada_em ? ` em ${formatDate(dupla.encerrada_em)}` : "") +
      ".";
  } else if (dupla.status === "pausada") {
    frase = "A trilha tá pausada. A coordenação retoma quando for a hora.";
  } else if (efetivoAberto === "contra_proposta") {
    frase = `${primeiro} propôs um horário pra próxima sessão.`;
    acao = (
      <Link href="#pedidos" className={buttonVariants({ size: "sm" })}>
        Responder proposta
      </Link>
    );
  } else if (passoVivo?.estado === "marcado" && linkChamada) {
    const quando = passoVivo.encontro?.data_hora;
    frase = `Sessão ${proximoPasso} marcada${quando ? ` pra ${rotuloSlot(quando)}` : ""}.`;
    acao = (
      <a
        href={linkChamada}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ size: "sm" })}
      >
        <VideoCamera size={15} aria-hidden />
        Entrar
        <span className="sr-only"> na chamada (abre em nova aba)</span>
      </a>
    );
  } else if (pedidoAberto) {
    frase = resumoPedidoJovem(efetivoAberto!, primeiro);
    acao = (
      <Link
        href="#pedidos"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Ver pedido
      </Link>
    );
  } else if (passoVivo?.estado === "marcado") {
    const quando = passoVivo.encontro?.data_hora;
    frase = `Sessão ${proximoPasso} marcada${quando ? ` pra ${rotuloSlot(quando)}` : ""}.`;
  } else if (passoVivo?.estado === "a_confirmar") {
    frase = `A sessão ${proximoPasso} aguarda o registro de ${primeiro}.`;
  } else if (passoVivo?.estado === "furou") {
    frase = `A sessão ${proximoPasso} não aconteceu.`;
    acao = (
      <Link
        href="/jovem/agenda"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Ver agenda
      </Link>
    );
  } else if (passoVivo) {
    frase = `A sessão ${proximoPasso} ainda não tem data.`;
    acao = (
      <Link
        href="/jovem/agenda"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Ver agenda
      </Link>
    );
  } else {
    frase = `As ${passos.length} sessões aconteceram. A devolutiva final encerra a trilha.`;
  }

  const ultima = feed[feed.length - 1] ?? null;
  const pil = PIL[dupla.status ?? "ativa"] ?? PIL.ativa;

  return (
    <Card
      className="animate-enter"
      style={{ "--i": indice } as CSSProperties}
    >
      <CardContent className="space-y-3 py-5">
        <div className="flex items-start gap-3">
          <Avatar
            nome={nome}
            src={
              dupla.mentor_avatar_path
                ? avatarPublicUrl(dupla.mentor_avatar_path)
                : null
            }
            size={40}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-snug">{nome}</p>
              <Badge
                variant="outline"
                className={cn("mt-0.5 shrink-0", pil.cls)}
              >
                {pil.rotulo}
              </Badge>
            </div>
            <p
              className="mt-0.5 line-clamp-2 text-sm text-muted-foreground"
              title={dupla.demanda ?? undefined}
            >
              {dupla.demanda ?? "Trilha de especialista"}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">
            {feitos} de {passos.length} sessões
          </p>
          <div
            role="progressbar"
            aria-label={`${feitos} de ${passos.length} sessões realizadas`}
            aria-valuemin={0}
            aria-valuemax={passos.length}
            aria-valuenow={feitos}
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="fill-grow h-full rounded-full bg-[var(--destaque)]"
              style={{
                width: `${passos.length ? (feitos / passos.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1 basis-52">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Próximo passo
            </p>
            <p className="mt-0.5 text-sm">{frase}</p>
          </div>
          {acao}
        </div>

        {/* devolutiva mais recente à vista (3 linhas) — o resto do feed e
            da linha do tempo ficam no recolhível abaixo */}
        {ultima && (
          <div className="border-t border-border/60 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Última devolutiva
            </p>
            <details className="group/dev mt-1">
              <summary className="cursor-pointer list-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {/* a prévia é a mesma frase do painel, truncada — aria-hidden
                    pra leitor não anunciar o texto cortado como nome do
                    botão */}
                <span
                  aria-hidden
                  className="block line-clamp-3 text-sm leading-relaxed group-open/dev:hidden"
                >
                  {ultima.texto}
                </span>
                <span className="mt-1.5 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:min-h-8">
                  Ler devolutiva completa
                  <CaretDown
                    size={12}
                    aria-hidden
                    className="transition-transform group-open/dev:rotate-180"
                  />
                </span>
              </summary>
              <p className="text-sm leading-relaxed">{ultima.texto}</p>
            </details>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={11} aria-hidden />
              {ultima.autor?.nome ?? nome} · {formatDateTime(ultima.created_at)}
            </p>
          </div>
        )}

        <details className="group/trilha border-t border-border/60">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            Ver trilha completa
            <CaretDown
              size={14}
              aria-hidden
              className="shrink-0 transition-transform group-open/trilha:rotate-180"
            />
          </summary>
          <div className="space-y-4 border-t border-border/60 pt-4">
            {/* ciclo de vida pedido→trilha (mock v6 ol.life) — vertical no
                mobile, 5 colunas a partir de md; um nó "atual" por vez
                marca a fase onde a trilha está parada */}
            <ol
              className="grid md:grid-cols-5 md:gap-2"
              aria-label="Ciclo de vida da trilha"
            >
              {vida.map((p, i) => (
                <li
                  key={i}
                  className="relative flex gap-2.5 pb-3 last:pb-0 md:flex-col md:gap-1.5 md:pb-0"
                >
                  {i < vida.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute top-6 bottom-0 left-[11px] w-0.5 bg-border md:top-[11px] md:right-[-8px] md:bottom-auto md:left-7 md:h-0.5 md:w-auto"
                    />
                  )}
                  <span
                    className={cn(
                      "z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 border-border bg-card text-xs font-extrabold text-muted-foreground",
                      p.estado === "feito" &&
                        "border-[var(--ok)] bg-[var(--ok)] text-white",
                      p.estado === "atual" &&
                        "border-[var(--brand-ink)] bg-[var(--role-mentorado)] text-[var(--brand-ink)]"
                    )}
                  >
                    {p.estado === "feito" ? (
                      <Check size={13} weight="bold" aria-hidden />
                    ) : (
                      <span aria-hidden>{i + 1}</span>
                    )}
                    <span className="sr-only">
                      {p.rotulo}:{" "}
                      {p.estado === "feito"
                        ? "concluído"
                        : p.estado === "atual"
                          ? "em andamento"
                          : "a caminho"}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm leading-snug font-medium",
                        p.estado === "futuro" && "text-muted-foreground"
                      )}
                    >
                      {p.rotulo}
                    </p>
                    {p.data && (
                      <p className="text-xs text-muted-foreground">{p.data}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            <JovemTrilhaStepper
              passos={passos}
              encontros={daTrilha}
              agoraMs={agoraMs}
              proximoPasso={proximoPasso}
            />

            {feed.length > 0 && (
              <div className="border-t border-border/60 pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Quotes size={13} aria-hidden />
                  Devolutivas da trilha
                </p>
                <ul className="space-y-3">
                  {feed.map((v) => (
                    <li key={v.id} className="text-sm">
                      <p className="leading-relaxed">{v.texto}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={11} aria-hidden />
                        {v.autor?.nome ?? nome} ·{" "}
                        {formatDateTime(v.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {encerrada && dupla.motivo_encerramento && (
              <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                {dupla.motivo_encerramento}
              </p>
            )}
            {!encerrada && feed.length === 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Circle size={11} aria-hidden />
                As devolutivas da trilha aparecem aqui conforme as sessões
                rolam.
              </p>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
