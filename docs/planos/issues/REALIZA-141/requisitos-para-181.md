# Requisitos que REALIZA-181 absorve de REALIZA-141

Origem: REALIZA-141 (Metas: reordenação = prioridade). O PDM nativo de
181 precisa incorporar estes pontos no modelo `pdm_metas`/metas:

1. **`meta_ordem`** — a posição da meta **é** a prioridade; reordenar =
   repriorizar. Persistir ordem como campo (`meta_ordem`) — no modelo
   nativo vira coluna `ordem`/`sort_order` em `pdm_metas` (ou tabela de
   metas), não JSONB solto. UI: drag-and-drop ou ↑↓ (mobile precisa
   funcionar).
2. **Remover `meta_principal`** — o campo dedicado é redundante: "Meta 1"
   pela posição já é a mais importante. Na transcrição do instrumento
   pro modelo nativo, `meta_principal` sai (respostas antigas com a chave
   seguem lendo sem quebrar — legado de `formulario_respostas.respostas`
   JSONB).
3. **Remover os sim/não finais** (`rev_ajudam`, `rev_importantes`,
   `rev_claras`) — o conteúdo vira copy de orientação na tela, não dado.
4. **Limite de metas: ~10** (decidido com a coord — alinhado à duração do
   programa). O modelo/UI bloqueia a 11ª com mensagem amigável.
5. **`instrumento-resultado` renderiza na ordem persistida** com
   hierarquia de prioridade ("1 · a mais importante").

Dependência entre elas: 141 e 142 dividem a mesma tela/modelo — entregar
juntas dentro de 181 (submetas recursivas + prazo/atingimento +
retrospectiva estão no `requisitos-para-181.md` de REALIZA-142).
