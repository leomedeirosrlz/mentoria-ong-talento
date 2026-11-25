"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpenText, CalendarDots, Check, X, CalendarPlus } from "@phosphor-icons/react";
import {
  aplicarPassoPlano,
  aplicarSessaoPlano,
  responderPlano,
  responderPlanoComRecesso,
  type DecisaoRecesso,
} from "@/lib/actions-plano";
import { diaSemanaDe } from "@/lib/ciclo";
import {
  datasDoPasso,
  diaMes,
  estadoLeituraPlano,
  listaEncontros,
  planoContestavel,
  resumoCombinado,
  rotuloSessao,
  sessoesDoEscopo,
  sugestaoPasso,
  type PlanoCombinado,
  type SugestaoPasso,
} from "@/lib/plano-combinado";
import { DURACAO_SESSAO_MIN } from "@/lib/plano-em-dia.data";
import {
  partesSP,
  type OcupadoRotulado,
} from "@/lib/sugestoes-encontro";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AcoesMenu } from "@/components/acoes-menu";
import {
  SeletorDiaHora,
  ddmm,
  type SeletorSugestoes,
} from "@/components/seletor-dia-hora";
import {
  AceitesPlano,
  QuadradosCombinado,
} from "@/components/plano-em-dia-pecas";
import {
  RecessoDecisao,
  type RecessoDaFicha,
} from "@/components/recesso-dupla-card";

/** O que o card precisa do plano — a projeção mínima comum ao embed da
 *  ficha (DuplaPlano) e ao recorte do jovem (jovem_plano), compartilhada
 *  com os banners das homes em plano-combinado. */
export type { PlanoCombinado };

/** "ter 01/12 às 19:00" de um par civil — a gramática da linha e do
 *  sucesso ("Marcado pra…"). */
const rotuloPasso = (data: string, hora: string) =>
  `${diaSemanaDe(data)} ${ddmm(data)} às ${hora}`;

/** Card do plano "ficar em dia" persistido (0219 — REALIZA-459): o
 *  combinado, não a sugestão — status, versão, ritmo e os passos com as
 *  datas combinadas. A mesma peça serve a ficha (mentor/equipe) e a
 *  agenda do jovem: responder e aplicar passo passam pelas RPCs do
 *  plano, que validam lado e janela no banco.
 *
 *  482: cada passo vira uma linha "6º encontro · sugestão ter 01/12 às
 *  19:00 [Confirmar] [Outra data]" — a sugestão (data do passo + horário
 *  do histórico, 19:00 de padrão) vem pré-preenchida e "Outra data" abre
 *  o SeletorDiaHora compartilhado com o agendar (chips, nunca
 *  datetime-local); sem `sugestoes` cai no par date+time. No sucesso a
 *  própria linha vira "Marcado pra…", sem esperar o revalidate. */
