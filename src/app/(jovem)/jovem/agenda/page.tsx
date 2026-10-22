import type { Metadata } from "next";
import {
  CalendarBlank,
  CalendarDots,
  CheckCircle,
  Sparkle,
  VideoCamera,
  WhatsappLogo,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import {
  AvaliarPendenteButton,
  VerAvaliacaoButton,
  type AvaliacaoFeita,
  type AvaliacaoPendente,
} from "@/components/jovem-avaliacoes";
import { JovemAgendarDialog } from "@/components/jovem-agendar-dialog";
import { EditarLinkDialog } from "@/components/editar-link-dialog";
import {
  DesmarcarEncontroJovem,
  NaoAconteceuJovem,
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
  getJovemPedidosEspecialista,
  getJovemPerfil,
} from "@/lib/queries-jovem";
import { getSlotsLivres } from "@/lib/queries-especialista";
import { getMe } from "@/lib/queries";
import { getJovemAvaliacoes } from "@/lib/queries-avaliacao";
import type { JovemEncontro } from "@/lib/queries-jovem";
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
  const [encontros, avaliacoes, me, duplas, contatos, pedidosEsp, perfil] =
    await Promise.all([
      getJovemEncontros(),
      getJovemAvaliacoes(),
      getMe(),
      getJovemDuplas(),
      getJovemContatos(),
      getJovemPedidosEspecialista(),
      getJovemPerfil(),
    ]);
  const agora = new Date().getTime();
  const primeiroNome = (me?.nome_social || me?.nome || "").split(" ")[0];

  // avaliação estrela (0071) por encontro — a linha realizado ganha o CTA
  // "Avaliar" (pendente) ou a estrela que já foi dada (ver resposta). A
  // trilha vem da view jovem_duplas — a tabela `duplas` não é legível pro
  // papel mentorado.
  const trilhaPorDupla = new Map(duplas.map((d) => [d.id, d.trilha ?? "dpp"]));
  const ativaPorDupla = new Map(duplas.map((d) => [d.id, d.status === "ativa"]));
  const avalPorEncontro = new Map(avaliacoes.map((a) => [a.encontro_id, a]));
  const avalDe = (
    e: JovemEncontro
  ): { pendente: AvaliacaoPendente | null; feita: AvaliacaoFeita | null } => {
    if (e.status !== "realizado") return { pendente: null, feita: null };
    const a = avalPorEncontro.get(e.id);
    if (a)
      return {
        pendente: null,
        feita: { ...a, trilha: trilhaPorDupla.get(a.dupla_id) ?? "dpp" },
      };
    return {
      pendente: {
        encontroId: e.id,
        numero: e.numero,
        realizado_em: e.realizado_em,
        trilha: trilhaPorDupla.get(e.dupla_id) ?? "dpp",
      },
      feita: null,
    };
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
  const semDuplaDpp = !duplas.some(
    (d) => d.trilha !== "especialista" && d.status === "ativa"
  );
  const waCoord = waLink(
    contatos.find((c) => c.papel === "coordenacao")?.whatsapp,
    `Olá! Sou ${me?.nome_social || me?.nome || ""}, mentorado(a) do programa, e preciso falar com a equipe.`
  );
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
            `Olá, ${nome.split(" ")[0]}! Sou ${primeiroNome}, seu/sua mentorado(a) — quero combinar nosso próximo encontro.`
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
            Os encontros das suas mentorias — vocês combinam as datas juntos.
          </p>
        </div>
        {duplaDpp?.id && numerosLivres.length > 0 && (
          <JovemAgendarDialog
            duplaId={duplaDpp.id}
            numeros={numerosLivres}
            atual={null}
          />
        )}
      </header>

      {duplasEsp.length > 0 && (
        <section aria-labelledby="agenda-esp" className="space-y-2">
          <h2
            id="agenda-esp"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
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
                          Sessões de 1h · escolhe um horário e manda o pedido
                          — quando {esp.primeiro} aceitar, a sessão aparece
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
                          waCoord={waCoord}
                          disponibilidade={dispJovem}
                        />
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {esp.primeiro} ainda não abriu horários livres —
                          pede por aqui que quem aceita propõe um com você
                          {esp.wa ? ", ou chama no WhatsApp" : ""}.
                        </p>
                        <PedirEspecialistaDialog
                          especialistas={pedidosEsp.catalogo}
                          trilhasAtivas={trilhasAtivasEsp}
                          slotsPorEsp={{ [d.mentor_id!]: slots }}
                          semDuplaDpp={semDuplaDpp}
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
                        semDuplaDpp={semDuplaDpp}
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
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
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
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
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
                      primeiroNome={primeiroNome}
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
        </>
      )}
    </div>
  );
}

function EncontroLinha({
  e,
  futuro = false,
  aval,
  primeiroNome,
  agora,
  duplaAtiva = false,
  trilha = "dpp",
  rotuloEsp,
}: {
  e: JovemEncontro;
  futuro?: boolean;
  aval?: { pendente: AvaliacaoPendente | null; feita: AvaliacaoFeita | null };
  primeiroNome?: string;
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
}) {
  const st = STATUS[e.status];
  const quando = e.status === "realizado" && e.realizado_em ? e.realizado_em : e.data_hora;
  // agendado futuro = remarcar/desmarcar (0072); já passado = "não aconteceu".
  // Só status 'agendado' — é o único que as RPCs movem (remarcado/legado não
  // ganha botão: a RPC recusaria de qualquer jeito)
  const agendadoFuturo =
    e.status === "agendado" &&
    duplaAtiva &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() > agora;
  const agendadoPassado =
    e.status === "agendado" &&
    duplaAtiva &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() <= agora;
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
              : "bg-[var(--role-mentorado)]/25 text-[var(--brand-ink)]"
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
        {futuro && linkSeguro(e.link) && (
          <a
            href={linkSeguro(e.link)!}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <VideoCamera size={15} aria-hidden />
            Entrar
            <span className="sr-only"> na chamada (abre em nova aba)</span>
          </a>
        )}
        {/* o lápis troca só o link (a action roteia o jovem pela RPC da
            0072, DPP-only). Em agendado já passado a RPC não escreve — o
            erro dela aponta o Remarcar ao lado, que edita data e link */}
        {(agendadoFuturo || agendadoPassado) && trilha !== "especialista" && (
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
        {/* agendado vencido também remarca (a RPC aceita fonte passada →
            alvo futuro) — "não aconteceu" não é a única saída do limbo */}
        {agendadoPassado && (
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
            <NaoAconteceuJovem encontroId={e.id} />
          </>
        )}
        {aval?.pendente && (
          <AvaliarPendenteButton
            pendente={aval.pendente}
            primeiroNome={primeiroNome ?? ""}
            variant="outline"
          />
        )}
        {aval?.feita && (
          <VerAvaliacaoButton
            avaliacao={aval.feita}
            label={<Estrelas n={aval.feita.estrelas} size={13} />}
          />
        )}
        <Badge variant="outline" className={st.cls}>
          {st.rotulo}
        </Badge>
      </div>
    </div>
  );
}

