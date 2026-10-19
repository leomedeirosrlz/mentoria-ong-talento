import Link from "next/link";
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import {
  efetivoDe,
  nomeEspDoPedido,
  pedidoEmAberto,
  resumoPedidoJovem,
} from "@/lib/jovem-especialista";
import {
  formatDiaHora,
  formatDiaNum,
  formatDiaSemana,
  formatMesAbrev,
} from "@/lib/ciclo";
import type { JovemEspecialista, SolicitacaoEspecialista } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// o que pede resposta primeiro, o que espera depois
const ORDEM: Record<string, number> = {
  contra_proposta: 0,
  aguardando_coord: 1,
  aberta: 2,
  expirada: 3,
};

/** "Sex 10/out · 16h" — a próxima sessão marcada, na gramática curta do
 *  card-CTA (mesmo fuso dos helpers de ciclo; hora quebrada fica "16:30"). */
function rotuloProxima(iso: string): string {
  const sem = formatDiaSemana(iso).replace("-feira", "");
  const semCurta = sem ? sem.slice(0, 3) : "";
  const diaMes = [formatDiaNum(iso), formatMesAbrev(iso)]
    .filter(Boolean)
    .join("/");
  const hora = formatDiaHora(iso).split("às ")[1]?.replace(":00", "h") ?? "";
  return [semCurta, diaMes, hora].filter(Boolean).join(" · ");
}

/** O badge vivo do card — o pontinho âmbar do mock (estado = texto, a cor
 *  nunca carrega sozinha). */
function LiveBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--warn-text)]">
      <span aria-hidden className="size-2 rounded-full bg-[var(--warn)]" />
      {children}
    </span>
  );
}

/** O botão-pílula escuro do card (CTA principal do estado vivo). */
function GoPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] bg-[var(--brand-ink)] px-4 text-sm font-bold text-white">
      {children}
      <ArrowRight size={14} weight="bold" aria-hidden />
    </span>
  );
}

/** Card-CTA vivo da seção Especialistas na home (mock v6 .cta): um card só
 *  — o estado mais urgente ganha (sugestão esperando resposta > trilha em
 *  curso > pedido em aberto > convite vazio). A mesa de negociação e o
 *  catálogo moram em /jovem/especialistas; daqui o gesto é sempre "ir pra
 *  lá". `disponivel` falso = profile sem ficha de mentorado — a home some
 *  a seção em vez de prometer um gesto impossível (mesma régua de antes). */
