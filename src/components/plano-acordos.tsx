"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, CalendarPlus } from "@phosphor-icons/react";
import {
  aplicarPassoPlano,
  responderPlano,
} from "@/lib/actions-plano";
import { diaSemanaDe } from "@/lib/ciclo";
import {
  datasDoPasso,
  resumoCombinado,
  sugestaoPasso,
  type PlanoCombinado,
  type SugestaoPasso,
} from "@/lib/plano-combinado";
import {
  partesSP,
  type OcupadoRotulado,
} from "@/lib/sugestoes-encontro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SeletorDiaHora,
  ddmm,
  type SeletorSugestoes,
} from "@/components/seletor-dia-hora";
import {
  AceitesPlano,
  QuadradosCombinado,
} from "@/components/plano-em-dia-pecas";

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
  sugestoes,
}: {
  plano: PlanoCombinado;
  /** id da dupla pra revalidar a ficha — o jovem não tem, e não
   *  precisa: a RPC valida pelo plano. */
  duplaId?: string;
  /** mentor/jovem respondem; equipe só acompanha */
  podeResponder: boolean;
  /** aplicar passo = agendar data combinada — mentor e jovem */
  podeAplicar: boolean;
  /** Lado de quem lê (513): com o aceite bilateral, "falta o seu aceite"
   *  é diferente de "falta o aceite do outro". Sem ele o card não
   *  oferece responder (só lê). */
  meuLado?: "mentor" | "mentorado" | null;
  /** Primeiros nomes dos dois lados — os chips de aceite nomeiam quem
   *  já disse sim. */
  nomes?: { mentor: string; mentorado: string };
  /** Números já realizados da dupla — a régua separa "feito" de
   *  "só tem data". */
  realizados?: readonly number[];
  /** Pacote do motor (perfil/grade/ocupados) — alimenta a sugestão da
   *  linha e os chips do "Outra data". Sem ele, date+time de step 900. */
  sugestoes?: SeletorSugestoes | null;
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
  } | null>(null);
  const [marcados, setMarcados] = useState<
    Record<number, { data: string; hora: string }>
  >({});
  const resumo = resumoCombinado(plano, realizados);
  const aberto = resumo.aberto;
  const aplicados = new Map(
    (plano.passos ?? []).map((p) => [p.numero, p])
  );
  const janela = plano.janela ?? plano.escopo?.janela ?? null;
  const hoje = sugestoes?.hoje ?? partesSP(new Date())?.data ?? "";
  // aceite bilateral (513): "falta eu" abre os botões; "falta o outro"
  // é leitura — a RPC recusa responder de novo e a tela não oferece
  const faltaEu =
    meuLado != null && plano.status === "proposto" && !resumo.aceites[meuLado];
  const statusTexto: Record<string, string> = {
    proposto:
      resumo.falta === "os_dois"
        ? "Proposto, esperando os dois aceitarem"
        : resumo.falta === "mentor" || resumo.falta === "mentorado"
          ? `Proposto, falta o aceite ${resumo.falta === "mentor" ? "do mentor" : "do jovem"}`
          : "Proposto, esperando aceitar",
    aceito: "Aceito, combinando as datas",
    ativo: "Em andamento",
    concluido: "Concluído",
    expirado: "Expirado",
    contestado: "Contestado",
  };

  const responder = (acao: "aceitar" | "contestar") => {
    setErro(null);
    iniciar(async () => {
      const r = await responderPlano(plano.id, acao, undefined, duplaId);
      if ("error" in r) setErro(r.error);
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
      const sug = sugestaoPasso({
        dataPasso: p.data,
        hoje,
        janela,
        perfil: sugestoes?.perfil,
        disponibilidade: sugestoes?.disponibilidade,
        ocupados: [...ocupadosBase, ...sugeridos],
        duracaoMin: sugestoes?.duracaoMin,
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
            Janela: {ddmm(janela.inicio)} a {ddmm(janela.fim)}
          </span>
        )}
      </div>

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
          return (
            <li key={p.numero} className="text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="font-medium">{p.numero}º encontro</span>
                {aplicado ? (
                  <span className="text-muted-foreground">
                    · marcado pra {rotuloAplicado(aplicado.data_nova)}
                  </span>
                ) : confirmado ? (
                  <span
                    role="status"
                    className="inline-flex items-center gap-1 text-[var(--ok-text)]"
                  >
                    <Check size={14} weight="bold" aria-hidden />
                    Marcado pra {rotuloPasso(confirmado.data, confirmado.hora)}
                  </span>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      · sugestão{" "}
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
                              aplicar(p.numero, sug.data, sug.hora)
                            }
                          >
                            <CalendarPlus aria-hidden />
                            Confirmar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pendente}
                            onClick={() => {
                              setErroPasso(null);
                              if (sugestoes) {
                                setEditando(null);
                                setSeletor((s) => ({
                                  numero: p.numero,
                                  sessao: (s?.sessao ?? 0) + 1,
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
                            }}
                          >
                            Outra data
                          </Button>
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
                      if (v?.dia && v?.hora) aplicar(p.numero, v.dia, v.hora);
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

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {aberto && podeResponder && faltaEu && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={pendente} onClick={() => responder("aceitar")}>
            <Check aria-hidden />
            Aceitar o combinado
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pendente}
            onClick={() => responder("contestar")}
          >
            <X aria-hidden />
            Não combina
          </Button>
        </div>
      )}
      {aberto &&
        podeResponder &&
        plano.status === "proposto" &&
        meuLado != null &&
        !faltaEu && (
          <p className="text-xs text-muted-foreground">
            Você já aceitou. O plano começa a valer quando{" "}
            {resumo.falta === "mentor"
              ? nomes?.mentor ?? "o mentor"
              : nomes?.mentorado ?? "o jovem"}{" "}
            aceitar também.
          </p>
        )}
      {aberto && podeResponder && plano.status !== "proposto" && (
        <p className="text-xs text-muted-foreground">
          {resumo.aceites.mentor && resumo.aceites.mentorado
            ? "Os dois lados aceitaram."
            : `Aceito por ${
                plano.aprovado_lado === "mentorado" ? "você" : "seu mentor"
              }.`}
          Se algo mudou, ainda dá pra contestar antes do próximo encontro.
        </p>
      )}

      {seletor && passoSeletor && sugSeletor && sugestoes && (
        <SeletorDiaHora
          key={`${seletor.numero}:${seletor.sessao}`}
          aberto
          onAberto={(o) => {
            if (!o) setSeletor(null);
          }}
          numero={passoSeletor.numero}
          descricao={`${passoSeletor.numero}º encontro · passo do combinado`}
          rotuloConfirmar="Confirmar data"
          inicial={{
            data: sugSeletor.data,
            hora: sugSeletor.hora,
            origem: "passo_do_plano",
          }}
          sugestoes={{
            ...sugestoes,
            datas: datasDoPasso({
              dataPasso: passoSeletor.data,
              hoje,
              janela,
              ritmo: plano.escopo?.ritmo,
              perfil: sugestoes.perfil,
              disponibilidade: sugestoes.disponibilidade,
              ocupados: ocupadosBase,
              duracaoMin: sugestoes.duracaoMin,
            }),
            ocupados: ocupadosRotulados,
            janela,
          }}
          pending={pendente}
          aviso={erroPasso?.numero === passoSeletor.numero ? erroPasso.texto : null}
          onAviso={(a) =>
            setErroPasso(a ? { numero: passoSeletor.numero, texto: a } : null)
          }
          onConfirmar={(data, hora) => aplicar(passoSeletor.numero, data, hora)}
        />
      )}
    </div>
  );
}

/** "ter 24/11 às 19:00" de um ISO aplicado — as partes civis do fuso do
 *  programa, como na linha. */
function rotuloAplicado(iso: string): string {
  const p = partesSP(new Date(iso));
  return p ? `${p.diaSemana} ${ddmm(p.data)} às ${p.horaMin}` : iso;
}
