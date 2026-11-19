import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getCicloEventos,
  getCronogramas,
  getDuplas,
  getMe,
} from "@/lib/queries";
import { getUltimasInteracoes } from "@/lib/interacoes";
import { getEncerramentos } from "@/lib/queries-encerramento";
import { createClient } from "@/lib/supabase/server";
import { demoAtivo } from "@/lib/demo/mode";
import { getDemoData } from "@/lib/demo/data";
import { demoTendenciaSaude } from "@/lib/demo/queries";
import { PageHeader } from "@/components/page-header";
import { VoltarLink } from "@/components/voltar-link";
import { GraficoTempo } from "@/components/viz/grafico-tempo";
import { turmaDaDupla } from "@/lib/turma";
import { formatDate } from "@/lib/ciclo";
import {
  filtraPorRecorte,
  recorteDeParams,
  type RecorteCsv,
} from "@/lib/relatorios/csv-core";
import {
  dadosItensAssinaturas,
  dadosItensAssinaturasDemo,
  dadosItensForms,
  dadosItensFormsDemo,
  dadosItensInteracoes,
  dadosItensInteracoesDemo,
  dadosItensSolicitacoes,
  dadosItensSolicitacoesDemo,
  dadosTendenciaSaude,
  type DiaSaude,
} from "@/lib/relatorios/dados";
import {
  paresEncerramento,
  resumoAderencia,
  resumoEncerramento,
} from "@/lib/relatorios/operacional";
import {
  dadosAdocaoCoorte,
  dadosAdocaoCoorteDemo,
  dadosAdocaoMatriz,
  dadosAdocaoMatrizDemo,
  dadosAdocaoResumo,
  dadosAdocaoResumoDemo,
  dadosFunilInstrumentos,
  dadosFunilInstrumentosDemo,
} from "@/lib/relatorios/adocao";
import { LeituraPainel } from "@/components/leitura-painel";
import { PerguntarLiza } from "@/components/perguntar-liza";
import { leituraAderencia } from "@/lib/relatorios/leituras-aderencia";
import { leituraAdocao } from "@/lib/relatorios/leituras-adocao";
import { leituraSaude } from "@/lib/relatorios/leituras-saude";
import {
  contextoAdocao,
  contextoAderencia,
  contextoAssinaturas,
  contextoEncerramento,
  contextoFormularios,
  contextoHash,
  contextoInteracoes,
  contextoSolicitacoes,
  contextoVisao,
  recorteTexto,
  type RecorteLiza,
} from "@/lib/relatorios/contexto";
import { cardVigenteDaAba } from "@/lib/actions-relatorio-ia";
import type { Achado } from "@/lib/relatorios/leituras";
import {
  janelaDeParam,
  papelDeParam,
  type Janela,
  type MedidaAdocao,
} from "@/lib/adocao";
import { temPapel } from "@/lib/types";
import { RelatoriosAbas, type AbaRelatorios } from "./relatorios-abas";
import { SecaoAderencia } from "./secao-aderencia";
import { SecaoAdocao } from "./secao-adocao";
import { SecaoAssinaturas } from "./secao-assinaturas";
import { SecaoEncerramento } from "./secao-encerramento";
import { SecaoFormularios } from "./secao-formularios";
import { SecaoInteracoes } from "./secao-interacoes";
import { SecaoSolicitacoes } from "./secao-solicitacoes";
import { RecorteTurma } from "./recorte-turma";
import { DigestBotao } from "./digest-botao";
import { DigestConfigCard } from "./digest-config-card";
import {
  DIGEST_CONFIG_PADRAO,
  lerDigestConfig,
  type DigestConfig,
} from "@/lib/relatorios/digest";

export const metadata: Metadata = { title: "Outros relatórios" };

const ABAS: { id: AbaRelatorios; rotulo: string }[] = [
  { id: "visao", rotulo: "Saúde" },
  { id: "aderencia", rotulo: "Aderência" },
  { id: "assinaturas", rotulo: "Assinaturas" },
  { id: "interacoes", rotulo: "Interações" },
  { id: "solicitacoes", rotulo: "Especialistas" },
  { id: "encerramento", rotulo: "Encerramento" },
  { id: "formularios", rotulo: "Formulários" },
  { id: "adocao", rotulo: "Adoção" },
];


