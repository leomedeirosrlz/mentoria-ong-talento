# Spec — Conquistas, nova rodada e preview de especialista

**Feature:** `specs/012-conquistas-especialista` · **Status:** Clarified
**Fila:** `REALIZA-515` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** a faixa “A caminho” mostra marcos já ganhos e parece chamar conquistas de “a caminho”; o card de sugestão de especialista só dá um nome, sem rosto, profissão ou experiência; o texto “o mentor enviou uma nova rodada” aparece até na primeira Roda, que é emitida automaticamente.
- **Resultado observável:** a faixa mostra só o próximo marco não ganho; o jovem vê um preview real do especialista antes de aceitar; a nova rodada só é oferecida quando a dupla/mentor decidiu refazer e existe resposta anterior.
- **Como saberemos que funcionou:** perfil/estante continuam earned-only; o card “Seu mentor sugeriu” mostra foto/área/experiência; a Roda inicial nunca diz “nova rodada”.

## Fora de escopo

- Implementar um novo modelo de badges/ilustrações (fica para a spec de badges, se a decisão visual justificar).
- Mudar o algoritmo de conquistas ou a régua de contagem.
- Criar nova rodada automática.

## Histórias de usuário

### US1 — “A caminho” = próximo marco (P1)

- **Por que P1:** a contradição atual faz o jovem duvidar do que já conquistou.
- **Teste independente:** abrir `/jovem/materiais` com 1, 2 e todos os marcos ganhos.
- **Cenários:**
  1. **Dado** um jovem com o 1º encontro feito **quando** abre a jornada **então** “A caminho” mostra o próximo marco não ganho, não o 1º como se faltasse.
  2. **Dado** todos os marcos ganhos **quando** abre **então** a faixa some ou vira “Jornada completa”, sem lista de conquistas ganhas.
  3. **Dado** o perfil **quando** aberto **então** a estante earned-only continua sendo o lugar de todas as conquistas.

### US2 — Preview do especialista (P1)

- **Por que P1:** aceitar uma sugestão de alguém que não se conhece é a maior fricção do fluxo.
- **Teste independente:** abrir home com sugestão e dialog de confirmação.
- **Cenários:**
  1. **Dado** uma sugestão com especialista desejado **quando** o card renderiza **então** mostra foto, nome, profissão/área e experiência resumida.
  2. **Dado** que a pessoa toca no preview **quando** abre **então** vê o perfil completo (sem documentos/LGPD restrito) e pode voltar ao aceite.
  3. **Dado** uma sugestão sem especialista definido **quando** renderiza **então** não inventa perfil; explica que a coordenação vai conectar.

### US3 — Nova rodada só por decisão (P1)

- **Por que P1:** o texto atual promete uma ação que não aconteceu e desvaloriza a primeira resposta.
- **Teste independente:** Roda inicial recém-emitida, Roda respondida e Roda reemitida.
- **Cenários:**
  1. **Dado** a Roda inicial autoemitida e não respondida **quando** o card renderiza **então** não aparece “nova rodada” nem “o mentor enviou”.
  2. **Dado** um instrumento com resposta anterior reemitido **quando** o card renderiza **então** o texto explica que a dupla decidiu refazer e que a resposta anterior segue salva.
  3. **Dado** que a pessoa clica em refazer **quando** confirma **então** a ação é explícita e registra a origem; não há reemissão silenciosa.

## Casos de borda

- Jornada sem marcos, sem cronograma ou concluída.
- Sugestão dispensada/aceita, especialista sem foto/área/experiência.
- Instrumento sem token, expirado, já respondido, reemitido e depois respondido.
- Roda inicial × formal: a mesma regra de “nova rodada” não pode contaminar a inicial.
- Papel sem permissão de ver perfil completo.

## Requisitos funcionais

- **FR-001:** a faixa “A caminho” DEVE mostrar apenas o próximo marco não ganho (ou um estado de conclusão).
- **FR-002:** conquistas ganhas NÃO DEVEM aparecer nessa faixa; a estante do perfil continua sendo a lista completa.
- **FR-003:** o card e o dialog de sugestão DEVEM exibir preview do especialista indicado com foto, profissão/área e experiência.
- **FR-004:** o detalhe de `a_fazer` DEVE carregar `reemissao` (ou equivalente) para distinguir primeira emissão de nova rodada.
- **FR-005:** a UI NÃO DEVE dizer “o mentor enviou uma nova rodada” sem reemissão real.
- **FR-006:** a primeira Roda não DEVE oferecer “Responder a nova rodada”.
- **FR-007:** a ação de refazer DEVE continuar explícita, com confirmação e registro de origem.

## Requisitos não funcionais

- **RLS:** inalterada; o preview só lê o perfil que o jovem já pode ver.
- **Auth:** sem rota pública nova.
- **LGPD:** não expor documentos, e-mail, telefone ou dados sensíveis no preview.
- **Demo:** dataset com sugestão de especialista e com Roda inicial a_fazer.
- **A11y:** preview é link/botão com nome acessível; dialog mantém foco.

## Entidades e dados

Nenhuma entidade nova. O `JovemEspecialista`/perfil já deve conter foto, profissão, áreas e experiência; se faltar, a query do catálogo passa a selecionar os campos existentes (sem migration). O estado derivado da jornada ganha a marca de reemissão.

## Critérios de sucesso

- **SC-001:** prints da jornada com 0/1/4 marcos ganhos, sem conquista ganha na faixa.
- **SC-002:** print do card de sugestão com foto/área/experiência.
- **SC-003:** Roda inicial sem “nova rodada”; Roda reemitida com o texto correto.

## Premissas

- “A caminho” será renomeado para **“Próximo marco”**; a estante do perfil continua “Suas conquistas”.
- O preview de especialista usa o perfil já acessível ao jovem, sem abrir dados de coordenação.
