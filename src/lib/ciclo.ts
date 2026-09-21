import type { CicloEvento, Dificuldade, Dupla, Encontro, Registro } from "./types";

export type Semaforo = "ok" | "atencao" | "risco";

// opções do form "Avaliação de Encontro Semanal - Mentores"
export const ATIVIDADES_ENCONTRO = [
  "Conversa de acompanhamento",
  "Orientação individual",
  "Atividade prática",
  "Desenvolvimento de competência",
  "Acompanhamento de atividade/tarefa",
  "Identificação de dificuldades",
  "Orientação profissional",
] as const;

export const AVALIACAO_LABEL: Record<string, string> = {
  excelente: "Excelente",
  boa: "Boa",
  regular: "Regular",
  baixa: "Baixa",
};

export const DIFICULDADE_LABEL: Record<Dificuldade, string> = {
  nenhuma: "Nenhuma",
  aprendizagem: "aprendizagem",
  participacao: "participação",
  comportamental: "comportamental",
  organizacao: "organização/rotina",
  outro: "outra",
};

export const PROXIMO_PASSO_LABEL: Record<string, string> = {
  continuar: "Continuar o acompanhamento normalmente",
  reforcar: "Reforçar o conteúdo/atividade",
  novo_feedback: "Realizar novo feedback",
  acompanhar_de_perto: "Fazer um acompanhamento mais próximo",
  conversa_individual: "Conversar individualmente com o mentorado",
  outro: "Outro",
};

/** Motivos de remarcação — `value` é a chave estável do form; `label` é o texto
 *  canônico gravado em encontros.motivo_reagendamento (auditável, sem enum no banco). */
export const MOTIVOS_REAGENDAMENTO = [
  { value: "ausencia_mentorado", label: "Ausência do mentorado" },
  { value: "ausencia_mentor", label: "Ausência do mentor" },
  { value: "conflito", label: "Conflito de agenda" },
  { value: "imprevisto", label: "Doença ou imprevisto" },
  { value: "outro", label: "Outro motivo" },
] as const;

/** Registro mais recente da dupla (pelo número do encontro). */
export function ultimoRegistro(dupla: Dupla): Registro | null {
  return (
    dupla.encontros
      .filter((e) => e.registro)
      .sort((a, b) => b.numero - a.numero)[0]?.registro ?? null
  );
}

export type DuplaSaude = {
  semaforo: Semaforo;
  motivo: string;
  esperado: number;
  feitos: number;
  proximo: Encontro | null;
  registroPendente: boolean;
  pediuApoio: boolean;
};

/** Total de encontros do ciclo — trilha DPP tem 16, especialista terá menos. */
export function totalEncontros(eventos: CicloEvento[]): number {
  return eventos.filter((e) => e.tipo === "encontro").length;
}

/** Encontros esperados = datas de encontro já passadas (ou hoje) desde o início da dupla. */
export function encontroEsperado(eventos: CicloEvento[], hoje: Date, desde?: string | null): number {
  const hojeStr = toDateStr(hoje);
  return eventos.filter(
    (e) => e.tipo === "encontro" && e.data <= hojeStr && (!desde || e.data >= desde)
  ).length;
}

/** Número do 1º encontro esperado (data <= hoje, >= início da dupla) sem `realizado`
 *  correspondente em dupla.encontros — é o encontro que "ainda não aconteceu".
 *  `limbo` exclui numeros agendados vencidos: eles são pendência de registro,
 *  não falta confirmada. */
function primeiroEncontroFaltante(
  dupla: Dupla,
  eventos: CicloEvento[],
  hoje: Date,
  limbo: ReadonlySet<number> = new Set()
): number | null {
  const hojeStr = toDateStr(hoje);
  const feitos = new Set(
    dupla.encontros.filter((e) => e.status === "realizado").map((e) => e.numero)
  );
  const faltante = eventos
    .filter(
      (e) =>
        e.tipo === "encontro" &&
        e.numero != null &&
        e.data <= hojeStr &&
        (!dupla.iniciada_em || e.data >= dupla.iniciada_em)
    )
    .sort((a, b) => a.data.localeCompare(b.data))
    .find((e) => e.numero != null && !feitos.has(e.numero) && !limbo.has(e.numero));
  return faltante?.numero ?? null;
}

