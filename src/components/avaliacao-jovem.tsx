import {
  HandHeart,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import {
  AVANCEI_AVALIACAO_LABEL,
  SENTIMENTO_AVALIACAO_LABEL,
  TEMA_AVALIACAO_LABEL,
  formatDate,
  waLink,
} from "@/lib/ciclo";
import type {
  AvaliacaoEncontro,
  AvaliacaoLink,
  EspecialistaAvaliacao,
} from "@/lib/types";
import type { AvaliacaoMediaDpp } from "@/lib/queries-avaliacao";
import {
  CopiarLinkAvaliacao,
  ResolverApoioJovemButton,
} from "@/components/avaliacao-jovem-acoes";
import { Estrelas, EstrelasMedia } from "@/components/estrelas";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

// A voz do jovem na ficha da dupla (REALIZA-109 / D4, migration 0071).
// As fronteiras são as do banco — aqui só projeta:
//   · coord/sup → linha inteira (RLS já filtrou o embed avaliacao_jovem)
//   · mentor DPP → média quantizada por RPC + a linha que o jovem liberou
//   · especialista → só estrelas (view definer), um chip por encontro
// O "pedir_apoio" do jovem NUNCA se funde com o precisa_apoio do mentor:
// canais diferentes, respondidos por gente diferente.

/** Bloco dentro do card do encontro (abaixo do registro do mentor): o que
 *  o jovem respondeu. `avaliacao` chega via embed RLS — coord e supervisor
 *  recebem a linha completa; o mentor DPP só recebe quando o jovem ligou
 *  "meu mentor pode ler esta" (o chip "liberada" conta isso a ele). */
export function AvaliacaoJovemCard({
  avaliacao,
  duplaId,
  souCoord,
  liberadaProMentor = false,
}: {
  avaliacao: AvaliacaoEncontro;
  duplaId: string;
  souCoord: boolean;
  /** Quem vê é o mentor e a linha só existe porque o jovem a liberou —
   *  a nota explica por que ela é a exceção da regra da média. */
  liberadaProMentor?: boolean;
}) {
  const temDetalhe =
    !!avaliacao.sentimento ||
    !!avaliacao.avancei ||
    (avaliacao.temas?.length ?? 0) > 0 ||
    !!avaliacao.comentario;

  return (
    <div
      className={
        avaliacao.pedir_apoio
          ? "border-t border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3"
          : "border-t border-border/60 bg-muted/50 px-4 py-3"
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
          Avaliação do jovem
        </span>
        <Estrelas n={avaliacao.estrelas} size={13} />
        {avaliacao.pedir_apoio ? (
          <Badge
            variant="outline"
            className="shrink-0 border-[var(--danger)] text-[var(--danger)]"
          >
            <HandHeart size={12} data-icon="inline-start" aria-hidden />
            pediu ajuda
          </Badge>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {/* respondido_por null = respondeu pelo link, sem login — o canal
              é a prova; a policy esconde a identidade do token de propósito */}
          {avaliacao.respondido_por_profile_id == null
            ? "pelo link, sem login"
            : "pela conta do jovem"}
          {" · "}
          {formatDate(avaliacao.created_at)}
        </span>
      </div>

      {liberadaProMentor && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          O jovem ligou “meu mentor pode ler esta” — normalmente você só vê
          a média das avaliações.
        </p>
      )}

      {temDetalhe && (
        <dl className="mt-2 space-y-1.5 text-sm">
          {avaliacao.sentimento && (
            <Linha rotulo="Sentiu-se">
              {SENTIMENTO_AVALIACAO_LABEL[avaliacao.sentimento] ??
                avaliacao.sentimento}
            </Linha>
          )}
          {avaliacao.avancei && (
            <Linha rotulo="Avançou?">
              {AVANCEI_AVALIACAO_LABEL[avaliacao.avancei] ?? avaliacao.avancei}
            </Linha>
          )}
          {(avaliacao.temas?.length ?? 0) > 0 && (
            <Linha rotulo="Temas">
              <span className="flex flex-wrap gap-1">
                {avaliacao.temas!.map((t) => (
                  <Badge key={t} variant="outline">
                    {TEMA_AVALIACAO_LABEL[t] ?? t}
                  </Badge>
                ))}
              </span>
            </Linha>
          )}
          {avaliacao.comentario && (
            <Linha rotulo="Comentário">
              <span className="whitespace-pre-wrap">{avaliacao.comentario}</span>
            </Linha>
          )}
        </dl>
      )}

      {/* o pedido partiu do JOVEM — a resposta é da coordenação, com o
          mentorado como canal (o mentor pode ser o motivo do pedido) */}
      {avaliacao.pedir_apoio && souCoord && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <ResolverApoioJovemButton
            avaliacaoId={avaliacao.id}
            duplaId={duplaId}
          />
        </div>
      )}
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
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

/** Encontro realizado e a estrela ainda não veio — coord/sup veem a
 *  pendência e a coord distribui o link (copiar ou mandar por WhatsApp).
 *  Link expirado não se reemite: o jovem responde pela página dele — a
 *  copy diz isso em vez de prometer um botão que não existe. */
export function AvaliacaoPendenteLinha({
  link,
  urlBase,
  jovemNome,
  jovemWhatsapp,
  numero,
  souCoord,
  duplaId,
  jornadaViva = true,
}: {
  link: AvaliacaoLink | null;
  urlBase: string;
  jovemNome: string;
  jovemWhatsapp: string | null;
  numero: number;
  souCoord: boolean;
  /** o ping da avaliação passa por /api/nudge — loga o contato em
   *  interacoes como os demais canais (t=contato) */
  duplaId: string;
  /** Dupla fechada (concluida/encerrada): a pendência fica como fato —
   *  copiar/enviar link morre junto com as demais ações de emissão. */
  jornadaViva?: boolean;
}) {
  const url = link ? `${urlBase}/avaliar/${link.token}` : null;
  const wa =
    url && waLink(
      jovemWhatsapp,
      `Oi ${jovemNome.split(" ")[0]}! Como foi o ${numero}º encontro de vocês? Conta aqui rapidinho (1 min): ${url}`
    );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Star size={13} aria-hidden />
        Avaliação do jovem ainda não chegou
      </span>
      {souCoord && jornadaViva && link?.status === "pendente" && url && (
        <span className="flex flex-wrap items-center gap-2">
          <CopiarLinkAvaliacao url={url} />
          {wa && (
            <a
              href={`/api/nudge?d=${encodeURIComponent(duplaId)}&to=${encodeURIComponent(wa)}&t=contato`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Enviar por WhatsApp
            </a>
          )}
        </span>
      )}
      {souCoord && link?.status === "expirado" && (
        <span className="italic">
          o link expirou — o jovem responde pela página dele
        </span>
      )}
    </div>
  );
}

/** Chip de estrela pro encontro da trilha especialista — a view definer
 *  entrega SÓ o número (com 1 avaliador qualquer metadado a mais
 *  identifica o jovem). Sem comentário, sem sentimento, sem data da
 *  resposta: a estrela é todo o recorte permitido. */
export function EstrelaEspecialistaChip({ estrelas }: { estrelas: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]">
        <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
        Jovem
      </span>
      <Estrelas n={estrelas} size={12} />
    </span>
  );
}

/** Card do rail "Voz do jovem" — o resumo agregado que cada papel pode
 *  ler. coord/sup: contagem + média + pedido de ajuda em aberto. Mentor
 *  DPP: só a média quantizada por lotes de 3 (a RPC garante). */
export function VozDoJovemCard({
  avaliacoes,
  pendentes,
  media,
  papel,
  realizados,
}: {
  /** Linhas visíveis ao papel (coord/sup: todas; mentor: só liberadas). */
  avaliacoes: AvaliacaoEncontro[];
  /** Realizados sem avaliação — pendência do jovem, não do mentor. */
  pendentes: number;
  /** Agregado do RPC — só preenchido pro mentor DPP. */
  media: AvaliacaoMediaDpp | null;
  papel: "coordenacao" | "supervisor" | "mentor";
  realizados: number;
}) {
  const ehMentor = papel === "mentor";
  const n = avaliacoes.length;
  const pedidoAjuda = avaliacoes.some((a) => a.pedir_apoio);
  // média própria pra coord/sup — eles leem as linhas inteiras, então o
  // cálculo direto não vaza nada além do que a tela já mostra
  const mediaCoord =
    n > 0 ? Math.round((avaliacoes.reduce((s, a) => s + a.estrelas, 0) / n) * 10) / 10 : null;

  return (
    <section className="rounded-xl bg-card p-4 text-sm space-y-2 shadow-[var(--shadow-border)]">
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
        Voz do jovem
      </h2>

      {ehMentor ? (
        media?.liberado && media.media != null ? (
          <div className="space-y-1.5">
            <p className="flex items-center gap-2">
              <EstrelasMedia media={media.media} size={15} />
              <span className="font-mono font-semibold tabular-nums">
                {media.media.toLocaleString("pt-BR", {
                  minimumFractionDigits: 1,
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                média de {media.base ?? media.n} avaliações
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {media.n} recebidas no total — cada resposta é anônima pra
              você e a média abre em lotes de 3, pra nenhuma ficar
              identificável. Quando o jovem quiser, ele libera uma
              avaliação inteira pra você ler na linha do encontro.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {media && media.n > 0
              ? `${media.n} ${media.n === 1 ? "avaliação recebida" : "avaliações recebidas"} — a média aparece pra você a partir de 3, pra nenhuma resposta ficar identificável.`
              : "Ainda nenhuma avaliação do jovem. Ele recebe o link após cada encontro realizado — e cada resposta chega a você só como média."}
          </p>
        )
      ) : (
        <div className="space-y-1.5">
          {n > 0 ? (
            <p className="flex items-center gap-2">
              <EstrelasMedia media={mediaCoord!} size={15} />
              <span className="font-mono font-semibold tabular-nums">
                {mediaCoord!.toLocaleString("pt-BR", {
                  minimumFractionDigits: 1,
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                média de {n} {n === 1 ? "avaliação" : "avaliações"}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhuma avaliação do jovem ainda.
            </p>
          )}
          {pendentes > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{pendentes}</span> de{" "}
              <span className="font-mono tabular-nums">{realizados}</span>{" "}
              realizados aguardando a resposta dele — o link sai na linha de
              cada encontro.
            </p>
          )}
          {pedidoAjuda && (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--danger)]">
              <HandHeart size={13} aria-hidden />
              Pedido de ajuda em aberto — o atendimento é da coordenação.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Lista das estrelas por sessão no rail do especialista — mesmo recorte
 *  do chip: número e data do encontro (que ele mesmo conduziu), nada mais. */
export function VozDoJovemEspecialista({
  itens,
}: {
  itens: EspecialistaAvaliacao[];
}) {
  if (!itens.length) return null;
  return (
    <section className="rounded-xl bg-card p-4 text-sm space-y-2 shadow-[var(--shadow-border)]">
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-[var(--role-mentorado)]" />
        Voz do jovem
      </h2>
      <ul className="space-y-1.5">
        {itens.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="text-muted-foreground">
              {a.numero}º encontro
              {a.realizado_em ? ` · ${formatDate(a.realizado_em)}` : ""}
            </span>
            <Estrelas n={a.estrelas} size={13} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Só a nota chega até você — o que o jovem escreveu fica com a equipe.
      </p>
    </section>
  );
}
