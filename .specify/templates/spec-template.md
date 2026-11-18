# Spec — <nome da feature>

**Feature:** `specs/NNN-<slug>` · **Status:** Draft | Clarified | Approved | Delivered | Dropped
**Fila:** `BACKLOG.md#<item>` ou `REALIZA-<n>` · **Dono:** <nome> · **Data:** <dd/mm/aaaa>

> O QUÊ e o POR QUÊ. Sem stack, sem DDL, sem nome de arquivo de implementação — isso é o `plan.md`.

## Problema e resultado

- **Dor hoje:** quem sente, em que momento, o que deixa de acontecer.
- **Resultado observável:** uma frase, sem tecnologia.
- **Como saberemos que funcionou:** sinal no produto ou no operacional.

## Fora de escopo

- O que esta mudança explicitamente não faz (evita virar épico).

## Histórias de usuário

Cada história é independente e testável sozinha. P1 é o menor recorte que já entrega valor.

### US1 — <título> (P1)

- **Por que P1:** valor que ela entrega sozinha.
- **Teste independente:** como verificar sem as outras histórias.
- **Cenários:**
  1. **Dado** <estado> **quando** <ação> **então** <resultado>.
  2. **Dado** <estado> **quando** <ação> **então** <resultado>.

### US2 — <título> (P2)

- ...

## Casos de borda

- Token expirado, já usado ou de outro dono.
- Dupla pausada, encerrada ou sem cronograma.
- Papel sem permissão (o caso negado importa tanto quanto o feliz).
- Dado ausente ou legado (migration retroativa).
- Menor de idade / responsável legal.
- Repetição da ação (idempotência).

## Requisitos funcionais

- **FR-001:** o sistema DEVE ...
- **FR-002:** o sistema DEVE ...
- **FR-003:** ... `[NEEDS CLARIFICATION: <pergunta>]` — resolver com `/speckit-clarify`; não planejar com dúvida aberta.

## Requisitos não funcionais

- **RLS:** papéis que leem e escrevem; policy nova, alterada ou RPC `security definer`.
- **Auth:** rota pública? token? entrada em `isPublic`? efeito no handoff de login?
- **LGPD:** dado pessoal novo? entra em `docs/lgpd/inventario-dados.md`; menor de idade?
- **Demo:** como a feature aparece em `/demo` sem login.
- **A11y/perf:** teclado, foco, piso de 12px no mobile, orçamento de tempo.

## Entidades e dados

Entidade, campos, relações e invariantes em linguagem de domínio. Sem DDL.

## Critérios de sucesso

- **SC-001:** métrica observável sem ler código.
- **SC-002:** ...

## Premissas

- O que foi assumido quando a descrição não especificou. Premissa errada é bug de spec, não de código.
