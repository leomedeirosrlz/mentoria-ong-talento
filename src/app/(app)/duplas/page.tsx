import { headers } from "next/headers";
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
import { duplaSupervisionada } from "@/lib/auxiliar-escopo";
import { getUltimasInteracoes } from "@/lib/interacoes";
import { RECORTES_FATIA, type RecorteFatia } from "@/lib/agenda-coordenacao";
import { temPapel } from "@/lib/types";
import { DuplasLista, type VisaoDuplas } from "@/components/duplas-lista";

export const metadata: Metadata = {
  title: "Duplas",
};

export default async function DuplasPage({
  searchParams,
}: {
  searchParams: Promise<{ recorte?: string | string[] }>;
}) {
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
  const [lista, eventos, alvos, espEventos, h, sp] = await Promise.all([
    me.role === "coordenacao"
      ? getDuplas()
      : me.role === "supervisor"
        ? // getMinhasDuplas vem escopada da RLS (0125 — supervisionadas +
          // turma dele + as que ele mentora). A visão do auxiliar é "duplas
          // que você supervisiona", então o lado mentor sai do radar daqui
          getMinhasDuplas().then((ds) =>
            ds.filter((d) => duplaSupervisionada(d, me.id))
          )
        : getMinhasDuplas(),
    getCicloEventos(),
    visao === "supervisor" ? getSupervisaoAlvos() : Promise.resolve([]),
    visao === "especialista" || visao === "hibrido"
      ? getEspecialistaEventos()
      : Promise.resolve([]),
    headers(),
    searchParams,
  ]);
  // o "Lembrar" lê o cap de 48h (último nudge da dupla) — coordenação e
  // auxiliar executivo renderizam o botão no próprio escopo (a RPC
  // `enviar_lembrete` já autoriza o supervisor da dupla); os demais
  // papéis não pagam a leitura
  const nudges =
    visao === "coordenacao" || visao === "supervisor"
      ? await getUltimasInteracoes(lista.map((d) => d.id), "nudge")
      : {};
  // proto+host do deploy — o texto do Lembrar embute o link de registro
  // ABSOLUTO (o wa.me/notificação sai do app; path relativo seria texto
  // morto). Mesma técnica do dashboard: x-forwarded-proto + host
  const origem = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  // ?recorte=<fatia> — os atalhos do SaudePrograma (home, agenda, registros)
  // pousam aqui já filtrados. Vocabulário único em RECORTES_FATIA; valor
  // desconhecido cai fora (ausência de recorte), nunca 404 nem chip fantasma
  const recorteParam = Array.isArray(sp.recorte) ? sp.recorte[0] : sp.recorte;
  const recorteInicial: RecorteFatia | null =
    RECORTES_FATIA.find((r) => r === recorteParam) ?? null;

  return (
    <DuplasLista
      lista={lista}
      eventos={eventos}
      agora={new Date().toISOString()}
      visao={visao}
      meuNome={me.nome.split(" ")[0]}
      supervisaoAlvos={alvos}
      especialistaEventos={espEventos}
      nudges={nudges}
      origem={origem}
      recorteInicial={recorteInicial}
    />
  );
}
