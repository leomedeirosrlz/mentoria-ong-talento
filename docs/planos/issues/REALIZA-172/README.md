# REALIZA-172 — Débitos pequenos da revisão geral (7 itens)

**Status: parcial — 7 itens da issue, com 2 "a verificar" resolvidos por
inspeção e 1 já entregue.** Tabela de estado:

| # | Item | Estado | Evidência |
|---|------|--------|-----------|
| 1 | `atribuido_nome` morto no portal do jovem | **confirmado** | populado em `src/lib/queries-chamados.ts:94` (ramo que zera `autor_*`), mas `src/components/jovem-chamados.tsx` nunca o renderiza — grep sem ocorrência de `atribuido` |
| 2 | `getCicloEventos` sem uso no jovem | **confirmado** | chamado em `src/app/(jovem)/jovem/agenda/page.tsx:92`; RLS (0065) devolve `[]` pro papel mentorado — só alimenta `oficialPorNumero` (`:136-153`), sempre vazio |
| 3 | agenda sem CTA de encerramento | **confirmado** | `src/lib/agenda-minha.ts:693` trata `evento_encerramento` como item de calendário, mas nenhum motivo/CTA aponta pro rito quando `encerramentos` pendente existe |
| 4 | `/assinar/[token]` sem faixa demo | **confirmado** | zero referências a demo em `src/app/assinar/[token]/` |
| 5 | dataset demo sem vínculo `outra_pessoa` | **confirmado** | `src/lib/demo/queries.ts:1938` — o stub sempre retorna `'anon'`; o ramo `outra_pessoa` de `src/app/assinar/[token]/page.tsx:169` é inexercitável em demo |
| 6 | edição de evento esp apaga `cronograma_id` | **a verificar** | `salvarEventoCronograma` exige `cronograma_id` no input (`src/lib/actions-cronogramas.ts:294-302`) e o editor o passa (`src/components/cronograma-editor.tsx:704-715`); suspeita vive em outro caminho — ver plano |
| 7 | card "expirado" de terceiros inalcançável | **a verificar** | o card existe (`src/app/t/[token]/page.tsx:100-115`); alcançável só se a RPC `terceiro_por_token` devolver `'expirado'` — `src/lib/terceiros/queries.ts:149-165` repassa o status cru do banco |

## Escopo

Nada de redesign. São 7 consertos cirúrgicos, cada um com seu próprio passo
no `plan.md` e caso no `acceptance.md`. Sem mudança de schema em 1-5;
o item 6 pode pedir correção de payload (server action), não de DDL.
