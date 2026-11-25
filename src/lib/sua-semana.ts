import {
  aceitesDoPlano,
  estadoLeituraPlano,
  planoAberto,
  propostoEmDoPlano,
  resumoCombinado,
  type EstadoLeituraPlano,
  type PlanoCombinado,
  type ResumoCombinado,
} from "@/lib/plano-combinado";

// ---------- "Sua semana" (REALIZA-520) ----------
// Derivação pura, unificada por papel: a home do jovem, o card do mentor e
// a fila do staff leem o MESMO resumo do combinado — nenhuma das três
// deriva o plano sozinha. Sem Next nem Supabase: tudo que vem do banco
// entra como parâmetro (a lib não conhece queries).

/** DuplaPlano (embed da ficha/home) → a projeção que resumoCombinado lê.
 *  A mesma montagem que a ficha e a home do mentor faziam à mão: os
 *  aceites da 0224 (ou o aprovado_lado da 0219 num banco sem ela) e o
 *  "avisado em" ancorado no carimbo que ativou. */
export function combinadoDaDupla(p: {
  id: string;
  status: string;
  versao: number;
  escopo?: PlanoCombinado["escopo"] | null;
  passos?: { numero: number; data_nova: string }[];
  aprovado_lado: "mentor" | "mentorado" | null;
  aceito_mentor_em?: string | null;
  aceito_mentorado_em?: string | null;
  aprovado_em?: string | null;
  created_at?: string;
  proposto_via?: string | null;
  expira_em?: string | null;
  concluido_em?: string | null;
}): PlanoCombinado {
  return {
    id: p.id,
    status: p.status,
    versao: p.versao,
    aprovado_lado: p.aprovado_lado,
    aceites: aceitesDoPlano(p),
    escopo: p.escopo ?? null,
    passos: (p.passos ?? []).map((s) => ({
      numero: s.numero,
      data_nova: s.data_nova,
    })),
    // "você foi avisado em" ancora no carimbo que ativou — a coluna
    // proposto_em não existe na tabela (a régua é a do banco)
    proposto_em: propostoEmDoPlano(p),
    proposto_via: p.proposto_via ?? null,
    expira_em: p.expira_em ?? null,
    concluido_em: p.concluido_em ?? null,
  };
}

/** O que o bloco "Sua semana" precisa, já mastigado: o resumo, a leitura
 *  de quem abre a tela, o vínculo do próximo encontro ao plano, o ritmo em
 *  texto e a janela de contestação (a mesma guarda da plano_responder). */
export type SemanaPlano = {
  resumo: ResumoCombinado;
  estado: EstadoLeituraPlano;
  /** número do próximo encontro quando ele é passo do plano — alimenta o
   *  "este é o Nº encontro do plano que Fulano combinou". */
  vinculo: number | null;
  /** "até 2 encontros por semana" — o mesmo texto do combinado. */
  ritmo: string | null;
  /** Dá pra contestar enquanto nenhum passo do plano aconteceu depois da
   *  proposta — a regra que a RPC aplica no banco, derivada na tela pra
   *  não prometer gesto que o servidor recusaria. */
  contestavel: boolean;
};

export function suaSemana(input: {
  plano: PlanoCombinado;
  /** lado de quem lê: "mentor" | "mentorado"; null = staff. */
  meuLado: "mentor" | "mentorado" | null;
  /** números de encontro já realizados da dupla. */
  realizados?: readonly number[];
  /** números com encontro realizado DEPOIS da proposta — zeram a janela
   *  de contestação. O caller deriva por realizado_em > proposto_em. */
  realizadosAposProposta?: readonly number[];
  /** número do próximo encontro agendado (o "este é o Nº" do vínculo). */
  proximoNumero?: number | null;
}): SemanaPlano | null {
  const resumo = resumoCombinado(input.plano, input.realizados ?? []);
  if (!resumo.aberto) return null;
  const estado = estadoLeituraPlano({
    status: input.plano.status,
    meuLado: input.meuLado,
    aceites: resumo.aceites,
  });
  if (!estado) return null;
  const passos = new Set(
    (input.plano.escopo?.passos ?? []).map((p) => p.numero)
  );
  const ritmo = input.plano.escopo?.ritmo ?? null;
  return {
    resumo,
    estado,
    vinculo:
      input.proximoNumero != null && passos.has(input.proximoNumero)
        ? input.proximoNumero
        : null,
    ritmo:
      ritmo != null && ritmo > 0
        ? `até ${ritmo} ${ritmo === 1 ? "encontro" : "encontros"} por semana`
        : null,
    contestavel:
      estado !== "contestado" &&
      !(input.realizadosAposProposta ?? []).some((n) => passos.has(n)),
  };
}

