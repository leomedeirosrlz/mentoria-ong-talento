import { createHash } from "node:crypto";
import {
  registroTemConteudo,
  saudadeDaDupla,
  passosDaTrilha,
  eventosDoCronograma,
} from "@/lib/ciclo";
import type { CicloEvento, Dupla, DuplaPlano } from "@/lib/types";

/** Resumo determinístico da dupla pra Liza (0221 — REALIZA-459): o que a
 *  tool `resumo_dupla` e a página consolidam sem recomputar saúde/plano.
 *  A RPC recorta por papel — `semaforo`, `motivos`, `sinais` e `interno`
 *  nunca chegam ao mentorado, então aqui o resumo é único e completo:
 *  quem lê decide o recorte, não quem escreve. */
export type ResumoDupla = {
  dupla_id: string;
  trilha: string;
  semaforo: string;
  motivos: string[];
  sinais: { tipo: string; tom: string; texto: string }[];
  apoio: { aberto: boolean; origem?: string };
  encontros: {
    feitos: number;
    esperados: number;
    proximos: {
      numero: number | null;
      titulo: string;
      data: string | null;
      status: string;
    }[];
    pendentes_registro: number[];
  };
  jovem: {
    nome: string;
    interesses: string[];
  };
  plano: {
    id: string;
    status: string;
    versao: number;
    ritmo: number | null;
    nivel: string | null;
    numeros: number[];
    aprovado_lado: string | null;
    expira_em: string;
    passos_aplicados: { numero: number; data_nova: string }[];
  } | null;
  /** bastidores que nunca saem no recorte do jovem nem na cópia de staff —
   *  nomes internos dos campos que a RPC subtrai pra mentorado. */
  interno: {
    iniciada_em: string | null;
    encaminhamentos_abertos: number;
    recessos_declarados: number;
  };
};

/** Plano vivo = único por índice parcial (proposto/aceito/ativo). O
 *  histórico (concluído/expirado/contestado) não entra no resumo. */
function planoVivo(d: Dupla): DuplaPlano | null {
  return (
    (d.planos ?? []).find((p) =>
      ["proposto", "aceito", "ativo"].includes(p.status)
    ) ?? null
  );
}

export function montarResumoDupla(
  dupla: Dupla,
  eventos: CicloEvento[],
  ref: Date = new Date()
): { resumo: ResumoDupla; fontes_hash: string } {
  const saude = saudadeDaDupla(dupla, eventos, ref);
  const cronograma = eventosDoCronograma(eventos, dupla.cronograma_id);
  const passos = passosDaTrilha(dupla.trilha, cronograma);
  const tituloPorNumero = new Map(passos.map((p) => [p.numero, p.titulo]));
  const plano = planoVivo(dupla);

  const proximos = dupla.encontros
    .filter(
      (e) =>
        (e.status === "agendado" || e.status === "remarcado") &&
        (e.data_hora == null || new Date(e.data_hora).getTime() >= ref.getTime())
    )
    .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0))
    .slice(0, 4)
    .map((e) => ({
      numero: e.numero,
      titulo: tituloPorNumero.get(e.numero ?? -1) ?? `Encontro ${e.numero}`,
      data: e.data_hora,
      status: e.status,
    }));

  const resumo: ResumoDupla = {
    dupla_id: dupla.id,
    trilha: dupla.trilha,
    semaforo: saude.semaforo,
    motivos: saude.motivos,
    sinais: saude.sinais.map((s) => ({
      tipo: s.tipo,
      tom: s.tom,
      texto: s.texto,
    })),
    apoio: { aberto: saude.apoio.aberto, origem: saude.apoio.origem },
    encontros: {
      feitos: saude.feitos,
      esperados: saude.esperado,
      proximos,
      pendentes_registro: dupla.encontros
        .filter((e) => e.status === "realizado" && !registroTemConteudo(e.registro))
        .map((e) => e.numero!)
        .filter((n): n is number => n != null),
    },
    jovem: {
      nome: dupla.mentorado?.nome ?? "",
      interesses: dupla.mentorado?.interesses ?? [],
    },
    plano: plano
      ? {
          id: plano.id,
          status: plano.status,
          versao: plano.versao,
          ritmo: plano.escopo?.ritmo ?? null,
          nivel: plano.escopo?.nivel ?? null,
          numeros: plano.escopo?.numeros ?? [],
          aprovado_lado: plano.aprovado_lado,
          expira_em: plano.expira_em,
          passos_aplicados: (plano.passos ?? []).map((p) => ({
            numero: p.numero,
            data_nova: p.data_nova,
          })),
        }
      : null,
    interno: {
      iniciada_em: dupla.iniciada_em,
      encaminhamentos_abertos: dupla.encaminhamentos.filter(
        (e) => e.status === "pendente" || e.status === "atrasado"
      ).length,
      recessos_declarados: (dupla.recessos ?? []).length,
    },
  };

  // hash das fontes, não do resumo inteiro: gerado_em/pendências de clock
  // fora da entrada mantêm o hash estável entre ticks iguais — o job só
  // grava quando a entrada mudou (idempotente sem re-escrever linha igual).
  const fontes_hash = createHash("sha256")
    .update(
      JSON.stringify({
        dupla_id: resumo.dupla_id,
        semaforo: resumo.semaforo,
        motivos: resumo.motivos,
        sinais: resumo.sinais,
        apoio: resumo.apoio,
        encontros: resumo.encontros,
        jovem: resumo.jovem,
        plano: resumo.plano,
        interno: resumo.interno,
      })
    )
    .digest("hex")
    .slice(0, 32);

  return { resumo, fontes_hash };
}
