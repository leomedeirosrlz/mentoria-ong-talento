import { diffDias, formatDiaMes, semanaBounds, toDateStr } from "./ciclo";

/** Derivação única das pendências do jovem (REALIZA-493 / R1): responde
 *  "o que precisa de você agora?" numa lista só, ordenada por prioridade.
 *  A home e a agenda consomem a mesma fonte em vez de cada superfície
 *  derivar a sua. Pura e determinística: nada de relógio escondido — `hoje`
 *  (e o `agora` opcional, pra "hoje com hora passada") chegam por parâmetro;
 *  os arrays de entrada já vêm filtrados do servidor (RLS) e aqui só se
 *  projeta. Sem JSX, sem Supabase, sem efeitos. */

export type TipoPendencia =
  | "encontro_sem_desfecho"
  | "registro_retroativo"
  | "termo"
  | "combinado"
  | "avaliacao"
  | "especialista"
  | "aviso"
  | "chamado";

export type AcaoPendencia =
  | "responder_encontro"
  | "remarcar"
  | "registrar_retroativo"
  | "assinar"
  | "marcar_combinado"
  | "avaliar"
  | "ver_especialista"
  | "ler_aviso"
  | "abrir_chamado";

export type PendenciaJovem = {
  /** Estável e único: `${tipo}` + alvo — dois caminhos pro mesmo alvo não
   *  duplicam linha (a dedup é por id). */
  id: string;
  tipo: TipoPendencia;
  /** Maior primeiro — a ordem fixa das regras mora nos pesos abaixo. */
  prioridade: number;
  /** Frase curta, pt-BR, sem travessão. */
  titulo: string;
  contexto?: string;
  /** ISO ou YYYY-MM-DD pra ordenar/exibir; null ordena por último. */
  quando?: string | null;
  acao: {
    tipo: AcaoPendencia;
    rotulo: string;
    href?: string;
    /** O alvo da ação quando ela é um gesto na própria tela (dialog) e não
     *  uma navegação — encontro.id, combinado.id, nº do retroativo. */
    alvoId?: string;
  };
  acaoSecundaria?: {
    tipo: AcaoPendencia;
    rotulo: string;
    href?: string;
    alvoId?: string;
  };
  /** Só no primeiro item da lista ordenada — o gesto que ganha o botão
   *  preenchido. */
  destaque?: boolean;
};

// ---------- entradas (estruturais, fáceis de mapear das views do jovem) ----------

/** Encontro da dupla do jovem (JovemEncontro + o nome de quem conduz). */
export type EncontroPendencia = {
  id: string;
  /** Nº exibido: o número do encontro DPP ou o passo da sessão esp (o
   *  chamador resolve o rank via passoEsp quando `sessao` é true). */
  numero: number;
  status: string | null;
  /** ISO com hora ou YYYY-MM-DD — inválido/futuro não vira pendência. */
  dataHora: string | null;
  /** Trilha de especialista: "sessão" em vez de "encontro" no título. */
  sessao?: boolean;
  /** Nome de quem conduz (mentor ou especialista) — vira o contexto. */
  comNome?: string | null;
};

/** Passo oficial vencido e sem row — o retroativo elegível (0207/0208). O
 *  chamador cruza cronograma × encontros e manda só os nºs elegíveis. */
export type RetroPendencia = {
  numero: number;
  duplaId?: string | null;
  /** Data oficial do passo (YYYY-MM-DD) — ancora a "semana de dd/mm". */
  dataOficial?: string | null;
};

/** Documento do jovem_assinaturas: termo dele pra assinar ou a autorização
 *  que o responsável assina (o gesto dele é encaminhar o link). */
export type DocumentoPendencia = {
  id: string;
  slug?: string | null;
  titulo?: string | null;
  status: string | null;
  /** Token do link público /assinar/[token]; sem ele não há href. */
  token?: string | null;
  tokenExpiraEm?: string | null;
};

/** Encaminhamento onde o jovem é o responsável (jovem_encaminhamentos). */
export type CombinadoPendencia = {
  id: string;
  descricao: string | null;
  /** Prazo YYYY-MM-DD — sem prazo nunca "vence", então não entra. */
  prazo: string | null;
  status: string | null;
};

/** Encontro realizado ainda sem a estrela do jovem. */
export type AvaliacaoPendencia = {
  /** id do encontro — alvoId da sequência de avaliação. */
  id: string;
  rotulo?: string | null;
  realizadoEm?: string | null;
};

/** Solicitação 'sugerida': o mentor indicou um especialista e o jovem decide. */
export type SugestaoPendencia = {
  id: string;
  /** Quem sugeriu (mentor/coord) — o primeiro nome entra no título. */
  sugeridoPor?: string | null;
  especialistaNome?: string | null;
  criadoEm?: string | null;
};

