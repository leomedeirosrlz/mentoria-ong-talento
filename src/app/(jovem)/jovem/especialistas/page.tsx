import type { Metadata } from "next";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { getMe } from "@/lib/queries";
import { waLink } from "@/lib/ciclo";
import {
  getDevolutivas,
  getJovemContatos,
  getJovemDuplas,
  getJovemEncontros,
  getJovemPedidosEspecialista,
  getJovemPerfil,
  getJovemTrilhaEsp,
} from "@/lib/queries-jovem";
import {
  efetivoDe,
  nomeEspDoPedido,
  pedidoEmAberto,
} from "@/lib/jovem-especialista";
import { JovemEspecialistaCard } from "@/components/jovem-especialista-card";
import { JovemTrilhaCard } from "@/components/jovem-trilha-card";
import { SugestaoEspecialistaCard } from "@/components/jovem-sugestao-card";
import { PedirEspecialistaDialog } from "@/components/pedir-especialista-dialog";
import { PedidoJovemItem } from "@/components/jovem-pedido-item";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Especialistas" };

// mesma fila da home: o que pede resposta primeiro, o encerrado por último
const ORDEM: Record<string, number> = {
  contra_proposta: 0,
  aguardando_coord: 1,
  aberta: 2,
  expirada: 3,
  recusada: 4,
};

/** /jovem/especialistas (WP6 · REALIZA-139/146) — a página dos especialistas
 *  do jovem: a sugestão do mentor esperando resposta, as trilhas em curso
 *  com stepper + devolutivas, a mesa de negociação dos pedidos abertos e o
 *  cardápio rico (bio/áreas/períodos — agenda de verdade só na mesa). */
