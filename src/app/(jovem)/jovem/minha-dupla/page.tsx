import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarCheck, Compass, Footprints, Handshake, ListChecks } from "@phosphor-icons/react/dist/ssr";
import { ContatoLinha } from "@/components/jovem-rede";
import { Card, CardContent } from "@/components/ui/card";
import {
  avaliacoesPendentesPorSessao,
  formatDate,
  formatDiaHora,
  formatDiaMes,
  toDateStr,
} from "@/lib/ciclo";
import { agrupaContatosPorPessoa } from "@/lib/jovem-contatos";
import { seloDuplaLabel, vinculoDeContato } from "@/lib/jovem-diretorio";
import { estadoLeituraPlano } from "@/lib/plano-combinado";
import { getMe } from "@/lib/queries";
import { getJovemAvaliacoes } from "@/lib/queries-avaliacao";
import { getPdmResumo } from "@/lib/queries-pdm";
import {
  getJovemContatos,
  getJovemDuplas,
  getJovemEncaminhamentos,
  getJovemEncontros,
  getJovemPlano,
} from "@/lib/queries-jovem";
import { turmaLonga } from "@/lib/turma";
import type { EncontroStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Minha dupla" };

// "Sem confirmação" é o agendado cuja hora passou sem ninguém contar o
// desfecho — o jovem resolve o gesto na agenda, aqui é só leitura.
// remarcado é status legado: em aberto como agendado (mesma régua do
// emLimbo da ciclo), não merece rótulo próprio.
function statusEncontro(status: EncontroStatus, passado: boolean) {
  if (status === "realizado") return "Aconteceu";
  if (status === "nao_aconteceu") return "Não aconteceu";
  if (status === "cancelado") return "Cancelado";
  return passado ? "Sem confirmação" : "Agendado";
}

function statusCombinado(status: string | null, prazo: string | null, hoje: string) {
  if (status === "feito") return "Feito";
  if (prazo && prazo < hoje) return "Passou do prazo";
  return "Pendente";
}

type ItemFazer = {
  id: string;
  titulo: string;
  detalhe?: string;
  href: string;
  rotulo: string;
};

/** Quem caminha primeiro no card — mentor, especialista, auxiliar. */
const ORDEM_PAPEL: Record<string, number> = {
  mentor: 0,
  especialista: 1,
  supervisor: 2,
};

/** Leitura própria do jovem: só projeções jovem_* e ações de navegação.
 *  Registros, notas do mentor, semáforo e dados de terceiros não entram na
 *  composição — a página nem importa essas fontes. */
export default async function MinhaDuplaPage() {
  const [me, duplas, contatos, encontros, combinados, plano, avaliacoes] =
    await Promise.all([
      getMe(),
      getJovemDuplas(),
      getJovemContatos(),
      getJovemEncontros(),
      getJovemEncaminhamentos(),
      getJovemPlano(),
      getJovemAvaliacoes(),
    ]);
  if (!me) notFound();

  const agora = new Date().getTime();
  const hoje = toDateStr(new Date());

  const vivas = duplas.filter((d) => d.status === "ativa" || d.status === "pausada");
  const dupla =
    vivas.find((d) => d.trilha !== "especialista") ?? vivas[0] ?? duplas[0] ?? null;
  // O PDM é da trilha DPP e /jovem/pdm cai em 404 fora dela — o card usa
  // o mesmo portão da página pra não prometer link morto.
  const duplaPdm =
    vivas.find((d) => d.id != null && d.trilha !== "especialista") ?? null;

  const porDupla = new Map(
    duplas.map((d) => [d.id, { status: d.status, trilha: d.trilha }])
  );
  const ids = new Set(duplas.map((d) => d.id).filter((id): id is string => id != null));
  const encontrosDaDupla = encontros.filter((e) => ids.has(e.dupla_id));
  // o encontro da trilha de especialista se chama sessão
  const nomeDoPasso = (e: { dupla_id: string; numero: number }) =>
    porDupla.get(e.dupla_id)?.trilha === "especialista"
      ? `${e.numero}ª sessão`
      : `${e.numero}º encontro`;

  const futurosIds = new Set(
    encontrosDaDupla
      .filter(
        (e) =>
          (e.status === "agendado" || e.status === "remarcado") &&
          e.data_hora &&
          new Date(e.data_hora).getTime() >= agora
      )
      .map((e) => e.id)
  );
  const proximos = encontrosDaDupla.filter((e) => futurosIds.has(e.id)).slice(0, 3);
  // tudo que não é futuro é histórico — inclusive o "estava marcado e
  // ninguém contou", que aparece com o selo Sem confirmação
  const anteriores = encontrosDaDupla
    .filter((e) => !futurosIds.has(e.id))
    .sort(
      (a, b) =>
        new Date(b.realizado_em ?? b.data_hora ?? 0).getTime() -
        new Date(a.realizado_em ?? a.data_hora ?? 0).getTime()
    )
    .slice(0, 5);
  const semDesfecho = encontrosDaDupla.filter(
    (e) =>
      (e.status === "agendado" || e.status === "remarcado") &&
      e.data_hora &&
      new Date(e.data_hora).getTime() < agora
  );
  const pendentes = combinados.filter((c) => c.id != null && c.status !== "feito");
  const feitosCombinados = combinados
    .filter((c) => c.id != null && c.status === "feito")
    .slice(0, 3);
  const pdm = duplaPdm?.id ? await getPdmResumo(duplaPdm.id).catch(() => null) : null;
  const nomeJovem = me.nome_social || me.nome;
  // uma linha por papel, a dupla mais viva carregando o selo — a mesma
  // dedup da home/perfil; o auxiliar executivo (supervisor) também é da dupla
  const adultos = agrupaContatosPorPessoa(
    contatos.filter(
      (c) =>
        c.id != null &&
        (c.papel === "mentor" || c.papel === "especialista" || c.papel === "supervisor") &&
        (c.dupla_id == null || ids.has(c.dupla_id))
    ),
    porDupla
  ).sort(
    (a, b) =>
      (ORDEM_PAPEL[a.papel ?? ""] ?? 9) - (ORDEM_PAPEL[b.papel ?? ""] ?? 9)
  );

  // o plano na régua única (estadoLeituraPlano): "proposto" sem o carimbo
  // do jovem pede o aceite dele — o gesto mora na agenda, não aqui
  const leituraPlano = plano
    ? estadoLeituraPlano({
        status: plano.status,
        meuLado: "mentorado",
        aceites: {
          mentor: plano.aceito_mentor === true || plano.aprovado_lado === "mentor",
          mentorado: plano.aceito_mentorado === true || plano.aprovado_lado === "mentorado",
        },
      })
    : null;
  const avalPendentes = avaliacoesPendentesPorSessao(encontrosDaDupla, avaliacoes);

  // "O que você precisa fazer" — só pendência real derivada dos dados já
  // lidos; cada item aponta a superfície onde o gesto mora.
  const fazer: ItemFazer[] = [];
  if (dupla?.status === "ativa") {
    for (const e of semDesfecho) {
      fazer.push({
        id: `encontro-${e.id}`,
        titulo: `${nomeDoPasso(e)} era em ${formatDiaMes(e.data_hora)}. Aconteceu?`,
        href: "/jovem/agenda",
        rotulo: "Responder na agenda",
      });
    }
    if (semDesfecho.length === 0 && proximos.length === 0) {
      fazer.push({
        id: "agendar",
        titulo: "O próximo encontro ainda não tem data marcada",
        href: "/jovem/agenda",
        rotulo: "Combinar na agenda",
      });
    }
  }
  if (leituraPlano === "proposto_staff_falta_meu") {
    fazer.push({
      id: "plano",
      titulo: "O plano pra ficar em dia espera seu aceite",
      href: "/jovem/agenda#plano",
      rotulo: "Ver o plano",
    });
  }
  for (const c of pendentes.slice(0, 6)) {
    const vencido = c.prazo != null && c.prazo < hoje;
    fazer.push({
      id: `combinado-${c.id}`,
      titulo: c.descricao?.trim() || "Combinado",
      detalhe: c.prazo
        ? `até ${formatDiaMes(c.prazo)}${vencido ? ", passou do prazo, vale fazer mesmo assim" : ""}`
        : "Sem prazo",
      href: "/jovem#combinados-titulo",
      rotulo: "Marcar feito",
    });
  }
  if (avalPendentes.length > 0) {
    fazer.push({
      id: "avaliacoes",
      titulo:
        avalPendentes.length === 1
          ? "1 encontro esperando sua avaliação"
          : `${avalPendentes.length} encontros esperando sua avaliação`,
      detalhe: "1 min cada",
      href: "/jovem/agenda",
      rotulo: "Avaliar",
    });
  }

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
            {(dupla?.status === "concluida" || dupla?.status === "encerrada") && (
              <p className="mb-3 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm">
                <span className="font-medium">
                  {dupla.status === "concluida" ? "Mentoria concluída." : "Mentoria encerrada."}
                </span>{" "}
                {dupla.status === "concluida"
                  ? "Vocês chegaram ao fim da jornada. O histórico continua aqui."
                  : "A dupla terminou antes do previsto. O histórico continua aqui."}
              </p>
            )}
            {dupla && (
              <p className="mb-2 text-xs text-muted-foreground">
                {[
                  dupla.trilha === "especialista"
                    ? dupla.demanda || "Trilha de especialista"
                    : turmaLonga(dupla.turma) || null,
                  dupla.iniciada_em ? `desde ${formatDate(dupla.iniciada_em)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {adultos.length ? (
              <ul className="divide-y divide-border/60">
                {adultos.map((c) => (
                  <ContatoLinha
                    key={`${c.papel}-${c.id}`}
                    c={c}
                    selo={seloDuplaLabel(
                      c.dupla_id ? porDupla.get(c.dupla_id)?.status : null,
                      c.dupla_id ? porDupla.get(c.dupla_id)?.trilha : null
                    )}
                    vinculo={vinculoDeContato(c)}
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
                      <span>{nomeDoPasso(e)} · {formatDiaHora(e.data_hora)}</span>
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
              {anteriores.length ? (
                <ul className="mt-2 space-y-2">
                  {anteriores.map((e) => {
                    const quando = e.realizado_em ?? e.data_hora;
                    const passado = quando ? new Date(quando).getTime() < agora : true;
                    return (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm odd:bg-muted/40">
                        <span>{nomeDoPasso(e)} · {formatDiaMes(quando)}</span>
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
                  {leituraPlano === "proposto_staff_falta_meu"
                    ? "Uma proposta espera o seu aceite."
                    : leituraPlano === "proposto_staff_falta_outro"
                      ? "Você já aceitou. Agora falta o aceite do seu mentor."
                      : leituraPlano === "contestado"
                        ? "A versão anterior não serviu. Vocês podem combinar uma nova."
                        : `${plano.passos.length} passo${plano.passos.length === 1 ? "" : "s"} combinado${plano.passos.length === 1 ? "" : "s"}.`}
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
                      <span>{c.descricao || "Combinado"}</span>
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

      {duplaPdm && (
        <section aria-labelledby="pdm-titulo" className="space-y-2.5">
          <h2 id="pdm-titulo" className="flex items-center gap-2 font-semibold">
            <Compass size={18} className="text-muted-foreground" aria-hidden />
            Meu plano de desenvolvimento
          </h2>
          <Card>
            <CardContent className="px-4 py-4">
              <p className="text-sm text-muted-foreground">
                {pdm && pdm.total > 0
                  ? `${pdm.atingidas} de ${pdm.total} ${pdm.total === 1 ? "meta atingida" : "metas atingidas"}.`
                  : "Seu PDM aparece quando você e seu mentor começarem a construir na jornada."}
              </p>
              {pdm && pdm.total > 0 && (
                <div
                  role="progressbar"
                  aria-label="Progresso do PDM"
                  aria-valuemin={0}
                  aria-valuemax={pdm.total}
                  aria-valuenow={pdm.atingidas}
                  className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-[var(--destaque)]"
                    style={{ width: `${Math.round((pdm.atingidas / pdm.total) * 100)}%` }}
                  />
                </div>
              )}
              <Link href="/jovem/pdm" className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                Abrir meu PDM <ArrowRight size={14} aria-hidden />
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      <section aria-labelledby="fazer-titulo" className="space-y-2.5">
        <h2 id="fazer-titulo" className="flex items-center gap-2 font-semibold">
          <Footprints size={18} className="text-muted-foreground" aria-hidden />
          O que você precisa fazer
        </h2>
        <Card>
          <CardContent className="divide-y divide-border/60 px-4 py-0">
            {fazer.length ? (
              fazer.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-sm font-medium">{item.titulo}</p>
                    {item.detalhe && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.detalhe}</p>
                    )}
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.rotulo} <ArrowRight size={14} aria-hidden />
                  </Link>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-muted-foreground">Nada pendente agora. Novas tarefas e combinados aparecem aqui.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