/** Bounds "YYYY-MM-DD" da semana calendário (seg–dom) que contém `hoje`.
 *  Âncora no meio-dia pra o dia da semana não depender do fuso do servidor. */
function semanaBounds(hoje: Date): { seg: string; dom: string } {
  const hojeData = new Date(`${toDateStr(hoje)}T12:00:00`);
  const dow = (hojeData.getDay() + 6) % 7; // seg=0 … dom=6
  const seg = new Date(hojeData);
  seg.setDate(hojeData.getDate() - dow);
  const dom = new Date(seg);
  dom.setDate(seg.getDate() + 6);
  return { seg: toDateStr(seg), dom: toDateStr(dom) };
}

export function eventoDaSemana(eventos: CicloEvento[], hoje: Date): CicloEvento | null {
  const ordenados = eventos
    .filter((e) => e.tipo === "encontro")
    .sort((a, b) => a.data.localeCompare(b.data));
  // "semana do encontro N" = a semana calendário (seg–dom) que contém a data do
  // encontro — encontros são terças, então qui–dom ainda é a semana do encontro
  // que rolou (janela de registro), não da próxima.
  const { seg, dom } = semanaBounds(hoje);
  const daSemana = ordenados.find((e) => e.data >= seg && e.data <= dom);
  if (daSemana) return daSemana;
  // semana sem encontro (recesso/gap): aponta o próximo; depois do ciclo, o último
  return ordenados.find((e) => e.data > dom) ?? ordenados.at(-1) ?? null;
}

export type ResumoSemana = {
  /** evento oficial da semana (o mesmo do chip da agenda) */
  evento: CicloEvento;
  /** duplas ativas — denominador da semana */
  total: number;
  /** duplas com encontro da semana realizado */
  realizaram: number;
  /** desses, com registro entregue */
  comRegistro: number;
  /** realizaram mas ainda não registraram */
  aguardandoRegistro: number;
  /** duplas ativas sem encontro realizado da semana */
  naoAconteceram: number;
  /** das que não fizeram o oficial, as que se encontraram mesmo assim —
   *  repuseram outro encontro dentro da semana calendário */
  reposicao: number;
};

/** Conta-gotas da semana pra faixa do dashboard — só duplas ativas entram na conta.
 *  Null quando não há evento da semana (fora de janela) ou o evento não tem número. */
export function resumoSemana(
  duplas: Dupla[],
  eventos: CicloEvento[],
  agora: Date
): ResumoSemana | null {
  const evento = eventoDaSemana(eventos, agora);
  if (!evento || evento.numero == null) return null;
  const ativas = duplas.filter((d) => d.status === "ativa");
  const oficialRealizado = (d: Dupla) =>
    d.encontros.find((e) => e.numero === evento.numero && e.status === "realizado");
  const feitos = ativas.map(oficialRealizado).filter((e): e is Encontro => !!e);
  const comRegistro = feitos.filter((e) => e.registro).length;
  // reposição: sem `realizado` do numero oficial, mas com algum encontro
  // realizado dentro da semana calendário corrente — ex.: a dupla pulou a
  // semana do encontro 2 e repôs na semana do 3. Ela SE encontrou; contar como
  // "sem encontro" mentiria na faixa.
  const { seg, dom } = semanaBounds(agora);
  const rolouNaSemana = (e: Encontro) => {
    if (e.status !== "realizado") return false;
    const quando = e.realizado_em ?? e.data_hora;
    if (!quando) return false;
    const dia = toDateStr(new Date(quando));
    return dia >= seg && dia <= dom;
  };
  const reposicao = ativas.filter(
    (d) => !oficialRealizado(d) && d.encontros.some(rolouNaSemana)
  ).length;
  return {
    evento,
    total: ativas.length,
    realizaram: feitos.length,
    comRegistro,
    aguardandoRegistro: feitos.length - comRegistro,
    naoAconteceram: ativas.length - feitos.length,
    reposicao,
  };
}

/** Texto da faixa "Esta semana" pronto pra WhatsApp da equipe.
 *  `emRisco` recebe strings prontas tipo "Ana & João (2 atrasos)". */
