import { getCicloEventos, getDuplas, getMe, getMinhasDuplas } from "@/lib/queries";
import { DashboardCoordenacao } from "@/components/dashboard-coordenacao";
import { MentorHome } from "@/components/mentor-home";

export default async function HomePage() {
  const me = await getMe();
  const eventos = await getCicloEventos();

  if (me?.role === "coordenacao") {
    const duplas = await getDuplas();
    return <DashboardCoordenacao duplas={duplas} eventos={eventos} me={me} />;
  }

  if (me?.role === "supervisor") {
    const duplas = await getMinhasDuplas();
    return <DashboardCoordenacao duplas={duplas} eventos={eventos} me={me} supervisor />;
  }

  const duplas = await getMinhasDuplas();
  return <MentorHome duplas={duplas} eventos={eventos} me={me!} />;
}
