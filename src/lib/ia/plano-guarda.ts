import type { CenarioPlano } from "@/lib/plano-cenarios";

/**
 * Guarda numérica do "ficar em dia" (rodada 1126).
 *
 * O motor de cenários acertou a conta, mas a Liza continuou respondendo com
 * datas que não existiam em lugar nenhum (14/01 quando o motor dizia 05/01)
 * e chamando de "único caminho viável" uma lista com quatro caminhos. Tool
 * certa não basta se o texto pode inventar por cima: aqui o payload vira a
 * única fonte de data permitida, e a resposta passa por validação antes de
 * chegar na pessoa.
 *
 * Puro e determinístico — sem I/O, sem modelo.
 */

export type FatosPlano = Record<string, unknown>;

const ISO = /(\d{4})-(\d{2})-(\d{2})/g;
const BR = /(?<!\d)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?!\d)/g;

/** dd/mm/aaaa → chaves canônicas (dd/mm/aaaa e dd/mm). */
function chavesBr(dia: string, mes: string, ano?: string): string[] {
  const d = dia.padStart(2, "0");
  const m = mes.padStart(2, "0");
  if (!ano) return [`${d}/${m}`];
  const a = ano.length === 2 ? `20${ano}` : ano;
  return [`${d}/${m}/${a}`, `${d}/${m}`];
}

