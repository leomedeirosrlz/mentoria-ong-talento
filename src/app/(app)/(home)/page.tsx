import {
  getCicloEventos,
  getComunicados,
  getContagemPessoas,
  getCronogramas,
  getDuplas,
  getEspecialistaEventos,
  getMe,
  getMinhasDuplas,
} from "@/lib/queries";
import { getUltimasInteracoes } from "@/lib/interacoes";
import {
  getPropostasMap,
  getSlotsLivres,
  getSolicitacoesVisiveis,
} from "@/lib/queries-especialista";
import { getSupervisaoAlvos, getSupervisoesRecentes } from "@/lib/queries-supervisao";
import { getMinhaAssinaturaTermo } from "@/lib/queries-assinaturas";
import { getEncerramentosPendentes } from "@/lib/queries-encerramento";
import { getChamados } from "@/lib/queries-chamados";
import { temPapel } from "@/lib/types";
import { DashboardCoordenacao } from "@/components/dashboard-coordenacao";
import { DemandasEspecialista } from "@/components/demandas-especialista";
import { MeusChamadosCard } from "@/components/meus-chamados-card";
import { MentorHome } from "@/components/mentor-home";
import { TermoBanner } from "@/components/termo-banner";
import { AvisosSection } from "@/components/avisos-section";

