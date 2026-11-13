import { DIFICULDADE_LABEL, PROXIMO_PASSO_LABEL } from "./ciclo";
import {
  resumoAvaliacaoJovem,
  type AvaliacaoJovemResumo,
} from "./avaliacao-agregado";
import {
  dadosResumoJornada,
  prazoTrilhaEspecialista,
  type DuplaParaResumo,
  type ResumoJornada,
} from "./encerramento";
import {
  COMPETENCIA_OPCOES,
  type FormularioCampo,
  type RespostaValor,
} from "./forms/schema";
import { parChecklist, parRoda } from "./jornada";
import type { PdmResumo } from "./pdm";
import type {
  AvaliacaoJovem,
  CicloEvento,
  Dificuldade,
  Encaminhamento,
  ProximoPasso,
} from "./types";
import type { PassoGuia } from "./ciclo";

// REALIZA-359 — the derived retrospective of the DPP journey. Pure: the
// inputs are the same rows the ficha and the mentee RPC already fetch
// (dupla with encounters+registros+encaminhamentos, the instrumentos_da_dupla
// payload, the live PDM summary); nothing new is queried. The screen it
// feeds is read-only and per-role: `comNotasInternas` gates the
// mentor-only record fields (observacoes, dificuldade, pedido de apoio)
// and the caller decides whether the mentor checklist block is shown at
// all (mentor/staff only — never for the mentee).

/** Registro fields that survive into the retrospective — labeled text
 *  excerpts, not raw dumps. Internal fields only appear with
 *  `comNotasInternas` (mentor/staff view). */
export type TrechoRegistro = { rotulo: string; texto: string };

export type RetroEncontro = {
  numero: number;
  data: string | null;
  tema: string | null;
  avaliacao: AvaliacaoJovem | null;
  trechos: TrechoRegistro[];
};

export type RetroCombinado = {
  descricao: string;
  /** null na visão da jovem — a view jovem_encaminhamentos não expõe a
   *  coluna (todo combinado dela já é, por definição, dela) */
  responsavel: Encaminhamento["responsavel"] | null;
  numero: number | null;
  prazo: string | null;
  status: Encaminhamento["status"];
  feitoEm: string | null;
};

/** A responded delivery of an instrument, normalized for display. */
export type RetroAplicacao = {
  respostas: Record<string, RespostaValor>;
  respondidoEm: string | null;
};

export type DadosRetrospectiva = {
  desbloqueada: boolean;
  resumo: ResumoJornada;
  /** every realized encounter, ascending — the full timeline, not the
   *  3-row excerpt of dadosResumoJornada */
  encontros: RetroEncontro[];
  combinados: RetroCombinado[];
  /** initial × formal pair; null when the roda was never answered */
  roda: {
    campos: FormularioCampo[];
    inicial: RetroAplicacao | null;
    formal: RetroAplicacao | null;
  } | null;
  /** início × fim mentor checklist pair — null without the form or when
   *  no marking was ever answered; mentor/staff display only */
  checklist: {
    campos: FormularioCampo[];
    inicio: RetroAplicacao | null;
    final: RetroAplicacao | null;
  } | null;
  pdm: PdmResumo | null;
  /** Star series the viewer may see per encontro slot (1..total, null on
   *  holes) — feeds the sparkline. Null when the caller's cut carries no
   *  series (the DPP mentor only gets the quantized media). */
  starSeries: (number | null)[] | null;
};

type DuplaParaRetro = Omit<
  DuplaParaResumo,
  "encontros" | "encaminhamentos"
> & {
  encerrada_em?: string | null;
  /** staff manda a row inteira; a jovem manda a linha da view dela —
   *  responsavel/numero/feito_em ficam de fora do payload (0190).
   *  Omit nos dois campos: A[] & B[] resolve .filter/.map pro elemento
   *  base e os campos extra somem do tipo. */
  encaminhamentos: (Pick<
    Encaminhamento,
    "descricao" | "prazo" | "status" | "created_at"
  > &
    Partial<Pick<Encaminhamento, "responsavel" | "numero" | "feito_em">>)[];
  encontros: (Omit<DuplaParaResumo["encontros"][number], "registro"> & {
    registro?: (NonNullable<
      DuplaParaResumo["encontros"][number]["registro"]
    > & {
      atividades?: string[];
      reflexoes?: string | null;
      observacoes?: string | null;
      dificuldade?: Dificuldade | null;
      proximo_passo?: ProximoPasso | null;
      precisa_apoio?: boolean;
    }) | null;
  })[];
};

