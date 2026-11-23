# Spec — Materiais gerados pela Liza (gen UI, backlog)

**Feature:** `specs/021-materiais-liza` · **Status:** Clarified
**Fila:** `REALIZA-522` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** `materiais` é catálogo de arquivo/link — não tem corpo editorial; a Liza fala e escreve em várias superfícies mas nunca gera material; e a coordenação não tem como pedir "cria o material da semana 17" sem montar markdown na mão.
- **Resultado observável:** materiais podem ter corpo estruturado em blocos com schema fechado e validação antes de renderizar; a coordenação cria material por chat ("cria material da semana 17", "cria guia pra dupla X") ou pelo botão "Gerar com Liza" no novo material; tudo nasce rascunho, a coordenação revisa e publica; no máximo um material gerado por semana de plano.
- **Como saberemos que funcionou:** coordenação pede no chat → preview validado → publica; o material aparece na biblioteca e no dropdown do passo; bloco inválido nunca renderiza; a auditoria `ia_eventos` + `via='liza'` marca a origem.

## Fora de escopo

- Geração em lote / automática sem pedido humano (um por semana, sob demanda).
- Material para o jovem além do que a biblioteca já expõe por `encontro_num`/`audiencias`.
- Novo formato de bloco fora do `DocBloco` existente — o schema fechado é o que já existe, ampliado só se faltar um tipo essencial.
- Edição colaborativa/comentários; revisão é ler e publicar (ou regenerar).
- Os roteiros semanais da spec 020 (a Liza pode vir a redigi-los depois — esta spec é sobre `materiais`).

## Histórias de usuário

### US1 — Material estruturado com schema fechado (P1)

- **Por que P1:** sem corpo estruturado não há o que gerar.
- **Teste independente:** material novo com `conteudo` de blocos renderiza; bloco fora do schema é recusado.
- **Cenários:**
  1. **Dado** material com `conteudo` `DocBloco[]` válido **quando** abre **então** renderiza com o mesmo renderer do corpus, com status rascunho/publicado visível para staff.
  2. **Dado** conteúdo com bloco/sintaxe inválida **quando** grava ou renderiza **então** a validação Zod recusa com erro legível — nunca renderiza quebrado nem cai em HTML livre.

### US2 — "Gerar com Liza" e tools de chat (P1)

- **Por que P1:** o gesto de criação é onde a IA entra; sem tool não há caminho.
- **Teste independente:** "cria material da semana 17" no chat da coordenação → tool → preview → publicado.
- **Cenários:**
  1. **Dado** coordenação no chat **quando** pede "cria material da semana 17 da dupla X" **então** a tool resolve a dupla no escopo, monta o material (título, descrição, `DocBloco[]`, vínculo `encontro_num`/semana), valida e passa pelo protocolo de confirmação em 2 fases antes de persistir rascunho.
  2. **Dado** o dialog "Novo material" **quando** a coordenação clica "Gerar com Liza" **então** o pedido vai pelo fluxo existente (`liza-pedido` CustomEvent ou ação equivalente) e o rascunho volta para revisão no mesmo lugar.
  3. **Dado** qualquer geração **quando** persistida **então** `via='liza'`, `status='rascunho'` e evento `ia_eventos` registram origem e autoria.

### US3 — Revisão e publicação (P1)

- **Por que P1:** a coordenação é a editora; a Liza é a estagiária.
- **Teste independente:** rascunho → coordenação lê → publica → jovem/mentor veem.
- **Cenários:**
  1. **Dado** rascunho gerado **quando** a coordenação abre **então** ela vê o material renderizado com marca "gerado pela Liza · rascunho" e as ações "Publicar" e "Regenerar".
  2. **Dado** a publicação **quando** salva **então** o material entra na biblioteca no escopo certo (global ou da dupla) e aparece no dropdown do passo correspondente.
  3. **Dado** uma semana já com material gerado **quando** pedem outra **então** o sistema oferece regenerar o existente em vez de empilhar (um por semana).

## Casos de borda

- Pedido de semana fora do plano/ciclo: a tool recusa com erro claro, não inventa contexto.
- Dupla fora do escopo do usuário: a tool usa o resolvedor de dupla do registry (mesma régua das ~35 tools de escrita).
- Provider fora do ar / `IA_ESCRITAS` off: o botão some ou a tool recusa com a mensagem padrão da feature flag.
- Material gerado com `encontro_num` inválido ou fora de 1–24: validação bloqueia.
- Regenerar material publicado: cria rascunho novo ou substitui o rascunho — o publicado só muda por gesto explícito de publicar.
- Sem conteúdo de fonte (semana sem roteiro/corpus): a tool diz que não tem base e propõe o que puxar; nunca alucina roteiro pedagógico.
- Materiais legados (sem `conteudo`): seguem funcionando como catálogo — `conteudo` é opcional.