export default async function RelatoriosOperacionaisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMe();
  // papel efetivo: a coordenação carregada como papel secundário (híbrido)
  // configura o digest igual — mesma régua temPapel das actions
  if (!me || !temPapel(me, "coordenacao")) redirect("/");

  const sp = await searchParams;
  const abaParam = typeof sp.aba === "string" ? sp.aba : undefined;
  // ?aba=grade aqui é sobra de link editado — a grade mora um nível acima;
  // o redirect preserva o recorte como o inverso em /relatorios faz
  if (abaParam === "grade") {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "aba") continue;
      for (const item of Array.isArray(v) ? v : v != null ? [v] : []) {
        q.append(k, item);
      }
    }
    redirect(`/relatorios${q.size ? `?${q}` : ""}`);
  }
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

  // turmas pros chips do recorte — recorte por turma só vale se a turma
  // existe
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

  // recorte próprio da aba Adoção (REALIZA-417): janela/papel/medida —
  // validados pela mesma regra dos outros params (valor estranho cai no
  // default), turma/cronograma não se aplicam a evento e seguem na URL
  // só como passageiros dos links de aba
  const janela = janelaDeParam(
    typeof sp.janela === "string" ? sp.janela : undefined
  );
  const papel = papelDeParam(
    typeof sp.papel === "string" ? sp.papel : undefined
  );
  const medida: MedidaAdocao = sp.medida === "gestos" ? "gestos" : "pessoas";

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

  // pra ação Lembrar das filas acionáveis (REALIZA-389): quem assina o
  // texto e o proto+host do deploy do link que vai dentro dele
  const meuNome = (me.nome_social ?? me.nome).split(" ")[0];
  const hdrs = await headers();
  const origem = `${hdrs.get("x-forwarded-proto") ?? "https"}://${hdrs.get("host")}`;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={<VoltarLink fallback="/relatorios" />}
        title="Outros relatórios"
        meta="Panorama do programa e exports operacionais em CSV"
      />
      <RelatoriosAbas abas={ABAS} ativa={aba} extraParams={extraParams}>
        {/* a régua de turma não recorta evento — a aba Adoção monta a
            régua própria (janela × papel × medida) dentro da seção */}
        {aba !== "adocao" && (
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
          meuNome,
          origem,
          janela,
          papel,
          medida,
          extraParams,
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
  meuNome,
  origem,
  janela,
  papel,
  medida,
  extraParams,
}: {
  aba: AbaRelatorios;
  demo: boolean;
  supabase: Awaited<ReturnType<typeof createClient>> | null;
  recorte: RecorteCsv;
  csvHref: (tipo: string) => string;
  meuNome: string;
  origem: string;
  /** recorte da aba Adoção — só o case "adocao" lê */
  janela: Janela;
  papel: string | null;
  medida: MedidaAdocao;
  /** turma/cronograma ativos — a régua da Adoção os preserva nos chips
   *  (inertes pra ela) pra não derrubar o recorte das outras abas */
  extraParams: string;
}) {
  const d = demo ? getDemoData() : null;

  // recorte dos cards da Liza (456): a mesma identidade na página e na
  // action — janela/papel/medida só contam na aba Adoção (recorteKey os
  // ignora fora dela)
  const recorteLiza: RecorteLiza = {
    aba,
    turma: recorte.turma,
    cronogramaId: recorte.cronogramaId,
    janela,
    papel,
    medida,
  };
  const rotuloAba = ABAS.find((a) => a.id === aba)!.rotulo;

  /** "Leitura" determinística (455) + card "Perguntar à Liza" (456) no topo
   *  da aba. O contexto/hash sai dos mesmos agregados que a action refaz
   *  no banco — o badge "desatualizado" é a diferença entre os dois. */
  async function blocoInteligencia({
    achados,
    contexto,
  }: {
    achados?: Achado[];
    contexto: Record<string, unknown>;
  }) {
    const card = await cardVigenteDaAba(aba, recorteLiza);
    return (
      <>
        {achados && (
          <LeituraPainel achados={achados} comoLer="A mesma régua dos dados abaixo." />
        )}
        <PerguntarLiza
          aba={aba}
          abaRotulo={rotuloAba}
          recorte={recorteLiza}
          recorteTexto={recorteTexto(recorteLiza)}
          contextoHash={contextoHash(contexto)}
          card={card}
        />
      </>
    );
  }

  switch (aba) {
    case "visao": {
      const tendencia = demo
        ? demoTendenciaSaude(d!, recorte)
        : await dadosTendenciaSaude(supabase!, recorte);
      // config do digest (451): demo mostra o padrão read-only; na sessão
      // real a row vem pela RLS coord e a lista de pessoas escolhíveis é
      // a equipe ativa (coordenação + supervisão, papel efetivo)
      let digestConfig: DigestConfig = DIGEST_CONFIG_PADRAO;
      let pessoasEquipe: { id: string; nome: string }[] = [];
      if (!demo) {
        const [cfg, pRes] = await Promise.all([
          lerDigestConfig(supabase!),
          supabase!
            .from("profiles")
            .select("id, nome, nome_social, profile_papeis!inner(papel)")
            .in("profile_papeis.papel", ["coordenacao", "supervisor"])
            .eq("ativo", true)
            .order("nome"),
        ]);
        digestConfig = cfg;
        const vistos = new Set<string>();
        pessoasEquipe = (pRes.data ?? [])
          .filter((p) => (vistos.has(p.id) ? false : (vistos.add(p.id), true)))
          .map((p) => ({
            id: p.id,
            nome: p.nome_social ?? p.nome,
          }));
      }
      return (
        <div className="space-y-4">
          {await blocoInteligencia({
            achados: leituraSaude(tendencia),
            contexto: contextoVisao(tendencia),
          })}
          <AbaSaude
            tendencia={tendencia}
            digestConfig={digestConfig}
            pessoasEquipe={pessoasEquipe}
            somenteLeitura={demo}
          />
        </div>
      );
    }

    case "aderencia": {
      // a seção acionável (REALIZA-389): resumo + fila; a prévia do export
      // sai das linhas que o próprio resumo já derivou — paridade literal
      const [duplas, eventos, crons] = await Promise.all([
        getDuplas(),
        getCicloEventos(),
        getCronogramas(),
      ]);
      const recDuplas = filtraPorRecorte(duplas, recorte, crons);
      const nudges = await getUltimasInteracoes(
        recDuplas.map((x) => x.id),
        "nudge"
      );
      const resumo = resumoAderencia(recDuplas, eventos, crons);
      return (
        <div className="space-y-4">
          {await blocoInteligencia({
            achados: leituraAderencia(resumo),
            contexto: contextoAderencia(resumo),
          })}
          <SecaoAderencia
            resumo={resumo}
            csvHref={csvHref("aderencia")}
            eventos={eventos}
            crons={crons}
            nudges={nudges}
            meuNome={meuNome}
            origem={origem}
            hoje={new Date()}
          />
        </div>
      );
    }

    case "assinaturas": {
      // a seção acionável (REALIZA-389): resumo + fila por pessoa; a prévia
      // do export deriva dos mesmos itens — paridade literal
      const itens = d
        ? dadosItensAssinaturasDemo(d, recorte)
        : await dadosItensAssinaturas(supabase!, recorte);
      return (
        <div className="space-y-4">
          {await blocoInteligencia({ contexto: contextoAssinaturas(itens) })}
          <SecaoAssinaturas
            itens={itens}
            csvHref={csvHref("assinaturas-pendentes")}
            hoje={new Date()}
          />
        </div>
      );
    }

    case "interacoes": {
      // idem: o log com drill pra ficha da dupla + resumo do volume
      const itens = d
        ? dadosItensInteracoesDemo(d, recorte)
        : await dadosItensInteracoes(supabase!, recorte);
      return (
        <div className="space-y-4">
          {await blocoInteligencia({ contexto: contextoInteracoes(itens) })}
          <SecaoInteracoes
            itens={itens}
            csvHref={csvHref("interacoes")}
            hoje={new Date()}
          />
        </div>
      );
    }

    case "solicitacoes": {
      // idem: o funil do mural + a fila do que espera ação
      const itens = d
        ? dadosItensSolicitacoesDemo(d, recorte)
        : await dadosItensSolicitacoes(supabase!, recorte);
      return (
        <div className="space-y-4">
          {await blocoInteligencia({ contexto: contextoSolicitacoes(itens) })}
          <SecaoSolicitacoes
            itens={itens}
            csvHref={csvHref("solicitacoes")}
            hoje={new Date()}
          />
        </div>
      );
    }

    case "encerramento": {
      // a seção acionável (REALIZA-389): resumo + fila de ritos; a prévia
      // do export deriva dos mesmos pares encerramento×dupla do recorte
      const [duplas, eventos, crons, encerramentos] = await Promise.all([
        getDuplas(),
        getCicloEventos(),
        getCronogramas(),
        getEncerramentos(),
      ]);
      const pares = paresEncerramento(
        encerramentos,
        duplas,
        recorte,
        crons
      );
      const resumo = resumoEncerramento(pares);
      return (
        <div className="space-y-4">
          {await blocoInteligencia({ contexto: contextoEncerramento(resumo) })}
          <SecaoEncerramento
            resumo={resumo}
            linhas={resumo.linhasCsv}
            csvHref={csvHref("encerramento")}
            eventos={eventos}
            crons={crons}
          />
        </div>
      );
    }

    case "formularios": {
      // idem: taxa de resposta + fila de links pendentes
      const itens = d
        ? dadosItensFormsDemo(d, recorte)
        : await dadosItensForms(supabase!, recorte);
      return (
        <div className="space-y-4">
          {await blocoInteligencia({ contexto: contextoFormularios(itens) })}
          <SecaoFormularios
            itens={itens}
            csvHref={csvHref("forms-taxa")}
            hoje={new Date()}
          />
        </div>
      );
    }

    case "adocao": {
      // agregados da inteligência com `desde` truncado no DIA UTC — o mesmo
      // piso do contexto-servidor da action, senão o hash nunca bate
      const desde = new Date(
        new Date(Date.now() - janela * 86400000).toISOString().slice(0, 10)
      );
      const [resumo, celulas, coorte, funil] = d
        ? ([
            dadosAdocaoResumoDemo(d, janela, papel),
            dadosAdocaoMatrizDemo(d, janela),
            dadosAdocaoCoorteDemo(10),
            dadosFunilInstrumentosDemo(),
          ] as const)
        : await Promise.all([
            dadosAdocaoResumo(supabase!, desde, papel),
            dadosAdocaoMatriz(supabase!, desde, null),
            dadosAdocaoCoorte(supabase!, 10),
            dadosFunilInstrumentos(supabase!, desde),
          ]);
      const ctxArgs = { resumo, celulas, coorte, funil, janela, papel, medida };
      return (
        <div className="space-y-4">
          {await blocoInteligencia({
            achados: leituraAdocao(ctxArgs),
            contexto: contextoAdocao(ctxArgs),
          })}
          <SecaoAdocao
            d={d}
            supabase={supabase}
            janela={janela}
            papel={papel}
            medida={medida}
            extraParams={extraParams}
          />
        </div>
      );
    }
  }
}

// ---------------------------------------------------------------------
// aba=visao — tendência do semáforo (snapshots REALIZA-182) + o disparo
// manual do digest. <7 dias de histórico = estado "acumulando".
// ---------------------------------------------------------------------

const DIAS_TENDENCIA = 30;
const MIN_DIAS_GRAFICO = 7;

function AbaSaude({
  tendencia,
  digestConfig,
  pessoasEquipe,
  somenteLeitura,
}: {
  tendencia: DiaSaude[];
  digestConfig: DigestConfig;
  pessoasEquipe: { id: string; nome: string }[];
  somenteLeitura: boolean;
}) {
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

      <section className="space-y-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
        <h2 className="text-base font-semibold">Digest semanal</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          O cron envia o panorama (risco, pendências e semana) na frequência
          configurada abaixo. O botão dispara o mesmo e-mail agora, sem a
          trava de uma vez por período.
        </p>
        <DigestBotao />
        <DigestConfigCard
          inicial={digestConfig}
          pessoas={pessoasEquipe}
          somenteLeitura={somenteLeitura}
        />
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
