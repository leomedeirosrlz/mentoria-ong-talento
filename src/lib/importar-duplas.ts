/** Pareamento em lote (REALIZA-102): CSV "mentor × mentorado" -> duplas.
 *
 *  Núcleo puro, sem I/O — a server action monta o `DiretorioPar` UMA vez
 *  (profiles + contatos, mentorados, duplas, cronogramas, capacidades,
 *  eventos) e resolve cada linha sem nova ida ao banco. A MESMA resolução
 *  alimenta a prévia do dialog (`previewDuplas`) e a gravação
 *  (`importDuplas`): o que a prévia promete é o que o import faz.
 *
 *  Identidade: e-mail quando a célula tem "@" (match exato normalizado);
 *  senão nome — exato sem acento/case contra `nome` e `nome_social`, e como
 *  fallback "nome de exibição contido" (todo token do valor é token do
 *  cadastro — "Juliana Novaes" acha "Juliana Novaes de Oliveira"). Apelido
 *  que não é pedaço do nome ("Drica" -> Adriana) NÃO resolve sozinho;
 *  2+ candidatos em qualquer passo = linha falha, nunca chute. */

import {
  normData,
  normEmail,
  normHeader,
  normNome,
  parseCsvCom,
  semAcento,
} from "./importar";
import {
  cronogramaVigente,
  inicioDefaultDupla,
  podeSupervisionar,
  toDateStr,
} from "./ciclo";
import type { AppRole, CicloEvento, Cronograma, Trilha } from "./types";

// ---------- parser ----------

export type CampoPar =
  | "mentor"
  | "mentorado"
  | "supervisor"
  | "turma"
  | "demanda"
  | "iniciada_em";

/** Linha de pareamento já normalizada — `n` é a posição entre as linhas de
 *  dado (1-based), pra prévia e o relatório apontarem a mesma linha. */
export type LinhaPar = Record<CampoPar, string> & { n: number };

const PAR_VAZIO: Record<CampoPar, string> = {
  mentor: "",
  mentorado: "",
  supervisor: "",
  turma: "",
  demanda: "",
  iniciada_em: "",
};

/** Cabeçalho -> campo do par. `mentorado` sai antes de `mentor` ("mentor"
 *  é substring de "mentorado"/"mentorando"); os lados aceitam nome OU
 *  e-mail na mesma coluna — quem decide é o conteúdo da célula. */
export function canonHeaderPar(h: string): CampoPar | null {
  const n = normHeader(h);
  if (/\bmentorad|\bmentorand|\bjovem|\bmentee|\bpupilo/.test(n))
    return "mentorado";
  if (/\bmentor(a|es)?\b|\btutor(a|es)?\b/.test(n)) return "mentor";
  if (/\bsupervis/.test(n)) return "supervisor";
  if (/\biniciad|\binicio\b|\bcomeco|\bdesde\b/.test(n)) return "iniciada_em";
  if (/\bdemanda\b|\beixo\b|\btema\b|\bfoco\b/.test(n)) return "demanda";
  if (/\bturma\b|\bgrupo\b|\bclasse\b/.test(n)) return "turma";
  return null;
}

/** CSV de pareamento: exige as colunas `mentor` e `mentorado`; linha sem
 *  nenhum dos dois lados é ignorada, linha com um lado só entra e a falta
 *  do outro vira motivo de pulada na resolução. */
export function parseCsvPares(text: string): {
  linhas: LinhaPar[];
  ignoradas: number;
} {
  const { linhas, ignoradas } = parseCsvCom(
    text,
    canonHeaderPar,
    ["mentor", "mentorado"],
    (r) => !!(r.mentor ?? "").trim() || !!(r.mentorado ?? "").trim()
  );
  return {
    linhas: linhas.map((l, i) => ({ ...PAR_VAZIO, ...l, n: i + 1 })),
    ignoradas,
  };
}