export function textoResumoSemana(resumo: ResumoSemana, emRisco: string[] = []): string {
  const semEncontro = resumo.naoAconteceram - resumo.reposicao;
  const linhas = [
    `Semana do ${resumo.evento.numero}º encontro (${formatDiaMes(resumo.evento.data)}) — Mentoria Social`,
    `✔ ${resumo.realizaram} de ${resumo.total} ${resumo.total === 1 ? "dupla" : "duplas"} já realizaram`,
    `✎ ${resumo.comRegistro} ${resumo.comRegistro === 1 ? "registro entregue" : "registros entregues"} · ${resumo.aguardandoRegistro} aguardando`,
    `⚠ ${semEncontro} ${semEncontro === 1 ? "dupla" : "duplas"} sem encontro esta semana` +
      (resumo.reposicao > 0 ? ` · ↺ ${resumo.reposicao} em reposição` : ""),
  ];
  if (emRisco.length > 0) linhas.push(`Em risco: ${emRisco.join(" · ")}`);
  return linhas.join("\n");
}

export function saudadeDaDupla(dupla: Dupla, eventos: CicloEvento[], hoje = new Date()): DuplaSaude {
  const hojeStr = toDateStr(hoje);
  // "limbo": agendado cuja data já passou e ainda não tem registro — pode ter
  // rolado ou não; a ambiguidade exige ação do mentor (registrar, remarcar ou
  // marcar não-aconteceu), então conta como pendência de registro, não atraso
  const emLimbo = (e: Encontro) =>
    e.status === "agendado" &&
    !e.registro &&
    e.data_hora != null &&
    new Date(e.data_hora).getTime() < hoje.getTime();
  const limbo = new Set(dupla.encontros.filter(emLimbo).map((e) => e.numero));
  // um encontro em limbo cobre o evento esperado do seu número — sai da conta
  // de atraso enquanto a pendência estiver aberta
  const numerosEsperados = new Set(
    eventos
      .filter(
        (e) =>
          e.tipo === "encontro" &&
          e.numero != null &&
          e.data <= hojeStr &&
          (!dupla.iniciada_em || e.data >= dupla.iniciada_em)
      )
      .map((e) => e.numero)
  );
  const esperado =
    encontroEsperado(eventos, hoje, dupla.iniciada_em) -
    [...limbo].filter((n) => numerosEsperados.has(n)).length;
  const feitos = dupla.encontros.filter((e) => e.status === "realizado").length;
  const proximo =
    dupla.encontros
      .filter((e) => e.status === "agendado" && e.data_hora && new Date(e.data_hora) >= hoje)
      .sort((a, b) => new Date(a.data_hora!).getTime() - new Date(b.data_hora!).getTime())[0] ??
    null;

  const pediuApoio = dupla.encontros.some((e) => e.registro?.precisa_apoio);
  // pendência de registro: realizado há >24h sem registro, ou agendado em
  // limbo — a de menor número vira o motivo e o alvo dos deep links
  const pendencia =
    dupla.encontros
      .filter(
        (e) =>
          !e.registro &&
          ((e.status === "realizado" &&
            hoje.getTime() - new Date(e.data_hora ?? 0).getTime() > 24 * 3600 * 1000) ||
            emLimbo(e))
      )
      .sort((a, b) => a.numero - b.numero)[0] ?? null;
  const registroPendente = pendencia != null;
  const atraso = esperado - feitos;
  const encaminhamentoVencido = dupla.encaminhamentos.some(
    (t) => t.status === "pendente" && t.prazo && t.prazo < toDateStr(hoje)
  );
  const ultimoReg = ultimoRegistro(dupla);
  const avaliacaoBaixa = ultimoReg?.avaliacao === "baixa";
  const comDificuldade = !!ultimoReg?.dificuldade && ultimoReg.dificuldade !== "nenhuma";

  if (pediuApoio && dupla.status !== "encerrada")
    // motivo em locução nominal — quem lê pode ser o próprio mentor ("Mentor
    // pediu apoio" em 3ª pessoa lê como se fosse sobre outra pessoa)
    return { semaforo: "risco", motivo: "Pedido de apoio", esperado, feitos, proximo, registroPendente, pediuApoio };
  // pedido de apoio fura o congelamento da pausada, mas não da encerrada — dupla fechada é capítulo encerrado
  if (dupla.status !== "ativa")
    return {
      semaforo: "ok",
      motivo: dupla.status === "pausada" ? "Dupla pausada" : "Dupla encerrada",
      esperado, feitos, proximo, registroPendente,
      pediuApoio: dupla.status === "pausada" && pediuApoio,
    };
  if (avaliacaoBaixa && comDificuldade)
    return {
      semaforo: "risco",
      motivo: `Avaliação baixa e dificuldade de ${DIFICULDADE_LABEL[ultimoReg!.dificuldade!] ?? ultimoReg!.dificuldade} no último encontro`,
      esperado, feitos, proximo, registroPendente, pediuApoio,
    };
  if (atraso >= 2)
    return { semaforo: "risco", motivo: `${atraso} encontros em atraso`, esperado, feitos, proximo, registroPendente, pediuApoio };
  if (atraso === 1)
    return {
      semaforo: "atencao",
      motivo: `Encontro ${primeiroEncontroFaltante(dupla, eventos, hoje, limbo) ?? esperado} ainda não aconteceu (reposição na mesma semana)`,
      esperado, feitos, proximo, registroPendente, pediuApoio,
    };
  if (avaliacaoBaixa)
    return {
      semaforo: "atencao",
      motivo: "Avaliação baixa no último encontro",
      esperado, feitos, proximo, registroPendente, pediuApoio,
    };
  if (comDificuldade)
    return {
      semaforo: "atencao",
      motivo: `Dificuldade de ${DIFICULDADE_LABEL[ultimoReg!.dificuldade!] ?? ultimoReg!.dificuldade} identificada`,
      esperado, feitos, proximo, registroPendente, pediuApoio,
    };
  // preventivo: encontro oficial da semana bate em ≤5 dias e a dupla ainda não marcou nada
  // (qualquer row com esse numero — agendada, realizada, cancelada — já cobre o encontro)
  const oficial = eventoDaSemana(eventos, hoje);
  const diasAteOficial = oficial ? diffDias(oficial.data, toDateStr(hoje)) : null;
  const oficialNaDupla =
    oficial?.numero != null && dupla.encontros.some((e) => e.numero === oficial.numero);
  if (
    oficial?.numero != null &&
    diasAteOficial != null &&
    diasAteOficial >= 0 &&
    diasAteOficial <= 5 &&
    !proximo &&
    !oficialNaDupla
  )
    return {
      semaforo: "atencao",
      motivo: `O ${oficial.numero}º encontro é ${formatDiaSemanaMes(oficial.data)} e ainda não foi agendado`,
      esperado, feitos, proximo, registroPendente, pediuApoio,
    };
  if (pendencia)
    return {
      semaforo: "atencao",
      motivo:
        pendencia.status === "agendado"
          ? `${pendencia.numero}º encontro agendado já passou — falta o registro`
          : "Encontro realizado sem registro",
      esperado, feitos, proximo, registroPendente, pediuApoio,
    };
  if (encaminhamentoVencido)
    return { semaforo: "atencao", motivo: "Combinado com prazo vencido", esperado, feitos, proximo, registroPendente, pediuApoio };
  return {
    semaforo: "ok",
    motivo: proximo ? `Próximo encontro ${formatDate(proximo.data_hora)}` : "Em dia",
    esperado, feitos, proximo, registroPendente, pediuApoio,
  };
}

