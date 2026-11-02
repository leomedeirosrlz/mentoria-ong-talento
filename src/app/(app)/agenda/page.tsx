import type { Metadata } from "next";
import { cookies } from "next/headers";
import { audienciasDe, veMaterial } from "@/lib/materiais";
import { temPapel } from "@/lib/types";
import {
  getCicloEventos,
  getCronogramas,
  getDuplas,
  getEspecialistaEventos,
  getMateriais,
  getMe,
  getMeuMentorProfile,
} from "@/lib/queries";
import { getMentoresChamada, getPresencas } from "@/lib/queries-presenca";
import { getUltimasInteracoes } from "@/lib/interacoes";
import { getEncerramentosPendentes } from "@/lib/queries-encerramento";
import {
  getEspecialistas,
  getMinhaGrade,
  getMinhasExcecoes,
  getSolicitacoesDasDuplas,
  getTrilhasDosJovens,
} from "@/lib/queries-especialista";
import type { SolicitacaoEspecialista } from "@/lib/types";
import {
  cronogramaVigente,
  eventoDaSemana,
  eventosDoCronograma,
  toDateStr,
} from "@/lib/ciclo";
import { deriveAgendaMinha } from "@/lib/agenda-minha";
import { duplaSupervisionada } from "@/lib/auxiliar-escopo";
import {
  resolveTurmaFoco,
  TURMA_FOCO_COOKIE,
  turmasDisponiveis,
} from "@/lib/turma-contexto";
import { turmaDaDupla } from "@/lib/turma";
import { abasDaAgenda, PAINEL_AGENDA, idDaAba } from "@/lib/agenda-abas";
import { AbasAgenda } from "@/components/agenda-abas";
import { AgendaAuxiliar, CabecalhoAuxiliar } from "@/components/agenda-auxiliar";
import { AgendaCalendarioLazy } from "@/components/agenda-calendario-lazy";
import {
  AgendaCoordenacao,
  CabecalhoCoordenacao,
} from "@/components/agenda-coordenacao";
import { AgendaEspecialista } from "@/components/agenda-especialista";
import { AgendaEspHorarios } from "@/components/agenda-especialista-horarios";
import { AgendaMinha } from "@/components/agenda-minha";
import { AgendaPorMentorado } from "@/components/agenda-por-mentorado";
import {
  TurmaContextoSelect,
  TurmaFocoSync,
} from "@/components/turma-contexto-select";
import { FaixaTurmaFoco } from "@/components/turma-hub";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    dia?: string;
    visao?: string;
    aba?: string;
    jw?: string;
    turma?: string | string[];
  }>;
}) {
  // ?dia=YYYY-MM-DD abre a agenda já no dia (deep-link da ficha/notificações);
  // ?visao=dpp|especialista abre a aba correspondente do híbrido (WP6b);
  // ?aba=minha|por-mentorado|calendario abre o modo dentro da visão DPP (WP3)
  // ?jw=semana|mes|ciclo — a janela temporal de coord/sup (REALIZA-195);
  // é param próprio, nunca recicla o ?visao= de papel
  // ?turma=<label> — contexto de turma das superfícies de equipe
  // (REALIZA-73): param > cookie turma_foco > "todas"
  const {
    dia,
    visao: visaoParam,
    aba: abaParam,
    jw,
    turma: turmaParam,
  } = await searchParams;
  const diaInicial = dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null;
  const janelaInicial =
    jw === "semana" || jw === "mes" || jw === "ciclo" ? jw : null;
  // valor fora do vocabulário vale como param ausente — cai no default do
  // papel primário em vez de forçar a visão DPP
  const visao =
    visaoParam === "dpp" || visaoParam === "especialista" ? visaoParam : null;

  // getDuplas vem no escopo do RLS: mentor→a própria, supervisor→supervisionadas, coord→todas.
  // O que só um ramo usa (materiais, grade do mentor, chamada, catálogo esp)
  // é buscado depois do roteamento — a aba não paga pela query da outra.
  const [eventos, me, duplas, cronogramas, cookieStore] = await Promise.all([
    getCicloEventos(),
    getMe(),
    getDuplas(),
    getCronogramas(),
    cookies(),
  ]);
  const agora = new Date();
  const hoje = toDateStr(agora);

  // ---- contexto de turma (REALIZA-73) — só as superfícies de equipe
  // (monitoramento da coordenação, agenda do auxiliar e o calendário
  // oficial delas) se recortam; as de mentor/especialista são da pessoa
  // e não leem contexto. Escopo do auxiliar = as turmas das supervisionadas
  // (mesma régua da home e da /duplas — nunca nomeia turma alheia). ----
  const supervisionadas = me
    ? duplas.filter((d) => duplaSupervisionada(d, me.id))
    : duplas;
  const escopoTurmas =
    me?.role === "supervisor"
      ? [
          ...new Set(
            supervisionadas
              .map((d) => turmaDaDupla(d, cronogramas))
              .filter((t): t is string => !!t)
          ),
        ]
      : undefined;
  const papelContexto =
    me?.role === "coordenacao" || me?.role === "supervisor";
  const foco = papelContexto
    ? resolveTurmaFoco(
        turmaParam,
        cookieStore.get(TURMA_FOCO_COOKIE)?.value,
        cronogramas,
        { papel: me!.role, escopoTurmas }
      )
    : null;
  // os conjuntos já recortados: o calendário oficial do contexto são os
  // cronogramas da turma (1 turma com 2 cronogramas mantém os dois — o
  // seletor interno do calendário desambigua); as duplas casam pelo
  // rótulo vivo (turmaDaDupla), nunca pelo selo congelado
  const cronogramasCtx = foco?.cronogramas ?? cronogramas;
  const idsCronCtx = new Set(cronogramasCtx.map((c) => c.id));
  const eventosCtx = foco?.turma
    ? eventos.filter((e) => idsCronCtx.has(e.cronograma_id))
    : eventos;
  const duplasCtx = foco?.turma
    ? duplas.filter((d) => turmaDaDupla(d, cronogramas) === foco.turma)
    : duplas;
  const supervisionadasCtx = foco?.turma
    ? supervisionadas.filter(
        (d) => turmaDaDupla(d, cronogramas) === foco.turma
      )
    : supervisionadas;
  // seletor + faixa do contexto — o seletor se esconde com <2 opções mas
  // o sync do cookie roda dentro dele de qualquer jeito (a /duplas usa
  // os chips dela como controle; aqui o controle é o seletor do header)
  const turmasNavegaveis = papelContexto
    ? turmasDisponiveis(cronogramas, { papel: me!.role, escopoTurmas })
    : [];
  const seletorTurma = foco ? (
    <TurmaContextoSelect
      turmas={turmasNavegaveis}
      foco={{ turma: foco.turma, origem: foco.origem }}
    />
  ) : null;
  const faixaTurma = (
    <FaixaTurmaFoco foco={foco?.turma ?? null} hrefTodas="/agenda?turma=todas" />
  );

  // "semana do encontro" é do cronograma vigente (o default da tela) — na
  // união dos calendários, semana de T1 e T2 se embaralhariam. Ela alimenta
  // só a inicialização/deep-link do calendário: dentro dele o "atual" é
  // recomputado do cronograma selecionado. Com turma em foco o vigente é
  // o DELA (a semana destacada é da turma que a pessoa está trabalhando)
  const vigente = cronogramaVigente(cronogramasCtx, agora);
  const eventosVigente = vigente
    ? eventosDoCronograma(eventos, vigente.id)
    : eventos;
  const semana = eventoDaSemana(eventosVigente, agora);
  const temEspecialista = duplas.some((d) => d.trilha === "especialista");
  // Quem tem o papel de especialista carrega a agenda própria (grade,
  // exceções, fila) — papel efetivo, não primário: o híbrido DPP também
  // configura a dele (WP6b). A superfície DPP (calendário oficial do ciclo)
  // vale pra todo mundo menos o especialista puro — o híbrido vê as duas
  // em abas (?visao=), aterrissando na do papel primário
  const souEsp = temPapel(me, "mentor_especialista");
  const souMentor = temPapel(me, "mentor_dpp");
  // a visão esp é "minha agenda" — filtra pelas duplas do próprio mentor
  // antes de derivar as abas: pra staff+esp o escopo RLS traz duplas de
  // outros mentores junto
  const minhasDuplas = duplas.filter((d) => d.mentor?.id === me?.id);
  const duplasEsp = minhasDuplas.filter((d) => d.trilha === "especialista");
  const mostraDpp =
    !souEsp ||
    temPapel(me, "mentor_dpp") ||
    duplas.some((d) => d.trilha !== "especialista");
  // a aba Especialista só existe com trilha pra mostrar (REALIZA-207): o
  // híbrido sem trilha perde a aba e ?visao=especialista cai mudo na visão
  // DPP. O especialista puro sem dupla segue na própria superfície — é a
  // única que ele tem (lá mora o estado vazio).
  const temVisaoEsp = souEsp && (!mostraDpp || duplasEsp.length > 0);
  const duasVisoes = souEsp && mostraDpp && temVisaoEsp;
  // o papel PRIMÁRIO decide a aterrissagem: quem é supervisor/coordenação
  // com papel de mentor/especialista por cima cai na superfície de equipe
  // (monitoramento/auxiliar) — o lado mentor/esp fica atrás de ?visao=
  // explícito. Sem isso o híbrido staff+mentor perdia a própria tela.
  const papelStaff =
    me?.role === "coordenacao" || me?.role === "supervisor";
  const visaoEsp =
    temVisaoEsp &&
    (!papelStaff || visao === "especialista") &&
    (!duasVisoes ||
      (visao ? visao === "especialista" : me?.role === "mentor_especialista"));

  // ?visao= pedida mas inaplicável degradava mudo — o banner explica o que
  // a tela está mostrando (SSR, sem estado: some na próxima navegação).
  // Esp sem trilha NÃO avisa: a queda na visão DPP é o comportamento certo.
  const avisoVisao =
    visao === "especialista" && !visaoEsp && !souEsp ? (
      <p className="rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
        A visão de especialista não se aplica ao seu papel. Mostrando a
        agenda normal.
      </p>
    ) : visao === "dpp" && !mostraDpp ? (
      <p className="rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
        Você não tem dupla DPP. Mostrando a agenda da trilha de
        especialista.
      </p>
    ) : null;

  // WP3 — os modos do mentor DPP vivem nesta tablist única: Minha agenda
  // (cronológica, default — "o que eu tenho hoje" primeiro), Por mentorado
  // (card por jovem com a trilha do especialista em modo "acompanha, não
  // participa") e Calendário (o AgendaCalendario atual, preservado inteiro).
  // Coord/sup ficam no calendário — os modos novos são do mentor. Param
  // inválido cai em "minha" — default da v6, não do papel.
  // ?dia= sem ?aba= explícita mira o calendário — o deep-link é dele;
  // ?jw= também (é o seletor temporal das visões do calendário — implica
  // aba=calendario pra quem tem a superfície)
  const aba =
    abaParam === "por-mentorado" || abaParam === "calendario"
      ? abaParam
      : diaInicial != null || janelaInicial != null
        ? "calendario"
        : "minha";
  // a barra é a mesma nas três visões e muda só a superfície disponível:
  // o ramo do especialista pede a lista com a aba dele, o resto entra com
  // a visão esp só quando ela existe de verdade (duasVisoes)
  const abasEsp = abasDaAgenda({
    papel: me?.role ?? null,
    mentor: souMentor,
    especialista: true,
  });
  const abas = abasDaAgenda({
    papel: me?.role ?? null,
    mentor: souMentor,
    especialista: duasVisoes,
  });
  // subtítulo do lado DPP do mentor — o MESMO nos três modos (trocar de aba
  // não reescreve o header; ele descreve a agenda, não a aba). A segunda
  // linha (REALIZA-97) fixa a leitura do calendário oficial: data do ciclo
  // é sugestão, a dupla combina a real — regra de reposição na mesma semana
  const subtituloDpp = (
    <>
      <p className="mt-1 text-sm text-muted-foreground">
        Os encontros do ciclo e os que você marcou com sua dupla.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        As datas oficiais são sugestões. A dupla combina o dia e o horário.
      </p>
    </>
  );

  if (visaoEsp) {
    // grade e exceções alimentam o "Quando você atende" (só leitura — a
    // edição mora no perfil); espEventos dá título/foco dos passos da trilha
    const [grade, excecoes, espEventos] = await Promise.all([
      getMinhaGrade(),
      getMinhasExcecoes(),
      duplasEsp.length > 0 ? getEspecialistaEventos() : Promise.resolve([]),
    ]);
    const barraEsp = <AbasAgenda abas={abasEsp} ativa="especialista" />;
    // especialista puro sem trilha: cabeçalho + estado vazio curto + a
    // disponibilidade em leitura (o híbrido sem trilha nem chega aqui —
    // caiu na visão DPP acima)
    return (
      <div className="space-y-6">
        {avisoVisao}
        {/* a visão é da pessoa, não do contexto — mas um ?turma= pousado
            aqui ainda precisa gravar o cookie (sync headless, sem UI) */}
        {foco && (
          <TurmaFocoSync foco={{ turma: foco.turma, origem: foco.origem }} />
        )}
        {duplasEsp.length === 0 ? (
          <>
            <header>
              <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Mentoria especializada · até 5 sessões de 1h em até 3 meses
              </p>
            </header>
            {barraEsp}
            <div
              id={PAINEL_AGENDA}
              role="tabpanel"
              className="animate-enter space-y-6"
            >
              <div className="rounded-xl bg-card px-5 py-6 text-center shadow-[var(--shadow-border)]">
                <p className="text-sm text-muted-foreground">
                  Você ainda não tem trilhas. Quando um pedido for aceito, as
                  sessões aparecem aqui.
                </p>
              </div>
              <AgendaEspHorarios grade={grade} excecoes={excecoes} />
            </div>
          </>
        ) : (
          <AgendaEspecialista
            duplas={duplasEsp}
            espEventos={espEventos}
            grade={grade}
            excecoes={excecoes}
            hojeIso={hoje}
            agoraMs={agora.getTime()}
            abas={barraEsp}
          />
        )}
      </div>
    );
  }

  // "Minhas duplas" = as que eu mentoro — pra staff+mentor o escopo RLS traz
  // supervisionadas/coorte inteira junto, e AgendaMinha/PorMentorado assume
  // que a entrada já é do mentor (o ramo esp já filtrava por mentor.id)
  const duplasDpp = duplas.filter(
    (d) => d.trilha !== "especialista" && d.mentor?.id === me?.id
  );

  // staff+mentor: ?visao=dpp é o escape explícito pra superfície de mentor
  if (souMentor && aba !== "calendario" && (!papelStaff || visao === "dpp")) {
    const idsDpp = duplasDpp.map((d) => d.id);
    const [trilhas, solicitacoes, especialistas, nudges, encerramentosPendentes] =
      await Promise.all([
        getTrilhasDosJovens(idsDpp),
        aba === "por-mentorado"
          ? getSolicitacoesDasDuplas(idsDpp)
          : Promise.resolve({} as Record<string, SolicitacaoEspecialista[]>),
        aba === "por-mentorado" ? getEspecialistas() : Promise.resolve([]),
        // cap de 48h do "Lembrar o jovem" — só o Por mentorado renderiza
        aba === "por-mentorado"
          ? getUltimasInteracoes(idsDpp, "nudge")
          : Promise.resolve({}),
        // rito de encerramento aberto (REALIZA-172) — o card do mentorado
        // concluído sinaliza que a coordenação fecha na ficha
        aba === "por-mentorado"
          ? getEncerramentosPendentes()
          : Promise.resolve([]),
      ]);
    // o strip "Sua semana" do Por mentorado mostra os MESMOS itens da Minha
    // agenda — a derivação é pura (sem query nova), reusa o que a página já
    // buscou pra esta aba
    const itensSemana =
      aba === "por-mentorado"
        ? deriveAgendaMinha({
            duplas: duplasDpp,
            trilhas,
            eventos,
            cronogramas,
            supervisoes: [],
            meuId: me!.id,
            hoje,
            agora: agora.getTime(),
          }).secoes.flatMap((s) => s.grupos.flatMap((g) => g.itens))
        : [];
    return (
      <div className="space-y-6">
        {avisoVisao}
        {/* idem visão esp: superfície do mentor não se recorta, mas o
            ?turma= pousado aqui persiste no cookie mesmo assim */}
        {foco && (
          <TurmaFocoSync foco={{ turma: foco.turma, origem: foco.origem }} />
        )}
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          {subtituloDpp}
        </header>
        {/* uma barra só pra página inteira: o híbrido staff+mentor entra com
            ?visao=dpp&aba= e o "Calendário" volta pro calendário de equipe */}
        <AbasAgenda abas={abas} ativa={aba} />
        <div
          key={aba}
          id={PAINEL_AGENDA}
          role="tabpanel"
          aria-labelledby={idDaAba(aba)}
          className="animate-enter"
        >
          {aba === "minha" ? (
            <AgendaMinha
              duplas={duplasDpp}
              trilhas={trilhas}
              eventos={eventos}
              cronogramas={cronogramas}
              meuId={me!.id}
              hoje={hoje}
              agora={agora.getTime()}
              // staff+mentor híbrido: os cards da faixa linkam pro dia no
              // calendário — precisam carregar a visão certa (regra do
              // hibrido do PorMentorado)
              hibrido={duasVisoes || (papelStaff ?? false)}
            />
          ) : (
            <AgendaPorMentorado
              duplas={duplasDpp}
              trilhas={trilhas}
              solicitacoes={solicitacoes}
              especialistas={especialistas.map((e) => ({
                id: e.id,
                nome: e.nome,
              }))}
              eventos={eventos}
              cronogramas={cronogramas}
              nudges={nudges}
              encerramentosPendentes={encerramentosPendentes}
              itensSemana={itensSemana}
              // staff+mentor também: o deep-link do dia no strip precisa do
              // ?visao=dpp (mesma régua da barra no ramo calendário)
              hibrido={duasVisoes || (papelStaff ?? false)}
              meuId={me!.id}
              meuNome={me!.nome.split(" ")[0]}
              hoje={hoje}
              agora={agora.getTime()}
            />
          )}
        </div>
      </div>
    );
  }

  // ---- ramo supervisor (WP5) — agenda própria do auxiliar executivo:
  // "Por turma" (as supervisionadas no calendário delas) | "Consolidada"
  // (a agenda única da pessoa). Ele monitora e registra supervisão —
  // nunca agenda por dupla — então o calendário do ciclo não é superfície
  // dele; `?dia=` cai na mesma vista (sem painel de dia)
  // supervisor+mentor tem o calendário DPP dele atrás de ?aba=calendario e
  // dos deep-links ?dia=/?jw= — sem o guard, o ramo da auxiliar captura a
  // aba e a janela que não são dela
  if (
    me?.role === "supervisor" &&
    !(
      (abaParam === "calendario" ||
        diaInicial != null ||
        janelaInicial != null) &&
      souMentor
    )
  ) {
    // "Consolidada" é uma das abas da barra (a ativa). O default é "Por turma".
    const consolidada = abaParam === "consolidada";
    const [nudgesAux] = await Promise.all([
      getUltimasInteracoes(supervisionadasCtx.map((d) => d.id), "nudge"),
    ]);
    return (
      <div className="space-y-6">
        {avisoVisao}
        <AgendaAuxiliar
          // o contexto recorta no server, como na /duplas dele — o grupo
          // "Por turma" da turma em foco fica sozinho e a faixa dá a saída
          duplas={supervisionadasCtx}
          eventos={eventosCtx}
          cronogramas={cronogramasCtx}
          nudges={nudgesAux}
          meuNome={me.nome.split(" ")[0]}
          hoje={hoje}
          agora={agora.getTime()}
          // supervisor+mentor tem superfície de dia própria — os cards da
          // faixa linkam `?aba=calendario&dia=` (o guard acima escapa esse
          // param do ramo auxiliar); pro supervisor puro o link seria engolido
          comLinkDia={souMentor}
          consolidada={consolidada}
          seletorContexto={seletorTurma}
          contextoTurma={faixaTurma}
          abas={
            <AbasAgenda
              abas={abas}
              ativa={consolidada ? "consolidada" : "turma"}
            />
          }
        />
      </div>
    );
  }

  // ---- ramo coordenação (WP5) — "Monitoramento" é a aterrissagem; o
  // calendário oficial vira a segunda aba (?aba=calendario ou os
  // deep-links ?dia=/?jw= da ficha/notificação)
  if (
    me?.role === "coordenacao" &&
    abaParam !== "calendario" &&
    diaInicial == null &&
    janelaInicial == null
  ) {
    const [nudgesCoord, encerramentosPendentes] =
      await Promise.all([
        // o cap de 48h do Lembrar só precisa das duplas do recorte
        getUltimasInteracoes(duplasCtx.map((d) => d.id), "nudge"),
        // rito de encerramento aberto — a pendência que vira linha "concluir
        // na ficha" quando a dupla já concluiu (REALIZA-172)
        getEncerramentosPendentes(),
      ]);
    return (
      <div className="space-y-6">
        {avisoVisao}
        <AgendaCoordenacao
          // fila, semana e números derivam do recorte: com turma em foco
          // os cards-resumo e o "para acompanhar" falam só dela
          duplas={duplasCtx}
          eventos={eventosCtx}
          cronogramas={cronogramasCtx}
          nudges={nudgesCoord}
          encerramentosPendentes={new Set(encerramentosPendentes)}
          meuNome={me.nome.split(" ")[0]}
          hoje={hoje}
          agora={agora.getTime()}
          seletorContexto={seletorTurma}
          contextoTurma={faixaTurma}
          abas={<AbasAgenda abas={abas} ativa="monitoramento" />}
        />
      </div>
    );
  }

  // ---- ramo calendário (aba da coord, visão do mentor e ?dia=/?jw=) ----
  // Busca tardia: materiais, grade do mentor (overlay de disponibilidade),
  // chamada da coordenação e o catálogo de sessões esp só valem aqui.
  const [materiais, meuMentorProfile, espEventos] = await Promise.all([
    getMateriais(),
    getMeuMentorProfile(),
    temEspecialista ? getEspecialistaEventos() : Promise.resolve([]),
  ]);
  // audiência = mesma régua do módulo de materiais (`veMaterial`): a lista
  // por papel cobre auxiliar executivo e mentorando, e o legado de valor
  // único é normalizado em `audienciasDe`
  const materiaisVisiveis = materiais.filter((m) =>
    veMaterial(audienciasDe(m), me)
  );
  // chamada dos encontros de formação — só a coordenação marca; pros demais
  // papéis nem busca (a UI nem renderiza o painel fora da coordenação)
  const idsFormacao = eventosCtx
    .filter((e) => e.tipo === "formacao")
    .map((e) => e.id);
  const [mentoresChamada, presencasLista] =
    me?.role === "coordenacao"
      ? await Promise.all([getMentoresChamada(), getPresencas(idsFormacao)])
      : [[], []];
  // a chamada é da turma em foco (navegacao-turmas.md): mentor dela = quem
  // tem dupla nos cronogramas do contexto; quem ainda não tem dupla em
  // turma nenhuma segue na lista de qualquer foco (não dá pra dizer de
  // qual turma ele é até o membership real da REALIZA-47)
  const mentoresCtx = foco?.turma
    ? mentoresChamada.filter(
        (m) =>
          !duplas.some((d) => d.mentor?.id === m.id) ||
          duplas.some(
            (d) =>
              d.mentor?.id === m.id && idsCronCtx.has(d.cronograma_id ?? "")
          )
      )
    : mentoresChamada;
  const presencasPorEvento: Record<string, Record<string, boolean>> = {};
  for (const p of presencasLista)
    (presencasPorEvento[p.ciclo_evento_id] ??= {})[p.profile_id] = p.presente;

  // o calendário é superfície de mais de um papel: o header acompanha a
  // superfície de onde a pessoa veio, pra trocar de aba não reescrever o h1
  const cabecalhoCalendario =
    !papelStaff || visao === "dpp" ? (
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          {subtituloDpp}
        </div>
        {/* staff+mentor com ?visao=dpp: a superfície abaixo segue sendo a
            de equipe (o calendário decide por papel, não por ?visao=) —
            o seletor de contexto vale pra ela também */}
        {seletorTurma}
      </header>
    ) : me?.role === "coordenacao" ? (
      <CabecalhoCoordenacao hoje={hoje} seletor={seletorTurma} />
    ) : (
      <CabecalhoAuxiliar
        duplas={supervisionadasCtx}
        hoje={hoje}
        seletor={seletorTurma}
      />
    );

  return (
    <div className="space-y-6">
      {cabecalhoCalendario}
      {foco?.turma && faixaTurma}
      <AbasAgenda abas={abas} ativa="calendario" />
      <div
        id={PAINEL_AGENDA}
        role="tabpanel"
        aria-labelledby={idDaAba("calendario")}
        className="animate-enter"
      >
        {eventos.length === 0 ? (
          <div className="rounded-xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted-foreground">
              A agenda ainda não foi publicada pela coordenação.
            </p>
          </div>
        ) : (
          <AgendaCalendarioLazy
            // a camada oficial é a do contexto: com turma em foco o
            // seletor interno só oferece os cronogramas dela e os dots/
            // coberturas contam as duplas dela (design REALIZA-73)
            eventos={eventosCtx}
            cronogramas={cronogramasCtx}
            espEventos={espEventos}
            materiais={materiaisVisiveis}
            hoje={hoje}
            semanaId={semana?.id ?? null}
            diaInicial={diaInicial}
            janelaInicial={janelaInicial}
            duplas={duplasCtx}
            role={me?.role ?? null}
            papeis={me?.papeis ?? null}
            mentores={mentoresCtx}
            presencas={presencasPorEvento}
            // Overlay "quem pode nesse dia" — só o mentor DPP puro
            // (REALIZA-24): coord/sup veem TODAS as duplas (uma tinta por
            // dupla seria ambígua) e pro staff+mentor a grade dele seria
            // vazamento de coorte na superfície de equipe — a visão mentor
            // dele fica atrás do ?visao=dpp
            mentorDisponibilidade={
              temPapel(me, "mentor_dpp") && !papelStaff
                ? (meuMentorProfile?.disponibilidade ?? null)
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