/** Minimal delivery shape — satisfied by both InstrumentoEntrega
 *  (instrumentos_da_dupla) and EntregaJornada (jovem_jornada). */
type EntregaRetro = {
  respostas?: Record<string, unknown> | null;
  respondido_em?: string | null;
  contexto?: Record<string, unknown> | null;
  created_at?: string;
};

function retroAplicacao(e: EntregaRetro | null): RetroAplicacao | null {
  if (!e?.respostas) return null;
  return {
    respostas: e.respostas as Record<string, RespostaValor>,
    respondidoEm: e.respondido_em ?? null,
  };
}

/** Derives the whole retrospective. `desbloqueada` mirrors the unlock
 *  rule: the 16th realized encounter opens it for everyone; a closed
 *  dupla (concluída/encerrada, or a legacy `encerrada_em` stamp from the
 *  specialist track) opens it too — the retrospective is history, not a
 *  gate of the checklist rite. Sections degrade gracefully: missing
 *  instrument/PDM data simply returns null and the UI omits the block. */
export function dadosRetrospectiva(input: {
  dupla: DuplaParaRetro;
  passos: PassoGuia[];
  /** espelha a assinatura alargada de dadosResumoJornada (0190): o jovem
   *  alimenta com o cronograma da própria RPC, sem row completa */
  eventos: Pick<CicloEvento, "tipo" | "data">[];
  /** closure stamp — encerramentos.created_at or encerrada_em */
  fim: string | null;
  hoje?: Date;
  pdm?: PdmResumo | null;
  /** instrumentos_da_dupla / jovem_jornada payload */
  instrumentos?: {
    sistema: string;
    campos: FormularioCampo[];
    entregas: EntregaRetro[];
  }[];
  /** the viewer-cut young-person summary (REALIZA-71) — forwarded into
   *  the resumo so the retro can show the tile it used to lack */
  avaliacaoJovem?: AvaliacaoJovemResumo | null;
  /** raw stars by encontro numero — ONLY what the viewer's policy already
   *  released (staff/jovem full series; the DPP mentor passes nothing:
   *  his cut is the quantized media inside `avaliacaoJovem`) */
  starSeries?: { numero: number; estrelas: number }[];
  /** mentor/staff view → include internal record fields; mentee → false */
  comNotasInternas: boolean;
}): DadosRetrospectiva {
  const { dupla } = input;
  const hoje = input.hoje ?? new Date();

  const enc16 = dupla.encontros.some(
    (e) => e.numero === 16 && e.status === "realizado"
  );
  const fechada =
    dupla.status === "concluida" ||
    dupla.status === "encerrada" ||
    !!dupla.encerrada_em;
  // trilha especialista (spec item 4): sem encontro 16, o fechamento ou o
  // marco de 3 meses da trilha abrem a retrospectiva — ela é história
  const prazoPassou =
    dupla.trilha === "especialista" &&
    prazoTrilhaEspecialista(dupla.iniciada_em, hoje)?.estado === "passou";

  const encontros: RetroEncontro[] = dupla.encontros
    .filter((e) => e.status === "realizado")
    .sort((a, b) => a.numero - b.numero)
    .map((e) => {
      const r = e.registro;
      const trechos: TrechoRegistro[] = [];
      if (r?.atividades?.length) {
        trechos.push({
          rotulo: "O que rolou",
          texto: r.atividades.join(" · "),
        });
      }
      if (r?.proximo_passo) {
        trechos.push({
          rotulo: "Próximo passo",
          texto: PROXIMO_PASSO_LABEL[r.proximo_passo] ?? r.proximo_passo,
        });
      }
      if (input.comNotasInternas && r) {
        if (r.reflexoes) {
          trechos.push({ rotulo: "Reflexões", texto: r.reflexoes });
        }
        if (r.dificuldade && r.dificuldade !== "nenhuma") {
          trechos.push({
            rotulo: "Dificuldade",
            texto: DIFICULDADE_LABEL[r.dificuldade] ?? r.dificuldade,
          });
        }
        if (r.observacoes) {
          trechos.push({ rotulo: "Observações", texto: r.observacoes });
        }
        if (r.precisa_apoio) {
          trechos.push({ rotulo: "Apoio", texto: "Pedido de apoio registrado" });
        }
      }
      return {
        numero: e.numero,
        data: e.realizado_em ?? e.data_hora,
        tema: r?.tema ?? null,
        avaliacao: r?.avaliacao ?? null,
        trechos,
      };
    });

  const combinados: RetroCombinado[] = [...(dupla.encaminhamentos ?? [])]
    .sort((a, b) => {
      const an = a.numero ?? 999;
      const bn = b.numero ?? 999;
      return an !== bn ? an - bn : a.created_at.localeCompare(b.created_at);
    })
    .map((c) => ({
      descricao: c.descricao,
      responsavel: c.responsavel ?? null,
      numero: c.numero ?? null,
      prazo: c.prazo,
      status: c.status,
      feitoEm: c.feito_em ?? null,
    }));

  const instRoda = input.instrumentos?.find((i) => i.sistema === "roda_vida");
  const par = instRoda ? parRoda(instRoda.entregas) : null;
  const roda =
    instRoda && (par?.inicial || par?.formal)
      ? {
          campos: instRoda.campos,
          inicial: retroAplicacao(par!.inicial),
          formal: retroAplicacao(par!.formal),
        }
      : null;

  const instCheck = input.instrumentos?.find(
    (i) => i.sistema === "competencias_mentor"
  );
  const parCheck = instCheck ? parChecklist(instCheck.entregas) : null;
  const checklist =
    instCheck && (parCheck?.inicio || parCheck?.final)
      ? {
          campos: instCheck.campos,
          inicio: retroAplicacao(parCheck!.inicio),
          final: retroAplicacao(parCheck!.final),
        }
      : null;

  const resumo = dadosResumoJornada(
    dupla,
    input.passos,
    input.eventos,
    input.fim,
    hoje,
    input.pdm ?? null,
    input.avaliacaoJovem ?? null
  );

  // slots 1..total alinhados à trilha — dupla histórica sem cronograma usa
  // o maior nº realizado pra não encolher a série no vazio
  const porNumero = new Map(
    (input.starSeries ?? []).map((s) => [s.numero, s.estrelas])
  );
  const starSeries = porNumero.size
    ? Array.from(
        {
          length: Math.max(
            resumo.total,
            ...encontros.map((e) => e.numero),
            ...porNumero.keys()
          ),
        },
        (_, i) => porNumero.get(i + 1) ?? null
      )
    : null;

  return {
    desbloqueada: enc16 || fechada || prazoPassou,
    resumo,
    encontros,
    combinados,
    roda,
    checklist,
    pdm: input.pdm ?? null,
    starSeries,
  };
}

