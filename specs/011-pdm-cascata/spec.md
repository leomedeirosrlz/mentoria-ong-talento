# Spec — PDM cascateado e seletor de mentorado

**Feature:** `specs/011-pdm-cascata` · **Status:** Clarified
**Fila:** `REALIZA-512` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** no formulário do PDM as metas aparecem primeiro e o mapa de submetas depois, como dois blocos separados. O mentor precisa do nome do mentorado como controle, não de um botão “Ficha”/“Na ficha” que esconde a escolha.
- **Resultado observável:** cada submeta aparece imediatamente sob a sua meta; a pessoa adiciona metas além das três obrigatórias dentro do mesmo documento; na régua de instrumentos o nome do mentorado é o seletor (pills até 3, dropdown acima disso).
- **Como saberemos que funcionou:** o formulário do PDM e a ficha mostram a mesma árvore; o mentor troca de mentorado sem sair da régua; o deep-link `?dupla=` continua funcionando.

## Fora de escopo

- Criar um segundo modelo de PDM; `pdm_itens`/`pdm_submetas` já são a fonte.
- Mudar a regra de quem edita (mentor + mentorado; especialista fora).
- Reordenar os outros instrumentos.

## Histórias de usuário

### US1 — Submeta sob a meta (P1)

- **Por que P1:** é o defeito que quebra a leitura do documento.
- **Teste independente:** abrir o form do PDM em `/f/<token>` e a ficha; comparar a ordem.
- **Cenários:**
  1. **Dado** uma meta com `submetas_N` no template **quando** o formulário renderiza **então** as submetas aparecem dentro do card da meta N, não em um capítulo posterior.
  2. **Dado** um template legado com o capítulo “Mapa de submetas” **quando** renderizado **então** o capítulo não duplica as submetas já aninhadas.
  3. **Dado** uma submeta removida **quando** a pessoa desfaz **então** o texto volta e o foco retorna ao controle.

### US2 — Mais metas no mesmo PDM (P2)

- **Por que P2:** duplas com mais de três prioridades precisam continuar no documento.
- **Teste independente:** adicionar uma quarta meta e uma submeta; recarregar.
- **Cenários:**
  1. **Dado** o PDM com três metas **quando** a pessoa aciona “Nova meta” **então** uma quarta ficha entra vazia e focada.
  2. **Dado** o limite configurado **quando** atingido **então** o botão desabilita com explicação, sem sumir com as metas existentes.
  3. **Dado** recarregamento/retorno **quando** o rascunho existe **então** as metas extras continuam.

### US3 — Nome do mentorado como controle (P1)

- **Por que P1:** o mentor com vários mentorados não consegue escolher sem abrir ficha por ficha.
- **Teste independente:** com 1, 3 e 5 mentorados, abrir `/materiais?aba=instrumentos` e um instrumento.
- **Cenários:**
  1. **Dado** um mentor com 2–3 duplas **quando** abre a régua **então** vê pills com os nomes e “Todas”.
  2. **Dado** 4+ duplas **quando** abre **então** vê um dropdown com os nomes, não uma lista de botões “Ficha”.
  3. **Dado** um nome escolhido **quando** troca de instrumento **então** `?dupla=` persiste e a página abre filtrada.

## Casos de borda

- PDM sem cronograma, dupla pausada/encerrada, form sem submetas.
- Resposta antiga com submetas em capítulo separado.
- Mentor com dupla pausada (rótulo “pausada” no seletor).
- Mentorado sem permissão de editar; coordenação lê.
- Limite de submetas (`PDM_MAX_SUBITENS`) e texto vazio.

## Requisitos funcionais

- **FR-001:** submetas DEVEM ser renderizadas sob a meta correspondente em `/f`, preview e ficha.
- **FR-002:** o capítulo legado de submetas NÃO DEVE duplicar o que já foi aninhado.
- **FR-003:** o PDM DEVE permitir metas extras até um limite explícito; o limite atual não pode ser escondido.
- **FR-004:** a régua e a página por instrumento DEVEM usar nomes como controle, com pills até 3 e dropdown acima.
- **FR-005:** “Ficha”/“Na ficha” não é o único caminho para escolher mentorado.
- **FR-006:** o `?dupla=` DEVE sobreviver à troca de instrumento e ao refresh.

## Requisitos não funcionais

- **RLS:** inalterada; a árvore já é lida/escrita pelas RPCs existentes.
- **Auth:** sem rota pública nova.
- **LGPD:** nenhum dado novo.
- **Demo:** dataset demo com PDM aninhado e 1/4 mentorados para exercitar os dois seletores.
- **A11y:** dropdown com label, pills com `aria-current`, foco após adicionar/remover.

## Entidades e dados

`pdm_itens`/`pdm_submetas` (ou o contrato serializado `submetas_N`) continuam a fonte. Nenhuma entidade nova; se o limite de metas exigir schema, a plan.md registra a migration.

## Critérios de sucesso

- **SC-001:** print do form e da ficha com submetas aninhadas.
- **SC-002:** print do seletor com 1 e 4 mentorados.
- **SC-003:** teste de persistência de `?dupla=` e de rascunho de meta extra.

## Premissas

- O PDM nativo continua sendo a superfície de edição viva; o form é a captura inicial.
- O limite inicial é 8 metas (3 obrigatórias + 5 extras), salvo se o schema do template impedir; nesse caso a spec de implementação deve propor a migration antes de codar.