/** Encontro oficial do ciclo que já venceu (na janela da dupla) e não tem row
 *  em `encontros` — candidato a "aconteceu sem agendar" (registro retroativo). */
export type EncontroFaltante = { numero: number; dataSugerida: string };

/** O que a superfície de agendamento precisa saber da dupla — derivação única
 *  usada pela ficha, pela home do mentor e pela agenda (era copiada em cada). */
export type AlvoAgendamento = {
  /** saude.proximo?.numero ?? primeiro nº ainda não realizado (teto = total). */
  proximoNumero: number;
  /** A row real do nº alvo — agendada, não-aconteceu… — é o que o dialog edita. */
  encontroAlvo: Encontro | null;
  /** Data oficial do nº alvo no calendário do ciclo (YYYY-MM-DD). */
  sugeridoProximo?: string;
  /** Oficiais vencidos dentro da janela da dupla e sem row em encontros. */
  faltantes: EncontroFaltante[];
  /** Todos os encontros do ciclo já realizados — desliga o CTA de agendar. */
  cicloCompleto: boolean;
};

export function alvoAgendamento(
  dupla: Dupla,
  eventos: CicloEvento[],
  hoje = new Date()
): AlvoAgendamento {
  const saude = saudadeDaDupla(dupla, eventos, hoje);
  const encontroEventos = eventos.filter((e) => e.tipo === "encontro");
  const total = totalEncontros(eventos);
  // primeiro número ainda não realizado — reposição deixa buracos na sequência
  // (ex.: fez o 4º antes do 3º), então "feitos + 1" podia cair num realizado
  const numerosFeitos = new Set(
    dupla.encontros.filter((e) => e.status === "realizado").map((e) => e.numero)
  );
  let primeiroFaltante = 1;
  while (numerosFeitos.has(primeiroFaltante)) primeiroFaltante++;
  const proximoNumero = saude.proximo?.numero ?? Math.min(primeiroFaltante, total);
  // a row real desse número é o que o dialog edita; saude.proximo só cobre
  // agendados futuros
  const encontroAlvo = dupla.encontros.find((e) => e.numero === proximoNumero) ?? null;
  const sugeridoProximo = encontroEventos.find((e) => e.numero === proximoNumero)?.data;

  const hojeStr = toDateStr(hoje);
  const comEncontro = new Set(dupla.encontros.map((e) => e.numero));
  const faltantes = encontroEventos.flatMap((e) =>
    e.numero != null &&
    e.data <= hojeStr &&
    (!dupla.iniciada_em || e.data >= dupla.iniciada_em) &&
    !comEncontro.has(e.numero)
      ? [{ numero: e.numero, dataSugerida: e.data }]
      : []
  );

  return {
    proximoNumero,
    encontroAlvo,
    sugeridoProximo,
    faltantes,
    cicloCompleto: saude.feitos >= total,
  };
}

