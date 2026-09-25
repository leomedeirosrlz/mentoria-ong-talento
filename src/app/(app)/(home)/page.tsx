import { headers } from "next/headers";
import {
  getCicloEventos,
  getComunicados,
  getContagemPessoas,
  getDuplas,
  getEspecialistaEventos,
  getMe,
  getMinhasDuplas,
} from "@/lib/queries";
import { getUltimasInteracoes } from "@/lib/interacoes";
import { getSolicitacoesVisiveis } from "@/lib/queries-especialista";
import { getSupervisaoAlvos, getSupervisoesRecentes } from "@/lib/queries-supervisao";
import { getMinhaAssinaturaTermo } from "@/lib/queries-assinaturas";
import { DashboardCoordenacao } from "@/components/dashboard-coordenacao";
import { DemandasEspecialista } from "@/components/demandas-especialista";
import { MentorHome } from "@/components/mentor-home";
import { TermoBanner } from "@/components/termo-banner";
import { AvisosSection } from "@/components/avisos-section";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string | string[] }>;
}) {
  const [me, eventos, h, params, avisos, assinatura] = await Promise.all([
    getMe(),
    getCicloEventos(),
    headers(),
    searchParams,
    getComunicados(),
    // termo de voluntariado vale pra equipe inteira (coord/sup/mentores) —
    // busca uma vez no topo; o branch de mentor reusa via React.cache
    getMinhaAssinaturaTermo(),
  ]);
  // um único instante pra página inteira — semáforo e "semana do encontro" consistentes
  const agora = new Date().toISOString();
  const origem = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  // ?filtro= alimenta os stat-cards do painel (risco | atencao | pendentes)
  const filtro = typeof params.filtro === "string" ? params.filtro : undefined;

  if (me?.role === "coordenacao") {
    const [duplas, pessoas, solicitacoes] = await Promise.all([
      getDuplas(),
      getContagemPessoas(),
      getSolicitacoesVisiveis(),
    ]);
    const interacoes = await getUltimasInteracoes(duplas.map((d) => d.id));
    return (
      <div className="space-y-8">
        {assinatura?.status !== "assinado" && <TermoBanner />}
        <DashboardCoordenacao
          duplas={duplas}
          eventos={eventos}
          agora={agora}
          origem={origem}
          interacoes={interacoes}
          pessoas={pessoas}
          avisos={avisos}
          filtro={filtro}
          solicitacoes={solicitacoes}
        />
      </div>
    );
  }

  if (me?.role === "supervisor") {
    const [duplas, supervisoes, supervisaoAlvos] = await Promise.all([
      getMinhasDuplas(),
      getSupervisoesRecentes(),
      getSupervisaoAlvos(),
    ]);
    const interacoes = await getUltimasInteracoes(duplas.map((d) => d.id));
    return (
      <div className="space-y-8">
        {assinatura?.status !== "assinado" && <TermoBanner />}
        <DashboardCoordenacao
          duplas={duplas}
          eventos={eventos}
          agora={agora}
          origem={origem}
          interacoes={interacoes}
          supervisor
          avisos={avisos}
          filtro={filtro}
          supervisaoItens={supervisoes}
          supervisaoAlvos={supervisaoAlvos}
        />
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
    // o mural de demandas é a home do especialista — pros demais não existe
    me?.role === "mentor_especialista"
      ? getSolicitacoesVisiveis()
      : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-8">
      {/* null = nunca assinou — qualquer estado ≠ assinado pede a assinatura */}
      {assinatura?.status !== "assinado" && <TermoBanner />}
      {/* contexto próprio → fila de pedidos → avisos: a saudação abre a
          página; o mural do especialista vem antes dos comunicados */}
      <MentorHome
        duplas={duplas}
        eventos={eventos}
        espEventos={espEventos}
        me={me!}
      />
      {me?.role === "mentor_especialista" && (
        <DemandasEspecialista solicitacoes={solicitacoes} meuId={me.id} />
      )}
      <AvisosSection avisos={avisos} souCoord={false} />
    </div>
  );
}