## Requisitos funcionais

- **FR-001:** `materiais` ganha `conteudo` (DocBloco[] jsonb), `status` (rascunho/publicado, default publicado para legado), `via` (manual/liza), e vínculos opcionais (`dupla_id`, `plano_id`, `semana`) — sugestão de DDL no recon §5.4.
- **FR-002:** validação Zod do `conteudo` na escrita e na renderização — o mesmo `DocBloco` schema do parser do corpus; bloco inválido é erro, não fallback silencioso.
- **FR-003:** tool(s) Liza de escopo coordenação: gerar material por semana/encontro/dupla, com resolução de dupla no escopo, confirmação em 2 fases, `via='liza'`, auditoria `ia_eventos` — seguindo o padrão `IA_TOOLS`.
- **FR-004:** "Gerar com Liza" no `NovoMaterialDialog` (coord-only) levando ao mesmo caminho da tool — um gesto, um fluxo.
- **FR-005:** publicação: rascunho só visível para coordenação (e auxiliar no escopo se decidido); publicado entra na biblioteca e no dropdown do passo; um material gerado por semana/plano (regenerar > duplicar).
- **FR-006:** modelos/componentes existentes: renderer `DocBloco` do corpus, dialog e queries de `materiais`, protocolo `rpcEscreve`+confirmação — nada de renderer novo nem HTML livre.

## Requisitos não funcionais

- **RLS/RPC:** write segue coord-only; Liza escreve via RPC definer/tool com grants (precedente das tools de escrita); leitura por escopo (global ou `dupla_id` da dupla); jovem nunca vê rascunho.
- **Feature flag:** geração atrás de flag/`IA_ESCRITAS`-equivalente — o backlog não bloqueia o resto.
- **Evals:** casos novos em `tests/evals/casos.json` (gerar material válido, recusar escopo inválido, bloco inválido não renderiza) nos modos contract/live.
- **LGPD:** material por dupla deriva de dados já cobertos; inventário atualiza com o artefato.
- **Audit:** `ia_eventos` + `via` + `gerado_por` cobrem trilha; prompt/versão do modelo no payload do evento (padrão atual).
- **Demo:** material gerado (rascunho + publicado) no dataset demo.

## Entidades e dados

- `materiais` ampliada (recon §5.4); `DocBloco[]` de `materiais-documentos.ts` como schema; `IA_TOOLS` + `ia_confirmacao_*` + `ia_eventos`; `liza-pedido` CustomEvent para o botão; `encontro_num`/`semana` como vínculos.
- Alternativa descartada: tabela `materiais_gerados` separada — segundo catálogo, segundo ponto de leitura.

## Critérios de sucesso

- **SC-001:** unit: parse/validação do `conteudo`, tool com confirmação, status flow, um-por-semana.
- **SC-002:** evals: "cria material da semana 17" gera blocos válidos; escopo inválido recusa; inválido não renderiza.
- **SC-003:** e2e app: coordenação gera via chat e via botão → rascunho → publica → biblioteca.
- **SC-004:** prints do material renderizado e do fluxo de revisão (1440/390).

## Plano de testes

- **Unit:** schema DocBloco, tool (2 fases), publicação, vínculo semana.
- **Evals:** casos `casos.json` novos (contract + live).
- **E2E:** chat + botão + biblioteca; papel negado (mentor/jovem não geram).
- **Regressão:** materiais legados (link/arquivo/doc) inalterados na leitura.

## Riscos

- Conteúdo gerado com erro pedagógico publicado rápido demais: mitigado pelo rascunho obrigatório + revisão humana; a flag permite desligar sem deploy.
- Scope creep do schema de blocos: manter o `DocBloco` fechado; tipo novo só por decisão, nunca por resposta da Liza.
- "Um por semana" pode frustrar quem quer iterar: a resposta é regenerar (nova versão), não empilhar.

## Premissas

- Esta spec é backlog: entra depois de 017–020; a modelagem de `materiais` pode sair cedo se o lead preferir destravar o schema.
- A Liza **não** escreve os roteiros semanais nesta spec — materiais somente.
- O schema de blocos é o `DocBloco` existente; se a geração pedir um tipo novo, é mudança explícita de schema, não duck-typing.
