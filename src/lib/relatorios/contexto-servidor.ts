// Reidratação server-side do contexto "Perguntar à Liza" (REALIZA-456): a
// action não confia em contexto vindo do cliente — refaz os fetchers da
// aba e deriva os agregados pelos mesmos builders puros de contexto.ts.
// A página usa os mesmos builders nos dados já renderizados, então o hash
// dos dois lados bate quando o recorte não mudou.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCicloEventos,
  getCronogramas,
  getDuplas,
} from "@/lib/queries";
import { getEncerramentos } from "@/lib/queries-encerramento";
import type { DemoData } from "@/lib/demo/data";
import { demoTendenciaSaude } from "@/lib/demo/queries";
import type { RecorteCsv } from "./csv-core";
import { filtraPorRecorte } from "./csv-core";
import {
  dadosItensAssinaturas,
  dadosItensAssinaturasDemo,
  dadosItensForms,
  dadosItensFormsDemo,
  dadosItensInteracoes,
  dadosItensInteracoesDemo,
  dadosItensSolicitacoes,
  dadosItensSolicitacoesDemo,
  dadosTendenciaSaude,
} from "./dados";
import {
  dadosAdocaoCoorte,
  dadosAdocaoCoorteDemo,
  dadosAdocaoMatriz,
  dadosAdocaoMatrizDemo,
  dadosAdocaoResumo,
  dadosAdocaoResumoDemo,
  dadosFunilInstrumentos,
  dadosFunilInstrumentosDemo,
} from "./adocao";
import { paresEncerramento, resumoAderencia, resumoEncerramento } from "./operacional";
import type { Janela, MedidaAdocao } from "@/lib/adocao";
import {
  contextoAdocao,
  contextoAderencia,
  contextoAssinaturas,
  contextoEncerramento,
  contextoFormularios,
  contextoInteracoes,
  contextoSolicitacoes,
  contextoVisao,
  contextoHash,
  recorteKey,
  type AbaLiza,
  type RecorteLiza,
} from "./contexto";

const SEMANAS_COORTE = 10;

type Env = {
  supabase: SupabaseClient | null;
  demo: DemoData | null;
};

/** `desde` de adoção truncado no DIA UTC: a janela exata do relógio mudaria
 *  o agregado a cada request (hash instável); o piso diário é estável entre
 *  o render da página e a geração do card no mesmo dia. */
function desdeEstavel(janela: Janela): Date {
  const alvo = new Date(Date.now() - janela * 86400000);
  return new Date(alvo.toISOString().slice(0, 10));
}

/** O contexto agregado da aba, refeito no servidor. Devolve o contexto e o
 *  hash — o mesmo par que a página derivou se o recorte não mudou. */
export async function contextoDaSecao(
  aba: AbaLiza,
  recorte: RecorteLiza,
  env: Env
): Promise<{ contexto: Record<string, unknown>; hash: string }> {
  const { supabase, demo: d } = env;
  const recorteCsv: RecorteCsv = {
    turma: recorte.turma ?? null,
    cronogramaId: recorte.cronogramaId ?? null,
  };

  let contexto: Record<string, unknown>;
  switch (aba) {
    case "visao": {
      const t = d
        ? demoTendenciaSaude(d, recorteCsv)
        : await dadosTendenciaSaude(supabase!, recorteCsv);
      contexto = contextoVisao(t);
      break;
    }
    case "aderencia": {
      const [duplas, eventos, crons] = await Promise.all([
        getDuplas(),
        getCicloEventos(),
        getCronogramas(),
      ]);
      contexto = contextoAderencia(
        resumoAderencia(filtraPorRecorte(duplas, recorteCsv, crons), eventos, crons)
      );
      break;
    }
    case "assinaturas": {
      const itens = d
        ? dadosItensAssinaturasDemo(d, recorteCsv)
        : await dadosItensAssinaturas(supabase!, recorteCsv);
      contexto = contextoAssinaturas(itens);
      break;
    }
    case "interacoes": {
      const itens = d
        ? dadosItensInteracoesDemo(d, recorteCsv)
        : await dadosItensInteracoes(supabase!, recorteCsv);
      contexto = contextoInteracoes(itens);
      break;
    }
    case "solicitacoes": {
      const itens = d
        ? dadosItensSolicitacoesDemo(d, recorteCsv)
        : await dadosItensSolicitacoes(supabase!, recorteCsv);
      contexto = contextoSolicitacoes(itens);
      break;
    }
    case "encerramento": {
      const [duplas, crons, encerramentos] = await Promise.all([
        getDuplas(),
        getCronogramas(),
        getEncerramentos(),
      ]);
      contexto = contextoEncerramento(
        resumoEncerramento(paresEncerramento(encerramentos, duplas, recorteCsv, crons))
      );
      break;
    }
    case "formularios": {
      const itens = d
        ? dadosItensFormsDemo(d, recorteCsv)
        : await dadosItensForms(supabase!, recorteCsv);
      contexto = contextoFormularios(itens);
      break;
    }
    case "adocao": {
      const janela = recorte.janela ?? 30;
      const papel = recorte.papel ?? null;
      const medida: MedidaAdocao = recorte.medida === "gestos" ? "gestos" : "pessoas";
      if (d) {
        contexto = contextoAdocao({
          resumo: dadosAdocaoResumoDemo(d, janela, papel),
          celulas: dadosAdocaoMatrizDemo(d, janela),
          coorte: dadosAdocaoCoorteDemo(SEMANAS_COORTE),
          funil: dadosFunilInstrumentosDemo(),
          janela,
          papel,
          medida,
        });
      } else {
        const desde = desdeEstavel(janela);
        const [resumo, celulas, coorte, funil] = await Promise.all([
          dadosAdocaoResumo(supabase!, desde, papel),
          dadosAdocaoMatriz(supabase!, desde, null),
          dadosAdocaoCoorte(supabase!, SEMANAS_COORTE),
          dadosFunilInstrumentos(supabase!, desde),
        ]);
        contexto = contextoAdocao({ resumo, celulas, coorte, funil, janela, papel, medida });
      }
      break;
    }
  }

  return { contexto, hash: contextoHash(contexto) };
}

/** A identidade do card da aba — a mesma chave gravada em recorte_key. */
export function chaveDaSecao(recorte: RecorteLiza): string {
  return recorteKey(recorte);
}
