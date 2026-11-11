import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getContatos,
  getCronogramas,
  getDocumentoTemplates,
  getMe,
  getRelatorioLinks,
  getTurmaInscricoesAguardando,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "@/lib/demo/mode";
import { getDemoData } from "@/lib/demo/data";
import { demoDuplas, demoMentorados, demoPessoas } from "@/lib/demo/queries";
import { demoEncerramentos } from "@/lib/demo/encerramento-data";
import { PageHeader } from "@/components/page-header";
import { GraficoTempo } from "@/components/viz/grafico-tempo";
import { turmaDaDupla } from "@/lib/turma";
import { formatDate } from "@/lib/ciclo";
import {
  dataHora,
  dia,
  recorteDeParams,
  type RecorteCsv,
} from "@/lib/relatorios/csv-core";
import {
  dadosAderencia,
  dadosAderenciaDemo,
  dadosAssinaturasPendentes,
  dadosAssinaturasPendentesDemo,
  dadosEncerramento,
  dadosEncerramentoDemo,
  dadosFormsTaxa,
  dadosFormsTaxaDemo,
  dadosInteracoes,
  dadosInteracoesDemo,
  dadosSolicitacoes,
  dadosSolicitacoesDemo,
  dadosTendenciaSaude,
  type DiaSaude,
} from "@/lib/relatorios/dados";
import { RelatorioBuilder } from "./relatorio-builder";
import { RelatoriosAbas, type AbaRelatorios } from "./relatorios-abas";
import { RelatorioSecao } from "./relatorio-secao";
import { RecorteTurma } from "./recorte-turma";
import { DigestBotao } from "./digest-botao";
import type { DuplaFonte, PessoaFonte } from "@/lib/relatorio";

export const metadata: Metadata = { title: "Relatórios" };

const ABAS: { id: AbaRelatorios; rotulo: string }[] = [
  { id: "visao", rotulo: "Saúde" },
  { id: "aderencia", rotulo: "Aderência" },
  { id: "assinaturas", rotulo: "Assinaturas" },
  { id: "interacoes", rotulo: "Interações" },
  { id: "solicitacoes", rotulo: "Especialistas" },
  { id: "encerramento", rotulo: "Encerramento" },
  { id: "formularios", rotulo: "Formulários" },
  { id: "grade", rotulo: "Grade livre" },
];

const PREVIA = 8;

/** Converte uma linha tipada do export nas células de prévia (mesma ordem
 *  que o CSV — quem vê a tabela reconhece o arquivo que baixa). */
const cell = (v: string | number | null | undefined) =>
  v == null || v === "" ? "—" : String(v);

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMe();
  if (me?.role !== "coordenacao") redirect("/");

  const sp = await searchParams;
  const abaParam = typeof sp.aba === "string" ? sp.aba : undefined;
  const aba: AbaRelatorios = ABAS.some((a) => a.id === abaParam)
    ? (abaParam as AbaRelatorios)
    : "visao";

  // recorte do hub: ?turma= (régua do hub) e ?cronograma= (deep-link) —
  // a mesma régua ?turma=/?cronograma= do /api/export via recorteDeParams
  const qs = new URLSearchParams();
  if (typeof sp.turma === "string") qs.set("turma", sp.turma);
  if (typeof sp.cronograma === "string") qs.set("cronograma", sp.cronograma);
  const recorte = recorteDeParams(qs);

  const demo = await demoAtivo();
  const supabase = demo ? null : await createClient();

  // turmas pros chips — query leve mesmo na aba grade (o builder faz a
  // sua carga própria depois); recorte por turma só vale se a turma existe
  let turmas: string[];
  let cronogramas: { id: string; nome: string; turma: string }[];
  if (demo) {
    const d = getDemoData();
    cronogramas = d.cronogramas.map((c) => ({
      id: c.id,
      nome: c.nome,
      turma: c.turma,
    }));
    turmas = [
      ...new Set(
        d.duplas
          .map((x) => turmaDaDupla(x, d.cronogramas))
          .filter((t): t is string => !!t)
      ),
    ].sort((a, b) => b.localeCompare(a, "pt-BR"));
  } else {
    const [dRes, cRes] = await Promise.all([
      supabase!.from("duplas").select("turma, cronograma_id"),
      getCronogramas(),
    ]);
    cronogramas = (cRes ?? []).map((c) => ({
      id: c.id,
      nome: c.nome,
      turma: c.turma,
    }));
    turmas = [
      ...new Set(
        (dRes.data ?? [])
          .map((x) => turmaDaDupla(x, cronogramas))
          .filter((t): t is string => !!t)
      ),
    ].sort((a, b) => b.localeCompare(a, "pt-BR"));
  }
  // ?turma= inválida cai no "todas" — valor estranho não filtra nada
  const turmaAtiva =
    recorte.turma && turmas.includes(recorte.turma)
      ? recorte.turma
      : undefined;
  if (turmaAtiva !== recorte.turma) recorte.turma = null;

  // params extras que as abas preservam entre si
  const extraParams = [
    turmaAtiva ? `turma=${encodeURIComponent(turmaAtiva)}` : "",
    recorte.cronogramaId
      ? `cronograma=${encodeURIComponent(recorte.cronogramaId)}`
      : "",
  ]
    .filter(Boolean)
    .join("&");

  const csvHref = (tipo: string) =>
    `/api/export?tipo=${tipo}${extraParams ? `&${extraParams}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operação"
        title="Relatórios"
        meta="Panorama do programa, exports operacionais e a grade livre"
      />
      <RelatoriosAbas abas={ABAS} ativa={aba} extraParams={extraParams}>
        {aba !== "grade" && (
          <RecorteTurma
            aba={aba}
            turmas={turmas}
            ativa={turmaAtiva}
            cronograma={recorte.cronogramaId ?? undefined}
          />
        )}
        {await renderAba({
          aba,
          demo,
          supabase,
          recorte,
          csvHref,
          turmaParam: typeof sp.turma === "string" ? sp.turma : undefined,
          cronogramas,
        })}
      </RelatoriosAbas>
    </div>
  );
}