function isoParaBr(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Todas as datas que aparecem no payload, em qualquer profundidade. */
export function datasPermitidas(payload: unknown, hoje = new Date()): Set<string> {
  const out = new Set<string>();
  const visitar = (v: unknown) => {
    if (typeof v === "string") {
      for (const m of v.matchAll(ISO)) {
        const iso = m[0];
        out.add(iso);
        out.add(isoParaBr(iso));
        out.add(`${m[3]}/${m[2]}`);
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) visitar(x);
      return;
    }
    if (v && typeof v === "object") {
      for (const x of Object.values(v)) visitar(x);
    }
  };
  visitar(payload);

  const isoHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  out.add(isoHoje);
  out.add(isoParaBr(isoHoje));
  out.add(isoParaBr(isoHoje).slice(0, 5));
  return out;
}

/** Datas citadas no texto, já na chave canônica usada na comparação. */
export function datasCitadas(texto: string): { bruto: string; chave: string }[] {
  const out: { bruto: string; chave: string }[] = [];
  for (const m of texto.matchAll(ISO)) {
    out.push({ bruto: m[0], chave: m[0] });
  }
  for (const m of texto.matchAll(BR)) {
    const chaves = chavesBr(m[1], m[2], m[3]);
    out.push({ bruto: m[0], chave: chaves[0] });
  }
  return out;
}

function sentencas(texto: string): string[] {
  return texto
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type ViolacoesPlano = {
  ok: boolean;
  datasInvalidas: string[];
  unicoIndevido: boolean;
  naoFechaIndevido: boolean;
  mesmaDataIndevida: boolean;
};

/**
 * Confere a resposta contra o payload do plano:
 * - toda data citada precisa existir no payload (ou ser hoje);
 * - "único caminho" só quando há um viável de fato;
 * - "não fecha" só quando não existe caminho viável na frase (sem
 *   condicional);
 * - "mesma data" só quando os caminhos viáveis realmente coincidem.
 */
export function validarRespostaPlano(
  texto: string,
  plano: FatosPlano,
  hoje = new Date()
): ViolacoesPlano {
  const permitidas = datasPermitidas(plano, hoje);
  const datasInvalidas = [
    ...new Set(
      datasCitadas(texto)
        .map((d) => d.chave)
        .filter((c) => !permitidas.has(c))
    ),
  ];

  const cenarios = (plano.cenarios as CenarioPlano[] | undefined) ?? [];
  const viaveis = cenarios.filter((c) => c.viavel);
  const datasViaveis = new Set(viaveis.map((c) => c.data).filter(Boolean));

  const unicoIndevido =
    viaveis.length > 1 && /(?:[úu]nico|somente esse|s[óo] esse) caminho/i.test(texto);

  // só é contradição quando o texto NÃO cita nenhuma data viável: citar o
  // caminho e dizer que "sem X não fecha" é legítimo
  const citaDataViavel = viaveis.some((c) => c.data && texto.includes(br(c.data)));
  const naoFechaIndevido =
    viaveis.length > 0 &&
    !citaDataViavel &&
    sentencas(texto).some(
      (s) =>
        /n[ãa]o (?:fecha|d[áa]|é poss[íi]vel|e poss[íi]vel)/i.test(s) &&
        !/\bsem\b|\bs[óo] (?:com|se|quando)\b|exceto|a n[ãa]o ser|se (?:a dupla )?(?:fundir|seguir)/i.test(
          s
        )
    );

  const mesmaDataIndevida =
    /mesma data|d[áa] (?:a )?mesma (?:data|proje[çc][ãa]o)|n[ãa]o muda nada/i.test(
      texto
    ) && datasViaveis.size > 1;

  return {
    ok:
      datasInvalidas.length === 0 &&
      !unicoIndevido &&
      !naoFechaIndevido &&
      !mesmaDataIndevida,
    datasInvalidas,
    unicoIndevido,
    naoFechaIndevido,
    mesmaDataIndevida,
  };
}

function br(iso: string | null | undefined): string {
  return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? isoParaBr(iso) : "—";
}

/**
 * Resposta de segurança montada só com o payload — usada quando o modelo
 * insiste em números que não existem. Sem prosa inventada, sem data nova.
 */
export function respostaDeterministica(plano: FatosPlano): string {
  const cenarios = (plano.cenarios as CenarioPlano[] | undefined) ?? [];
  const melhor = (plano.melhor as CenarioPlano | null | undefined) ?? null;
  const encerramento = plano.encerramento as string | null | undefined;
  const pendentes = (plano.recessos_pendentes as
    | { titulo: string; inicio: string; fim: string }[]
    | undefined) ?? [];

  const caminho = plano.caminho as
    | {
        rotulo?: string;
        data?: string;
        exigencias?: string[];
      }
    | null
    | undefined;

  const partes: string[] = [];

  if (caminho?.data) {
    // "como a dupla fica em dia?" responde pelo plano que fecha com menos
    // mudanças — a data primeiro, depois o que precisa mudar
    const ex = caminho.exigencias ?? [];
    partes.push(
      `A dupla fica em dia em ${br(caminho.data)}.${ex.length ? ` O que muda: ${ex.join("; ")}.` : ""}`
    );
    const rapido = melhor && melhor.data && melhor.data !== caminho.data;
    if (rapido) {
      partes.push(
        `Dá para fechar antes, em ${br(melhor!.data)}, mas com mais mudanças: ${melhor!.rotulo}.`
      );
    }
  } else if (melhor) {
    const cabem = melhor.cabem;
    const alvo = cabem
      ? `${cabem.faltam} encontro${cabem.faltam === 1 ? "" : "s"} até o encerramento`
      : "os encontros que faltam";
    partes.push(
      `O caminho que fecha é ${melhor.rotulo}: a dupla fica em dia em ${br(melhor.data)}, com ${melhor.sessoes} sessões para ${alvo}.`
    );
    const outras = cenarios.filter(
      (c) => c.viavel && c.id !== melhor.id && c.data
    );
    if (outras.length) {
      partes.push(
        `Outros caminhos viáveis: ${outras
          .slice(0, 3)
          .map((c) => `${c.rotulo} (${br(c.data)})`)
          .join("; ")}.`
      );
    }
  } else {
    partes.push(
      `Nenhum jeito fecha antes do encerramento${encerramento ? ` (${br(encerramento)})` : ""}. A coordenação precisa entrar.`
    );
    const naoViaveis = cenarios.filter((c) => !c.viavel && c.data);
    if (naoViaveis.length) {
      partes.push(
        `A data mais próxima seria ${br(naoViaveis[0].data)}.`
      );
    }
  }

  if (pendentes.length) {
    const nomes = pendentes
      .map((p) => `${p.titulo} (${br(p.inicio)} a ${br(p.fim)})`)
      .join(", ");
    // a pendência trava só a proposta da DUPLA (0245): pra equipe a
    // proposta já pode ir com a suposição de pausa e a dupla confirma
    // ou troca no aceite
    partes.push(
      plano.lado === "staff"
        ? `A proposta pode ir com pausa ${
            pendentes.length === 1 ? "no recesso" : "nos recessos"
          } (${pendentes.map((p) => `${br(p.inicio)} a ${br(p.fim)}`).join(", ")}); a dupla confirma ou troca no aceite.`
        : `Falta a dupla decidir sobre ${nomes}.`
    );
  }

  const grade = plano.grade as
    | { mentor?: boolean; jovem?: boolean; dias_comuns?: number }
    | undefined;
  if (grade?.mentor && grade?.jovem) {
    partes.push(
      `Os dois já marcaram a disponibilidade (${grade.dias_comuns ?? 0} dia${grade.dias_comuns === 1 ? "" : "s"} em comum). Dá para enviar o plano pela aba Agora.`
    );
  } else if (grade && (!grade.mentor || !grade.jovem)) {
    partes.push("Antes de enviar, falta a disponibilidade de um dos lados.");
  }

  return partes.join(" ");
}

/** Bloco de fatos pra rodada de correção — só o que o texto pode citar. */
export function fatosParaCorrecao(plano: FatosPlano): string {
  const cenarios = ((plano.cenarios as CenarioPlano[] | undefined) ?? []).map(
    (c) => ({
      caminho: c.rotulo,
      viavel: c.viavel,
      data: c.data,
      sessoes: c.sessoes,
      decisao_recesso: c.decisaoRecesso,
      fusao: c.fusao,
    })
  );
  return JSON.stringify(
    {
      hoje: new Date().toISOString().slice(0, 10),
      encerramento: plano.encerramento,
      estado: plano.estado,
      melhor: plano.melhor
        ? {
            caminho: (plano.melhor as CenarioPlano).rotulo,
            data: (plano.melhor as CenarioPlano).data,
            sessoes: (plano.melhor as CenarioPlano).sessoes,
            cabem: (plano.melhor as CenarioPlano).cabem,
          }
        : null,
      cenarios,
      caminho: plano.caminho
        ? {
            caminho: (plano.caminho as { rotulo?: string }).rotulo,
            data: (plano.caminho as { data?: string }).data,
            exigencias: (plano.caminho as { exigencias?: string[] }).exigencias,
          }
        : null,
      recessos_pendentes: plano.recessos_pendentes,
      // quem perguntou (0245): pendente de recesso bloqueia a dupla,
      // mas pra equipe a proposta já vai com pausa assumida
      lado: plano.lado,
      grade: plano.grade,
      passos: (plano.passos as { numero: number; acao: string; data_sugerida: string | null }[] | undefined)?.map(
        (p) => ({
          numero: p.numero,
          acao: p.acao,
          data: p.data_sugerida,
        })
      ),
    },
    null,
    1
  );
}