/** O payload cru da action pode vir com campo ausente/errado — o parse do
 *  client já garante a forma, mas a fronteira da action não confia nisso. */
export function saneiaLinhaPar(l: Partial<LinhaPar>, i: number): LinhaPar {
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    n: typeof l.n === "number" && l.n > 0 ? l.n : i + 1,
    mentor: s(l.mentor),
    mentorado: s(l.mentorado),
    supervisor: s(l.supervisor),
    turma: s(l.turma),
    demanda: s(l.demanda),
    iniciada_em: s(l.iniciada_em),
  };
}

// ---------- resolução ----------

/** Candidato a match — o mínimo que a resolução precisa. `role`/`ativo`
 *  só chegam nos profiles; mentorados não têm os campos (sempre aptos). */
export type PessoaRef = {
  id: string;
  nome: string;
  email?: string | null;
  nome_social?: string | null;
  role?: AppRole | null;
  ativo?: boolean;
};

/** Dupla como o diretório precisa — o status decide se ocupa vaga. */
export type DuplaRef = {
  mentor_id: string;
  mentorado_id: string;
  trilha: string;
  status: string;
  turma: string;
  /** ISO — o desempate da "dupla DPP mais recente" na derivação de turma. */
  created_at: string;
};

/** Tudo que a resolução consulta, montado uma vez por lote. */
export type DiretorioPar = {
  profiles: PessoaRef[];
  mentorados: PessoaRef[];
  /** TODAS as duplas (qualquer status) — a derivação de turma da trilha
   *  especialista olha o histórico; os checks de vaga filtram ativa/pausada. */
  duplas: DuplaRef[];
  cronogramas: Cronograma[];
  /** profile_id -> capacidade; mentor sem linha em mentor_profiles vale 1. */
  capacidades: Map<string, number>;
  /** Eventos de todos os cronogramas — base do iniciada_em default da DPP. */
  eventos: {
    cronograma_id: string;
    tipo: CicloEvento["tipo"];
    data: string | null;
  }[];
};

/** O que uma linha resolvida vira no insert — espelha o cadastro manual
 *  (createDupla): trilha derivada do papel do mentor, supervisor fora da
 *  trilha especialista, iniciada_em uma semana antes do 1º encontro do
 *  cronograma quando a célula vem vazia. */
export type ParPronto = {
  mentor: PessoaRef;
  mentorado: PessoaRef;
  supervisor: PessoaRef | null;
  trilha: Trilha;
  turma: string;
  cronogramaId: string | null;
  iniciadaEm: string;
  demanda: string | null;
};

/** "ok" = pronta pra inserir · "existe" = vaga já ocupada (par vivo no
 *  banco/lote ou mentorado já em dupla da trilha) · "falha" = não resolveu
 *  ou violou regra. Os nomes vêm preenchidos até onde a resolução chegou —
 *  a prévia mostra "achou o mentor, faltou o mentorado" sem reprocessar. */
export type ResolucaoPar = {
  linha: LinhaPar;
  status: "ok" | "existe" | "falha";
  motivo: string | null;
  mentorNome: string | null;
  mentoradoNome: string | null;
  supervisorNome: string | null;
  turmaLabel: string | null;
  par: ParPronto | null;
};

/** Recorte da resolução pra prévia do dialog — só o que a tela exibe; os
 *  ids e o ParPronto ficam no server. */
export type PreviewPar = {
  n: number;
  status: ResolucaoPar["status"];
  motivo: string | null;
  mentorNome: string | null;
  mentoradoNome: string | null;
  supervisorNome: string | null;
  turmaLabel: string | null;
  trilha: Trilha | null;
  iniciadaEm: string | null;
};

export function previewPar(r: ResolucaoPar): PreviewPar {
  return {
    n: r.linha.n,
    status: r.status,
    motivo: r.motivo,
    mentorNome: r.mentorNome,
    mentoradoNome: r.mentoradoNome,
    supervisorNome: r.supervisorNome,
    turmaLabel: r.turmaLabel,
    trilha: r.par?.trilha ?? null,
    iniciadaEm: r.par?.iniciadaEm ?? null,
  };
}