export default async function HomePage() {
  const [me, eventos, cronogramas, avisos, assinatura] = await Promise.all([
    getMe(),
    getCicloEventos(),
    getCronogramas(),
    getComunicados(),
    // termo de voluntariado vale pra equipe inteira (coord/sup/mentores) —
    // busca uma vez no topo; o branch de mentor reusa via React.cache
    getMinhaAssinaturaTermo(),
  ]);
  // um único instante pra página inteira — semáforo e "semana do encontro" consistentes
  const agora = new Date().toISOString();

  if (me?.role === "coordenacao") {
    const [duplas, pessoas, solicitacoes, encerramentos] = await Promise.all([
      getDuplas(),
      getContagemPessoas(),
      getSolicitacoesVisiveis(),
      getEncerramentosPendentes(),
    ]);
    const interacoes = await getUltimasInteracoes(duplas.map((d) => d.id), "nudge");
    // staff+especialista (papel secundário): o sino já notifica os pedidos —
    // a home tem que dar a superfície de agir, senão o ping morre aqui
    const ehEsp = temPapel(me, "mentor_especialista");
    const emNegociacao = solicitacoes.filter((s) =>
      ["aberta", "contra_proposta"].includes(s.status_efetivo ?? s.status)
    );
    const [propostas, meusSlots] = await Promise.all([
      ehEsp && emNegociacao.length
        ? getPropostasMap(emNegociacao.map((s) => s.id))
        : Promise.resolve({}),
      ehEsp ? getSlotsLivres(me.id) : Promise.resolve([]),
    ]);
    return (
      <div className="space-y-8">
        <DashboardCoordenacao
          duplas={duplas}
          eventos={eventos}
          cronogramas={cronogramas}
          agora={agora}
          interacoes={interacoes}
          pessoas={pessoas}
          avisos={avisos}
          solicitacoes={solicitacoes}
          encerramentos={new Set(Object.keys(encerramentos))}
          turmas={[...new Set(cronogramas.map((c) => c.turma))]}
          meuNome={me?.nome.split(" ")[0]}
          termo={assinatura?.status !== "assinado" ? <TermoBanner /> : null}
        />
        {ehEsp && (
          <DemandasEspecialista
            solicitacoes={solicitacoes}
            propostas={propostas}
            slots={meusSlots}
            meuId={me.id}
            minhasAreas={me.areas ?? undefined}
            mentoradosProprios={duplas
              .filter(
                (d) =>
                  d.trilha !== "especialista" &&
                  d.mentor?.id === me.id &&
                  (d.status === "ativa" || d.status === "pausada")
              )
              .map((d) => d.mentorado?.id)
              .filter((id): id is string => id != null)}
          />
        )}
      </div>
    );
  }

  if (me?.role === "supervisor") {
    // idem coord: sup+esp também recebe o ping do mural — a home dele tem
    // que deixar agir. Os fetches sobem no mesmo batch: só dependem de `me`
    const ehEspSup = temPapel(me, "mentor_especialista");
    const [duplas, supervisoes, supervisaoAlvos, solicitacoesEsp, slotsSup, interacoes] =
      await Promise.all([
        getMinhasDuplas(),
        getSupervisoesRecentes(),
        getSupervisaoAlvos(),
        ehEspSup ? getSolicitacoesVisiveis() : Promise.resolve([]),
        ehEspSup ? getSlotsLivres(me.id) : Promise.resolve([]),
        getMinhasDuplas().then((d) =>
          getUltimasInteracoes(d.map((x) => x.id), "nudge")
        ),
      ]);
    const emNegSup = solicitacoesEsp.filter((s) =>
      ["aberta", "contra_proposta"].includes(s.status_efetivo ?? s.status)
    );
    const propostasSup = emNegSup.length
      ? await getPropostasMap(emNegSup.map((s) => s.id))
      : {};
    return (
      <div className="space-y-8">
        <DashboardCoordenacao
          duplas={duplas}
          eventos={eventos}
          cronogramas={cronogramas}
          agora={agora}
          interacoes={interacoes}
          supervisor
          avisos={avisos}
          supervisaoItens={supervisoes}
          supervisaoAlvos={supervisaoAlvos}
          meuNome={me?.nome.split(" ")[0]}
          termo={assinatura?.status !== "assinado" ? <TermoBanner /> : null}
        />
        {ehEspSup && (
          <DemandasEspecialista
            solicitacoes={solicitacoesEsp}
            propostas={propostasSup}
            slots={slotsSup}
            meuId={me.id}
            minhasAreas={me.areas ?? undefined}
            mentoradosProprios={duplas
              .filter(
                (d) =>
                  d.trilha !== "especialista" &&
                  d.mentor?.id === me.id &&
                  (d.status === "ativa" || d.status === "pausada")
              )
              .map((d) => d.mentorado?.id)
              .filter((id): id is string => id != null)}
          />
        )}
      </div>
    );
  }

  const duplas = await getMinhasDuplas();
  const [espEventos, solicitacoes] = await Promise.all([
    // passos da trilha especialista só valem a leitura quando há dupla dela —
    // mentor DPP puro não paga o round-trip
    duplas.some((d) => d.trilha === "especialista")
      ? getEspecialistaEventos()
      : Promise.resolve([]),
    // o mural de demandas é a home do especialista — pros demais não existe.
    // temPapel: o híbrido DPP-primário também atende demandas (WP6b)
    temPapel(me, "mentor_especialista")
      ? getSolicitacoesVisiveis()
      : Promise.resolve([]),
  ]);
  // a negociação precisa da thread de propostas e da agenda do especialista
  // (o slot sempre sai da grade dele — os picks de aceite/contra vêm daqui)
  const emNegociacao = solicitacoes.filter(
    (s) =>
      (s.status_efetivo ?? s.status) === "aberta" ||
      (s.status_efetivo ?? s.status) === "contra_proposta"
  );
  const [propostas, meusSlots, meusChamados] = await Promise.all([
    emNegociacao.length
      ? getPropostasMap(emNegociacao.map((s) => s.id))
      : Promise.resolve({}),
    temPapel(me, "mentor_especialista")
      ? getSlotsLivres(me!.id)
      : Promise.resolve([]),
    // 0084: os chamados do mentor moram na home dele (coord/sup têm a fila)
    getChamados(),
  ]);
  const duplasOpcoes = duplas
    .filter((d) => d.status === "ativa" || d.status === "pausada")
    .map((d) => ({
      id: d.id,
      label: `${d.mentorado?.nome?.split(" ")[0] ?? "Mentorado(a)"} · ${d.trilha === "especialista" ? "Especialista" : "DPP"}`,
    }));
  return (
    <div className="space-y-8">
      {/* contexto próprio → fila de pedidos → avisos: a saudação abre a
          página; o mural do especialista vem antes dos comunicados */}
      {/* termo em faixa de largura total logo abaixo da saudação, antes das
          duplas. null = nunca assinou — qualquer estado ≠ assinado pede a
          assinatura */}
      <MentorHome
        duplas={duplas}
        eventos={eventos}
        espEventos={espEventos}
        cronogramas={cronogramas}
        me={me!}
        termo={assinatura?.status !== "assinado" ? <TermoBanner /> : null}
      />
      <MeusChamadosCard
        chamados={meusChamados.itens}
        duplas={duplasOpcoes}
        papel={me?.role ?? ""}
      />
      {temPapel(me, "mentor_especialista") && (
        <DemandasEspecialista
          solicitacoes={solicitacoes}
          propostas={propostas}
          slots={meusSlots}
          meuId={me!.id}
          minhasAreas={me?.areas ?? undefined}
          mentoradosProprios={duplas
            .filter(
              (d) =>
                d.trilha !== "especialista" &&
                (d.status === "ativa" || d.status === "pausada")
            )
            .map((d) => d.mentorado?.id)
            .filter((id): id is string => id != null)}
        />
      )}
      <AvisosSection avisos={avisos} souCoord={false} />
    </div>
  );
}