// ---------------------------------------------------------------------
// Painel da aba — cada seção busca o que exibe (as prévias compartilham
// os fetchers dos exports em lib/relatorios/dados.ts).
// ---------------------------------------------------------------------

async function renderAba({
  aba,
  demo,
  supabase,
  recorte,
  csvHref,
  turmaParam,
  cronogramas,
}: {
  aba: AbaRelatorios;
  demo: boolean;
  supabase: Awaited<ReturnType<typeof createClient>> | null;
  recorte: RecorteCsv;
  csvHref: (tipo: string) => string;
  turmaParam?: string;
  cronogramas: { id: string; nome: string; turma: string }[];
}) {
  const d = demo ? getDemoData() : null;

  switch (aba) {
    case "visao": {
      const tendencia = demo
        ? []
        : await dadosTendenciaSaude(supabase!, recorte);
      return <AbaSaude tendencia={tendencia} />;
    }

    case "aderencia": {
      const linhas = d
        ? dadosAderenciaDemo(d, recorte)
        : await dadosAderencia(supabase!, recorte);
      return (
        <RelatorioSecao
          titulo="Aderência ao ciclo"
          descricao="Plano × fato por dupla: encontros esperados e realizados, atraso médio de registro e o semáforo vivo com os motivos."
          colunas={[
            "Mentorado",
            "Mentor",
            "Turma",
            "Esperados",
            "Realizados",
            "Aderência",
            "Semáforo",
            "Motivos",
          ]}
          linhas={linhas.slice(0, PREVIA).map((l) => [
            l.mentorado,
            l.mentor,
            cell(l.turma),
            String(l.esperados),
            String(l.realizados),
            l.aderencia == null ? "—" : `${l.aderencia}%`,
            l.semaforo,
            l.motivos || "—",
          ])}
          total={linhas.length}
          csvHref={csvHref("aderencia")}
        />
      );
    }

    case "assinaturas": {
      const linhas = d
        ? dadosAssinaturasPendentesDemo(d, recorte)
        : await dadosAssinaturasPendentes(supabase!, recorte);
      return (
        <RelatorioSecao
          titulo="Assinaturas pendentes"
          descricao="Documento emitido × pessoa sem assinado_em — inclui os links expirados que ainda contam como pendência."
          colunas={[
            "Nome",
            "Papel",
            "Documento",
            "Status",
            "Emitido em",
            "Expira em",
          ]}
          linhas={linhas.slice(0, PREVIA).map((l) => [
            l.nome,
            l.papel,
            l.documento,
            l.status,
            dia(l.emitido_em) || "—",
            dia(l.expira_em) || "—",
          ])}
          total={linhas.length}
          csvHref={csvHref("assinaturas-pendentes")}
        />
      );
    }

    case "interacoes": {
      const linhas = d
        ? dadosInteracoesDemo(d, recorte)
        : await dadosInteracoes(supabase!, recorte);
      return (
        <RelatorioSecao
          titulo="Interações"
          descricao="Log de nudges, contatos e apoios registrados pela coordenação — o rastro de acompanhamento por dupla."
          colunas={["Dupla", "Tipo", "Canal", "Autor", "Data", "Nota"]}
          linhas={linhas.slice(0, PREVIA).map((l) => [
            l.dupla,
            l.tipo,
            l.canal,
            l.autor,
            dataHora(l.data) || "—",
            l.nota,
          ])}
          total={linhas.length}
          csvHref={csvHref("interacoes")}
        />
      );
    }

    case "solicitacoes": {
      const linhas = d
        ? dadosSolicitacoesDemo(d, recorte)
        : await dadosSolicitacoes(supabase!, recorte);
      return (
        <RelatorioSecao
          titulo="Pedidos de especialista"
          descricao="Solicitações do jovem, do mentor e da equipe com o status efetivo (expiração aplicada) e a latência de resposta."
          colunas={[
            "Mentorado",
            "Demanda",
            "Origem",
            "Status",
            "Criada em",
            "Latência",
            "Especialista",
          ]}
          linhas={linhas.slice(0, PREVIA).map((l) => [
            l.mentorado,
            l.demanda,
            l.origem,
            l.status,
            dataHora(l.criada_em) || "—",
            l.latencia == null ? "—" : `${l.latencia}d`,
            l.especialista,
          ])}
          total={linhas.length}
          csvHref={csvHref("solicitacoes")}
        />
      );
    }

    case "encerramento": {
      const linhas = d
        ? dadosEncerramentoDemo(d, recorte, demoEncerramentos("coordenacao"))
        : await dadosEncerramento(supabase!, recorte);
      return (
        <RelatorioSecao
          titulo="Encerramentos"
          descricao="Ritos de fechamento por dupla — tipo, checklist do rito e quem decidiu."
          colunas={[
            "Mentor",
            "Mentorado",
            "Tipo",
            "Checklist",
            "Decidido por",
            "Resumo",
            "Criado em",
          ]}
          linhas={linhas.slice(0, PREVIA).map((l) => [
            l.mentor,
            l.mentorado,
            l.tipo,
            l.checklist,
            l.decidido_por || "—",
            l.resumo_jornada,
            dataHora(l.created_at) || "—",
          ])}
          total={linhas.length}
          csvHref={csvHref("encerramento")}
        />
      );
    }

    case "formularios": {
      const linhas = d
        ? dadosFormsTaxaDemo(d, recorte)
        : await dadosFormsTaxa(supabase!, recorte);
      return (
        <RelatorioSecao
          titulo="Formulários — taxa de resposta"
          descricao="Um linha por link emitido: respondido/não e quantas respostas chegaram — a taxa se deriva do par."
          colunas={[
            "Formulário",
            "Destinatário",
            "Origem",
            "Emitido em",
            "Respondido",
            "Respostas",
          ]}
          linhas={linhas.slice(0, PREVIA).map((l) => [
            l.formulario,
            l.destinatario,
            l.origem,
            dataHora(l.emitido_em) || "—",
            l.respondido,
            String(l.respostas),
          ])}
          total={linhas.length}
          csvHref={csvHref("forms-taxa")}
        />
      );
    }

    case "grade":
      return <AbaGrade turmaParam={turmaParam} cronogramas={cronogramas} />;
  }
}

