import type { Metadata } from "next";
import {
  CalendarBlank,
  ClockCounterClockwise,
  Sparkle,
  SunHorizon,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import {
  type AvaliacaoFeita,
  type AvaliacaoPendente,
} from "@/components/jovem-avaliacoes";
import {
  JovemParaFazer,
  type EncontroCtx,
} from "@/components/jovem-para-fazer";
import { EncontroLinha } from "@/components/jovem-encontro-linha";
import { JovemAgendarDialog } from "@/components/jovem-agendar-dialog";
import { JovemAgendarSugestao } from "@/components/jovem-agendar-sugestao";
import { JovemRetroativoDialog } from "@/components/jovem-retroativo-dialog";
import { PedidoJovemMesa } from "@/components/jovem-pedido-item";
import {
  JovemEspSlots,
  PedirEspecialistaDialog,
} from "@/components/pedir-especialista-dialog";
import { JovemHistorico } from "@/components/jovem-historico";
import {
  formatDate,
  formatMesAnoLongo,
  maxEncontros,
  passoEsp,
  rotuloPasso,
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
import type { JovemEncontro } from "@/lib/queries-jovem";
import { combinadoDoJovem } from "@/lib/plano-combinado";
import { PlanoAcordosCard } from "@/components/plano-acordos";
import type { Disponibilidade } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Agenda" };

/** Agenda do jovem (REALIZA-108 + 110) — a agenda DELE: os encontros das
 *  duplas dele, lidos por projeção explícita (RLS escopa; registros/notas
 *  do mentor nunca entram). A agenda livre é o D3: agendar/remarcar DPP e
 *  desmarcar/"não aconteceu" em qualquer trilha passam pelas RPCs definer
 *  da 0072 — nenhum write do jovem é policy. */

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
        null;
      const primeiro = nome?.split(" ")[0] ?? null;
      return [
        d.id!,
        {
          // `quem` entra inteiro depois de "com"/"de" — primeiro nome ou a
          // frase de fallback, nunca os dois truncados igual ("com seu")
          nome: nome ?? "seu especialista",
          primeiro,
          quem: primeiro ?? "seu especialista",
          deQuem: primeiro ? `de ${primeiro}` : "do seu especialista",
          avatar_path: contato?.avatar_path ?? d.mentor_avatar_path,
          wa: waLink(
            contato?.whatsapp,
            `Olá${primeiro ? `, ${primeiro}` : ""}! Sou ${primeiroNome}, seu/sua mentorado(a). Quero combinar nosso próximo encontro.`
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
  // o passo realizado por passo do guia — a tentativa falha que foi
  // remarcada e rolou mostra "a sessão rolou em…" na linha (o "Não
  // aconteceu" sozinho leria como buraco na trilha)
  const realizadoPorPassoEsp = new Map<string, string>();
  for (const e of encontros) {
    if (
      trilhaPorDupla.get(e.dupla_id) !== "especialista" ||
      e.status !== "realizado" ||
      e.realizado_em == null
    )
      continue;
    const passo = passoPorEncontroEsp.get(e.id);
    if (passo != null)
      realizadoPorPassoEsp.set(`${e.dupla_id}:${passo}`, e.realizado_em);
  }
  const notaSessaoCoberta = (e: JovemEncontro): string | null => {
    if (trilhaPorDupla.get(e.dupla_id) !== "especialista") return null;
    if (e.status !== "nao_aconteceu" && e.status !== "cancelado") return null;
    const quando = realizadoPorPassoEsp.get(
      `${e.dupla_id}:${passoPorEncontroEsp.get(e.id) ?? -1}`
    );
    return quando ? `a sessão rolou em ${formatDate(quando)}` : null;
  };
  // rótulo canônico da linha (492): "Sessão N com Sofia" na trilha de
  // especialista (passo do guia, nunca a tentativa), "Nº encontro" no DPP
  const rotuloDaLinha = (e: JovemEncontro): string =>
    rotuloPasso({
      esp: trilhaPorDupla.get(e.dupla_id) === "especialista",
      numero:
        trilhaPorDupla.get(e.dupla_id) === "especialista"
          ? (passoPorEncontroEsp.get(e.id) ?? e.numero)
          : e.numero,
      com:
        trilhaPorDupla.get(e.dupla_id) === "especialista"
          ? (espPorDupla.get(e.dupla_id)?.quem ?? "seu especialista")
          : null,
    });

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
  // o mesmo pacote alimenta o cartão do agendar e as linhas do combinado
  // (482): com plano vivo e sem nº livre ainda faz falta pras linhas
  const sugestoesAgendar =
    duplaDpp?.id != null && (numeroAgendar != null || planoJovem != null)
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
      rotulo: rotuloDaLinha(e),
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
        comQuem: nomeDaDupla(e.dupla_id, sessao),
      };
    }),
    avaliacoes: avaliacoesPendentes.map((p) => ({
      id: p.encontroId,
      rotulo: p.rotulo,
      realizadoEm: p.realizado_em,
      sessao: p.trilha === "especialista",
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
                numeroPadrao={numeroAgendar ?? undefined}
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
        <Card id="plano" className="scroll-mt-20">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-base font-semibold">O combinado</h2>
            <p className="text-sm text-muted-foreground">
              O plano pra colocar vocês em dia. Ele começa a valer quando
              você e seu mentor aceitarem; depois é confirmar as datas
              juntos.
            </p>
            <PlanoAcordosCard
              plano={combinadoDoJovem(planoJovem)}
              podeResponder
              podeAplicar
              meuLado="mentorado"
              nomes={{
                mentor:
                  contatos.find(
                    (c) =>
                      c.papel === "mentor" &&
                      (c.dupla_id === duplaDpp?.id || c.dupla_id == null)
                  )?.nome?.split(" ")[0] ?? "Seu mentor",
                mentorado: primeiroNome || "Você",
              }}
              realizados={encontros
                .filter(
                  (e) =>
                    e.dupla_id === duplaDpp?.id && e.status === "realizado"
                )
                .map((e) => e.numero)}
              sugestoes={sugestoesAgendar}
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
                          Horários {esp.deQuem}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sessões de 1h · escolhe um horário e manda o pedido.
                          Quando {esp.quem} aceitar, a sessão aparece
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
                          {esp.primeiro ?? "Seu especialista"} ainda não
                          abriu horários livres. Pede por aqui que quem
                          aceita propõe um com você
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
                              Pedir sessão com {esp.quem}
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
                        ocupados={ocupadosRotulados}
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
                      rotulo={rotuloDaLinha(e)}
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
              {/* 488: denso e por mês — os 5 mais recentes + "ver
                  histórico completo"; chips de origem só quando as duas
                  trilhas convivem na lista */}
              <JovemHistorico
                itens={passados.map((e) => {
                  const quando =
                    e.status === "realizado" && e.realizado_em
                      ? e.realizado_em
                      : e.data_hora;
                  return {
                    id: e.id,
                    trilha: trilhaPorDupla.get(e.dupla_id) ?? "dpp",
                    mes: quando
                      ? formatMesAnoLongo(quando)
                      : "Sem data",
                    node: (
                      <EncontroLinha
                        e={e}
                        aval={avalDe(e)}
                        agora={agora}
                        duplaAtiva={
                          ativaPorDupla.get(e.dupla_id) ?? false
                        }
                        trilha={trilhaPorDupla.get(e.dupla_id) ?? "dpp"}
                        rotulo={rotuloDaLinha(e)}
                        nota={notaSessaoCoberta(e)}
                        meId={me?.id ?? null}
                      />
                    ),
                  };
                })}
                rodape={
                  /* retroativo só com passo elegível (QW1): sem candidato
                     o link prometia um gesto que a RPC recusaria */
                  duplaDpp?.id && numerosRetro.length > 0 ? (
                    <div className="px-4 py-1.5 sm:px-5">
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
                  ) : null
                }
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}