/** "Fulano combinou" / "você combinou" / "a equipe combinou" — a autoria
 *  do combinado em primeiro nome. `proposto_por` é uuid de profiles: a
 *  resolução passa por um mapa que o caller monta com quem ele conhece
 *  (mentor, supervisor, contatos do jovem). Não resolvido e não próprio =
 *  "a equipe" — nunca o uuid cru nem um palpite. */
export function quemCombinou(input: {
  propostoPor: string | null | undefined;
  /** "app" | "liza" — reservado pra copy futura ("a Liza combinou"). */
  propostoVia?: string | null;
  /** profile id de quem lê — quando o plano nasceu do próprio lado. */
  euId?: string | null;
  /** profile id → primeiro nome (mentor, supervisor, contatos…). */
  nomesPorId?: ReadonlyMap<string, string>;
  /** ids alternativos do outro lado (ex.: mentorados.id) → primeiro nome. */
  nomesPorOutroId?: ReadonlyMap<string, string>;
}): string {
  const por = input.propostoPor;
  if (!por) return "a equipe";
  if (input.euId != null && por === input.euId) return "você";
  const nome =
    input.nomesPorId?.get(por) ?? input.nomesPorOutroId?.get(por) ?? null;
  return nome ?? "a equipe";
}

// ---------- "O que precisa de você" (staff) ----------

/** Dias civis até a data (negativo = já passou) — âncora de meio-dia UTC. */
function diasAte(iso: string, hoje: string): number {
  return Math.round(
    (Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) -
      Date.parse(`${hoje}T12:00:00Z`)) /
      86_400_000
  );
}

/** O motivo pedindo atenção, sempre antes do rótulo de quem é — a régua
 *  da spec 019: proposta expirando, passo vencido, contestado recente,
 *  decisão pendente (aceite da dupla ou recesso sem marcação). */
export type MotivoAtencao =
  | { tipo: "expira"; dias: number }
  | { tipo: "passo_vencido"; numero: number }
  /** `haDias` = dias civis desde a contestação (0 = hoje) — calculado
   *  com o `hoje` do caller, nunca com o relógio do render. */
  | { tipo: "contestado"; em: string; haDias: number }
  | { tipo: "decisao"; detalhe: "aceite" | "recesso" };

export type ItemAtencao = {
  motivo: MotivoAtencao;
  /** a linha como aparece depois do nome da dupla — começa minúscula. */
  texto: string;
  /** menor sobe na fila — expirando > passo vencido > contestado > decisão. */
  rank: number;
};

/** Proposta aberta que expira em até N dias conta como "expirando". */
const JANELA_EXPIRANDO_DIAS = 4;
/** Contestação é notícia por uma semana — depois disso ela vira histórico
 *  (o "último plano" da ficha segue contando). */
const CONTESTADO_RECENTE_DIAS = 7;

export function textoDoMotivo(m: MotivoAtencao): string {
  switch (m.tipo) {
    case "expira":
      return m.dias < 0
        ? "proposta vencida"
        : m.dias === 0
          ? "proposta expira hoje"
          : m.dias === 1
            ? "proposta expira amanhã"
            : `proposta expira em ${m.dias} dias`;
    case "passo_vencido":
      return `o ${m.numero}º encontro passou da data combinada`;
    case "contestado":
      return m.haDias === 0
        ? "plano contestado hoje"
        : m.haDias === 1
          ? "plano contestado ontem"
          : `plano contestado há ${m.haDias} dias`;
    case "decisao":
      return m.detalhe === "recesso"
        ? "recesso sem decisão da dupla"
        : "proposta esperando aceite da dupla";
  }
}

/** Um motivo por dupla — a fila é curta e o motivo mais urgente fala.
 *  Recebe o plano vivo + o último contestado já separados pelo caller. */
