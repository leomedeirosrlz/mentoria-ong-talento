import Link from "next/link";
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import {
  efetivoDe,
  nomeEspDoPedido,
  pedidoEmAberto,
} from "@/lib/jovem-especialista";
import type {
  JovemEspecialista,
  SolicitacaoEspecialista,
  SolicitacaoProposta,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PedirEspecialistaDialog } from "./pedir-especialista-dialog";
import { PedidoJovemItem } from "./jovem-pedido-item";

// o que pede resposta primeiro, o que espera depois, o encerrado por último
const ORDEM: Record<string, number> = {
  contra_proposta: 0,
  aguardando_coord: 1,
  aberta: 2,
  expirada: 3,
  recusada: 4,
};

/** Seção "Especialistas" da home do jovem (REALIZA-112): convite pra pedir
 *  apoio + os pedidos em andamento com a mesa de negociação (o rail no
 *  papel mentorado — aceitar a proposta do especialista, contra-propor ou
 *  cancelar). Não é dashboard: aceita/cancelada não listam (sessão marcada
 *  mora na agenda; o cancelado sumiu por decisão dele). `disponivel`
 *  falso = profile sem ficha de mentorado vinculada — a RPC negaria e a
 *  home some a seção em vez de prometer um gesto impossível. */
export function JovemEspecialistas({
  disponivel,
  catalogo,
  solicitacoes,
  propostas,
  slotsPorEsp,
  trilhasAtivas,
  semDuplaDpp,
  meuId,
  waCoord,
}: {
  disponivel: boolean;
  catalogo: JovemEspecialista[];
  solicitacoes: SolicitacaoEspecialista[];
  propostas: Record<string, SolicitacaoProposta[]>;
  slotsPorEsp: Record<string, string[]>;
  trilhasAtivas: string[];
  semDuplaDpp: boolean;
  meuId: string;
  waCoord: string | null;
}) {
  if (!disponivel) return null;

  const visiveis = solicitacoes
    .filter((s) => pedidoEmAberto(s) || efetivoDe(s) === "recusada")
    .sort(
      (a, b) =>
        (ORDEM[efetivoDe(a)] ?? 9) - (ORDEM[efetivoDe(b)] ?? 9) ||
        b.created_at.localeCompare(a.created_at)
    );
  const abertos = solicitacoes.filter(pedidoEmAberto).length;
  // teto da RPC: 3 pedidos em aberto (a expirada lazy conta — a coluna cru
  // segue 'aberta' no banco até o cancelamento)
  const lotado = abertos >= 3;
  // WP6: a sugestão do mentor não é pedido ainda — a decisão mora na página
  // de especialistas; a home sinaliza e linka
  const sugestoesPendentes = solicitacoes.filter(
    (s) => s.status === "sugerida"
  ).length;

  return (
    <section aria-labelledby="esp-titulo">
      <h2
        id="esp-titulo"
        className="mb-3 flex items-center gap-2 font-semibold"
      >
        <Sparkle size={18} className="text-muted-foreground" aria-hidden />
        Especialistas
      </h2>
      <Card className="animate-enter">
        <CardContent className="space-y-4 py-5">
          {sugestoesPendentes > 0 && (
            <Link
              href="/jovem/especialistas"
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--role-mentorado)]/40 bg-[var(--role-mentorado)]/10 px-3.5 py-3 text-sm font-medium transition-colors hover:bg-[var(--role-mentorado)]/20"
            >
              <span className="flex items-center gap-2">
                <Sparkle size={16} aria-hidden />
                Seu mentor sugeriu um especialista — veja e responda
              </span>
              <ArrowRight size={16} aria-hidden className="shrink-0" />
            </Link>
          )}
          {visiveis.length === 0 ? (
            <div>
              <p className="font-medium">
                Precisa de uma mão em algo específico?
              </p>
              <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Especialistas são mentors pra temas pontuais — entrevista,
                prova, projeto, decisão. Você pede, a pessoa responde e vocês
                marcam a sessão juntos.
              </p>
            </div>
          ) : (
            <ul className="-mx-(--card-spacing) divide-y divide-border/60">
              {visiveis.map((s) => {
                const alvoId =
                  s.especialista_id ?? s.especialista_desejado_id;
                const noCatalogo = catalogo.find((e) => e.id === alvoId);
                const nome = nomeEspDoPedido(s, catalogo);
                const alvo = nome
                  ? {
                      nome,
                      avatar_path: noCatalogo?.avatar_path ?? null,
                    }
                  : null;
                return (
                  <PedidoJovemItem
                    key={s.id}
                    s={s}
                    propostas={propostas[s.id] ?? []}
                    slots={alvoId ? (slotsPorEsp[alvoId] ?? []) : []}
                    meuId={meuId}
                    waCoord={waCoord}
                    alvo={alvo}
                  />
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {lotado ? (
              <p className="text-xs text-muted-foreground">
                Você já tem {abertos} pedidos em aberto — espera uma resposta
                antes de pedir de novo.
              </p>
            ) : (
              <PedirEspecialistaDialog
                especialistas={catalogo}
                trilhasAtivas={trilhasAtivas}
                slotsPorEsp={slotsPorEsp}
                semDuplaDpp={semDuplaDpp}
                trigger={
                  <Button
                    size="sm"
                    variant={visiveis.length === 0 ? "default" : "outline"}
                  >
                    <Sparkle size={15} aria-hidden />
                    {visiveis.length === 0
                      ? "Pedir apoio de um especialista"
                      : "Fazer outro pedido"}
                  </Button>
                }
              />
            )}
            <Link
              href="/jovem/especialistas"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Conhecer os especialistas e suas trilhas
              <ArrowRight size={13} aria-hidden />
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