/** Comunicado da coordenação — só urgente/importante viram pendência. */
export type AvisoPendencia = {
  id: string;
  titulo: string | null;
  prioridade: string | null;
  criadoEm?: string | null;
};

/** Chamado do jovem — entra só quando a equipe respondeu (o chamador sabe
 *  pela timeline; a row sozinha não diz se a resposta é nova). */
export type ChamadoPendencia = {
  id: string;
  assunto?: string | null;
  temRespostaEquipe: boolean;
  /** Nome de quem respondeu ("Marina") — o primeiro nome entra no título. */
  respondeuNome?: string | null;
  atualizadoEm?: string | null;
};

export type EntradaPendencias = {
  /** "YYYY-MM-DD" no fuso do programa — sem Date.now() interno. */
  hoje: string;
  /** ISO opcional: habilita "hoje com hora passada" (encontro das 19h vira
   *  pendência às 20h). Ausente, só dia estritamente anterior conta. */
  agora?: string | null;
  encontros: EncontroPendencia[];
  avaliacoes: AvaliacaoPendencia[];
  documentos: DocumentoPendencia[];
  combinados: CombinadoPendencia[];
  sugestoes: SugestaoPendencia[];
  avisos: AvisoPendencia[];
  retro: RetroPendencia[];
  chamados?: ChamadoPendencia[];
};

// ---------- constantes ----------

/** Combinado entra quando falta pouco pro prazo — a janela do "vencendo"
 *  (vencido sempre entra, a diferença fica negativa). */
const JANELA_COMBINADO_DIAS = 3;

const PRIO_AVISO: Record<string, { prioridade: number; contexto: string }> = {
  urgente: { prioridade: 55, contexto: "Urgente" },
  importante: { prioridade: 45, contexto: "Importante" },
};

// ---------- helpers de data/texto ----------

/** "YYYY-MM-DD" é dia de calendário, não instante — âncora no meio-dia
 *  (mesma convenção do ciclo) pra o fuso da máquina não virar o dia. ISO
 *  completo segue instante. Null/inválido → null. */