/** One derived checklist line appended to the resumo snapshot — keeps
 *  textoResumoJornada generated-only (no free-form content) while the
 *  final report reflects the revisited competencies. */
export function linhaChecklistResumo(checklist: {
  inicio: RetroAplicacao | null;
  final: RetroAplicacao | null;
}): string | null {
  const conta = (r: RetroAplicacao | null) =>
    r
      ? Object.values(r.respostas).filter((v) => v === COMPETENCIA_OPCOES[0])
          .length
      : null;
  const ini = conta(checklist.inicio);
  const fim = conta(checklist.final);
  if (ini == null && fim == null) return null;
  const total = 10;
  if (ini != null && fim != null) {
    return `Checklist de competências do mentor: “já faço bem” ${ini} → ${fim} de ${total}`;
  }
  const unico = ini ?? fim;
  return `Checklist de competências do mentor: “já faço bem” ${unico} de ${total} (uma marcação)`;
}

// ---------- recorte da jovem (0190) ----------

/** Minimal shapes of the mentee-scoped sources — structural on purpose:
 *  `jovem_jornada` deliveries arrive as `EntregaJornada`, the cronograma
 *  as `EventoJornada` and the commitments as `jovem_encaminhamentos`
 *  rows; declaring the real imported types here would couple the helper
 *  to three different modules for zero behavioral gain. */
