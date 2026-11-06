/** Reconciliação dos combinados de UM registro na gravação do follow-up
 *  (salvarRegistro): o form devolve a lista inteira do que deve existir
 *  depois do salvar — linhas com id do banco são update (só quando algo
 *  mudou de fato), ids do registro que não voltaram são delete e o resto
 *  é insert.
 *
 *  O dedupe de insert é contra o estado FINAL, não o atual: re-submit de
 *  aba duplicada não duplica, e o combinado que o mentor removeu e
 *  redigitou igual sobrevive como row nova em vez de sumir junto com o
 *  antigo (ids são a identidade; o conteúdo é só o que aparece na tela). */

export type CombinadoCampos = {
  descricao: string;
  responsavel: "mentor" | "mentorado";
  prazo: string | null;
};

/** Linha vinda do form — `id` só é id de banco na edição; no registro novo
 *  viaja o uuid local da linha (chave do React), que não casa nada e cai
 *  no insert. */
export type CombinadoEnviado = CombinadoCampos & { id?: string | null };

/** Row já gravada — o select do PostgREST devolve responsavel como string. */
export type CombinadoExistente = {
  id: string;
  descricao: string;
  responsavel: string;
  prazo: string | null;
};

export type ReconciliacaoCombinados = {
  /** Rows a inserir (dupla_id/registro_id completados pelo caller). */
  inserir: CombinadoCampos[];
  /** Linhas casadas por id cujo conteúdo mudou — status nunca entra. */
  atualizar: (CombinadoCampos & { id: string })[];
  /** Ids do registro ausentes no envio. */
  remover: string[];
};

const chave = (t: {
  descricao: string;
  responsavel: string;
  prazo: string | null;
}) => `${t.descricao}|${t.responsavel}|${t.prazo ?? ""}`;

export function reconciliaCombinados(
  existentes: CombinadoExistente[],
  enviados: CombinadoEnviado[]
): ReconciliacaoCombinados {
  const porId = new Map(existentes.map((e) => [e.id, e]));
  const casados = new Set<string>();
  const atualizar: ReconciliacaoCombinados["atualizar"] = [];
  // conteúdo que vai existir ao fim — a régua do dedupe de insert: começa
  // com o que volta casado por id, e o resto do envio só insere se ainda
  // não estiver coberto (duas linhas idênticas no envio não duplicam)
  const chavesFinais = new Set<string>();

  for (const t of enviados) {
    const ex = t.id != null ? porId.get(t.id) : undefined;
    if (!ex || casados.has(ex.id)) continue;
    casados.add(ex.id);
    chavesFinais.add(chave(t));
    // update só quando o conteúdo mudou — regravar a mesma linha seria
    // write à toa (e mexeria em updated_at / audit por nada)
    if (chave(t) !== chave(ex)) {
      atualizar.push({
        id: ex.id,
        descricao: t.descricao,
        responsavel: t.responsavel,
        prazo: t.prazo,
      });
    }
  }

  const inserir: CombinadoCampos[] = [];
  for (const t of enviados) {
    // casado por id já resolvido acima (update ou igual) — não é insert;
    // id repetido no envio colapsa na primeira ocorrência
    if (t.id != null && porId.has(t.id)) continue;
    const k = chave(t);
    if (chavesFinais.has(k)) continue;
    chavesFinais.add(k);
    inserir.push({
      descricao: t.descricao,
      responsavel: t.responsavel,
      prazo: t.prazo,
    });
  }

  const remover = existentes
    .filter((e) => !casados.has(e.id))
    .map((e) => e.id);

  return { inserir, atualizar, remover };
}