/** Situação de um passo na trilha de jornada — mesma gramática dos dots da
 *  agenda: fill = aconteceu (lime com registro, âmbar sem), anel = futuro ou
 *  incerteza, apagado = não rolou. */
export type EstadoNoJornada =
  | "realizado_completo"   // realizado + registro entregue
  | "pendente_registro"    // realizado sem registro — o âmbar que a coordenação monitora
  | "limbo"                // agendado vencido sem registro — pode ter rolado
  | "agendado"             // agendado/remarcado ainda por vir
  | "nao_aconteceu"        // nao_aconteceu/cancelado
  | "futuro";              // sem row — a caminho

export type MarcoJornada = "primeiro" | "metade" | "reta_final" | "completo";

export type NoJornada = {
  /** 1..total dentro da janela da dupla (não é o nº oficial do encontro). */
  posicao: number;
  numero: number;
  evento: CicloEvento;
  estado: EstadoNoJornada;
  encontro: Encontro | null;
  /** Marco cuja posição-limiar é este nó — só setado depois de atingido. */
  marco: MarcoJornada | null;
};

export type JornadaDupla = {
  nos: NoJornada[];
  /** Encontros oficiais na janela (pode ser < 16 em dupla de meio de ciclo). */
  total: number;
  feitos: number;
  comRegistro: number;
  /** pendente_registro + limbo — o que ainda pede confirmação. */
  pendentesRegistro: number;
  /** Nº oficial do 1º passo ainda não realizado — o "você está aqui" (anel na
   *  trilha). O estado do nó segue verdadeiro: um limbo ou nao_aconteceu como
   *  passo atual continua mostrando que pede ação. Null quando completa ou a
   *  dupla não está ativa (trilha congela — nada pede ação). */
  proximoNumero: number | null;
  faseAtual: { indice: number; total: number; nome: string } | null;
  completa: boolean;
  /** iniciada_em podou encontros do início do ciclo — a trilha começa depois. */
  janelaCortada: boolean;
};

/** Limiares dos marcos sobre `feitos` — por posição na janela, nunca por nº
 *  oficial (a jornada pode começar no meio do ciclo). `reta_final` se
 *  auto-exclui em trilhas curtas (na de 5, total−3 ≤ metade). */