export function PlanoAcordosCard({
  plano,
  duplaId,
  podeResponder,
  podeAplicar,
  meuLado = null,
  nomes,
  realizados = [],
  recessos = [],
  sugestoes,
  combinadoHref,
  whatsappHref,
}: {
  plano: PlanoCombinado;
  /** id da dupla pra revalidar a ficha — o jovem não tem, e não
   *  precisa: a RPC valida pelo plano. */
  duplaId?: string;
  /** mentor/jovem respondem; equipe só acompanha */
  podeResponder: boolean;
  /** aplicar passo = agendar data combinada — mentor e jovem */
  podeAplicar: boolean;
  /** Lado de quem lê (518): um aceite da dupla ativa o combinado, então
   *  "falta o seu" vs "você foi avisado" são estados diferentes. Sem ele
   *  o card não oferece responder (só lê). */
  meuLado?: "mentor" | "mentorado" | null;
  /** Primeiros nomes dos dois lados — os chips nomeiam quem respondeu
   *  e quem foi avisado. */
  nomes?: { mentor: string; mentorado: string };
  /** Números já realizados da dupla — a régua separa "feito" de
   *  "só tem data". */
  realizados?: readonly number[];
  /** Recessos no caminho do combinado (518, US3.5): na proposta a dupla
   *  pode repensar a resposta aqui — o aceite leva as decisões novas e
   *  recalcula se as datas mudarem. */
  recessos?: RecessoDaFicha[];
  /** Pacote do motor (perfil/grade/ocupados) — alimenta a sugestão da
   *  linha e os chips do "Outra data". Sem ele, date+time de step 900. */
  sugestoes?: SeletorSugestoes | null;
  /** Rota do documento do combinado (020) — "Ler o combinado" no card */
  combinadoHref?: string;
  /** deep link wa.me com template dinâmico (518) — sem provider */
  whatsappHref?: string | null;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [erroPasso, setErroPasso] = useState<{
    numero: number;
    texto: string;
  } | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [datas, setDatas] = useState<
    Record<number, { dia: string; hora: string }>
  >({});
  const [seletor, setSeletor] = useState<{
    numero: number;
    sessao: number;
    /** números da sessão combinada (018) — quando existe, o gesto
     *  carimba o grupo inteiro de uma vez */
    grupo?: number[];
  } | null>(null);
  const [marcados, setMarcados] = useState<
    Record<number, { data: string; hora: string }>
  >({});
  // respostas de recesso dadas nesta sessão — ganham da prop no aceite
  // (o revalidate demora um tiquinho e o gesto não pode viajar velho)
  const [decisaoLocal, setDecisaoLocal] = useState<Record<string, boolean>>(
    {}
  );
  const resumo = resumoCombinado(plano, realizados);
  const aberto = resumo.aberto;
  const aplicados = new Map(
    (plano.passos ?? []).map((p) => [p.numero, p])
  );
  // 018: os grupos de sessão combinada marcados no escopo — número →
  // números do grupo. O primeiro é a âncora, que carrega o gesto.
  const grupoPorNumero = new Map<number, number[]>();
  for (const nums of sessoesDoEscopo(plano.escopo?.passos ?? []).values())
    for (const n of nums) grupoPorNumero.set(n, nums);
  /** o grupo inteiro ainda sem data — só aí o gesto é da sessão; com um
   *  membro já marcado (não devia acontecer: a RPC carimba junto), cada
   *  pendente volta ao caminho individual */
  const grupoLivre = (g: readonly number[] | undefined): g is number[] =>
    g != null && g.every((n) => !aplicados.has(n) && !marcados[n]);
  const janela = plano.janela ?? plano.escopo?.janela ?? null;
  const hoje = sugestoes?.hoje ?? partesSP(new Date())?.data ?? "";
  // leitura 518 do plano por quem abre: proposta da equipe esperando a
  // dupla ("falta o seu"), combinado valendo sem o seu carimbo ("você
  // foi avisado") ou seguindo — um aceite ativa, nunca "faltam os dois"
  const estado = estadoLeituraPlano({
    status: plano.status,
    meuLado,
    aceites: resumo.aceites,
  });
  const nomeOutro =
    meuLado === "mentor"
      ? (nomes?.mentorado ?? "seu jovem")
      : (nomes?.mentor ?? "seu mentor");
  // 519: a contestação vale até um encontro do escopo acontecer de fato —
  // o botão some junto com a janela real em vez de prometer o que o
  // banco recusa
  const contestavel = planoContestavel(plano.escopo?.passos, realizados);
  const propostaPor =
    plano.proposto_via === "liza" ? "A Liza" : "A equipe";
  const statusTexto: Record<string, string> = {
    proposto: "Proposto, falta um aceite da dupla",
    aceito: "Valendo",
    ativo: "Em andamento",
    concluido: "Concluído",
    expirado: "Expirado",
    contestado: "Contestado",
  };

  const responder = (acao: "aceitar" | "contestar") => {
    setErro(null);
    // o aceite leva só o que a pessoa repensou aqui — reenviar a resposta
    // vigente regravaria declarado_por/em no banco e roubaria a autoria
    // de quem decidiu antes (519)
    const decisoes: DecisaoRecesso[] = recessos
      .filter(
        (r) =>
          decisaoLocal[r.cicloEventoId] != null &&
          decisaoLocal[r.cicloEventoId] !== r.usa
      )
      .map((r) => ({
        cicloEventoId: r.cicloEventoId,
        usa: decisaoLocal[r.cicloEventoId]!,
      }));
    iniciar(async () => {
      const r =
        acao === "aceitar" && decisoes.length > 0 && duplaId
          ? await responderPlanoComRecesso(
              plano.id,
              acao,
              decisoes,
              duplaId
            )
          : await responderPlano(plano.id, acao, undefined, duplaId);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      if (r.novaVersao)
        toast.success("Versão recalculada já vale.");
      router.refresh();
    });
  };

  const aplicar = (numero: number, data: string, hora: string) => {
    setErroPasso(null);
    iniciar(async () => {
      const r = await aplicarPassoPlano(
        plano.id,
        numero,
        `${data}T${hora}:00-03:00`,
        undefined,
        undefined,
        duplaId
      );
      if ("error" in r) {
        setErroPasso({ numero, texto: r.error });
        return;
      }
      setMarcados((m) => ({ ...m, [numero]: { data, hora } }));
      setEditando(null);
      setSeletor(null);
      router.refresh();
    });
  };

  // 018: a sessão combinada é um gesto só — todos os passos do grupo
  // ganham a mesma data/hora e o mesmo sessao_id numa RPC
  const aplicarSessao = (numeros: number[], data: string, hora: string) => {
    setErroPasso(null);
    iniciar(async () => {
      const r = await aplicarSessaoPlano(
        plano.id,
        numeros,
        `${data}T${hora}:00-03:00`,
        DURACAO_SESSAO_MIN,
        undefined,
        undefined,
        duplaId
      );
      if ("error" in r) {
        setErroPasso({ numero: numeros[0], texto: r.error });
        return;
      }
      setMarcados((m) => {
        const n = { ...m };
        for (const x of numeros) n[x] = { data, hora };
        return n;
      });
      setEditando(null);
      setSeletor(null);
      router.refresh();
    });
  };

  const aplicarOuSessao = (numero: number, data: string, hora: string) => {
    const g = grupoPorNumero.get(numero);
    if (grupoLivre(g)) aplicarSessao(g, data, hora);
    else aplicar(numero, data, hora);
  };

  // instantes já comprometidos: ocupados do motor + passos aplicados +
  // os confirmados nesta sessão (que o refresh ainda não devolveu) — um
  // passo pendente nunca reoferece um instante desses (507)
  const ocupadosBase = [
    ...(sugestoes?.ocupados.map((o) => o.inicio) ?? []),
    ...(plano.passos ?? []).map((p) => p.data_nova),
    ...Object.values(marcados).map((m) => `${m.data}T${m.hora}:00-03:00`),
  ];
  // dedup entre pendentes: percorridos na ordem da lista, cada sugestão
  // entregue entra como ocupada pro seguinte — dois passos com a mesma
  // data combinada (o clamp os iguala no min) não propõem o mesmo instante
  const sugs = new Map<number, SugestaoPasso | null>();
  {
    const sugeridos: string[] = [];
    for (const p of plano.escopo?.passos ?? []) {
      if (aplicados.has(p.numero) || marcados[p.numero]) {
        sugs.set(p.numero, null);
        continue;
      }
      const g = grupoPorNumero.get(p.numero);
      const sessao = grupoLivre(g);
      // o grupo é um instante só: a âncora carrega a sugestão de 2h, os
      // outros membros esperam por ela (sem CTA nem horário próprio)
      if (sessao && g[0] !== p.numero) {
        sugs.set(p.numero, null);
        continue;
      }
      const sug = sugestaoPasso({
        dataPasso: p.data,
        hoje,
        janela,
        perfil: sugestoes?.perfil,
        disponibilidade: sugestoes?.disponibilidade,
        ocupados: [...ocupadosBase, ...sugeridos],
        duracaoMin: sessao
          ? (p.duracao_min ?? DURACAO_SESSAO_MIN)
          : sugestoes?.duracaoMin,
      });
      sugs.set(p.numero, sug);
      if (sug) sugeridos.push(`${sug.data}T${sug.hora}:00-03:00`);
    }
  }
  // os mesmos instantes pro choque do seletor, já com o rótulo do chip
  const ocupadosRotulados: OcupadoRotulado[] = [
    ...(sugestoes?.ocupados ?? []),
    ...(plano.passos ?? []).map((p) => ({
      inicio: p.data_nova,
      rotulo: `${p.numero}º encontro`,
      rotuloArtigo: `o ${p.numero}º encontro`,
    })),
    ...Object.entries(marcados).map(([numero, m]) => ({
      inicio: `${m.data}T${m.hora}:00-03:00`,
      rotulo: `${numero}º encontro`,
      rotuloArtigo: `o ${numero}º encontro`,
    })),
  ];

  const passoSeletor = seletor
    ? (plano.escopo?.passos ?? []).find((p) => p.numero === seletor.numero)
    : null;
  const sugSeletor = passoSeletor
    ? (sugs.get(passoSeletor.numero) ?? null)
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--destaque)]/15 px-2.5 py-0.5 text-xs font-semibold">
          {statusTexto[plano.status] ?? plano.status}
        </span>
        {plano.versao > 1 && (
          <span className="text-xs text-muted-foreground">
            versão {plano.versao}
          </span>
        )}
        {plano.escopo?.ritmo != null && (
          <span className="text-xs text-muted-foreground">
            {plano.escopo.ritmo === 1
              ? "1 encontro por semana"
              : `até ${plano.escopo.ritmo} encontros por semana`}
          </span>
        )}
        {janela && (
          <span className="text-xs text-muted-foreground">
            De {ddmm(janela.inicio)} a {ddmm(janela.fim)}
          </span>
        )}
        {combinadoHref && (
          <Link
            href={combinadoHref}
            className="inline-flex items-center gap-1 rounded-sm text-xs font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BookOpenText size={13} aria-hidden />
            Ler o combinado
          </Link>
        )}
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
          >
            Avisar por WhatsApp
          </a>
        )}
      </div>

      {/* a leitura da proposta muda por lado: quem ainda não respondeu
          vê o pedido; quem já carimbou vê que um aceite da dupla basta */}
      {estado === "proposto_staff_falta_meu" && (
        <p className="text-sm text-muted-foreground">
          {propostaPor} propôs esse plano. Um aceite da dupla põe o
          plano pra valer. O outro lado recebe o aviso.
        </p>
      )}
      {estado === "proposto_staff_falta_outro" && meuLado != null && (
        <p className="text-sm text-muted-foreground">
          Você já respondeu. Um aceite da dupla põe o combinado pra
          valer.
        </p>
      )}
      {estado === "ativo_sem_minha_ciencia" && (
        <p className="text-sm text-muted-foreground">
          {nomeOutro} combinou o plano pra vocês.
          {resumo.propostoEm &&
            ` Você foi avisado em ${diaMes(resumo.propostoEm.slice(0, 10))}.`}
        </p>
      )}

      {plano.status === "proposto" && (
        <AceitesPlano
          resumo={resumo}
          mentor={nomes?.mentor ?? "Mentor"}
          jovem={nomes?.mentorado ?? "Jovem"}
        />
      )}

      {aberto && resumo.total > 0 && (
        <QuadradosCombinado resumo={resumo} />
      )}

      <ol className="space-y-2">
        {(plano.escopo?.passos ?? []).map((p) => {
          const aplicado = aplicados.get(p.numero);
          const confirmado = marcados[p.numero];
          const sug = sugs.get(p.numero) ?? null;
          // 018: membro de sessão combinada carrega o rótulo do grupo;
          // a âncora (o 1º do grupo) cobre todos numa linha só com o
          // gesto "Marcar sessão"
          const grupo = grupoPorNumero.get(p.numero);
          const sessaoLivre = grupoLivre(grupo);
          const ehAncora = sessaoLivre && grupo[0] === p.numero;
          const tagSessao = grupo ? rotuloSessao(p.numero, grupo) : null;
          const durSessao = p.duracao_min ?? DURACAO_SESSAO_MIN;
          return (
            <li key={p.numero} className="text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="font-medium">
                  {ehAncora
                    ? `${listaEncontros(grupo)} encontros`
                    : p.titulo
                      ? `${p.numero}º encontro · ${p.titulo}`
                      : `${p.numero}º encontro`}
                </span>
                {aplicado ? (
                  <span className="text-muted-foreground">
                    · {tagSessao ? `${tagSessao} · ` : ""}marcado pra{" "}
                    {rotuloAplicado(aplicado.data_nova)}
                  </span>
                ) : confirmado ? (
                  <span
                    role="status"
                    className="inline-flex items-center gap-1 text-[var(--ok-text)]"
                  >
                    <Check size={14} weight="bold" aria-hidden />
                    {tagSessao ? `${tagSessao} · ` : ""}Marcado pra{" "}
                    {rotuloPasso(confirmado.data, confirmado.hora)}
                  </span>
                ) : sessaoLivre && !ehAncora ? (
                  <span className="text-muted-foreground">
                    · {tagSessao}
                  </span>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      ·{" "}
                      {ehAncora
                        ? `sessão de ${rotuloDuracao(durSessao)} · `
                        : tagSessao
                          ? `${tagSessao} · `
                          : ""}
                      sugestão{" "}
                      {sug ? rotuloPasso(sug.data, sug.hora) : ddmm(p.data)}
                    </span>
                    {aberto &&
                      podeAplicar &&
                      plano.status !== "proposto" &&
                      sug && (
                        <span className="flex items-center gap-1.5 max-sm:basis-full">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pendente}
                            onClick={() =>
                              aplicarOuSessao(p.numero, sug.data, sug.hora)
                            }
                          >
                            <CalendarPlus aria-hidden />
                            {ehAncora ? "Marcar sessão" : "Confirmar"}
                          </Button>
                          {/* 526: um CTA à vista; trocar a data é exceção e
                              mora no ⋯ (mesmo AcoesMenu dos cards) */}
                          <AcoesMenu
                            label={
                              ehAncora
                                ? "Ações da sessão"
                                : `Ações do ${p.numero}º encontro`
                            }
                            className="max-sm:w-9"
                            itens={[
                              {
                                id: "outra-data",
                                rotulo: "Outra data",
                                icone: <CalendarDots aria-hidden className="size-4 shrink-0 text-muted-foreground" />,
                                onEscolher: () => {
                                  if (pendente) return;
                                  setErroPasso(null);
                                  if (sugestoes) {
                                    setEditando(null);
                                    setSeletor((s) => ({
                                      numero: p.numero,
                                      sessao: (s?.sessao ?? 0) + 1,
                                      grupo: ehAncora ? grupo : undefined,
                                    }));
                                  } else {
                                    setDatas((d) => ({
                                      ...d,
                                      [p.numero]: d[p.numero] ?? {
                                        dia: sug.data,
                                        hora: sug.hora,
                                      },
                                    }));
                                    setEditando((e) =>
                                      e === p.numero ? null : p.numero
                                    );
                                  }
                                },
                              },
                            ]}
                          />
                        </span>
                      )}
                  </>
                )}
              </div>
              {editando === p.numero && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    aria-label={`Outro dia do ${p.numero}º encontro`}
                    className="w-40 text-xs"
                    min={sug?.min}
                    max={sug?.max ?? undefined}
                    value={datas[p.numero]?.dia ?? ""}
                    onChange={(e) =>
                      setDatas((d) => ({
                        ...d,
                        [p.numero]: {
                          dia: e.target.value,
                          hora: d[p.numero]?.hora ?? "19:00",
                        },
                      }))
                    }
                  />
                  <Input
                    type="time"
                    step={900}
                    aria-label={`Outro horário do ${p.numero}º encontro`}
                    className="w-28 text-xs"
                    value={datas[p.numero]?.hora ?? ""}
                    onChange={(e) =>
                      setDatas((d) => ({
                        ...d,
                        [p.numero]: {
                          dia: d[p.numero]?.dia ?? "",
                          hora: e.target.value,
                        },
                      }))
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      pendente ||
                      !datas[p.numero]?.dia ||
                      !datas[p.numero]?.hora
                    }
                    onClick={() => {
                      const v = datas[p.numero];
                      if (v?.dia && v?.hora)
                        aplicarOuSessao(p.numero, v.dia, v.hora);
                    }}
                  >
                    Confirmar
                  </Button>
                </div>
              )}
              {erroPasso?.numero === p.numero && (
                <p role="status" className="mt-1 text-sm text-destructive">
                  {erroPasso.texto}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {/* repensar o recesso antes do aceite (518, US3.5): a decisão é
          da dupla, e se a resposta nova mudar as datas o combinado
          recalcula no mesmo gesto */}
      {aberto &&
        podeResponder &&
        meuLado != null &&
        duplaId &&
        recessos.length > 0 &&
        plano.status === "proposto" && (
          <div className="space-y-1.5 rounded-lg bg-muted/50 px-3.5 py-3 shadow-[var(--shadow-inset)]">
            <p className="text-xs font-semibold text-foreground">
              {recessos.length > 1
                ? "Os recessos no caminho"
                : "O recesso no caminho"}
            </p>
            <p className="text-xs text-muted-foreground">
              Podem repensar a resposta antes de aceitar. Se as datas
              mudarem, o combinado recalcula junto.
            </p>
            <RecessoDecisao
              duplaId={duplaId}
              recessos={recessos}
              podeDeclarar
              onDecisao={(cicloEventoId, usa) =>
                setDecisaoLocal((d) => ({ ...d, [cicloEventoId]: usa }))
              }
            />
          </div>
        )}

      {erro && (
        <p role="status" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      {aberto && podeResponder && estado === "proposto_staff_falta_meu" && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={pendente} onClick={() => responder("aceitar")}>
            <Check aria-hidden />
            Aceitar
          </Button>
          {contestavel && (
            <Button
              size="sm"
              variant="outline"
              disabled={pendente}
              onClick={() => responder("contestar")}
            >
              <X aria-hidden />
              Não serve pra mim
            </Button>
          )}
        </div>
      )}
      {aberto && podeResponder && estado === "ativo_sem_minha_ciencia" && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={pendente} onClick={() => responder("aceitar")}>
            <Check aria-hidden />
            Estou ciente
          </Button>
          {contestavel && (
            <Button
              size="sm"
              variant="outline"
              disabled={pendente}
              onClick={() => responder("contestar")}
            >
              <X aria-hidden />
              Não serve pra mim
            </Button>
          )}
        </div>
      )}
      {aberto && podeResponder && estado === "ativo" && contestavel && (
        <div className="space-y-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            disabled={pendente}
            onClick={() => responder("contestar")}
          >
            <X aria-hidden />
            Não serve pra mim
          </Button>
          <p className="text-xs text-muted-foreground">
            O plano vale. Se algo mudou, ainda dá pra
            contestar antes do próximo encontro.
          </p>
        </div>
      )}

      {seletor && passoSeletor && sugSeletor && sugestoes && (
        <SeletorDiaHora
          key={`${seletor.numero}:${seletor.sessao}`}
          aberto
          onAberto={(o) => {
            if (!o) setSeletor(null);
          }}
          numero={passoSeletor.numero}
          descricao={
            seletor.grupo
              ? `${listaEncontros(seletor.grupo)} encontros · sessão combinada de ${rotuloDuracao(passoSeletor.duracao_min ?? DURACAO_SESSAO_MIN)}`
              : `${passoSeletor.numero}º encontro · passo do plano`
          }
          rotuloConfirmar={seletor.grupo ? "Marcar sessão" : "Confirmar data"}
          inicial={{
            data: sugSeletor.data,
            hora: sugSeletor.hora,
            origem: "passo_do_plano",
          }}
          sugestoes={{
            ...sugestoes,
            duracaoMin: seletor.grupo
              ? (passoSeletor.duracao_min ?? DURACAO_SESSAO_MIN)
              : sugestoes.duracaoMin,
            datas: datasDoPasso({
              dataPasso: passoSeletor.data,
              hoje,
              janela,
              ritmo: plano.escopo?.ritmo,
              perfil: sugestoes.perfil,
              disponibilidade: sugestoes.disponibilidade,
              ocupados: ocupadosBase,
              duracaoMin: seletor.grupo
                ? (passoSeletor.duracao_min ?? DURACAO_SESSAO_MIN)
                : sugestoes.duracaoMin,
            }),
            ocupados: ocupadosRotulados,
            janela,
          }}
          pending={pendente}
          aviso={erroPasso?.numero === passoSeletor.numero ? erroPasso.texto : null}
          onAviso={(a) =>
            setErroPasso(a ? { numero: passoSeletor.numero, texto: a } : null)
          }
          onConfirmar={(data, hora) =>
            seletor.grupo
              ? aplicarSessao(seletor.grupo, data, hora)
              : aplicar(passoSeletor.numero, data, hora)
          }
        />
      )}
    </div>
  );
}

/** "2h" / "1h30" / "45min" — a duração da sessão combinada na linha e na
 *  descrição do seletor. */
function rotuloDuracao(min: number): string {
  if (min % 60 === 0) return `${min / 60}h`;
  if (min > 60) return `${Math.floor(min / 60)}h${min % 60}`;
  return `${min}min`;
}

/** "ter 24/11 às 19:00" de um ISO aplicado — as partes civis do fuso do
 *  programa, como na linha. */
function rotuloAplicado(iso: string): string {
  const p = partesSP(new Date(iso));
  return p ? `${p.diaSemana} ${ddmm(p.data)} às ${p.horaMin}` : iso;
}