export function atencaoDaDupla(input: {
  /** plano vivo (proposto/aceito/ativo) ou null. */
  vivo: {
    status: string;
    escopo?: { passos?: { numero: number; data: string }[] | null } | null;
    passos?: { numero: number; data_nova: string }[];
    expira_em?: string | null;
  } | null;
  /** último plano contestado (qualquer idade — a recência é medida aqui). */
  contestado?: { contestado_em?: string | null } | null;
  /** "YYYY-MM-DD" no fuso do programa. */
  hoje: string;
  /** números de encontro já realizados. */
  realizados?: readonly number[];
  /** recesso do cronograma vigente/futuro sem decisão da dupla. */
  recessoPendente?: boolean;
}): ItemAtencao | null {
  const motivos: { motivo: MotivoAtencao; rank: number }[] = [];
  const v = input.vivo;

  if (v?.status === "proposto" && v.expira_em) {
    const dias = diasAte(v.expira_em, input.hoje);
    if (dias <= JANELA_EXPIRANDO_DIAS)
      motivos.push({ motivo: { tipo: "expira", dias }, rank: Math.max(0, dias) });
  }

  if (v && (v.status === "aceito" || v.status === "ativo")) {
    const feitos = new Set(input.realizados ?? []);
    const aplicados = new Set((v.passos ?? []).map((p) => p.numero));
    // o primeiro passo devendo data cuja data combinada já passou —
    // "pendente" segue a mesma leitura do resumoCombinado
    const vencido = (v.escopo?.passos ?? [])
      .slice()
      .sort((a, b) => a.numero - b.numero)
      .find(
        (p) =>
          !feitos.has(p.numero) &&
          !aplicados.has(p.numero) &&
          p.data < input.hoje
      );
    if (vencido)
      motivos.push({
        motivo: { tipo: "passo_vencido", numero: vencido.numero },
        rank: 10,
      });
  }

  const contestadoEm = input.contestado?.contestado_em ?? null;
  if (contestadoEm) {
    const ha = -diasAte(contestadoEm.slice(0, 10), input.hoje);
    if (ha >= 0 && ha <= CONTESTADO_RECENTE_DIAS)
      motivos.push({
        motivo: { tipo: "contestado", em: contestadoEm, haDias: ha },
        rank: 20,
      });
  }

  // decisão pendente: a dupla ainda não respondeu (proposta sem aceite)
  // ou o recesso do caminho segue sem marcação — o auxiliar cobra e
  // aponta o caminho, não responde por eles
  if (v?.status === "proposto") {
    motivos.push({
      motivo: { tipo: "decisao", detalhe: "aceite" },
      rank: 30,
    });
  } else if (input.recessoPendente) {
    motivos.push({
      motivo: { tipo: "decisao", detalhe: "recesso" },
      rank: 30,
    });
  }

  const topo = motivos.sort((a, b) => a.rank - b.rank)[0];
  return topo ? { motivo: topo.motivo, texto: textoDoMotivo(topo.motivo), rank: topo.rank } : null;
}

/** Recesso pede atenção da fila quando o início já se aproxima (dá pra
 *  remontar o calendário) — mais longe disso a ficha pergunta na hora
 *  certa e a fila não grita meses antes. */
const JANELA_RECESSO_DIAS = 45;

