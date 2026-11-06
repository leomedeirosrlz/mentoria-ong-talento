import { redirect } from "next/navigation";
import { getMe, getMinhasDuplas } from "@/lib/queries";
import {
  getChamados,
  getChamadoDetalhe,
} from "@/lib/queries-chamados";
import { duplasOpcoesChamado } from "@/lib/ciclo";
import { temPapel } from "@/lib/types";
import { ChamadosApp } from "@/components/chamados-app";

export const metadata = { title: "Chamados" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ChamadosPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const [me, { c }] = await Promise.all([getMe(), searchParams]);
  if (!me) redirect("/login");
  if (me.role === "mentorado") redirect("/jovem/perfil"); // o jovem tem a dele no perfil

  const staff = me.role === "coordenacao" || me.role === "supervisor";
  // o select "Dupla relacionada" do NovoChamadoDialog só vale pra quem é
  // mentor — staff puro não paga o getMinhasDuplas (a RLS devolveria o
  // escopo inteiro da coordenação, não as duplas dela)
  const ehMentor =
    temPapel(me, "mentor_dpp") || temPapel(me, "mentor_especialista");
  const [{ itens }, minhasDuplas] = await Promise.all([
    getChamados(),
    ehMentor ? getMinhasDuplas() : Promise.resolve([]),
  ]);
  const duplasOpcoes = duplasOpcoesChamado(minhasDuplas, me.id);
  const selecionado = c && UUID_RE.test(c) ? c : null;
  const detalhe = selecionado ? await getChamadoDetalhe(selecionado) : null;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {staff ? "Chamados" : "Meus chamados"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {staff
              ? "Quem assumir primeiro trata. Resposta combinada em 1 dia útil."
              : "Acompanhe aqui as respostas da equipe aos seus pedidos."}
          </p>
        </div>
      </header>
      <ChamadosApp
        papel={me.role ?? ""}
        meuId={me.id}
        meuNome={me.nome_social || me.nome || ""}
        itens={itens}
        duplas={duplasOpcoes}
        selecionadoInicial={selecionado}
        detalheInicial={
          detalhe?.chamado
            ? {
                chamado: detalhe.chamado,
                timeline: detalhe.timeline,
                equipe: detalhe.equipe,
              }
            : null
        }
      />
    </div>
  );
}