type JovemRetroInput = {
  /** jornada.dupla — the jovem_duplas view row fields the summary needs */
  dupla: {
    trilha: DuplaParaResumo["trilha"];
    status: DuplaParaResumo["status"];
    iniciada_em: string | null;
    encerrada_em: string | null;
    mentorNome: string;
  };
  mentoradoNome: string;
  /** cronograma da RPC (EventoJornada) — dá `passos` e `eventos` */
  cronograma: {
    numero: number | null;
    data: string | null;
    tipo: string;
    fase: string | null;
    instrumentos: string[];
  }[];
  /** encontros reais dela (getJovemEncontros filtrado pra dupla) */
  encontros: {
    numero: number;
    status: string;
    data_hora: string | null;
    realizado_em: string | null;
  }[];
  /** tema por nº — o campo único do payload retrospectiva da RPC */
  temas: { numero: number; tema: string | null }[];
  combinados: {
    descricao: string | null;
    prazo: string | null;
    status: Encaminhamento["status"] | null;
    created_at: string | null;
  }[];
  instrumentos?: {
    sistema: string;
    campos: FormularioCampo[];
    entregas: EntregaRetro[];
  }[];
  /** as avaliações de encontro DELA (getJovemAvaliacoes + embed do nº) —
   *  alimentam o tile "Avaliação do jovem" e a sparkline da retrospectiva */
  avaliacoes?: {
    numero: number;
    estrelas: number;
    temas?: string[] | null;
  }[];
  pdm?: PdmResumo | null;
  /** a RPC decide quem destrava — a lib não repete a régua */
  desbloqueada: boolean;
  hoje?: Date;
};

/** A retrospectiva no recorte da jovem: mesma derivação da ficha, mas
 *  alimentada só pelo que já é dela (a timeline da RPC + suas próprias
 *  linhas das views). Sem registro interno (trechos saem vazios — a
 *  projeção não carrega os campos) e SEM o checklist do mentor — a RPC
 *  já tira o instrumento do payload e o filtro abaixo é a segunda trava,
 *  caso um payload antigo ainda traga o sistema. */
export function dadosRetrospectivaJovem(
  input: JovemRetroInput
): DadosRetrospectiva {
  const temaPorNumero = new Map(input.temas.map((t) => [t.numero, t.tema]));
  const passos: PassoGuia[] = input.cronograma
    .filter(
      (e): e is JovemRetroInput["cronograma"][number] & { numero: number } =>
        e.tipo === "encontro" && e.numero != null
    )
    .sort((a, b) => a.numero - b.numero)
    .map((e) => ({
      id: `retro-${e.numero}`,
      numero: e.numero,
      titulo: `Encontro ${e.numero}`,
      data: e.data,
      fase: e.fase,
      instrumentos: e.instrumentos,
    }));

  const dados = dadosRetrospectiva({
    dupla: {
      trilha: input.dupla.trilha,
      status: input.dupla.status,
      iniciada_em: input.dupla.iniciada_em,
      encerrada_em: input.dupla.encerrada_em,
      mentor: { nome: input.dupla.mentorNome },
      mentorado: { nome: input.mentoradoNome },
      encontros: input.encontros.map((e) => ({
        numero: e.numero,
        status: e.status as DuplaParaResumo["encontros"][number]["status"],
        data_hora: e.data_hora,
        realizado_em: e.realizado_em,
        // o tema é o único campo de registro no payload dela — os demais
        // (avaliação interna, notas) nem chegam: a projeção é a trava
        registro: temaPorNumero.has(e.numero)
          ? { tema: temaPorNumero.get(e.numero) ?? null, avaliacao: null }
          : null,
      })),
      encaminhamentos: input.combinados.map((c) => ({
        descricao: c.descricao ?? "",
        prazo: c.prazo,
        status: c.status ?? "pendente",
        created_at: c.created_at ?? "",
      })),
    },
    passos,
    eventos: input.cronograma.map((e) => ({
      tipo: e.tipo as Pick<CicloEvento, "tipo">["tipo"],
      data: e.data,
    })),
    fim: input.dupla.encerrada_em,
    hoje: input.hoje,
    pdm: input.pdm ?? null,
    instrumentos: (input.instrumentos ?? []).filter(
      (i) => i.sistema !== "competencias_mentor"
    ),
    // dela é a série inteira — ela vê as próprias estrelas
    avaliacaoJovem: resumoAvaliacaoJovem(input.avaliacoes ?? []),
    starSeries: (input.avaliacoes ?? []).map((a) => ({
      numero: a.numero,
      estrelas: a.estrelas,
    })),
    comNotasInternas: false,
  });

  // a régua destrava no banco (a RPC conta com o estado real); a derivação
  // local só cobre o que a jovem carrega — sem a trava da RPC o recorte
  // poderia abrir cedo com dados parciais
  return { ...dados, desbloqueada: input.desbloqueada };
}