function limiaresMarcos(total: number): [MarcoJornada, number][] {
  const metade = Math.ceil(total / 2);
  const l: [MarcoJornada, number][] = [["primeiro", 1], ["metade", metade]];
  if (total - 3 > metade) l.push(["reta_final", total - 3]);
  l.push(["completo", total]);
  return l;
}

/** Marcos cujo limiar foi cruzado entre `antes` e `depois` realizados — o
 *  notifier dispara só o que é novo (e só o mais alto da leva). */
export function marcosEntre(antes: number, depois: number, total: number): MarcoJornada[] {
  if (depois <= antes || total <= 0) return [];
  return limiaresMarcos(total)
    .filter(([, p]) => p > antes && p <= depois)
    .map(([m]) => m);
}

/** Mapa de progresso da dupla: os encontros oficiais da janela `iniciada_em`
 *  como passos numerados. Derivação pura — o estado já está gravado nas rows;
 *  nada aqui persiste. Encontros oficiais anteriores ao início da dupla não
 *  entram: buraco no começo leria como perda, e a trilha é só-positiva. */
export function jornadaDaDupla(
  dupla: Dupla,
  eventos: CicloEvento[],
  hoje = new Date()
): JornadaDupla {
  const oficiais = eventos
    .filter((e) => e.tipo === "encontro" && e.numero != null)
    .sort((a, b) => a.numero! - b.numero!);
  const janela = dupla.iniciada_em
    ? oficiais.filter((e) => e.data >= dupla.iniciada_em!)
    : oficiais;
  const total = janela.length;
  const porNumero = new Map(dupla.encontros.map((e) => [e.numero, e]));

  const nos: NoJornada[] = janela.map((evento, i) => {
    const encontro = porNumero.get(evento.numero!) ?? null;
    let estado: EstadoNoJornada;
    if (!encontro) estado = "futuro";
    else if (encontro.status === "realizado")
      estado = encontro.registro ? "realizado_completo" : "pendente_registro";
    else if (
      encontro.status === "agendado" &&
      !encontro.registro &&
      encontro.data_hora != null &&
      new Date(encontro.data_hora).getTime() < hoje.getTime()
    )
      estado = "limbo";
    else if (encontro.status === "agendado" || encontro.status === "remarcado")
      estado = "agendado";
    else estado = "nao_aconteceu";
    return { posicao: i + 1, numero: evento.numero!, evento, estado, encontro, marco: null };
  });

  const realizado = (n: NoJornada) =>
    n.estado === "realizado_completo" || n.estado === "pendente_registro";
  const feitos = nos.filter(realizado).length;
  const ativa = dupla.status === "ativa";

  // "você está aqui" = primeiro passo ainda não realizado — pode ser um atraso
  // a recuperar (limbo/nao_aconteceu), não só um futuro. O nó não muda de
  // estado: o anel marca posição, a cor segue dizendo o que falta.
  const noAtual = ativa && feitos < total ? (nos.find((n) => !realizado(n)) ?? null) : null;

  // o marco mora na posição do limiar e só aparece depois de cruzado — marco
  // futuro não vira cadeado ("locked" é framing de falta)
  for (const [marco, pos] of limiaresMarcos(total)) {
    const no = nos[pos - 1];
    if (no && feitos >= pos) no.marco = marco;
  }

  // fase corrente = a do passo atual; congelada/completa, a do último passo
  // não realizado (onde a trilha parou) ou do último nó
  const noFase = noAtual ?? nos.find((n) => !realizado(n)) ?? nos[total - 1] ?? null;
  const fases = [...new Set(janela.map((e) => e.fase).filter((f): f is string => !!f))];
  const nomeFase = noFase?.evento.fase ?? null;
  const faseAtual =
    nomeFase && fases.includes(nomeFase)
      ? { indice: fases.indexOf(nomeFase) + 1, total: fases.length, nome: nomeFase }
      : null;

  return {
    nos,
    total,
    feitos,
    comRegistro: nos.filter((n) => n.estado === "realizado_completo").length,
    pendentesRegistro: nos.filter(
      (n) => n.estado === "pendente_registro" || n.estado === "limbo"
    ).length,
    proximoNumero: noAtual?.numero ?? null,
    faseAtual,
    completa: total > 0 && feitos >= total,
    janelaCortada: janela.length < oficiais.length,
  };
}

