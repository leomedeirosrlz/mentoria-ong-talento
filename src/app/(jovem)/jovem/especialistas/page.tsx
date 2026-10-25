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
import { CatalogoJovem } from "@/components/catalogo-jovem";
import { JovemTrilhaCard } from "@/components/jovem-trilha-card";
import { SugestaoEspecialistaCard } from "@/components/jovem-sugestao-card";
import { PedidoJovemItem } from "@/components/jovem-pedido-item";
import { Card, CardContent } from "@/components/ui/card";
import type { Disponibilidade, JovemDupla } from "@/lib/types";

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
  // o autor da devolutiva é quase sempre o especialista da trilha — mas a
  // coordenação também posta (postar_devolutiva aceita staff). mentorado
  // não lê profiles: o nome sai de jovem_contatos (mentor, supervisor,
  // coordenação são alcançáveis), com o mentor da dupla como fallback —
  // atribuir uma devolutiva da coord ao especialista seria errado
  const nomeContato = new Map(
    contatos
      .filter((c) => c.id != null && (c.nome_social || c.nome) != null)
      .map((c) => [c.id!, (c.nome_social || c.nome)!] as const)
  );
  const nomeMentor = new Map(
    trilhas.map((d) => [
      d.id,
      d.mentor_nome_social || d.mentor_nome || "Equipe",
    ] as const)
  );
  const feedComAutor = devolutivas.map((v) => ({
    ...v,
    autor: {
      nome:
        nomeContato.get(v.autor_id) ?? nomeMentor.get(v.dupla_id) ?? "Equipe",
    },
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
  const abertos = solicitacoes.filter(pedidoEmAberto);
  const lotado = abertos.length >= 3;
  // a grade do jovem pinta o "encaixa com você" na mesa de negociação
  const dispJovem = (perfil?.disponibilidade ?? null) as Disponibilidade | null;

  /** A solicitação que originou a trilha — o aceite grava `dupla_id` nela,
   *  mas o follow-up de sessão seguinte também nasce com `dupla_id` (e
   *  'aberta' ordena antes de 'aceita'): entre os matches, o pedido-origem
   *  é o `aceita` — senão o stepper conta a história do pedido novo com a
   *  trilha velha. Sem match (view sem solicitacao_id, aceite por caminho
   *  staff, dado antigo) cai na mais recente do mesmo par. */
  const solDaTrilha = (d: JovemDupla) => {
    const vinculadas = solicitacoes.filter((s) => s.dupla_id === d.id);
    return (
      vinculadas.find((s) => s.status === "aceita") ??
      vinculadas.sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ??
      solicitacoes
        .filter(
          (s) =>
            s.especialista_id === d.mentor_id ||
            s.especialista_desejado_id === d.mentor_id
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ??
      null
    );
  };

  if (!disponivel) {
    // sem ficha de mentorado a RPC negaria — a página diz por que em vez de
    // prometer um gesto impossível (mesma régua da home)
    return (
      <div className="grid gap-6">
        <header>
          <h1 className="text-xl font-semibold">Especialistas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mentores pra temas pontuais: entrevista, prova, projeto, decisão.
          </p>
        </header>
        <Card>
          <CardContent className="py-5 text-sm text-muted-foreground">
            Seu cadastro ainda não está completo. Quando a equipe vincular
            sua ficha, você pede um especialista por aqui.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-xl font-semibold">Especialistas</h1>
        <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Mentores pra temas pontuais: entrevista, prova, projeto, decisão.
          Você pede, a pessoa responde e vocês marcam a sessão juntos.
        </p>
      </header>

      {/* os três gestos separados na própria página (mock v6 .three) — a
          confusão real era chamar tudo de "pedir especialista": o chamado
          é outro sistema e a sessão não existe sem trilha */}
      <div
        role="note"
        aria-label="Três coisas diferentes"
        className="grid gap-2 text-xs leading-relaxed text-muted-foreground sm:grid-cols-3"
      >
        <p className="rounded-lg border border-[var(--role-mentorado)]/50 bg-[var(--role-mentorado)]/10 px-3 py-2.5">
          <span className="block font-semibold text-foreground">
            Pedir uma trilha
          </span>
          Ela é o que esta página faz. O pedido vai ao mural e um
          especialista aceita.
        </p>
        <p className="rounded-lg border border-border px-3 py-2.5">
          <span className="block font-semibold text-foreground">
            Agendar uma sessão
          </span>
          Só dentro de uma trilha ativa, nos horários do especialista.
        </p>
        <p className="rounded-lg border border-border px-3 py-2.5">
          <span className="block font-semibold text-foreground">
            Pedir apoio à coordenação
          </span>
          É um chamado sobre agenda, método ou urgência. O link fica no fim
          da página.
        </p>
      </div>

      {sugestoes.length > 0 && (
        <section aria-label="Sugestões do seu mentor" className="space-y-3">
          {sugestoes.map((s) => (
            <SugestaoEspecialistaCard key={s.id} s={s} catalogo={catalogo} />
          ))}
        </section>
      )}

      {trilhas.length > 0 && (
        // id="trilhas": o card-CTA da home ancora aqui ("Abrir minha trilha")
        <section
          id="trilhas"
          aria-labelledby="trilhas-titulo"
          className="space-y-3"
        >
          <h2 id="trilhas-titulo" className="text-base font-semibold">
            Suas trilhas
          </h2>
          <div className="grid gap-4">
            {trilhas.map((d, i) => (
              <JovemTrilhaCard
                key={d.id}
                indice={i}
                dupla={d}
                solicitacao={solDaTrilha(d)}
                pedidoAberto={
                  solicitacoes.find(
                    (s) => s.dupla_id === d.id && pedidoEmAberto(s)
                  ) ?? null
                }
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
        // id="pedidos": o card "pedido em andamento" do catálogo ancora aqui
        <section id="pedidos" aria-labelledby="pedidos-titulo">
          <h2
            id="pedidos-titulo"
            className="mb-3 text-base font-semibold"
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
                      disponibilidade={dispJovem}
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
          className="mb-3 flex items-center gap-2 text-base font-semibold"
        >
          <Sparkle size={18} className="text-muted-foreground" aria-hidden />
          Quem pode te ajudar
        </h2>
        <CatalogoJovem
          catalogo={catalogo}
          trilhasAtivas={trilhasAtivas}
          slotsPorEsp={slotsPorEsp}
          semDuplaDpp={semDuplaDpp}
          lotado={lotado}
          pedidosAbertos={abertos}
        />
      </section>
    </div>
  );
}
