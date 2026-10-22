# REALIZA-147 — Avaliação do especialista pela dupla (form sistema + emissão automática)

[Jira REALIZA-147](https://realizavc.atlassian.net/browse/REALIZA-147)

**Status: FEITO** — evidência auditada; não replanejar.

## Escopo da auditoria

Formulário oficial de avaliação da trilha do mentor especialista, emitido
automaticamente ao encerrar a trilha, respondido pela dupla via link público.

## Evidências

- `supabase/migrations/0104_avaliacao_especialista.sql` — tudo em uma migration:
  - valor `avaliacao_especialista` adicionado ao check `formularios_sistema_check`;
  - seed do formulário oficial com `sistema=true` (imutável via
    `formularios_sistema_guard`);
  - `encerrar_trilha_especialista` passa a emitir o link de avaliação e a
    notificação junto do encerramento;
  - RPC de leitura `avaliacao_esp_da_dupla` para a coordenação ler a resposta
    da dupla.
- `src/app/(app)/formularios/formulario-links.tsx` / listagem de links em
  `/formularios/[id]` — canal de envio/cópia do link tokenizado existente.
- Renderer público `src/app/f/[token]/formulario-publico.tsx` cobre os tipos
  usados pelo seed (genérico — avaliação especialista não é instrumento
  sob-medida de `src/components/instrumentos/`).

## Notas

- O recon (`_recon/issues-status.md`) marca 147 como entregue via `0104`;
  confirmado por leitura direta da migration.
