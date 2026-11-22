import type { Metadata } from "next";
import {
  CalendarBlank,
  CalendarDots,
  CheckCircle,
  ClockCounterClockwise,
  Sparkle,
  SunHorizon,
  VideoCamera,
  WhatsappLogo,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import {
  VerAvaliacaoButton,
  type AvaliacaoFeita,
  type AvaliacaoPendente,
} from "@/components/jovem-avaliacoes";
import {
  JovemParaFazer,
  type EncontroCtx,
} from "@/components/jovem-para-fazer";
import { JovemAgendarDialog } from "@/components/jovem-agendar-dialog";
import { JovemAgendarSugestao } from "@/components/jovem-agendar-sugestao";
import { JovemRetroativoDialog } from "@/components/jovem-retroativo-dialog";
import { EditarLinkDialog } from "@/components/editar-link-dialog";
import {
  DesmarcarEncontroJovem,
  DesfazerRetroativoJovem,
} from "@/components/jovem-encontro-acoes";
import { PedidoJovemMesa } from "@/components/jovem-pedido-item";
import {
  JovemEspSlots,
  PedirEspecialistaDialog,
} from "@/components/pedir-especialista-dialog";
import { Estrelas } from "@/components/estrelas";
import {
  formatDateTime,
  linkSeguro,
  maxEncontros,
  passoEsp,
  podeEntrarAgora,
  toDateStr,
  waLink,
} from "@/lib/ciclo";
import {
  efetivoDe,
  pedidoAbertoComEsp,
  resumoPedidoJovem,
} from "@/lib/jovem-especialista";
import { avatarPublicUrl } from "@/lib/avatar";
import {
  getJovemContatos,
  getJovemDuplas,
  getJovemEncontros,
  getJovemJornada,
  getJovemPedidosEspecialista,
  getJovemPerfil,
  getJovemPlano,
  getJovemRecessos,
} from "@/lib/queries-jovem";
import { datasOficiaisDe } from "@/lib/jornada";
import { derivarPendencias } from "@/lib/pendencias-jovem";
import {
  ocupadosDoJovem,
  sugestoesEncontroDaDupla,
} from "@/lib/sugestoes-encontro-server";
import { getSlotsLivres } from "@/lib/queries-especialista";
import { getMe } from "@/lib/queries";
import { getJovemAvaliacoes } from "@/lib/queries-avaliacao";
import type { JovemEncontro, JovemPlano } from "@/lib/queries-jovem";
import {
  PlanoAcordosCard,
  type PlanoCombinado,
} from "@/components/plano-acordos";
import type { Disponibilidade } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Agenda" };

/** Agenda do jovem (REALIZA-108 + 110) — a agenda DELE: os encontros das
 *  duplas dele, lidos por projeção explícita (RLS escopa; registros/notas
 *  do mentor nunca entram). A agenda livre é o D3: agendar/remarcar DPP e
 *  desmarcar/"não aconteceu" em qualquer trilha passam pelas RPCs definer
 *  da 0072 — nenhum write do jovem é policy. */

const STATUS = {
  agendado: { rotulo: "Agendado", cls: "border-border text-muted-foreground" },
  remarcado: {
    rotulo: "Remarcado",
    cls: "border-[var(--warn)]/50 text-[var(--warn-text)]",
  },
  realizado: {
    rotulo: "Aconteceu",
    cls: "border-[var(--ok)]/50 text-[var(--ok-text)]",
  },
  nao_aconteceu: {
    rotulo: "Não aconteceu",
    cls: "border-border text-muted-foreground",
  },
  cancelado: { rotulo: "Cancelado", cls: "border-border text-muted-foreground" },
} as const;

export default async function JovemAgenda() {
  const [
    encontros,
    avaliacoes,
    me,
    duplas,
    contatos,
    pedidosEsp,
    perfil,
    jornada,
    recessosJovem,
    planoJovem,
  ] = await Promise.all([
    getJovemEncontros(),
    getJovemAvaliacoes(),
    getMe(),
    getJovemDuplas(),
    getJovemContatos(),
    getJovemPedidosEspecialista(),
    getJovemPerfil(),
    // além dos passos vencidos do retroativo (0208), a RPC é a auto-cura
    // da jornada — chamar na visita já dispara a emissão devida (0123)
    getJovemJornada().catch(() => null),
    getJovemRecessos(),
    getJovemPlano().catch(() => null),
  ]);
  const agora = new Date().getTime();
  const primeiroNome = (me?.nome_social || me?.nome || "").split(" ")[0];

  // avaliação estrela (0071) por encontro — a linha realizado mostra a
  // estrela já dada ("Ver resposta"); a que falta é pendência da seção
  // "Precisa de você". A trilha vem da view jovem_duplas — a tabela
  // `duplas` não é legível pro papel mentorado.
  const trilhaPorDupla = new Map(duplas.map((d) => [d.id, d.trilha ?? "dpp"]));
  const ativaPorDupla = new Map(duplas.map((d) => [d.id, d.status === "ativa"]));
  const avalPorEncontro = new Map(avaliacoes.map((a) => [a.encontro_id, a]));
  const avalDe = (e: JovemEncontro): AvaliacaoFeita | null => {
    if (e.status !== "realizado") return null;
    const a = avalPorEncontro.get(e.id);
    return a
      ? { ...a, trilha: trilhaPorDupla.get(a.dupla_id) ?? "dpp" }
      : null;
  };

  // CTA "Agendar encontro" — só a dupla DPP ativa entra (a RPC recusa a
  // trilha especialista). Os números livres são os sem row ainda: o Select
  // lista só o nº (a data oficial não é legível pro papel mentorado — a
  // RLS filtra o calendário a vazio); a RPC mede o teto real contra o
  // cronograma da dupla.
  const duplaDpp =
    duplas.find((d) => d.status === "ativa" && d.trilha !== "especialista") ??
    null;
  const ocupados = new Set(
    encontros.filter((e) => e.dupla_id === duplaDpp?.id).map((e) => e.numero)
  );
  const numerosLivres = duplaDpp
    ? Array.from({ length: maxEncontros("dpp") }, (_, i) => i + 1)
        .filter((n) => !ocupados.has(n))
        .map((n) => ({ numero: n }))
    : [];
  // retroativo (0207+0208): mesma lista de nº sem row, menos o último do
  // ciclo — e só passo oficial JÁ VENCIDO (a data do cronograma passou; a
  // RPC recusa os dois casos também). O cronograma chega pela jovem_jornada
  // — mesma cautela do acervo: vale se for desta mesma dupla.
  const oficiaisRetro =
    jornada != null && jornada.dupla_id === duplaDpp?.id
      ? datasOficiaisDe(jornada.cronograma)
      : [];
  const vencidosRetro = new Set(
    oficiaisRetro
      .filter((e) => e.data <= toDateStr(new Date()))
      .map((e) => e.numero)
  );
  const numerosRetro = numerosLivres
    .map((x) => x.numero)
    .filter((n) => n < maxEncontros("dpp") && vencidosRetro.has(n));

  // trilha especialista (111+112): a agenda real do especialista chega como
  // PROJEÇÃO de slots (especialista_slots_livres — timestamptz pronto) e
  // cada slot é um "pedir esse horário" — a sessão só nasce quando o
  // especialista aceita (RPC 0074). Um pedido em aberto pro mesmo
  // especialista substitui os chips: a dedup é do banco, a UI mostra a mesa.
  const duplasEsp = duplas.filter(
    (d) =>
      d.status === "ativa" && d.trilha === "especialista" && d.mentor_id != null
  );
  const slotsEsp = new Map(
    (
      await Promise.all(duplasEsp.map((d) => getSlotsLivres(d.mentor_id!)))
    ).map((slots, i) => [duplasEsp[i].id!, slots] as const)
  );
  const trilhasAtivasEsp = duplas
    .filter(
      (d) =>
        d.trilha === "especialista" &&
        (d.status === "ativa" || d.status === "pausada") &&
        d.mentor_id != null
    )
    .map((d) => d.mentor_id!);
  const equipeCoord = contatos.filter((c) => c.papel === "coordenacao");
  const nomeTela = (me?.nome_social || me?.nome || "").split(" ")[0];
  // a grade do jovem marca nos chips/slots do especialista os horários que
  // encaixam nela ("encaixa com você" — mesma régua da mesa de negociação)
  const dispJovem =
    (perfil?.disponibilidade as Disponibilidade | null | undefined) ?? null;
  const espPorDupla = new Map(
    duplasEsp.map((d) => {
      // a view rotula por trilha desde a 0076: na dupla esp o contato do
      // titular chega como 'especialista' ('mentor' é o papel da DPP)
      const contato = contatos.find(
        (c) =>
          c.dupla_id === d.id &&
          (c.papel === "especialista" || c.papel === "mentor")
      );
      const nome =
        contato?.nome_social ||
        contato?.nome ||
        d.mentor_nome_social ||
        d.mentor_nome ||
        "seu especialista";
      return [
        d.id!,
        {
          nome,
          primeiro: nome.split(" ")[0],
          avatar_path: contato?.avatar_path ?? d.mentor_avatar_path,
          wa: waLink(
            contato?.whatsapp,
            `Olá, ${nome.split(" ")[0]}! Sou ${primeiroNome}, seu/sua mentorado(a). Quero combinar nosso próximo encontro.`
          ),
        },
      ] as const;
    })
  );
  // passo da sessão = rank do encontro entre os realizados da MESMA dupla
  // (e.numero é a tentativa — a 3ª tentativa pode ser a 2ª sessão; "Sessão N"
  // é o passo do guia). Só computa pras trilhas esp — o DPP usa o oficial.
  const passoPorEncontroEsp = new Map(
    encontros
      .filter((e) => trilhaPorDupla.get(e.dupla_id) === "especialista")
      .map((e) => [
        e.id,
        passoEsp(
          e,
          encontros.filter((x) => x.dupla_id === e.dupla_id)
        ),
      ])
  );
  const rotuloSessao = (e: JovemEncontro) =>
    `Sessão ${passoPorEncontroEsp.get(e.id) ?? e.numero} com ${espPorDupla.get(e.dupla_id)?.primeiro ?? "seu especialista"}`;

  // "Precisa de você" (REALIZA-493): a mesma régua da home — o motor puro
  // ordena e a agenda só apresenta, com o recorte do que é da agenda
  // (encontro sem desfecho, retroativo e avaliação). Documentos/
  // combinados/avisos não entram aqui: a página não os busca.
  const nomeDaDupla = (duplaId: string, esp: boolean): string => {
    const contato = contatos.find(
      (c) =>
        c.dupla_id === duplaId &&
        (c.papel === "especialista" || c.papel === "mentor")
    );
    const dupla = duplas.find((d) => d.id === duplaId);
    const nome =
      contato?.nome_social ||
      contato?.nome ||
      dupla?.mentor_nome_social ||
      dupla?.mentor_nome ||
      "";
    return nome.split(" ")[0] || (esp ? "seu especialista" : "seu mentor");
  };

  // 481: o cartão "Próximo passo" troca o CTA de formulário vazio pela
  // recomendação do motor — o nº segue o critério da home (primeiro livre
  // depois do último realizado) e a régua de choque cobre TODAS as duplas,
  // incluindo a mesa de especialista no aceite
  const numeroAgendar =
    numerosLivres.find(
      (x) =>
        x.numero >
        Math.max(
          0,
          ...encontros
            .filter(
              (e) => e.dupla_id === duplaDpp?.id && e.status === "realizado"
            )
            .map((e) => e.numero)
        )
    )?.numero ??
    numerosLivres[0]?.numero ??
    null;
  const ocupadosRotulados = ocupadosDoJovem(encontros, duplas);
  const sugestoesAgendar =
    duplaDpp?.id != null && numeroAgendar != null
      ? await sugestoesEncontroDaDupla({
          encontros: encontros.filter((e) => e.dupla_id === duplaDpp.id),
          plano: planoJovem,
          duplaId: duplaDpp.id,
          agora: new Date(agora),
          ocupados: ocupadosRotulados,
        }).catch(() => null)
      : null;
  const avaliacoesPendentes: AvaliacaoPendente[] = encontros
    .filter((e) => e.status === "realizado" && !avalPorEncontro.has(e.id))
    .map((e) => ({
      encontroId: e.id,
      numero: e.numero,
      realizado_em: e.realizado_em,
      trilha: trilhaPorDupla.get(e.dupla_id) ?? "dpp",
      rotulo:
        trilhaPorDupla.get(e.dupla_id) === "especialista"
          ? rotuloSessao(e)
          : `${e.numero}º encontro`,
    }));
  const ctxPorEncontro: Record<string, EncontroCtx> = Object.fromEntries(
    encontros.map((e) => [
      e.id,
      {
        e,
        ativa: ativaPorDupla.get(e.dupla_id) ?? false,
        esp: trilhaPorDupla.get(e.dupla_id) === "especialista",
      },
    ])
  );
  const oficialPorNumero = new Map(
    oficiaisRetro.map((e) => [e.numero, e.data])
  );
  const pendencias = derivarPendencias({
    hoje: toDateStr(new Date()),
    agora: new Date(agora).toISOString(),
    encontros: encontros.map((e) => {
      const sessao = trilhaPorDupla.get(e.dupla_id) === "especialista";
      return {
        id: e.id,
        numero: sessao
          ? (passoPorEncontroEsp.get(e.id) ?? e.numero)
          : e.numero,
        status: e.status,
        dataHora: e.data_hora,
        sessao,
        comNome: nomeDaDupla(e.dupla_id, sessao),
      };
    }),
    avaliacoes: avaliacoesPendentes.map((p) => ({
      id: p.encontroId,
      rotulo: p.rotulo,
      realizadoEm: p.realizado_em,
    })),
    documentos: [],
    combinados: [],
    sugestoes: [],
    avisos: [],
    retro: numerosRetro.map((numero) => ({
      numero,
      duplaId: duplaDpp?.id ?? null,
      dataOficial: oficialPorNumero.get(numero) ?? null,
    })),
    chamados: [],
  });

  // futuros = agendado/remarcado com data pra frente; o resto é histórico
  // (inclui agendado já passado — "estava marcado e não rolou" é histórico,
  // não futuro)
  const futuros = encontros
    .filter(
      (e) =>
        (e.status === "agendado" || e.status === "remarcado") &&
        e.data_hora != null &&
        new Date(e.data_hora).getTime() >= agora
    )
    .sort(
      (a, b) =>
        new Date(a.data_hora!).getTime() - new Date(b.data_hora!).getTime()
    );
  const passados = encontros
    .filter((e) => !futuros.includes(e))
    .sort(
      (a, b) =>
        new Date(b.realizado_em ?? b.data_hora ?? 0).getTime() -
        new Date(a.realizado_em ?? a.data_hora ?? 0).getTime()
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Os encontros das suas mentorias. Vocês combinam as datas juntos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* o formulário vazio só sobra de rede de segurança: quando o
              motor não acha dia viável o cartão não promete e o diálogo
              antigo cobre o caminho raro */}
          {duplaDpp?.id &&
            numerosLivres.length > 0 &&
            !sugestoesAgendar?.principal && (
              <JovemAgendarDialog
                duplaId={duplaDpp.id}
                numeros={numerosLivres}
                atual={null}
              />
            )}
          {duplaDpp?.id && numerosRetro.length > 0 && (
            <JovemRetroativoDialog
              duplaId={duplaDpp.id}
              numeros={numerosRetro}
              trigger={
                <Button variant="outline" size="sm">
                  <ClockCounterClockwise size={15} aria-hidden />
                  Registrar encontro já realizado
                </Button>
              }
            />
          )}
        </div>
      </header>

      {/* 481: a sugestão concreta é o próximo passo da página — um toque
          marca; "Escolher outro dia" abre o seletor de chips */}
      {duplaDpp?.id != null &&
        numeroAgendar != null &&
        sugestoesAgendar?.principal && (
          <JovemAgendarSugestao
            duplaId={duplaDpp.id}
            numero={numeroAgendar}
            numeros={numerosLivres.map((x) => x.numero)}
            comQuem={nomeDaDupla(duplaDpp.id, false)}
            sugestoes={sugestoesAgendar}
          />
        )}

      {/* o que a agenda pede do jovem — a mesma lista da home, no recorte
          daqui (sem desfecho, retroativo, avaliação). Some quando não há
          pedido: a agenda segue sendo consulta */}
      {pendencias.length > 0 && (
        <JovemParaFazer
          titulo="Precisa de você"
          id="precisa-titulo"
          pendencias={pendencias}
          encontros={ctxPorEncontro}
          pendentes={avaliacoesPendentes}
          retro={{ duplaId: duplaDpp?.id ?? null, numeros: numerosRetro }}
          primeiroNome={primeiroNome}
        />
      )}

      {/* decisão de recesso declarada pela dupla (462): o combinado aparece
          na agenda dele sem abrir espaço pra gesto — declarar é do mentor */}
      {recessosJovem.some((r) => !r.usa) && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
            >
              <SunHorizon size={16} />
            </span>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Recesso do programa:
              </span>{" "}
              vocês combinaram seguir se encontrando. As datas vocês marcam
              com seu mentor, como sempre.
            </p>
          </CardContent>
        </Card>
      )}

      {/* o combinado do plano "ficar em dia" (459): chega pela
          jovem_plano, o recorte definer — aceitar e confirmar datas são
          gestos dele aqui, pela mesma RPC do mentor */}
      {planoJovem && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-base font-semibold">O combinado</h2>
            <p className="text-sm text-muted-foreground">
              O plano pra colocar vocês em dia. Aceitem e confirmem as
              datas juntos — vale pra você e pro seu mentor.
            </p>
            <PlanoAcordosCard
              plano={mapearPlanoJovem(planoJovem)}
              podeResponder
              podeAplicar
            />
          </CardContent>
        </Card>
      )}

      {duplasEsp.length > 0 && (
        <section aria-labelledby="agenda-esp" className="space-y-2">
          <h2
            id="agenda-esp"
            className="text-base font-semibold"
          >
            Mentoria especializada
          </h2>
          <div className="grid gap-3">
            {duplasEsp.map((d) => {
              const esp = espPorDupla.get(d.id!)!;
              const slots = slotsEsp.get(d.id!) ?? [];
              // a dedup do banco é por par — se já tem pedido em aberto pra
              // esse especialista, a mesa aparece no lugar dos chips
              const pedido = pedidoAbertoComEsp(
                pedidosEsp.solicitacoes,
                d.mentor_id
              );
              return (
                <Card key={d.id}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar
                        nome={esp.nome}
                        src={
                          esp.avatar_path
                            ? avatarPublicUrl(esp.avatar_path)
                            : null
                        }
                        size={40}
                      />
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="truncate text-sm font-medium">
                          Horários de {esp.primeiro}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sessões de 1h · escolhe um horário e manda o pedido.
                          Quando {esp.primeiro} aceitar, a sessão aparece
                          aqui na agenda.
                        </p>
                      </div>
                      {esp.wa && (
                        <a
                          href={esp.wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Chamar ${esp.nome} no WhatsApp`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "shrink-0"
                          )}
                        >
                          <WhatsappLogo size={15} aria-hidden />
                          <span className="hidden sm:inline">WhatsApp</span>
                          <span className="sr-only"> (abre em nova aba)</span>
                        </a>
                      )}
                    </div>
                    {pedido ? (
                      <div className="space-y-2 border-t border-border/60 pt-3">
                        <p className="text-xs text-muted-foreground">
                          {resumoPedidoJovem(efetivoDe(pedido), esp.primeiro)}
                        </p>
                        <PedidoJovemMesa
                          s={pedido}
                          propostas={pedidosEsp.propostas[pedido.id] ?? []}
                          slots={slots}
                          meuId={me?.id ?? ""}
                          equipe={equipeCoord}
                          nomeJovem={nomeTela}
                          disponibilidade={dispJovem}
                          ocupados={ocupadosRotulados}
                        />
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {esp.primeiro} ainda não abriu horários livres.
                          Pede por aqui que quem aceita propõe um com você
                          {esp.wa ? ", ou chama no WhatsApp" : ""}.
                        </p>
                        <PedirEspecialistaDialog
                          especialistas={pedidosEsp.catalogo}
                          trilhasAtivas={trilhasAtivasEsp}
                          slotsPorEsp={{ [d.mentor_id!]: slots }}
                          preEspId={d.mentor_id}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Sparkle size={15} aria-hidden />
                              Pedir sessão com {esp.primeiro}
                            </Button>
                          }
                        />
                      </div>
                    ) : (
                      <JovemEspSlots
                        espId={d.mentor_id!}
                        slots={slots}
                        especialistas={pedidosEsp.catalogo}
                        trilhasAtivas={trilhasAtivasEsp}
                        slotsPorEsp={{ [d.mentor_id!]: slots }}
                        disponibilidade={dispJovem}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {encontros.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2.5 py-10 text-center text-sm text-muted-foreground">
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <CalendarBlank size={18} aria-hidden />
            </span>
            <p>
              Nenhum encontro por aqui ainda. Quando a dupla marcar o
              primeiro, ele aparece nesta agenda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {futuros.length > 0 && (
            <section aria-labelledby="agenda-proximos" className="space-y-2">
              <h2
                id="agenda-proximos"
                className="text-base font-semibold"
              >
                Próximos
              </h2>
              <Card>
                <CardContent className="divide-y divide-border/60 p-0">
                  {futuros.map((e) => (
                    <EncontroLinha
                      key={e.id}
                      e={e}
                      futuro
                      agora={agora}
                      duplaAtiva={ativaPorDupla.get(e.dupla_id) ?? false}
                      trilha={trilhaPorDupla.get(e.dupla_id) ?? "dpp"}
                      rotuloEsp={rotuloSessao(e)}
                    />
                  ))}
                </CardContent>
              </Card>
            </section>
          )}
          {passados.length > 0 && (
            <section aria-labelledby="agenda-historico" className="space-y-2">
              <h2
                id="agenda-historico"
                className="text-base font-semibold"
              >
                Histórico
              </h2>
              <Card>
                <CardContent className="divide-y divide-border/60 p-0">
                  {passados.map((e) => (
                    <EncontroLinha
                      key={e.id}
                      e={e}
                      aval={avalDe(e)}
                      agora={agora}
                      duplaAtiva={ativaPorDupla.get(e.dupla_id) ?? false}
                      trilha={trilhaPorDupla.get(e.dupla_id) ?? "dpp"}
                      rotuloEsp={rotuloSessao(e)}
                      meId={me?.id ?? null}
                    />
                  ))}
                  {/* retroativo só com passo elegível (QW1): sem candidato
                      o link prometia um gesto que a RPC recusaria */}
                  {duplaDpp?.id && numerosRetro.length > 0 && (
                    <div className="px-4 py-1.5 sm:px-6">
                      <JovemRetroativoDialog
                        duplaId={duplaDpp.id}
                        numeros={numerosRetro}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2.5"
                          >
                            <ClockCounterClockwise size={15} aria-hidden />
                            Encontro que não aparece aqui?
                          </Button>
                        }
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function EncontroLinha({
  e,
  futuro = false,
  aval,
  agora,
  duplaAtiva = false,
  trilha = "dpp",
  rotuloEsp,
  meId,
}: {
  e: JovemEncontro;
  futuro?: boolean;
  /** A avaliação que já saiu — "Ver resposta" com as estrelas. A pendente
   *  não entra: pedir avaliação é da lista "Precisa de você" (REALIZA-493),
   *  sem duplicar o gesto na linha. */
  aval?: AvaliacaoFeita | null;
  /** ms do render da página — o "futuro" do gesto é o da listagem, não o do
   *  clique; a RPC reavalia o instante real de qualquer jeito */
  agora: number;
  /** A RPC de agendar/não-aconteceu exige dupla ativa; desmarcar não checa,
   *  mas um gesto numa dupla encerrada seria ruído — os botões seguem ela. */
  duplaAtiva?: boolean;
  /** agendar_encontro_mentorado é DPP-only (0072): na trilha de especialista
   *  quem marca é o especialista — o botão de remarcar não renderiza pra não
   *  prometer um gesto que a RPC recusaria. Desmarcar/"não aconteceu" valem
   *  em qualquer trilha e seguem aparecendo. */
  trilha?: string;
  /** rótulo "Sessão N com Fulana" — o passo vem do caller (rank entre
   *  realizados; e.numero é tentativa). Distinção DPP×esp na listagem
   *  mista (0097: antes eram dois "3º encontro" indistinguíveis). */
  rotuloEsp?: string;
  /** profile do jovem logado — casa com created_by pra liberar Corrigir/
   *  Desfazer no retroativo criado por ele (0207). */
  meId?: string | null;
}) {
  const st = STATUS[e.status];
  const quando = e.status === "realizado" && e.realizado_em ? e.realizado_em : e.data_hora;
  // agendado futuro = remarcar/desmarcar (0072). O agendado já passado não
  // ganha gesto aqui — virou pendência da lista "Precisa de você"; na linha
  // fica só a pergunta honesta do badge. Só status 'agendado' — é o único
  // que as RPCs movem (remarcado/legado não ganha botão: recusariam)
  const agendadoFuturo =
    e.status === "agendado" &&
    duplaAtiva &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() > agora;
  // QW4: "agendado" com o horário vencido não é mais um plano — é uma
  // pendência. A badge pergunta, a ação mora na seção do topo.
  const passadoSemDesfecho =
    e.status === "agendado" &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() <= agora;
  // retroativo do jovem (0207): o realizado que ELE criou é editável
  // (corrigir data) e desfazível enquanto o mentor não registra — o gate
  // de verdade mora na RPC; aqui o affordance é por autoria
  const retroDele =
    e.status === "realizado" &&
    duplaAtiva &&
    trilha !== "especialista" &&
    meId != null &&
    e.created_by === meId;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          e.status === "realizado"
            ? "bg-[var(--ok)]/15 text-[var(--ok-text)]"
            : e.status === "nao_aconteceu" || e.status === "cancelado"
              ? "bg-muted text-muted-foreground"
              : "bg-[var(--role-mentorado)]/25 text-foreground"
        )}
      >
        {e.status === "realizado" ? (
          <CheckCircle size={16} aria-hidden />
        ) : e.status === "nao_aconteceu" || e.status === "cancelado" ? (
          <XCircle size={16} aria-hidden />
        ) : (
          <CalendarBlank size={16} aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-medium">
          {trilha === "especialista" && rotuloEsp
            ? rotuloEsp
            : `${e.numero}º encontro`}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {quando ? formatDateTime(quando) : "data a combinar"}
        </p>
        {e.motivo_reagendamento && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Por que mudou: {e.motivo_reagendamento}
          </p>
        )}
      </div>
      <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
        {/* Entrar é a ação decisiva só na janela da chamada (QW5: 30 min
            antes até 2 h depois — mesma régua da home e da ficha). Fora
            dela o link segue acessível, mas discreto. */}
        {futuro &&
          linkSeguro(e.link) &&
          (podeEntrarAgora(e.data_hora, agora) ? (
            <a
              href={linkSeguro(e.link)!}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              <VideoCamera size={15} aria-hidden />
              Entrar
              <span className="sr-only"> na chamada (abre em nova aba)</span>
            </a>
          ) : (
            <a
              href={linkSeguro(e.link)!}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <VideoCamera size={15} aria-hidden />
              Link da chamada
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          ))}
        {/* o lápis troca só o link e só em agendado futuro (a action roteia
            o jovem pela RPC da 0072, DPP-only — ela recusa a linha já
            vencida) */}
        {agendadoFuturo && trilha !== "especialista" && (
          <EditarLinkDialog encontroId={e.id} linkAtual={e.link} />
        )}
        {agendadoFuturo && (
          <>
            {trilha !== "especialista" && (
              <JovemAgendarDialog
                duplaId={e.dupla_id}
                numero={e.numero}
                atual={e}
                trigger={
                  <Button variant="outline" size="sm">
                    <CalendarDots size={15} aria-hidden />
                    Remarcar
                  </Button>
                }
              />
            )}
            <DesmarcarEncontroJovem encontroId={e.id} />
          </>
        )}
        {aval && (
          <VerAvaliacaoButton
            avaliacao={aval}
            label={<Estrelas n={aval.estrelas} size={13} />}
          />
        )}
        {retroDele && (
          <>
            <JovemRetroativoDialog
              duplaId={e.dupla_id}
              atual={e}
              trigger={
                <Button variant="ghost" size="sm">
                  Corrigir
                </Button>
              }
            />
            <DesfazerRetroativoJovem encontroId={e.id} />
          </>
        )}
        {/* QW4: o vencido pergunta "Aconteceu?" (warn — é pendência, não
            estado), o realizado não carimba "Aconteceu" de novo (ser o que
            é já basta) e os demais seguem a tabela de status */}
        {e.status === "realizado" ? null : passadoSemDesfecho ? (
          <Badge
            variant="outline"
            className="border-[var(--warn)]/50 text-[var(--warn-text)]"
          >
            Aconteceu?
          </Badge>
        ) : (
          <Badge variant="outline" className={st.cls}>
            {st.rotulo}
          </Badge>
        )}
      </div>
    </div>
  );
}


/** Recorte da jovem_plano → a projeção que o card do combinado lê
 *  (PlanoCombinado) — a RPC já devolve sem semáforo/motivos; aqui só
 *  muda a forma (ritmo vem texto do jsonb, passos aplicados achatam). */
function mapearPlanoJovem(p: JovemPlano): PlanoCombinado {
  return {
    id: p.id,
    status: p.status,
    versao: p.versao,
    aprovado_lado: p.aprovado_lado,
    escopo: {
      ritmo: p.ritmo == null ? null : Number(p.ritmo) || null,
      passos: (p.passos ?? []).map((s) => ({
        numero: s.numero,
        data: s.data,
        acao: s.acao,
      })),
    },
    passos: (p.passos_aplicados ?? []).map((s) => ({
      numero: s.numero,
      data_nova: s.data_nova,
    })),
  };
}