const chaveNome = (s: string) => semAcento(normNome(s));
const ehEmail = (v: string) => v.includes("@");
const tokensNome = (s: string) =>
  chaveNome(s).split(" ").filter((t) => t.length >= 2);

/** As formas de nome de um cadastro — civil e social valem igual. */
function nomesDe(p: PessoaRef): string[] {
  return [p.nome, p.nome_social ?? ""].filter((s) => s.trim()).map(chaveNome);
}

function erroAmbiguo(valor: string, achados: PessoaRef[]): { erro: string } {
  const nomes = achados
    .slice(0, 3)
    .map((p) => p.nome)
    .join(", ");
  const resto = achados.length > 3 ? ` e mais ${achados.length - 3}` : "";
  return {
    erro: `"${valor}" é ambíguo (${nomes}${resto}) — use o e-mail`,
  };
}

/** Resolve uma célula de pessoa contra o diretório. E-mail (tem "@") casa
 *  exato normalizado; texto é nome — exato sem acento primeiro, contido por
 *  tokens depois. Nunca devolve chute: 0 -> "não achou", 2+ -> ambíguo. */
export function resolverPessoa<T extends PessoaRef>(
  valor: string,
  candidatos: T[]
): { pessoa: T } | { erro: string } {
  const v = normNome(valor);
  if (ehEmail(v)) {
    const alvo = normEmail(v);
    const achados = candidatos.filter(
      (c) => c.email && normEmail(c.email) === alvo
    );
    if (achados.length === 1) return { pessoa: achados[0] };
    if (achados.length > 1) return erroAmbiguo(v, achados);
    return { erro: `nenhum cadastro com o e-mail "${v}"` };
  }
  if (!v) return { erro: "célula vazia" };
  const q = chaveNome(v);
  const exatos = candidatos.filter((c) => nomesDe(c).includes(q));
  if (exatos.length === 1) return { pessoa: exatos[0] };
  if (exatos.length > 1) return erroAmbiguo(v, exatos);
  const qtok = tokensNome(v);
  if (qtok.length) {
    const contidos = candidatos.filter((c) =>
      nomesDe(c).some((nm) => {
        const t = new Set(nm.split(" "));
        return qtok.every((x) => t.has(x));
      })
    );
    if (contidos.length === 1) return { pessoa: contidos[0] };
    if (contidos.length > 1) return erroAmbiguo(v, contidos);
  }
  return { erro: `nenhum cadastro como "${v}"` };
}

/** Turma da linha -> cronograma. Célula vazia só resolve quando existe UM
 *  cronograma ativo — com 2+ turmas em andamento, chutar a vigente podia
 *  gravar a turma inteira no calendário errado sem aviso. Match: label
 *  exato (sem acento/case), depois contido ("T2" acha "T2 · 2026/2027");
 *  empate/ambíguo falha com a lista de turmas pra não deixar dúvida. */
function resolverCronograma(
  turmaTxt: string,
  cronogramas: Cronograma[]
): { cronograma: Cronograma } | { erro: string } {
  const rotulos = [...new Set(cronogramas.map((c) => c.turma))].join(", ");
  const txt = normNome(turmaTxt);
  if (!txt) {
    const ativos = cronogramas.filter((c) => c.status === "ativo");
    if (ativos.length === 1) return { cronograma: ativos[0] };
    return {
      erro: ativos.length
        ? `sem turma na linha e ${ativos.length} cronogramas ativos (${ativos
            .map((c) => c.turma)
            .join(", ")}) — informe a coluna turma`
        : "sem turma na linha e nenhum cronograma ativo — informe a coluna turma",
    };
  }
  const q = chaveNome(txt);
  const exatos = cronogramas.filter((c) => chaveNome(c.turma) === q);
  const match = exatos.length
    ? exatos
    : cronogramas.filter((c) => chaveNome(c.turma).includes(q));
  if (!match.length) {
    return { erro: `turma "${txt}" não encontrada — existentes: ${rotulos || "nenhuma"}` };
  }
  if (match.length === 1) return { cronograma: match[0] };
  // turma duplicada entre cronogramas: o ativo é a leitura óbvia do label
  const ativos = match.filter((c) => c.status === "ativo");
  if (ativos.length === 1) return { cronograma: ativos[0] };
  return { erro: `turma "${txt}" é ambígua (${match.length} cronogramas)` };
}