export default async function JovemEspecialistasPage() {
  const [me, perfil, duplas, contatos, encontros, pedidosEsp, passos] =
    await Promise.all([
      getMe(),
      getJovemPerfil(),
      getJovemDuplas(),
      getJovemContatos(),
      getJovemEncontros(),
      getJovemPedidosEspecialista(),
      getJovemTrilhaEsp(),
    ]);
  if (!me) return null; // o layout já barra — convenção das páginas

  const agoraMs = new Date().getTime();
  const { catalogo, solicitacoes, propostas, slotsPorEsp } = pedidosEsp;
  const disponivel = perfil != null;

  const duplaAtual =
    duplas.find((d) => d.status === "ativa" || d.status === "pausada") ??
    duplas[0] ??
    null;
  const coordenacao = contatos.filter(
    (c) => (c.dupla_id == null || c.dupla_id === duplaAtual?.id) && c.papel === "coordenacao"
  );
  const nomeTela = me.nome_social || me.nome;
  const waCoord = waLink(
    coordenacao[0]?.whatsapp,
    `Olá! Sou ${nomeTela}, mentorado(a) do programa, e preciso falar com a equipe.`
  );

  // sugestões do mentor DPP esperando a resposta do jovem (WP6) — 'sugerida'
  // não conta nos tetos e não entra na mesa: o card vem primeiro na página
  const sugestoes = solicitacoes.filter((s) => s.status === "sugerida");

  // trilhas de especialista (ativas primeiro; as encerradas seguem com o
  // feed de devolutivas — a história do que a trilha devolveu)
  const trilhas = duplas
    .filter((d) => d.trilha === "especialista" && d.id != null)
    .sort((a, b) => {
      const ativaA = a.status === "ativa" || a.status === "pausada";
      const ativaB = b.status === "ativa" || b.status === "pausada";
      return Number(ativaB) - Number(ativaA);
    });
  const devolutivas = await getDevolutivas(
    trilhas.map((d) => d.id!)
  );
  // o autor da devolutiva é o mentor da trilha (ou a coordenação) — o nome
  // vem do embed da própria dupla; mentorado não lê profiles direto
  const nomeAutor = new Map(
    trilhas.map((d) => [
      d.id,
      d.mentor_nome_social || d.mentor_nome || "Equipe",
    ] as const)
  );
  const feedComAutor = devolutivas.map((v) => ({
    ...v,
    autor: { nome: nomeAutor.get(v.dupla_id) ?? "Equipe" },
  }));

  const trilhasAtivas = trilhas
    .filter(
      (d) => (d.status === "ativa" || d.status === "pausada") && d.mentor_id != null
    )
    .map((d) => d.mentor_id!);
  const semDuplaDpp = !duplas.some(
    (d) => d.trilha !== "especialista" && d.status === "ativa"
  );

  // a mesa: pedidos abertos + recusadas (aceita vira trilha; cancelada some)
  const visiveis = solicitacoes
    .filter((s) => pedidoEmAberto(s) || efetivoDe(s) === "recusada")
    .sort(
      (a, b) =>
        (ORDEM[efetivoDe(a)] ?? 9) - (ORDEM[efetivoDe(b)] ?? 9) ||
        b.created_at.localeCompare(a.created_at)
    );
  const lotado = solicitacoes.filter(pedidoEmAberto).length >= 3;

  if (!disponivel) {
    // sem ficha de mentorado a RPC negaria — a página diz por que em vez de
    // prometer um gesto impossível (mesma régua da home)
    return (
      <div className="grid gap-6">
        <header>
          <h1 className="text-xl font-semibold">Especialistas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mentores pra temas pontuais — entrevista, prova, projeto, decisão.
          </p>
        </header>
        <Card>
          <CardContent className="py-5 text-sm text-muted-foreground">
            Seu cadastro ainda não está completo — quando a equipe vincular
            sua ficha, você pede um especialista por aqui.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-xl font-semibold">Especialistas</h1>
        <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Mentores pra temas pontuais — entrevista, prova, projeto, decisão.
          Você pede, a pessoa responde e vocês marcam a sessão juntos.
        </p>
      </header>

      {sugestoes.length > 0 && (
        <section aria-label="Sugestões do seu mentor" className="space-y-3">
          {sugestoes.map((s) => (
            <SugestaoEspecialistaCard key={s.id} s={s} catalogo={catalogo} />
          ))}
        </section>
      )}

      {trilhas.length > 0 && (
        <section aria-labelledby="trilhas-titulo" className="space-y-3">
          <h2
            id="trilhas-titulo"
            className="flex items-center gap-2 font-semibold"
          >
            Suas trilhas
          </h2>
          <div className="grid gap-4">
            {trilhas.map((d) => (
              <JovemTrilhaCard
                key={d.id}
                dupla={d}
                passos={passos}
                encontros={encontros}
                devolutivas={feedComAutor}
                agoraMs={agoraMs}
              />
            ))}
          </div>
        </section>
      )}

      {visiveis.length > 0 && (
        <section aria-labelledby="pedidos-titulo">
          <h2
            id="pedidos-titulo"
            className="mb-3 flex items-center gap-2 font-semibold"
          >
            Pedidos em aberto
          </h2>
          <Card className="animate-enter">
            <CardContent className="py-2">
              <ul className="-mx-(--card-spacing) divide-y divide-border/60">
                {visiveis.map((s) => {
                  const alvoId = s.especialista_id ?? s.especialista_desejado_id;
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
                      meuId={me.id}
                      waCoord={waCoord}
                      alvo={alvo}
                    />
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-labelledby="catalogo-titulo">
        <h2
          id="catalogo-titulo"
          className="mb-3 flex items-center gap-2 font-semibold"
        >
          <Sparkle size={18} className="text-muted-foreground" aria-hidden />
          Quem pode te ajudar
        </h2>
        {catalogo.length === 0 ? (
          <Card>
            <CardContent className="py-5 text-sm text-muted-foreground">
              Ainda não tem especialista disponível pra sua turma — a
              coordenação avisa quando entrar alguém.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {catalogo.map((e) => (
              <JovemEspecialistaCard
                key={e.id}
                e={e}
                trilhasAtivas={trilhasAtivas}
                slotsPorEsp={slotsPorEsp}
                semDuplaDpp={semDuplaDpp}
                lotado={lotado}
              />
            ))}
          </div>
        )}
        {!lotado && catalogo.length > 0 && (
          <div className="mt-4">
            <PedirEspecialistaDialog
              especialistas={catalogo}
              trilhasAtivas={trilhasAtivas}
              slotsPorEsp={slotsPorEsp}
              semDuplaDpp={semDuplaDpp}
              trigger={
                <Button size="sm" variant="outline">
                  <Sparkle size={15} aria-hidden />
                  Pedir sem escolher — a coordenação direciona
                </Button>
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}
