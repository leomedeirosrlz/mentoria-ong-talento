import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
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
import {
  getSupervisaoAlvos,
  getSupervisoesDaPessoa,
  getSupervisoesRecentes,
} from "@/lib/queries-supervisao";
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
import { AgendaAuxiliar } from "@/components/agenda-auxiliar";
import { AgendaCalendario } from "@/components/agenda-calendario";
import { AgendaCoordenacao } from "@/components/agenda-coordenacao";
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

  if (visaoEsp) {
    // grade e exceções alimentam o "Quando você atende" (só leitura — a
    // edição mora no perfil); espEventos dá título/foco dos passos da trilha
    const [grade, excecoes, espEventos] = await Promise.all([
      getMinhaGrade(),
      getMinhasExcecoes(),
      duplasEsp.length > 0 ? getEspecialistaEventos() : Promise.resolve([]),
    ]);
    // especialista puro sem trilha: cabeçalho + estado vazio curto + a
    // disponibilidade em leitura (o híbrido sem trilha nem chega aqui —
    // caiu na visão DPP acima)
    const conteudoEsp =
      duplasEsp.length === 0 ? (
        <div className="space-y-6">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Mentoria especializada · até 5 sessões de 1h em até 3 meses
            </p>
          </header>
          <div className="rounded-xl bg-card px-5 py-6 text-center shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted-foreground">
              Você ainda não tem trilhas. Quando um pedido for aceito, as
              sessões aparecem aqui.
            </p>
          </div>
          <AgendaEspHorarios grade={grade} excecoes={excecoes} />
        </div>
      ) : (
        <AgendaEspecialista
          duplas={duplasEsp}
          espEventos={espEventos}
          grade={grade}
          excecoes={excecoes}
          hojeIso={hoje}
          agoraMs={agora.getTime()}
        />
      );
    return duasVisoes ? (
      <div className="space-y-6">
        {avisoVisao}
        <AbasAgenda ativa="especialista" />
        {conteudoEsp}
      </div>
    ) : (
      <div className="space-y-6">
        {avisoVisao}
        {conteudoEsp}
      </div>
    );
  }

  // WP3 — os modos do mentor DPP vivem numa tablist dentro da visão DPP:
  // Minha agenda (cronológica, default — "o que eu tenho hoje" primeiro),
  // Por mentorado (card por jovem com a trilha do especialista em modo
  // "acompanha, não participa") e Calendário (o AgendaCalendario atual,
  // preservado inteiro). Coord/sup ficam no calendário — os modos novos são
  // do mentor. Param inválido cai em "minha" — default da v6, não do papel.
  // ?dia= sem ?aba= explícita mira o calendário — o deep-link é dele;
  // ?jw= também (é o seletor temporal das visões do calendário — implica
  // aba=calendario pra quem tem a superfície)
  const souMentor = temPapel(me, "mentor_dpp");
  const aba =
    abaParam === "por-mentorado" || abaParam === "calendario"
      ? abaParam
      : diaInicial != null || janelaInicial != null
        ? "calendario"
        : "minha";
  // "Minhas duplas" = as que eu mentoro — pra staff+mentor o escopo RLS traz
  // supervisionadas/coorte inteira junto, e AgendaMinha/PorMentorado assume
  // que a entrada já é do mentor (o ramo esp já filtrava por mentor.id)
  const duplasDpp = duplas.filter(
    (d) => d.trilha !== "especialista" && d.mentor?.id === me?.id
  );

  // staff+mentor: ?visao=dpp é o escape explícito pra superfície de mentor
  if (souMentor && aba !== "calendario" && (!papelStaff || visao === "dpp")) {
    const idsDpp = duplasDpp.map((d) => d.id);
    const [trilhas, supervisoes, solicitacoes, especialistas, nudges, encerramentosPendentes] =
      await Promise.all([
        getTrilhasDosJovens(idsDpp),
        // as duas abas leem supervisões: "minha" pra linha cronológica,
        // "por-mentorado" pra seção "Do programa" + o strip da semana
        getSupervisoesDaPessoa(me!.id),
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
            supervisoes,
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
        </header>
        {duasVisoes && <AbasAgenda ativa="dpp" />}
        {/* staff+mentor também é híbrido aqui: sem o ?visao=dpp as tabs
            "minha/por mentorado" derrubam de volta na superfície de equipe
            (mesma régua das chamadas lá de baixo) */}
        <AbasAgendaMentor
          ativa={aba}
          hibrido={duasVisoes || (papelStaff ?? false)}
        />
        {aba === "minha" ? (
          <AgendaMinha
            duplas={duplasDpp}
            trilhas={trilhas}
            eventos={eventos}
            cronogramas={cronogramas}
            supervisoes={supervisoes}
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
            supervisoes={supervisoes}
            nudges={nudges}
            encerramentosPendentes={encerramentosPendentes}
            itensSemana={itensSemana}
            // staff+mentor também: o deep-link do dia no strip precisa do
            // ?visao=dpp (mesma régua do AbasAgendaMentor no ramo calendário)
            hibrido={duasVisoes || (papelStaff ?? false)}
            meuId={me!.id}
            meuNome={me!.nome.split(" ")[0]}
            hoje={hoje}
            agora={agora.getTime()}
          />
        )}
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
    // escopo da RLS (0125): supervisionadas + turma dele chegam em `duplas`
    // — a peneira só tira o lado mentor (duplaSupervisionada)
    const supervisionadas = duplas.filter((d) => duplaSupervisionada(d, me.id));
    const [alvos, supervisoesAux, nudgesAux] = await Promise.all([
      getSupervisaoAlvos(),
      getSupervisoesDaPessoa(me.id),
      getUltimasInteracoes(supervisionadas.map((d) => d.id), "nudge"),
    ]);
    return (
      <div className="space-y-6">
        {avisoVisao}
        {duasVisoes && <AbasAgenda ativa="dpp" />}
        <AgendaAuxiliar
          duplas={supervisionadas}
          eventos={eventos}
          cronogramas={cronogramas}
          supervisoes={supervisoesAux}
          alvos={alvos}
          nudges={nudgesAux}
          meuNome={me.nome.split(" ")[0]}
          hoje={hoje}
          agora={agora.getTime()}
          // supervisor+mentor tem superfície de dia própria — os cards da
          // faixa linkam `?aba=calendario&dia=` (o guard acima escapa esse
          // param do ramo auxiliar); pro supervisor puro o link seria engolido
          comLinkDia={souMentor}
          consolidada={abaParam === "consolidada"}
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
    const [nudgesCoord, supervisoesCoord, encerramentosPendentes] =
      await Promise.all([
        getUltimasInteracoes(duplas.map((d) => d.id), "nudge"),
        // a lib recorta a semana — trago margem (30) pra cobrir ciclos grandes
        getSupervisoesRecentes(30),
        // rito de encerramento aberto — a pendência que vira linha "concluir
        // na ficha" quando a dupla já concluiu (REALIZA-172)
        getEncerramentosPendentes(),
      ]);
    return (
      <div className="space-y-6">
        {avisoVisao}
        {duasVisoes && <AbasAgenda ativa="dpp" />}
        <AbasAgendaCoord ativa="monitoramento" />
        <AgendaCoordenacao
          duplas={duplas}
          eventos={eventos}
          cronogramas={cronogramas}
          nudges={nudgesCoord}
          supervisoes={supervisoesCoord}
          encerramentosPendentes={new Set(encerramentosPendentes)}
          meuNome={me.nome.split(" ")[0]}
          hoje={hoje}
          agora={agora.getTime()}
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
  // audiência = mesma regra de /materiais: "todos" pra todo mundo, "dpp" e
  // "especialista" pro papel correspondente, coordenação vê tudo
  const materiaisVisiveis = materiais.filter((m) => {
    if (m.audiencia === "todos") return true;
    if (me?.role === "coordenacao") return true;
    if (m.audiencia === "dpp") return temPapel(me, "mentor_dpp");
    if (m.audiencia === "especialista")
      return temPapel(me, "mentor_especialista");
    return false;
  });
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {/* contexto estático por papel — a semana vigente vive no rail e no
              título do board, que acompanham o cronograma selecionado */}
          {me?.role === "coordenacao"
            ? "O calendário oficial do ciclo e o que cada dupla marcou."
            : "Os encontros do ciclo e os que você marcou com sua dupla."}
        </p>
      </header>

      {duasVisoes && <AbasAgenda ativa="dpp" />}
      {souMentor && (
        <AbasAgendaMentor
          ativa="calendario"
          // staff+mentor também precisa do ?visao=dpp nas tabs — sem ele os
          // links "minha/por mentorado" caem de volta na superfície staff
          hibrido={duasVisoes || (papelStaff ?? false)}
        />
      )}
      {me?.role === "coordenacao" && <AbasAgendaCoord ativa="calendario" />}

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
  );
}

/** Abas da agenda do híbrido (WP6b) — quem é DPP + especialista alterna
 *  entre o calendário oficial do ciclo e a agenda própria de especialista.
 *  Deep-link por ?visao= — notificações de trilha esp podem pousar direto. */
function AbasAgenda({ ativa }: { ativa: "dpp" | "especialista" }) {
  return (
    <nav
      aria-label="Visão da agenda"
      className="scroll-fina flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1"
    >
      {(
        [
          // o param explícito é obrigatório — sem ele o default recai na
          // visão do papel primário e a aba DPP fica inalcançável pro
          // híbrido com primário especialista
          ["dpp", "Ciclo DPP", "/agenda?visao=dpp"],
          ["especialista", "Especialista", "/agenda?visao=especialista"],
        ] as const
      ).map(([v, label, href]) => (
        <Link
          key={v}
          href={href}
          aria-current={ativa === v ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors sm:min-h-8",
            ativa === v
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Abas da agenda da coordenação (WP5) — "Monitoramento" é a aterrissagem;
 *  o calendário oficial fica a uma aba de distância (?aba=calendario e os
 *  deep-links ?dia= abrem nele). */
function AbasAgendaCoord({
  ativa,
}: {
  ativa: "monitoramento" | "calendario";
}) {
  return (
    <div
      role="tablist"
      aria-label="Modos da agenda"
      className="scroll-fina flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1"
    >
      {(
        [
          ["monitoramento", "Monitoramento", "/agenda"],
          ["calendario", "Calendário", "/agenda?aba=calendario"],
        ] as const
      ).map(([v, label, href]) => (
        <Link
          key={v}
          role="tab"
          aria-selected={ativa === v}
          href={href}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors sm:min-h-8",
            ativa === v
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

/** Modos da agenda do mentor DPP (WP3) — segundo nível, dentro da visão DPP.
 *  Link + role=tablist/tab: deep-link por ?aba= (notificação pode pousar na
 *  aba certa) sem roubar o nome acessível "Visão da agenda" do nav do
 *  híbrido (WP6b). No híbrido os links carregam ?visao=dpp — sem ele a
 *  aba DPP volta a ficar inalcançável pra quem tem primário especialista. */
function AbasAgendaMentor({
  ativa,
  hibrido,
}: {
  ativa: "minha" | "por-mentorado" | "calendario";
  hibrido: boolean;
}) {
  const base = hibrido ? "/agenda?visao=dpp&aba=" : "/agenda?aba=";
  return (
    <div
      role="tablist"
      aria-label="Modos da agenda"
      className="scroll-fina flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1"
    >
      {(
        [
          ["minha", "Minha agenda"],
          ["por-mentorado", "Por mentorado"],
          ["calendario", "Calendário"],
        ] as const
      ).map(([v, label]) => (
        <Link
          key={v}
          role="tab"
          aria-selected={ativa === v}
          href={`${base}${v}`}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors sm:min-h-8",
            ativa === v
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