function somaDiasYmd(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Recesso oficial do cronograma da dupla sem decisão registrada —
 *  pendente é a AUSÊNCIA de row em dupla_recessos (qualquer row vale como
 *  decidida). Só conta o que já pede atenção: vigente/futuro E (a) a
 *  menos de JANELA_RECESSO_DIAS do início, ou (b) coberto pela janela de
 *  um plano aberto — a decisão muda as datas do combinado. */
export function recessoSemDecisao(input: {
  eventos: readonly {
    id: string;
    tipo: string | null;
    data?: string | null;
    data_fim?: string | null;
  }[];
  decididos: ReadonlySet<string>;
  hoje: string;
  /** janela do plano vivo (escopo.janela) — o recesso dentro dela trava
   *  as datas do combinado enquanto não decide. */
  janelaPlano?: { inicio: string; fim: string } | null;
}): number {
  const corte = somaDiasYmd(input.hoje, JANELA_RECESSO_DIAS);
  const j = input.janelaPlano ?? null;
  return input.eventos.filter(
    (e) =>
      e.tipo === "recesso" &&
      e.data != null &&
      (e.data_fim ?? e.data) >= input.hoje &&
      (e.data <= corte ||
        (j != null &&
          e.data <= j.fim &&
          (e.data_fim ?? e.data) >= j.inicio)) &&
      !input.decididos.has(e.id)
  ).length;
}

/** Uma linha da fila "O que precisa de você". */
export type ItemPrecisaDeVoce = {
  duplaId: string;
  /** "Carlos × Caio" — primeiro nome dos dois. */
  nomes: string;
  motivo: ItemAtencao;
  /** destino do gesto — a ficha já abre no lugar certo. */
  href: string;
  /** rótulo do link de ação — o caminho que a dupla/staff segue na ficha. */
  acao: string;
};

const primeiro = (nome: string | null | undefined) =>
  (nome ?? "").split(" ")[0];

/** Corte da fila (019): a seção fica curta, o panorama cobre o resto. */
const LIMITE_FILA = 5;

/** Deriva a fila do staff sobre as duplas já entregues pela RLS — o
 *  recorte do papel (coordenação vê tudo, auxiliar as supervisionadas +
 *  a turma dele) é o que a query devolveu; a régua não refiltra escopo.
 *  Trilha especialista não tem plano "ficar em dia" nem decisão de
 *  recesso DPP — fica de fora. */
export function precisaDeVoce(input: {
  duplas: readonly {
    id: string;
    status: string;
    trilha?: string | null;
    cronograma_id?: string | null;
    mentor?: { nome?: string | null; nome_social?: string | null } | null;
    mentorado?: { nome?: string | null; nome_social?: string | null } | null;
    planos?: readonly {
      id: string;
      status: string;
      escopo?: {
        passos?: { numero: number; data: string }[] | null;
        janela?: { inicio: string; fim: string } | null;
      } | null;
      passos?: { numero: number; data_nova: string }[];
      expira_em?: string | null;
      contestado_em?: string | null;
      created_at?: string;
    }[] | null;
    recessos?: readonly { ciclo_evento_id: string }[] | null;
    encontros?: readonly { numero: number; status: string }[];
  }[];
  /** todos os ciclo_eventos — filtrados por cronograma da dupla aqui. */
  eventos: readonly {
    id: string;
    cronograma_id?: string | null;
    tipo: string | null;
    data?: string | null;
    data_fim?: string | null;
  }[];
  hoje: string;
}): { itens: ItemPrecisaDeVoce[]; total: number } {
  const itens: ItemPrecisaDeVoce[] = [];
  for (const d of input.duplas) {
    if (d.trilha === "especialista") continue;
    if (d.status !== "ativa" && d.status !== "pausada") continue;

    const planos = d.planos ?? [];
    const vivo =
      planos
        .filter((p) => planoAberto(p.status))
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0] ??
      null;
    const contestado =
      planos
        .filter((p) => p.status === "contestado" && p.contestado_em)
        .sort((a, b) =>
          (b.contestado_em ?? "").localeCompare(a.contestado_em ?? "")
        )[0] ?? null;

    const decididos = new Set(
      (d.recessos ?? []).map((r) => r.ciclo_evento_id)
    );
    const recessoPendente =
      recessoSemDecisao({
        eventos: input.eventos.filter(
          (e) => e.cronograma_id === d.cronograma_id
        ),
        decididos,
        hoje: input.hoje,
        janelaPlano: vivo?.escopo?.janela ?? null,
      }) > 0;

    const atencao = atencaoDaDupla({
      vivo,
      contestado,
      hoje: input.hoje,
      realizados: (d.encontros ?? [])
        .filter((e) => e.status === "realizado")
        .map((e) => e.numero),
      recessoPendente,
    });
    if (!atencao) continue;

    const ficha = `/duplas/${d.id}`;
    const destino =
      atencao.motivo.tipo === "decisao" && atencao.motivo.detalhe === "recesso"
        ? // #recesso-dupla existe nos dois mundos (card standalone e o
          // bloco dentro do plano); staff só acompanha — a ação é ver,
          // nunca declarar (a RPC de recesso é da dupla, 0225)
          { href: `${ficha}#recesso-dupla`, acao: "Ver o recesso" }
        : atencao.motivo.tipo === "contestado"
          ? { href: `${ficha}#acordos`, acao: "Retomar o plano" }
          : atencao.motivo.tipo === "passo_vencido"
            ? { href: `${ficha}#acordos`, acao: "Ver o combinado" }
            : { href: `${ficha}#acordos`, acao: "Ver a proposta" };

    itens.push({
      duplaId: d.id,
      // "—" nunca vira nome de pessoa: a linha junta só os lados que
      // têm nome (dupla sem lado algum não existe na prática, mas se
      // chegar vazio o link lê "a dupla", não um travessão)
      nomes:
        [
          primeiro(d.mentor?.nome_social ?? d.mentor?.nome),
          primeiro(d.mentorado?.nome_social ?? d.mentorado?.nome),
        ]
          .filter(Boolean)
          .join(" × ") || "a dupla",
      motivo: atencao,
      ...destino,
    });
  }
  // lista curta (019): o urgente ordena na frente e o resto vai pro
  // panorama — a seção não vira feed
  const ordenados = itens.sort(
    (a, b) => a.motivo.rank - b.motivo.rank || a.nomes.localeCompare(b.nomes)
  );
  return { itens: ordenados.slice(0, LIMITE_FILA), total: ordenados.length };
}
