import type { Metadata } from "next";
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
  getSolicitacoesDaDupla,
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
import { abasDaAgenda, PAINEL_AGENDA, idDaAba } from "@/lib/agenda-abas";
import { AbasAgenda } from "@/components/agenda-abas";
import { AgendaAuxiliar, CabecalhoAuxiliar } from "@/components/agenda-auxiliar";
import { AgendaCalendario } from "@/components/agenda-calendario";
import {
  AgendaCoordenacao,
  CabecalhoCoordenacao,
} from "@/components/agenda-coordenacao";
import { AgendaEspecialista } from "@/components/agenda-especialista";
import { AgendaEspHorarios } from "@/components/agenda-especialista-horarios";
import { AgendaMinha } from "@/components/agenda-minha";
import { AgendaPorMentorado } from "@/components/agenda-por-mentorado";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    dia?: string;
    visao?: string;
    aba?: string;
    jw?: string;
  }>;
}) {
  // ?dia=YYYY-MM-DD abre a agenda já no dia (deep-link da ficha/notificações);
  // ?visao=dpp|especialista abre a aba correspondente do híbrido (WP6b);
  // ?aba=minha|por-mentorado|calendario abre o modo dentro da visão DPP (WP3)
  // ?jw=semana|mes|ciclo — a janela temporal de coord/sup (REALIZA-195);
  // é param próprio, nunca recicla o ?visao= de papel
  const { dia, visao: visaoParam, aba: abaParam, jw } = await searchParams;
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
  const [eventos, me, duplas, cronogramas] = await Promise.all([
    getCicloEventos(),
    getMe(),
    getDuplas(),
    getCronogramas(),
  ]);
  const agora = new Date();
  const hoje = toDateStr(agora);
  // "semana do encontro" é do cronograma vigente (o default da tela) — na
  // união dos calendários, semana de T1 e T2 se embaralhariam. Ela alimenta
  // só a inicialização/deep-link do calendário: dentro dele o "atual" é
  // recomputado do cronograma selecionado
  const vigente = cronogramaVigente(cronogramas, agora);
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
  // não reescreve o header; ele descreve a agenda, não a aba)
  const subtituloDpp = (
    <p className="mt-1 text-sm text-muted-foreground">
      Os encontros do ciclo e os que você marcou com sua dupla.
    </p>
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
          ? Promise.all(idsDpp.map((id) => getSolicitacoesDaDupla(id))).then(
              (lista) => Object.fromEntries(idsDpp.map((id, i) => [id, lista[i]]))
            )
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
  const supervisionadas = me
    ? duplas.filter((d) => duplaSupervisionada(d, me.id))
    : duplas;
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
      getUltimasInteracoes(supervisionadas.map((d) => d.id), "nudge"),
    ]);
    return (
      <div className="space-y-6">
        {avisoVisao}
        <AgendaAuxiliar
          duplas={supervisionadas}
          eventos={eventos}
          cronogramas={cronogramas}
          nudges={nudgesAux}
          meuNome={me.nome.split(" ")[0]}
          hoje={hoje}
          agora={agora.getTime()}
          // supervisor+mentor tem superfície de dia própria — os cards da
          // faixa linkam `?aba=calendario&dia=` (o guard acima escapa esse
          // param do ramo auxiliar); pro supervisor puro o link seria engolido
          comLinkDia={souMentor}
          consolidada={consolidada}
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
        getUltimasInteracoes(duplas.map((d) => d.id), "nudge"),
        // rito de encerramento aberto — a pendência que vira linha "concluir
        // na ficha" quando a dupla já concluiu (REALIZA-172)
        getEncerramentosPendentes(),
      ]);
    return (
      <div className="space-y-6">
        {avisoVisao}
        <AgendaCoordenacao
          duplas={duplas}
          eventos={eventos}
          cronogramas={cronogramas}
          nudges={nudgesCoord}
          encerramentosPendentes={new Set(encerramentosPendentes)}
          meuNome={me.nome.split(" ")[0]}
          hoje={hoje}
          agora={agora.getTime()}
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
  const idsFormacao = eventos
    .filter((e) => e.tipo === "formacao")
    .map((e) => e.id);
  const [mentoresChamada, presencasLista] =
    me?.role === "coordenacao"
      ? await Promise.all([getMentoresChamada(), getPresencas(idsFormacao)])
      : [[], []];
  const presencasPorEvento: Record<string, Record<string, boolean>> = {};
  for (const p of presencasLista)
    (presencasPorEvento[p.ciclo_evento_id] ??= {})[p.profile_id] = p.presente;

  // o calendário é superfície de mais de um papel: o header acompanha a
  // superfície de onde a pessoa veio, pra trocar de aba não reescrever o h1
  const cabecalhoCalendario =
    !papelStaff || visao === "dpp" ? (
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        {subtituloDpp}
      </header>
    ) : me?.role === "coordenacao" ? (
      <CabecalhoCoordenacao hoje={hoje} />
    ) : (
      <CabecalhoAuxiliar duplas={supervisionadas} hoje={hoje} />
    );

  return (
    <div className="space-y-6">
      {cabecalhoCalendario}
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
          <AgendaCalendario
            eventos={eventos}
            cronogramas={cronogramas}
            espEventos={espEventos}
            materiais={materiaisVisiveis}
            hoje={hoje}
            semanaId={semana?.id ?? null}
            diaInicial={diaInicial}
            janelaInicial={janelaInicial}
            duplas={duplas}
            role={me?.role ?? null}
            papeis={me?.papeis ?? null}
            mentores={mentoresChamada}
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