/** Default de `duplas.iniciada_em` quando a coordenação não informa: uma semana
 *  antes do 1º encontro oficial — a dupla nasce "antes do ciclo", então os
 *  encontros contam desde o 1º (inclusive) sem depender de default = hoje. */
export function inicioDefaultDupla(
  eventos: Pick<CicloEvento, "tipo" | "data">[]
): string | null {
  const primeiro = eventos
    .filter((e) => e.tipo === "encontro")
    .sort((a, b) => a.data.localeCompare(b.data))[0];
  if (!primeiro) return null;
  const d = new Date(`${primeiro.data}T12:00:00`);
  d.setDate(d.getDate() - 7);
  return toDateStr(d);
}

const TZ = "America/Sao_Paulo";

const fmtDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "hoje" no fuso do programa — en-CA formata YYYY-MM-DD. */
export function toDateStr(d: Date): string {
  return fmtDia.format(d);
}

export function diffDias(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

/** "YYYY-MM-DD" é dia de calendário, não instante · âncora no meio-dia pra não voltar um dia no fuso. */
function paraData(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "a definir";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "a definir";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: TZ });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "a definir";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "a definir";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** "06/10" — dia e mês numerados. */
export function formatDiaMes(iso: string | null | undefined): string {
  if (!iso) return "a definir";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "a definir";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ });
}

/** "15" — só o dia, pro nó da timeline de /registros. */
export function formatDiaNum(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", timeZone: TZ });
}

/** "set" — mês abreviado sem o ponto que o Intl pt-BR devolve ("set."). */
export function formatMesAbrev(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("pt-BR", { month: "short", timeZone: TZ })
    .replace(/\.$/, "");
}

const TRES_DIAS_MS = 3 * 86400000;

/** Registro tardio: entregue mais de 3 dias depois de o encontro acontecer.
 *  Sem `realizado_em` cai na `data_hora` agendada; sem nenhuma das duas não dá
 *  pra atrasar → false. (Antes essa conta vivia duplicada em 3 componentes.) */
export function registroTardio(
  registro: { created_at: string },
  encontro?: { realizado_em: string | null; data_hora: string | null } | null
): boolean {
  const quando = encontro?.realizado_em ?? encontro?.data_hora;
  return (
    quando != null &&
    new Date(registro.created_at).getTime() - new Date(quando).getTime() >
      TRES_DIAS_MS
  );
}

/** Dias inteiros entre o encontro e a entrega do registro (0 quando não tardio). */
export function diasAtrasoRegistro(
  registro: { created_at: string },
  encontro?: { realizado_em: string | null; data_hora: string | null } | null
): number {
  const quando = encontro?.realizado_em ?? encontro?.data_hora;
  if (quando == null) return 0;
  const dias = Math.round(
    (new Date(registro.created_at).getTime() - new Date(quando).getTime()) /
      86400000
  );
  return Math.max(0, dias);
}

/** "terça-feira" — dia da semana por extenso; "" se a data for inválida. */
export function formatDiaSemana(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = paraData(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: TZ });
}

/** "terça-feira (06/10)" — cai pra "06/10" se o dia da semana não resolver. */
export function formatDiaSemanaMes(iso: string | null | undefined): string {
  const dia = formatDiaSemana(iso);
  const dm = formatDiaMes(iso);
  return dia ? `${dia} (${dm})` : dm;
}

/** Rótulo do papel — mora aqui (não em app-shell) pra server components poderem usar. */
export function papelLabel(role: string | null | undefined) {
  switch (role) {
    case "coordenacao": return "Coordenação";
    case "supervisor": return "Supervisor de relacionamento";
    case "mentor_dpp": return "Mentor DPP";
    case "mentor_especialista": return "Mentor especialista";
    default: return "Sem papel definido";
  }
}

export function waLink(phone: string | null | undefined, mensagem: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // dado legado/edição manual pode ter caractere mas zero dígito ("-", "abc")
  // — wa.me/ vazio abre a página de erro do WhatsApp, então falha aqui
  if (!digits.length) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensagem)}`;
}
