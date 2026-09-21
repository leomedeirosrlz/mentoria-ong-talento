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
import { DashboardCoordenacao } from "@/components/dashboard-coordenacao";
import { DemandasEspecialista } from "@/components/demandas-especialista";
import { MentorHome } from "@/components/mentor-home";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string | string[] }>;
}) {
  const [me, eventos, h, params, avisos] = await Promise.all([
    getMe(),
    getCicloEventos(),
    headers(),
    searchParams,
    getComunicados(),
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
    );
  }

  if (me?.role === "supervisor") {
    const duplas = await getMinhasDuplas();
    const interacoes = await getUltimasInteracoes(duplas.map((d) => d.id));
    return (
      <DashboardCoordenacao
        duplas={duplas}
        eventos={eventos}
        agora={agora}
        origem={origem}
        interacoes={interacoes}
        supervisor
        avisos={avisos}
        filtro={filtro}
      />
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
      {me?.role === "mentor_especialista" && (
        <DemandasEspecialista solicitacoes={solicitacoes} meuId={me.id} />
      )}
      <MentorHome
        duplas={duplas}
        eventos={eventos}
        espEventos={espEventos}
        me={me!}
        avisos={avisos}
      />
    </div>
  );
}
