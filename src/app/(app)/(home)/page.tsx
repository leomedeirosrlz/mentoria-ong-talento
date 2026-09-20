import { headers } from "next/headers";
import {
  getCicloEventos,
  getContagemPessoas,
  getDuplas,
  getMe,
  getMinhasDuplas,
} from "@/lib/queries";
import { getUltimasInteracoes } from "@/lib/interacoes";
import { DashboardCoordenacao } from "@/components/dashboard-coordenacao";
import { MentorHome } from "@/components/mentor-home";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string | string[] }>;
}) {
  const [me, eventos, h, params] = await Promise.all([
    getMe(),
    getCicloEventos(),
    headers(),
    searchParams,
  ]);
  // um único instante pra página inteira — semáforo e "semana do encontro" consistentes
  const agora = new Date().toISOString();
  const origem = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  // ?filtro= alimenta os stat-cards do painel (risco | atencao | pendentes)
  const filtro = typeof params.filtro === "string" ? params.filtro : undefined;

  if (me?.role === "coordenacao") {
    const [duplas, pessoas] = await Promise.all([getDuplas(), getContagemPessoas()]);
    const interacoes = await getUltimasInteracoes(duplas.map((d) => d.id));
    return (
      <DashboardCoordenacao
        duplas={duplas}
        eventos={eventos}
        agora={agora}
        origem={origem}
        interacoes={interacoes}
        pessoas={pessoas}
        filtro={filtro}
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
        filtro={filtro}
      />
    );
  }

  const duplas = await getMinhasDuplas();
  return <MentorHome duplas={duplas} eventos={eventos} me={me!} />;
}
