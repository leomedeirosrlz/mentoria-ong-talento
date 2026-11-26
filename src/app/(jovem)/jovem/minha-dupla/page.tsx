import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Compass, Handshake, ListChecks } from "@phosphor-icons/react/dist/ssr";
import { ContatoLinha } from "@/components/jovem-rede";
import { Card, CardContent } from "@/components/ui/card";
import { formatDiaHora, formatDiaMes } from "@/lib/ciclo";
import { getMe } from "@/lib/queries";
import { getPdmDaDupla } from "@/lib/queries-pdm";
import {
  getJovemContatos,
  getJovemDuplas,
  getJovemEncaminhamentos,
  getJovemEncontros,
  getJovemPlano,
} from "@/lib/queries-jovem";
import type { EncontroStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Minha dupla" };

function statusEncontro(status: EncontroStatus, passado: boolean) {
  if (status === "realizado") return "Aconteceu";
  if (status === "nao_aconteceu" || status === "cancelado") return "Não aconteceu";
  return passado ? "Sem confirmação" : "Agendado";
}

function statusCombinado(status: string | null, prazo: string | null, hoje: string) {
  if (status === "feito") return "Feito";
  if (prazo && prazo < hoje) return "Em atraso";
  return "Pendente";
}

/** Leitura própria do jovem: só projeções jovem_* e ações de navegação.
 *  Registros, notas do mentor, semáforo e dados de terceiros não entram na
 *  composição — a página nem importa essas fontes. */
export default async function MinhaDuplaPage() {
  const [me, duplas, contatos, encontros, combinados, plano] = await Promise.all([
    getMe(),
    getJovemDuplas(),
    getJovemContatos(),
    getJovemEncontros(),
    getJovemEncaminhamentos(),
    getJovemPlano(),
  ]);
  if (!me) return null;

  const vivas = duplas.filter((d) => d.status === "ativa" || d.status === "pausada");
  const dupla =
    vivas.find((d) => d.trilha !== "especialista") ?? vivas[0] ?? duplas[0] ?? null;
  const ids = new Set(duplas.map((d) => d.id).filter((id): id is string => id != null));
  const encontrosDaDupla = encontros.filter((e) => ids.has(e.dupla_id));
  const agora = new Date().getTime();
  const hoje = new Date().toISOString().slice(0, 10);
  const proximos = encontrosDaDupla
    .filter((e) => e.status === "agendado" && e.data_hora && new Date(e.data_hora).getTime() >= agora)
    .slice(0, 3);
  const feitos = encontrosDaDupla
    .filter((e) => e.status === "realizado" || (e.data_hora && new Date(e.data_hora).getTime() < agora))
    .sort((a, b) => (b.realizado_em ?? b.data_hora ?? "").localeCompare(a.realizado_em ?? a.data_hora ?? ""))
    .slice(0, 5);
  const pendentes = combinados.filter((c) => c.status !== "feito");
  const feitosCombinados = combinados.filter((c) => c.status === "feito").slice(0, 3);
  const pdm = dupla?.id ? await getPdmDaDupla(dupla.id).catch(() => null) : null;
  const nomeJovem = me.nome_social || me.nome;
  const adultos = contatos.filter(
    (c) =>
      (c.papel === "mentor" || c.papel === "especialista") &&
      (dupla?.id == null || c.dupla_id == null || ids.has(c.dupla_id))
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Minha dupla</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quem caminha com você, seus encontros e os próximos passos.
        </p>
      </header>

      <section aria-labelledby="mentor-titulo" className="space-y-2.5">
        <h2 id="mentor-titulo" className="flex items-center gap-2 font-semibold">
          <Handshake size={18} className="text-muted-foreground" aria-hidden />
          Quem caminha com você
        </h2>
        <Card>
          <CardContent className="px-4 py-4">
            {dupla?.status === "pausada" && (
              <p className="mb-3 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-4 py-3 text-sm">
                <span className="font-medium">Mentoria pausada.</span> A coordenação retoma quando for a hora.
              </p>
            )}
            {adultos.length ? (
              <ul className="divide-y divide-border/60">
                {adultos.map((c) => (
                  <ContatoLinha
                    key={`${c.papel}-${c.id}`}
                    c={c}
                    vinculo={c.papel === "especialista" ? "Seu especialista" : "Seu mentor"}
                    nomeJovem={nomeJovem}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Você ainda não tem uma dupla. Quando a coordenação formar a sua, seu mentor aparece aqui.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="encontros-titulo" className="space-y-2.5">
        <h2 id="encontros-titulo" className="flex items-center gap-2 font-semibold">
          <CalendarCheck size={18} className="text-muted-foreground" aria-hidden />
          Encontros
        </h2>
        <Card>
          <CardContent className="space-y-4 px-4 py-4">
            <div>
              <h3 className="text-sm font-medium">Próximos</h3>
              {proximos.length ? (
                <ul className="mt-2 space-y-2">
                  {proximos.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                      <span>{e.numero}º encontro · {formatDiaHora(e.data_hora)}</span>
                      <span className="text-xs font-medium text-muted-foreground">{statusEncontro(e.status, false)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Nenhum encontro agendado no momento.</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium">Anteriores</h3>
              {feitos.length ? (
                <ul className="mt-2 space-y-2">
                  {feitos.map((e) => {
                    const quando = e.realizado_em ?? e.data_hora;
                    const passado = quando ? new Date(quando).getTime() < agora : true;
                    return (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm odd:bg-muted/40">
                        <span>{e.numero}º encontro · {formatDiaMes(quando)}</span>
                        <span className="text-xs font-medium text-muted-foreground">{statusEncontro(e.status, passado)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Seus encontros realizados aparecem aqui.</p>
              )}
              <Link href="/jovem/agenda" className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                Ver agenda completa <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="plano-titulo" className="space-y-2.5">
        <h2 id="plano-titulo" className="flex items-center gap-2 font-semibold">
          <ListChecks size={18} className="text-muted-foreground" aria-hidden />
          Combinados e plano
        </h2>
        <Card>
          <CardContent className="space-y-4 px-4 py-4">
            {plano ? (
              <div className="rounded-lg bg-muted/50 px-3 py-3">
                <p className="text-sm font-medium">Plano para ficar em dia · versão {plano.versao}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plano.passos.length} passo{plano.passos.length === 1 ? "" : "s"} combinado{plano.passos.length === 1 ? "" : "s"}.
                </p>
                <Link href="/jovem/combinado" className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                  Ler o plano <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Quando você e seu mentor combinarem um plano, ele aparece aqui.</p>
            )}
            <div>
              <h3 className="text-sm font-medium">Seus combinados</h3>
              {pendentes.length || feitosCombinados.length ? (
                <ul className="mt-2 space-y-2">
                  {[...pendentes, ...feitosCombinados].map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm odd:bg-muted/40">
                      <span>{c.descricao}</span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {statusCombinado(c.status, c.prazo, hoje)}{c.prazo ? ` · até ${formatDiaMes(c.prazo)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Nenhum combinado no momento.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="pdm-titulo" className="space-y-2.5">
        <h2 id="pdm-titulo" className="flex items-center gap-2 font-semibold">
          <Compass size={18} className="text-muted-foreground" aria-hidden />
          Meu plano de desenvolvimento
        </h2>
        <Card>
          <CardContent className="px-4 py-4">
            <p className="text-sm text-muted-foreground">
              {pdm
                ? "Seu PDM já começou e segue aberto para você acompanhar."
                : "Seu PDM aparece quando você e seu mentor começarem a construir na jornada."}
            </p>
            <Link href="/jovem/pdm" className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              Abrir meu PDM <ArrowRight size={14} aria-hidden />
            </Link>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="fazer-titulo" className="space-y-2.5">
        <h2 id="fazer-titulo" className="font-semibold">O que você precisa fazer</h2>
        <Card>
          <CardContent className="px-4 py-4">
            {pendentes.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {pendentes.slice(0, 4).map((c) => <li key={c.id}>{c.descricao}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nada pendente agora. Novas tarefas e combinados aparecem aqui.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
