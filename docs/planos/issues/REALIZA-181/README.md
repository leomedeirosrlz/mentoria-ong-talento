# REALIZA-181 — PDM nativo na plataforma

- **Jira:** `REALIZA-181` — "PDM nativo na plataforma — metas SMART → submetas (decisão fechada: substitui link Drive)" (Feature, prioridade Medium, `_issues.json`)
- **Veredito:** **ABERTA — planejar do zero sobre fundação real.** O PDM hoje existe só como formulário one-shot (`sistema='pdm'` em `formularios`, resposta JSONB em `formulario_respostas`) — não é o documento vivo pedido. A decisão de produto está fechada (PDM nativo, `_contexto-agentes.md` regra 7; `duplas.pdm_url` dropada em `0098`).
- **Absorve:** REALIZA-17 (documento vivo), REALIZA-141 (ordem=prioridade), REALIZA-142 (submetas recursivas, datas, retrospectiva). Os planos dessas três viram seções aqui — escrever só READMEs apontando pra cá.
- **Insumos do cluster I (incorporados):** `REALIZA-141/requisitos-para-181.md` e `REALIZA-142/requisitos-para-181.md` — todas as exigências listadas lá estão mapeadas abaixo e no sdd (ordem=prioridade, caps, `parent_id` compartilhado, `prazo_alvo`/`atingida_em`, retrospectiva, decisões abertas respondidas em sdd §D7).

## Escopo (o que entrega)

- **`pdm` + `pdm_itens` [NOVO]** — documento vivo 1:1 com a dupla DPP; itens recursivos (`parent_id`): meta = item raiz, submeta = qualquer item com pai. Uma tabela serve Metas e PDM (requisito do cluster I: "mesma estrutura pros dois instrumentos").
- **Campos SMART por item:** `titulo`, `porque`, `indicador` (IS), `area_vida`, `prazo_alvo`, `status` (`ativa`/`atingida`/`descartada`), `atingida_em`.
- **`ordem` = prioridade** (a `meta_ordem` da 141 em modelo relacional): reordenar = repriorizar; UI mostra "Meta 1 · a mais importante" pela posição — o campo `meta_principal` do form sai de cena.
- **Caps:** ≤10 metas raiz e ≤20 itens não-raiz por PDM ("~20 submetas no total", 142); RPC + trigger garantem.
- **Co-edição mentor + mentorado** via RPCs `security definer` escopadas à dupla; coordenação e supervisor leem (regra 4 do contexto: "coord vê tudo de conteúdo; supervisor da dupla vê como mentor"). Writes só em dupla DPP `ativa|pausada` — encerrada vira leitura (documento congela no rito).
- **Forms engine segue como camada de coleta:** respostas de `sistema='metas'`/`'pdm'` projetam pro documento vivo dentro de `submeter_resposta_formulario` (precedente exato: 360º carimba `encerramentos.checklist` — wiring nascido em `0042`, vigente em `0080:337-342`). Respostas JSONB antigas ficam intactas como snapshot histórico e backfillam o modelo na migration.
- **Superfícies:** seção "Plano de desenvolvimento" na ficha `/duplas/[id]` (editor pra mentor, leitura pra staff); nova rota `/jovem/pdm` (o jovem **já tem login** — co-edição real, não link); bloco PDM no "Resumo da jornada" (`resumo-jornada.tsx` + `dadosResumoJornada`); estação "PDM" da Minha jornada linka pro documento.
- **Form `metas` atualizado** (absorve 141): remove `meta_principal` + `rev_*` (conteúdo vira copy de orientação), bump `versao`; update via escape hatch documentada (`disable trigger formularios_sistema_guard`, padrão comentado em `0043`).
- **Retrospectiva:** metas atingidas com datas entram no resumo de encerramento; checklist `revisao_pdm` (`0037`/`src/lib/encerramento.ts:38`) continua gesto humano — o rito é revisar junto, não auto-marcar.

## Dependências / bloqueios

- **Nenhuma dep de outra issue.** Fundação toda embarcada: forms engine (`0036`/`0042`/`0080`), `my_mentorado_id()` (`0066`), portal `/jovem` (`0096`+), `encerramentos` (`0037`), wiring `sistema→efeito` (`0042`).
- **Insumo pra 178/180** (cluster AI): PDM como dado relacional alimenta relatórios/IA — documentar contrato estável (`pdm_da_dupla`) pra não acoplar nas tabelas.
- **BLOCKER: nenhum identificado.** As duas decisões de arquitetura pedidas (tabela nativa × forms; `pdm_itens` compartilhada × separadas) estão respondidas no sdd.md com base nos requisitos do cluster I + descrição da 142.

## Esforço

**G** — migration com 2 tabelas + RLS + ~6 RPCs + projeção + backfill, editor de árvore (recursivo, mobile), superfície no portal do jovem, resumo/encerramento, forms update, demo, testes. Quebrável em 4 PRs (ver plan.md §ordem).

## Riscos principais

- **Dupla escrita divergente** (form responde depois do PDM editado à mão) — mitigada por reconciliação por `origem_campo` + nunca deletar item com status/edição manual (ver sdd §projeção).
- **Árvore recursiva no celular** (142: "UI é o ponto delicado") — mitigada por indentação leve, collapse, "adicionar dentro desta", sem drag-and-drop (botões ↑↓ + ação contextual).
- **LGPD/menores** — metas são autorrelato íntimo; escopo idêntico ao da ficha (sdr.md); coord lê tudo já é convenção documentada (regra 4), registrada como decisão.
- **`InstrumentoResultado` legado** — campos removidos do form (`meta_principal`, `rev_*`) não podem quebrar a leitura de respostas antigas: o renderer já tolera campo ausente (`campos.find` → `respostaFormatada(undefined, v)`); garantir no teste de regressão.

## Referências de verdade (verificadas no disco)

- Modelo/forms atuais: `supabase/migrations/0080_instrumentos_dupla.sql` (seeds dos 4 instrumentos; `metas` tem `meta_principal`/`rev_*`/`porque_N`; `pdm` tem `is_N`/`prazo_N`/`submetas_N`), `supabase/migrations/0042_formularios_sistema.sql` (guard + wiring 360→checklist `submeter_resposta_formulario:259-264`)
- `pdm_url` removida: `supabase/migrations/0098_remove_pdm_url.sql` (100% NULL em prod — nada a migrar)
- Render atual: `src/components/instrumento-resultado.tsx`, `src/lib/forms/schema.ts` (`extraiMetas:548`, `INSTRUMENTOS_SISTEMA:86`)
- Ficha: `src/app/(app)/duplas/[id]/page.tsx` + `instrumentos-dupla.tsx` (mesma pasta)
- Jovem: `src/app/(jovem)/jovem/materiais/page.tsx` (estações), `src/components/jovem-shell.tsx` (nav), `src/lib/queries-jovem.ts` (`getJovemJornada:392`)
- Resumo: `src/components/resumo-jornada.tsx`, `src/lib/encerramento.ts` (`dadosResumoJornada:114`, `textoResumoJornada:189`, `CHECKLIST_ENCERRAMENTO:23`), `src/lib/actions-encerramento.ts` (`resumo_jornada:168`)
- Plano-fonte: `docs/planos/atividades-interativas.md` (Alternativa C — projeções, `pdm_itens` esboçado em :129)