// ---------------------------------------------------------------------
// aba=visao — tendência do semáforo (snapshots REALIZA-182) + o disparo
// manual do digest. <7 dias de histórico = estado "acumulando".
// ---------------------------------------------------------------------

const DIAS_TENDENCIA = 30;
const MIN_DIAS_GRAFICO = 7;

function AbaSaude({ tendencia }: { tendencia: DiaSaude[] }) {
  const ultimo = tendencia.at(-1);
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Saúde do programa</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Tendência diária do semáforo nos últimos {DIAS_TENDENCIA} dias —
            a leitura do histórico gravado, sem recálculo.
          </p>
        </div>
        {ultimo && (
          <p className="text-sm text-muted-foreground">
            Último dia com dados ({formatDate(ultimo.dia)}):{" "}
            <span className="font-medium text-foreground">
              {ultimo.risco} em risco · {ultimo.atencao} em atenção ·{" "}
              {ultimo.ok} em dia
            </span>
          </p>
        )}
        {tendencia.length < MIN_DIAS_GRAFICO ? (
          <div className="rounded-xl bg-card px-4 py-6 shadow-[var(--shadow-border)]">
            <p className="text-sm font-medium">Acumulando histórico</p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              A tendência aparece depois de {MIN_DIAS_GRAFICO} dias de
              snapshots — o registro diário já está rodando; volte em
              alguns dias.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <GraficoSaude
              tendencia={tendencia}
              campo="risco"
              rotulo="duplas em risco"
              cor="var(--danger)"
            />
            <GraficoSaude
              tendencia={tendencia}
              campo="atencao"
              rotulo="duplas em atenção"
              cor="var(--warn)"
            />
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <h2 className="text-base font-semibold">Digest semanal</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Toda segunda o cron envia o panorama (risco, pendências e semana)
          pra coordenação. O botão dispara o mesmo e-mail agora — sem a
          trava de uma vez por semana.
        </p>
        <DigestBotao />
      </section>
    </div>
  );
}

function GraficoSaude({
  tendencia,
  campo,
  rotulo,
  cor,
}: {
  tendencia: DiaSaude[];
  campo: "risco" | "atencao";
  rotulo: string;
  cor: string;
}) {
  const hoje = new Date();
  const porDia = new Map(tendencia.map((t) => [t.dia, t[campo]]));
  const pontos = Array.from({ length: DIAS_TENDENCIA }, (_, i) => {
    const d = new Date(hoje.getTime() - (DIAS_TENDENCIA - 1 - i) * 86400000);
    const chave = d.toISOString().slice(0, 10);
    const valor = porDia.get(chave);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return {
      chave,
      rotuloEixo: `${dd}/${mm}`,
      rotulo: formatDate(chave),
      // dia sem snapshot é buraco honesto — a linha quebra em vez de
      // inventar zero
      valor: valor ?? null,
      valorFmt:
        valor == null
          ? "sem dados"
          : `${valor} ${valor === 1 ? "dupla" : "duplas"}`,
    };
  });
  const valores = pontos.map((p) => p.valor).filter((v): v is number => v != null);
  const media = valores.length
    ? valores.reduce((s, v) => s + v, 0) / valores.length
    : null;
  const picoIdx = valores.length
    ? pontos.reduce(
        (best, p, i) =>
          p.valor != null && p.valor > (pontos[best]?.valor ?? -1) ? i : best,
        0
      )
    : null;
  return (
    <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
      <GraficoTempo
        pontos={pontos}
        tipo="linha"
        formato="inteiro"
        media={media}
        pico={picoIdx}
        cor={cor}
        ariaLabel={`Tendência de ${rotulo} nos últimos ${DIAS_TENDENCIA} dias`}
        rotuloTempo="Dia"
        rotuloValor={rotulo}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// aba=grade — o builder livre preservado inteiro (REALIZA-201): grade,
// links públicos e seletores ficam exatamente como eram.
// ---------------------------------------------------------------------

async function AbaGrade({
  turmaParam,
  cronogramas,
}: {
  turmaParam?: string;
  cronogramas: { id: string; nome: string; turma: string }[];
}) {
  let turmas: string[];
  let duplas: DuplaFonte[];
  let profs: PessoaFonte[];
  let mentorados: PessoaFonte[];
  // fila "Sem dupla" de todas as turmas (turma_inscricoes) + os links
  // públicos (170) pro painel "Compartilhar" da toolbar do builder (201),
  // com os seletores dos recortes ciclo/assinaturas
  const [inscricoes, links, cronogramasFull, templates] = await Promise.all([
    getTurmaInscricoesAguardando(null),
    getRelatorioLinks(),
    getCronogramas(),
    getDocumentoTemplates(),
  ]);

  if (await demoAtivo()) {
    const dd = demoDuplas("coordenacao");
    turmas = [...new Set(dd.map((d) => d.turma))];
    duplas = dd.map((d) => ({
      id: d.id,
      turma: d.turma,
      mentor_id: d.mentor.id,
      mentorado_id: d.mentorado.id,
      supervisor_id: d.supervisor?.id ?? null,
      status: d.status,
      desfecho: d.desfecho,
      iniciada_em: d.iniciada_em,
      demanda: d.demanda,
    }));
    const pessoaFonte = (p: {
      id: string;
      user_id?: string | null;
      nome: string | null;
      email?: string | null;
      whatsapp?: string | null;
      cidade?: string | null;
      uf?: string | null;
    }): PessoaFonte => ({
      id: p.id,
      user_id: p.user_id ?? null,
      nome: p.nome,
      email: p.email ?? null,
      whatsapp: p.whatsapp ?? null,
      cidade: p.cidade ?? null,
      uf: p.uf ?? null,
    });
    profs = [
      ...dd.map((d) => pessoaFonte(d.mentor)),
      ...dd.filter((d) => d.supervisor).map((d) => pessoaFonte(d.supervisor!)),
    ];
    mentorados = dd.map((d) => ({
      id: d.mentorado.id,
      nome: d.mentorado.nome,
      email: d.mentorado.email ?? null,
      whatsapp: d.mentorado.whatsapp ?? null,
      cidade: d.mentorado.cidade ?? null,
      uf: d.mentorado.uf ?? null,
    }));
    // pessoas da fila que não estão em dupla nenhuma não chegam pelos mapas
    // derivados de `duplas` — resolve no dataset demo completo (mesma
    // regra da query real, que lê as tabelas inteiras)
    if (inscricoes.length) {
      const todasProfs = new Map(demoPessoas("coordenacao").map((p) => [p.id, p]));
      const todasMents = new Map(demoMentorados("coordenacao").map((m) => [m.id, m]));
      const temProf = new Set(profs.map((p) => p.id));
      const temMent = new Set(mentorados.map((m) => m.id));
      for (const i of inscricoes) {
        if (i.papel_esperado === "mentor") {
          const p = todasProfs.get(i.profile_id);
          if (p && !temProf.has(p.id)) profs.push(pessoaFonte(p));
        } else {
          const m = todasMents.get(i.mentorado_id);
          if (m && !temMent.has(m.id)) mentorados.push(pessoaFonte(m));
        }
      }
    }
  } else {
    const supabase = await createClient();
    // profiles: grant por coluna da 0026 — email/whatsapp ficam de fora da
    // tabela (permission denied) e chegam pela view profiles_contato, que a
    // coordenação lê inteira. mentorados tem email/whatsapp no grant (0034).
    const [dRes, pRes, mRes, contatos] = await Promise.all([
      supabase
        .from("duplas")
        .select("id, turma, cronograma_id, mentor_id, mentorado_id, supervisor_id, status, desfecho, iniciada_em, demanda")
        .order("iniciada_em"),
      // user_id alimenta o gate do e-mail editável na grade (conta
      // vinculada → e-mail só muda pelo sync do auth, 0060)
      supabase.from("profiles").select("id, user_id, nome, cidade, uf"),
      supabase.from("mentorados").select("id, nome, email, whatsapp, cidade, uf"),
      getContatos(),
    ]);
    if (dRes.error || pRes.error || mRes.error) {
      throw new Error(dRes.error?.message ?? pRes.error?.message ?? mRes.error?.message);
    }
    duplas = dRes.data ?? [];
    profs = (pRes.data ?? []).map((p) => ({
      ...p,
      email: contatos.get(p.id)?.email ?? null,
      whatsapp: contatos.get(p.id)?.whatsapp ?? null,
    }));
    mentorados = mRes.data ?? [];
    turmas = [
      ...new Set(
        duplas
          .map((d) => turmaDaDupla(d, cronogramas))
          .filter((t): t is string => !!t)
      ),
    ].sort((a, b) => b.localeCompare(a, "pt-BR"));
  }

  // turma que só existe na fila (T3 recém-inscrita, sem dupla ainda) também
  // entra no seletor — senão a fila dela ficaria invisível no builder
  turmas = [...new Set([...turmas, ...inscricoes.map((i) => i.turma)])].sort(
    (a, b) => b.localeCompare(a, "pt-BR")
  );

  // deep-link ?turma=<valor cru> — só vira recorte se a turma existir;
  // valor estranho cai no default (turma mais recente) sem quebrar a URL
  const turmaInicial =
    typeof turmaParam === "string" &&
    (turmaParam === "todas" || turmas.includes(turmaParam))
      ? turmaParam
      : undefined;

  return (
    <RelatorioBuilder
      turmas={turmas}
      turmaInicial={turmaInicial}
      duplas={duplas}
      profs={profs}
      mentorados={mentorados}
      inscricoes={inscricoes}
      cronogramas={cronogramasFull}
      templates={templates}
      links={links}
    />
  );
}