export function JovemEspecialistas({
  disponivel,
  solicitacoes,
  catalogo,
  trilha,
  agoraMs,
}: {
  disponivel: boolean;
  solicitacoes: SolicitacaoEspecialista[];
  /** Catálogo — só resolve o nome do especialista do pedido em aberto. */
  catalogo: JovemEspecialista[];
  /** Resumo da trilha de especialista em curso (a página escolhe a mais
   *  "viva": a que tem a próxima sessão mais perto; sem sessão, a mais
   *  nova). null = nenhuma trilha ativa/pausada. */
  trilha: {
    /** Tema da trilha — a demanda que a originou (null → rótulo genérico). */
    tema: string;
    /** Primeiro nome do especialista. */
    espNome: string;
    /** Passo do guia da próxima sessão (1..5 — já conta o que rolou). */
    sessao: number;
    /** ISO da próxima sessão marcada/remarcada — null = sem horário ainda. */
    proxima: string | null;
    pausada: boolean;
  } | null;
  /** o "agora" vem da página — o "há N dias" não diverge entre renders. */
  agoraMs: number;
}) {
  if (!disponivel) return null;

  const sugestao = solicitacoes.find((s) => s.status === "sugerida");
  const pedido =
    solicitacoes
      .filter(pedidoEmAberto)
      .sort(
        (a, b) =>
          (ORDEM[efetivoDe(a)] ?? 9) - (ORDEM[efetivoDe(b)] ?? 9) ||
          b.created_at.localeCompare(a.created_at)
      )[0] ?? null;

  return (
    <section aria-labelledby="esp-titulo">
      <h2
        id="esp-titulo"
        className="mb-3 flex items-center gap-2 font-semibold"
      >
        <Sparkle size={18} className="text-muted-foreground" aria-hidden />
        Especialistas
      </h2>

      {sugestao ? (
        <Link
          href="/jovem/especialistas"
          className="block rounded-(--radius) border border-[var(--role-mentorado)]/60 bg-[var(--role-mentorado)]/15 p-4 shadow-(--shadow) transition-colors hover:bg-[var(--role-mentorado)]/20"
        >
          <LiveBadge>Sugestão esperando sua resposta</LiveBadge>
          <p className="mt-1 font-bold">
            {(sugestao.solicitante?.nome ?? "Seu mentor").split(" ")[0]}{" "}
            sugeriu um especialista pra você
          </p>
          <p className="text-sm">Veja quem é e responda por lá.</p>
          <GoPill>Ver a sugestão</GoPill>
        </Link>
      ) : trilha ? (
        <Link
          href="/jovem/especialistas#trilhas"
          className="block rounded-(--radius) border border-[var(--role-mentorado)]/60 bg-[var(--role-mentorado)]/15 p-4 shadow-(--shadow) transition-colors hover:bg-[var(--role-mentorado)]/20"
        >
          <LiveBadge>
            {trilha.pausada
              ? "Trilha pausada"
              : `Trilha em andamento · sessão ${trilha.sessao} de 5`}
          </LiveBadge>
          <p className="mt-1 font-bold">
            {trilha.tema} com {trilha.espNome}
          </p>
          <p className="text-sm">
            {trilha.proxima
              ? `${rotuloProxima(trilha.proxima)} · marcada na agenda`
              : `A sessão ${trilha.sessao} ainda precisa de horário.`}
          </p>
          <GoPill>Abrir minha trilha</GoPill>
        </Link>
      ) : pedido ? (
        <PedidoCta s={pedido} catalogo={catalogo} agoraMs={agoraMs} />
      ) : (
        // estado quieto — sem card pesado: o convite é a linha + o link
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <div className="min-w-0 flex-1 basis-52">
              <p className="font-medium">
                Quer o apoio de um especialista?
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Carreira, finanças, vendas… trilha de até 5 sessões em
                ~3 meses.
              </p>
            </div>
            <Link
              href="/jovem/especialistas"
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-input px-4 text-sm font-bold transition-colors",
                "hover:bg-muted"
              )}
            >
              Conhecer
              <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

/** O estado "pedido em aberto" — badge no mural/em negociação/em triagem,
 *  título "{tema} · há N dias" e a linha de estado honesta na voz do
 *  jovem (resumoPedidoJovem). */
function PedidoCta({
  s,
  catalogo,
  agoraMs,
}: {
  s: SolicitacaoEspecialista;
  catalogo: JovemEspecialista[];
  agoraMs: number;
}) {
  const efetivo = efetivoDe(s);
  const nomeEsp = nomeEspDoPedido(s, catalogo);
  const dias = Math.max(
    0,
    Math.floor((agoraMs - new Date(s.created_at).getTime()) / 86400000)
  );
  const haQuanto =
    dias === 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`;
  const tema =
    s.motivo ?? s.demanda ?? nomeEsp ?? "Pedido de especialista";

  const badge =
    efetivo === "contra_proposta"
      ? "Seu pedido está em negociação"
      : efetivo === "aguardando_coord"
        ? "Seu pedido está em triagem"
        : efetivo === "expirada"
          ? "Seu pedido expirou"
          : "Seu pedido está no mural";

  return (
    <Link
      href="/jovem/especialistas#pedidos"
      className="block rounded-(--radius) border border-[var(--role-mentorado)]/60 bg-[var(--role-mentorado)]/15 p-4 shadow-(--shadow) transition-colors hover:bg-[var(--role-mentorado)]/20"
    >
      <LiveBadge>{badge}</LiveBadge>
      <p className="mt-1 font-bold">
        {tema} · {haQuanto}
      </p>
      <p className="text-sm">{resumoPedidoJovem(efetivo, nomeEsp)}</p>
      <GoPill>Ver meu pedido</GoPill>
    </Link>
  );
}