/** Resolve o lote inteiro contra o diretório — stateful de propósito: cada
 *  linha resolvida ocupa a vaga (par, mentorado×trilha, capacidade do
 *  mentor) pras linhas seguintes, então duplicata dentro do MESMO arquivo
 *  já cai como "existe" sem depender de ida ao banco. Ordem dos checks por
 *  linha espelha createDupla: resolve pessoas -> papel -> supervisor ->
 *  vaga -> turma -> data. */
export function resolverPares(
  linhas: LinhaPar[],
  dir: DiretorioPar,
  hoje = new Date()
): ResolucaoPar[] {
  const emCurso = dir.duplas.filter(
    (d) => d.status === "ativa" || d.status === "pausada"
  );
  const parVivo = new Set(
    emCurso.map((d) => `${d.mentor_id}|${d.mentorado_id}`)
  );
  const vagaOcupada = new Set(
    emCurso.map((d) => `${d.mentorado_id}|${d.trilha}`)
  );
  const duplasDoMentor = new Map<string, number>();
  for (const d of emCurso) {
    duplasDoMentor.set(d.mentor_id, (duplasDoMentor.get(d.mentor_id) ?? 0) + 1);
  }

  return linhas.map((linha) => {
    const r: ResolucaoPar = {
      linha,
      status: "falha",
      motivo: null,
      mentorNome: null,
      mentoradoNome: null,
      supervisorNome: null,
      turmaLabel: null,
      par: null,
    };
    const falha = (motivo: string): ResolucaoPar => ({ ...r, motivo });
    const existe = (motivo: string): ResolucaoPar => ({
      ...r,
      status: "existe",
      motivo,
    });

    // mentor — resolve em profiles; papel de mentor é o que libera a linha
    const rMentor = resolverPessoa(linha.mentor, dir.profiles);
    if ("erro" in rMentor) {
      return falha(
        linha.mentor.trim()
          ? `mentor: ${rMentor.erro}`
          : "mentor em branco"
      );
    }
    const mentor = rMentor.pessoa;
    r.mentorNome = mentor.nome;
    if (mentor.ativo === false) {
      return falha(`${mentor.nome}: cadastro inativo — reative antes de parear`);
    }
    if (mentor.role !== "mentor_dpp" && mentor.role !== "mentor_especialista") {
      return falha(`${mentor.nome}: não tem papel de mentor`);
    }
    // mesma régua do createDupla — a trilha é do mentor, não da planilha
    const trilha: Trilha =
      mentor.role === "mentor_especialista" ? "especialista" : "dpp";

    // mentorado — resolve em mentorados
    const rMd = resolverPessoa(linha.mentorado, dir.mentorados);
    if ("erro" in rMd) {
      return falha(
        linha.mentorado.trim()
          ? `mentorado: ${rMd.erro}`
          : "mentorado em branco"
      );
    }
    const mentorado = rMd.pessoa;
    r.mentoradoNome = mentorado.nome;

    // supervisor — só DPP leva (a especialista não tem supervisor, força
    // null como o cadastro manual); informado e não resolvido falha a
    // linha, nunca é ignorado em silêncio
    let supervisor: PessoaRef | null = null;
    if (trilha === "dpp" && linha.supervisor.trim()) {
      const rSup = resolverPessoa(linha.supervisor, dir.profiles);
      if ("erro" in rSup) return falha(`supervisor: ${rSup.erro}`);
      if (!podeSupervisionar(rSup.pessoa.role)) {
        return falha(`${rSup.pessoa.nome}: não pode supervisionar duplas`);
      }
      supervisor = rSup.pessoa;
      r.supervisorNome = supervisor.nome;
    }

    // idempotência — mesmo par ativo/pausado no banco ou já criado no lote
    if (parVivo.has(`${mentor.id}|${mentorado.id}`)) {
      return existe("par já existe (dupla ativa ou pausada)");
    }
    // mentorado ocupa UMA vaga por trilha (mesmo guard do createDupla)
    if (vagaOcupada.has(`${mentorado.id}|${trilha}`)) {
      return existe(
        trilha === "especialista"
          ? `${mentorado.nome} já está em uma dupla de especialista ativa`
          : `${mentorado.nome} já está em uma dupla ativa`
      );
    }
    // capacidade do mentor — o trigger do banco é a trava final; aqui é a
    // mensagem amigável contando o que o próprio lote já reservou
    const capacidade = dir.capacidades.get(mentor.id) ?? 1;
    const emUso = duplasDoMentor.get(mentor.id) ?? 0;
    if (emUso >= capacidade) {
      return falha(
        `${mentor.nome}: sem vaga (${emUso}/${capacidade} ${capacidade === 1 ? "dupla" : "duplas"} em curso)`
      );
    }

    // turma/cronograma — DPP corre contra calendário; a especialista deriva
    // a turma da dupla DPP do mentorado (ou da vigente), como no createDupla
    let cronogramaId: string | null = null;
    let turma: string | null = null;
    if (trilha === "dpp") {
      const rC = resolverCronograma(linha.turma, dir.cronogramas);
      if ("erro" in rC) return falha(rC.erro);
      cronogramaId = rC.cronograma.id;
      turma = rC.cronograma.turma;
    } else {
      const dpp = dir.duplas
        .filter((d) => d.mentorado_id === mentorado.id && d.trilha === "dpp")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      turma =
        dpp?.turma ?? cronogramaVigente(dir.cronogramas, hoje)?.turma ?? null;
      if (!turma) {
        return falha(
          "não consegui derivar a turma da dupla de especialista (sem dupla DPP do mentorado nem cronograma vigente)"
        );
      }
    }
    r.turmaLabel = turma;

    // iniciada_em — aceita dd/mm/aaaa, ISO e serial de planilha (normData);
    // vazia cai no default do createDupla: DPP nasce uma semana antes do 1º
    // encontro oficial do cronograma, especialista cai em hoje
    const iniciadaRaw = normNome(linha.iniciada_em);
    let iniciadaEm: string | null = null;
    if (iniciadaRaw) {
      iniciadaEm = normData(iniciadaRaw);
      if (!iniciadaEm) {
        return falha(
          `iniciada_em inválida ("${linha.iniciada_em.trim()}" — use dd/mm/aaaa ou aaaa-mm-dd)`
        );
      }
    } else if (trilha === "especialista") {
      iniciadaEm = toDateStr(hoje);
    } else {
      iniciadaEm =
        inicioDefaultDupla(
          dir.eventos.filter((e) => e.cronograma_id === cronogramaId)
        ) ?? toDateStr(hoje);
    }

    // reserva a vaga dentro do lote — a linha seguinte já a vê ocupada
    parVivo.add(`${mentor.id}|${mentorado.id}`);
    vagaOcupada.add(`${mentorado.id}|${trilha}`);
    duplasDoMentor.set(mentor.id, emUso + 1);

    return {
      ...r,
      status: "ok",
      par: {
        mentor,
        mentorado,
        supervisor,
        trilha,
        turma,
        cronogramaId,
        iniciadaEm,
        demanda: normNome(linha.demanda) || null,
      },
    };
  });
}