function instanteDe(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T12:00:00-03:00`).getTime()
    : Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** Dia de calendário do ISO no fuso do programa; null quando não é data. */
function diaDe(iso: string | null | undefined): string | null {
  const t = instanteDe(iso);
  return t == null ? null : toDateStr(new Date(t));
}

/** "17/11" — dia/mês compacto; null quando a entrada não é data. */
function ddmm(iso: string | null | undefined): string | null {
  const dia = diaDe(iso);
  return dia == null ? null : formatDiaMes(dia).slice(0, 5);
}

/** "Já passou" na régua da entrada: com `agora` compara instante (o
 *  encontro das 19h vira pendência às 20h); sem ele só dia estritamente
 *  anterior — não acusar o que ainda pode acontecer hoje. */
function passou(
  iso: string | null | undefined,
  hoje: string,
  agoraMs: number | null
): boolean {
  const t = instanteDe(iso);
  if (t == null) return false;
  if (agoraMs != null) return t < agoraMs;
  return diaDe(iso)! < hoje;
}

function primeiroNome(nome: string | null | undefined): string {
  return nome?.trim().split(/\s+/)[0] ?? "";
}

function lcfirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// ---------- derivações por tipo ----------

/** 100 — agendado cujo horário já passou e ninguém contou como foi. Um item
 *  por encontro; o desfecho é do jovem ("aconteceu") ou remarcação. */
function encontrosSemDesfecho(
  encontros: EncontroPendencia[],
  hoje: string,
  agoraMs: number | null
): PendenciaJovem[] {
  const out: PendenciaJovem[] = [];
  for (const e of encontros) {
    if (e.id == null || e.status !== "agendado") continue;
    if (e.dataHora == null || instanteDe(e.dataHora) == null) continue;
    if (!passou(e.dataHora, hoje, agoraMs)) continue;
    const sujeito = e.sessao
      ? `A ${e.numero}ª sessão`
      : `O ${e.numero}º encontro`;
    const nome = primeiroNome(e.comNome);
    out.push({
      id: `encontro:${e.id}`,
      tipo: "encontro_sem_desfecho",
      prioridade: 100,
      titulo: `${sujeito} era em ${ddmm(e.dataHora)}. Aconteceu?`,
      contexto: nome ? `com ${nome}` : undefined,
      quando: e.dataHora,
      acao: { tipo: "responder_encontro", rotulo: "Aconteceu", alvoId: e.id },
      acaoSecundaria: {
        tipo: "remarcar",
        rotulo: "Remarcar",
        alvoId: e.id,
      },
    });
  }
  return out;
}

/** 90 — passo oficial vencido e sem row: a sessão pode ter rolado sem
 *  agendamento e o jovem mesmo registra (a RPC revalida a janela). */
function retroativos(retro: RetroPendencia[]): PendenciaJovem[] {
  const out: PendenciaJovem[] = [];
  for (const r of retro) {
    if (!Number.isInteger(r.numero) || r.numero < 1) continue;
    // a janela honesta é a semana do guia, não o dia exato — o passo vale
    // pela semana oficial inteira
    const dia = diaDe(r.dataOficial);
    const seg = dia
      ? ddmm(semanaBounds(new Date(`${dia}T12:00:00-03:00`)).seg)
      : null;
    out.push({
      id: `retro:${r.duplaId ?? "dpp"}:${r.numero}`,
      tipo: "registro_retroativo",
      prioridade: 90,
      titulo: seg
        ? `O ${r.numero}º encontro era na semana de ${seg} e não está na agenda. Vocês se encontraram?`
        : `O ${r.numero}º encontro não está na agenda. Vocês se encontraram?`,
      quando: r.dataOficial ?? null,
      acao: {
        tipo: "registrar_retroativo",
        rotulo: "Sim, registrar",
        alvoId: String(r.numero),
      },
    });
  }
  return out;
}

/** 85 — documento esperando a assinatura (ou o encaminhamento ao
 *  responsável). Link expirado conta como passado: a expiração é lazy no
 *  banco — quem abre o link carimba, a pendência já desce. */
function documentos(
  documentos: DocumentoPendencia[],
  hoje: string,
  agoraMs: number | null
): PendenciaJovem[] {
  const out: PendenciaJovem[] = [];
  for (const d of documentos) {
    if (d.id == null || d.status !== "pendente") continue;
    if (passou(d.tokenExpiraEm, hoje, agoraMs)) continue;
    const autorizacao = d.slug === "autorizacao-responsavel";
    const tituloDoc = d.titulo?.trim();
    const expira = d.tokenExpiraEm ? formatDiaMes(d.tokenExpiraEm) : null;
    out.push({
      id: `doc:${d.id}`,
      tipo: "termo",
      prioridade: 85,
      titulo: autorizacao
        ? "Encaminhe a autorização para seu responsável"
        : d.slug === "termo-mentorando" || !tituloDoc
          ? "Assine o termo de participação"
          : `Assine ${lcfirst(tituloDoc)}`,
      contexto:
        expira && expira !== "a definir" ? `vale até ${expira}` : undefined,
      quando: d.tokenExpiraEm ?? null,
      acao: {
        tipo: "assinar",
        rotulo: autorizacao ? "Encaminhar" : "Assinar",
        href: d.token ? `/assinar/${d.token}` : undefined,
        alvoId: d.id,
      },
    });
  }
  return out;
}

/** 80 — combinado aberto com prazo dentro da janela (ou já vencido).
 *  Sem prazo nunca vence, então não entra aqui — segue na lista normal. */
function combinados(
  combinados: CombinadoPendencia[],
  hoje: string
): PendenciaJovem[] {
  const out: PendenciaJovem[] = [];
  for (const c of combinados) {
    if (c.id == null || c.status === "feito") continue;
    const diaPrazo = diaDe(c.prazo);
    if (diaPrazo == null) continue;
    if (diffDias(diaPrazo, hoje) > JANELA_COMBINADO_DIAS) continue;
    const vencido = diaPrazo < hoje;
    const descricao = c.descricao?.trim();
    out.push({
      id: `combinado:${c.id}`,
      tipo: "combinado",
      prioridade: 80,
      titulo: `${descricao || "Combinado"} · até ${ddmm(diaPrazo)}`,
      contexto: vencido
        ? "passou do prazo, vale fazer mesmo assim"
        : undefined,
      quando: diaPrazo,
      acao: {
        tipo: "marcar_combinado",
        rotulo: "Marcar feito",
        href: "/jovem#combinados-titulo",
        alvoId: c.id,
      },
    });
  }
  return out;
}

/** 70 — UMA linha agrupada por mais avaliações que haja: avaliar é gesto
 *  leve e em sequência, não N itens competindo com o encontro. O alvo é o
 *  encontro mais recente (o primeiro da sequência). */
function avaliacoes(lista: AvaliacaoPendencia[]): PendenciaJovem[] {
  const validas = lista.filter((a) => a.id != null);
  if (validas.length === 0) return [];
  const maisRecente = [...validas].sort(
    (a, b) =>
      (instanteDe(b.realizadoEm) ?? Number.NEGATIVE_INFINITY) -
      (instanteDe(a.realizadoEm) ?? Number.NEGATIVE_INFINITY)
  )[0];
  const n = validas.length;
  return [
    {
      id: "avaliacoes",
      tipo: "avaliacao",
      prioridade: 70,
      titulo: `${n} ${n === 1 ? "encontro esperando" : "encontros esperando"} sua avaliação`,
      contexto: "1 min cada",
      quando: maisRecente.realizadoEm ?? null,
      acao: {
        tipo: "avaliar",
        rotulo: n === 1 ? "Avaliar" : "Avaliar em sequência",
        alvoId: maisRecente.id,
      },
    },
  ];
}

/** 60 — o mentor sugeriu um especialista; a decisão é do jovem e mora na
 *  página de especialistas. */
function sugestoes(lista: SugestaoPendencia[]): PendenciaJovem[] {
  const out: PendenciaJovem[] = [];
  for (const s of lista) {
    if (s.id == null) continue;
    out.push({
      id: `especialista:${s.id}`,
      tipo: "especialista",
      prioridade: 60,
      titulo: `${primeiroNome(s.sugeridoPor) || "Seu mentor"} sugeriu um especialista`,
      contexto: s.especialistaNome?.trim() || undefined,
      quando: s.criadoEm ?? null,
      acao: {
        tipo: "ver_especialista",
        rotulo: "Ver especialista",
        href: "/jovem/especialistas",
        alvoId: s.id,
      },
    });
  }
  return out;
}

/** 55 urgente / 45 importante — o comum segue recolhido na seção, não
 *  vira tarefa. */
function avisos(lista: AvisoPendencia[]): PendenciaJovem[] {
  const out: PendenciaJovem[] = [];
  for (const a of lista) {
    const prio = a.prioridade ? PRIO_AVISO[a.prioridade] : undefined;
    if (a.id == null || !prio || !a.titulo?.trim()) continue;
    out.push({
      id: `aviso:${a.id}`,
      tipo: "aviso",
      prioridade: prio.prioridade,
      titulo: a.titulo.trim(),
      contexto: prio.contexto,
      quando: a.criadoEm ?? null,
      acao: {
        tipo: "ler_aviso",
        rotulo: "Ler aviso",
        href: "/jovem#avisos",
        alvoId: a.id,
      },
    });
  }
  return out;
}

/** 50 — a equipe respondeu o pedido de ajuda; a conversa mora no perfil. */
function chamados(lista: ChamadoPendencia[]): PendenciaJovem[] {
  const out: PendenciaJovem[] = [];
  for (const c of lista) {
    if (c.id == null || !c.temRespostaEquipe) continue;
    out.push({
      id: `chamado:${c.id}`,
      tipo: "chamado",
      prioridade: 50,
      titulo: `${primeiroNome(c.respondeuNome) || "A equipe"} respondeu seu pedido`,
      contexto: c.assunto?.trim() || undefined,
      quando: c.atualizadoEm ?? null,
      acao: {
        tipo: "abrir_chamado",
        rotulo: "Ver resposta",
        href: `/jovem/perfil?c=${c.id}`,
        alvoId: c.id,
      },
    });
  }
  return out;
}

// ---------- derivação ----------

/** Lista única e ordenada das pendências do jovem. Determinística: mesma
 *  entrada, mesma saída — prioridade desc, `quando` asc (nulos por último),
 *  `id` asc. Dedup por id. `destaque` só no primeiro. */
export function derivarPendencias(
  input: EntradaPendencias
): PendenciaJovem[] {
  const hoje = input.hoje;
  const agoraMs = instanteDe(input.agora);

  const itens = [
    ...encontrosSemDesfecho(input.encontros ?? [], hoje, agoraMs),
    ...retroativos(input.retro ?? []),
    ...documentos(input.documentos ?? [], hoje, agoraMs),
    ...combinados(input.combinados ?? [], hoje),
    ...avaliacoes(input.avaliacoes ?? []),
    ...sugestoes(input.sugestoes ?? []),
    ...avisos(input.avisos ?? []),
    ...chamados(input.chamados ?? []),
  ];

  const unicos = new Map<string, PendenciaJovem>();
  for (const p of itens) if (!unicos.has(p.id)) unicos.set(p.id, p);

  const ordenadas = [...unicos.values()].sort((a, b) => {
    if (b.prioridade !== a.prioridade) return b.prioridade - a.prioridade;
    const ta = instanteDe(a.quando);
    const tb = instanteDe(b.quando);
    if (ta != null && tb == null) return -1;
    if (ta == null && tb != null) return 1;
    if (ta != null && tb != null && ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });

  if (ordenadas.length > 0) ordenadas[0].destaque = true;
  return ordenadas;
}
