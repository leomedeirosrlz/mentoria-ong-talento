# Spec — Revisão e2e UI/UX das trilhas de especialista

**Feature:** `specs/015-e2e-especialista-uiux` · **Status:** Clarified
**Fila:** `REALIZA-510` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** as trilhas de especialista têm contratos e testes de agenda, mas não uma revisão e2e voltada a UI/UX: catálogo, sugestão, aceite, sessão, devolutiva e encerramento são avaliados em pedaços, sem prints e sem estados vazios/negados.
- **Resultado observável:** um roteiro e2e reproduzível, em 1440 e 390, com prints, falhas P0/P1/P2 e specs que faltarem; a revisão acontece depois dos ajustes de especialista para não fotografar o estado velho.
- **Como saberemos que funcionou:** qualquer pessoa consegue rodar o roteiro no Supabase local e comparar o resultado com o relatório.

## Fora de escopo

- Corrigir o produto nesta spec (as correções vão para a spec 012 ou issues próprias).
- Usar staging/produção.
- Testar documentos/LGPD que não aparecem no fluxo do jovem.

## Histórias de usuário

### US1 — Jornada do jovem com especialista (P1)

- **Por que P1:** é o caminho de quem recebe a sugestão e decide.
- **Teste independente:** rodar o roteiro com um jovem e um especialista.
- **Cenários:**
  1. **Dado** uma sugestão do mentor **quando** o jovem abre a home/especialistas **então** vê o preview (foto, área, experiência) e consegue confirmar ou dispensar.
  2. **Dado** um pedido aceito **quando** a sessão é combinada **então** o cartão mostra tema, especialista, passo e horário.
  3. **Dado** uma sessão realizada **quando** a devolutiva chega **então** o jovem entende o que foi registrado e o que fica privado.

### US2 — Catálogo e mural (P1)

- **Por que P1:** o especialista precisa se reconhecer e o jovem precisa escolher.
- **Teste independente:** catálogo com perfis completos e incompletos.
- **Cenários:**
  1. **Dado** um perfil com foto/área/experiência **quando** o catálogo abre **então** o card é reconhecível e abre o perfil.
  2. **Dado** um perfil sem foto/experiência **quando** abre **então** há fallback honesto, sem card quebrado.
  3. **Dado** um pedido no mural **quando** o especialista abre **então** vê demanda, objetivo e contexto sem dados sensíveis desnecessários.

### US3 — Registro, encerramento e estados negados (P2)

- **Por que P2:** é onde a trilha termina e onde a permissão errada aparece.
- **Teste independente:** rodar com papéis permitidos/negados.
- **Cenários:**
  1. **Dado** uma trilha ativa **quando** o especialista registra/devolve **então** o mentor DPP vê o que foi compartilhado.
  2. **Dado** um encerramento **quando** o rito abre **então** o checklist e a avaliação final aparecem no estado certo.
  3. **Dado** um papel sem permissão **quando** tenta acessar **então** a UI e a RLS negam sem vazar conteúdo.

## Casos de borda

- Sem sugestão, sugestão dispensada, pedido aberto, contraproposta, sessão sem horário, sessão cancelada.
- Especialista sem perfil completo; jovem sem trilha; dupla pausada/encerrada.
- Mobile 390, teclado, leitor de tela, `prefers-reduced-motion`, contraste.
- Datas no passado/futuro e fuso.

## Requisitos funcionais

- **FR-001:** o roteiro DEVE cobrir home, catálogo, sugestão, aceite, sessão, devolutiva, encerramento e estados negados.
- **FR-002:** cada passo DEVE ter print desktop/mobile e resultado esperado.
- **FR-003:** falhas DEVEM ser classificadas P0/P1/P2 com evidência e arquivo/rota.
- **FR-004:** o relatório DEVE indicar specs e2e novas/alteradas.
- **FR-005:** a execução DEVE ser local, com Supabase local, sem staging.

## Requisitos não funcionais

- **Dados:** fixtures locais, sem PII real.
- **A11y:** foco, teclado, alvos de toque, contraste e texto alternativo.
- **Reprodutibilidade:** comandos e credenciais de teste no relatório, sem segredos.

## Entidades e dados

Nenhum dado novo; usa fixtures locais de perfis, solicitações, duplas e sessões.

## Critérios de sucesso

- **SC-001:** relatório com matriz passo × papel × viewport.
- **SC-002:** pelo menos um spec e2e novo/ajustado para cada lacuna P0/P1.
- **SC-003:** revisão aprovada manualmente pelo Thiago antes de virar PR.

## Premissas

- A revisão ocorre depois dos ajustes de preview/copy de especialista (spec 012), para medir o estado novo.
- O foco é UI/UX e confiança do fluxo, não carga/performance.
