import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getCicloEventos,
  getDuplas,
  getEspecialistaEventos,
  getMe,
  getMinhasDuplas,
} from "@/lib/queries";
import { getSupervisaoAlvos } from "@/lib/queries-supervisao";
import { temPapel } from "@/lib/types";
import { DuplasLista, type VisaoDuplas } from "@/components/duplas-lista";

export const metadata: Metadata = {
  title: "Duplas",
};

export default async function DuplasPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  // mentor também entra — a RLS já limita a lista às próprias duplas.
  // Papéis efetivos, não o primário: quem é DPP + especialista ganha a
  // visão híbrida (as duas seções, cada card na régua da própria trilha)
  const visao: VisaoDuplas | null =
    me.role === "coordenacao"
      ? "coordenacao"
      : me.role === "supervisor"
        ? "supervisor"
        : temPapel(me, "mentor_dpp") && temPapel(me, "mentor_especialista")
          ? "hibrido"
          : temPapel(me, "mentor_dpp")
            ? "mentor"
            : temPapel(me, "mentor_especialista")
              ? "especialista"
              : null;
  if (!visao) redirect("/");

  // coord vê tudo; supervisor/mentor já vêm escopados da query (uma leitura,
  // sem baixar o ciclo inteiro pra filtrar em JS). Os extras são por visão:
  // alvos do dialog de supervisão (auxiliar) e os 5 passos da trilha
  // (especialista) — os demais não pagam essa leitura
  const [lista, eventos, alvos, espEventos] = await Promise.all([
    me.role === "coordenacao"
      ? getDuplas()
      : me.role === "supervisor"
        ? // getMinhasDuplas abrange mentor_id OU supervisor_id — a visão do
          // auxiliar é "duplas que você supervisiona", então o lado mentor
          // (caso ela também seja mentora de alguém) sai do radar daqui
          getMinhasDuplas().then((ds) =>
            ds.filter((d) => d.supervisor?.id === me.id)
          )
        : getMinhasDuplas(),
    getCicloEventos(),
    visao === "supervisor" ? getSupervisaoAlvos() : Promise.resolve([]),
    visao === "especialista" || visao === "hibrido"
      ? getEspecialistaEventos()
      : Promise.resolve([]),
  ]);

  return (
    <DuplasLista
      lista={lista}
      eventos={eventos}
      agora={new Date().toISOString()}
      visao={visao}
      meuNome={me.nome.split(" ")[0]}
      supervisaoAlvos={alvos}
      especialistaEventos={espEventos}
    />
  );
}
