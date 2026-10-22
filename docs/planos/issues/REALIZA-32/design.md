# REALIZA-32 — design.md

## Persona & JTBD

- **Auxiliar executivo** ("Paulo"): "quero acompanhar a minha turma inteira — semáforo, agenda, registros — sem a coordenação me atribuir dupla por dupla."
- **Coordenação**: "quero designar o auxiliar a uma turma uma vez."

## Superfícies afetadas

### Auxiliar

- `/duplas` — seção "Minhas supervisionadas" já agrupa por turma (`duplas-lista.tsx:1289-1331`); com escopo por turma a seção cresce: manter sub-headers por turma e o colapso `Collapsible` por turma quando >8 duplas `[NOVO ajuste]`.
- Home do auxiliar + agenda-auxiliar (`src/lib/agenda-auxiliar.ts`) — cards por turma já existem; só o conjunto de dados muda.
- `/agenda` — calendário do auxiliar passa a projetar a turma do escopo; seletor de cronograma (hoje coord) pode aparecer pro auxiliar multi-turma — **a verificar** se `AgendaCoordenacao`/`AgendaMinha` já recebem cronogramas pro supervisor.

### Coordenação — designação

- Ponto de configuração: dialog/ficha onde papéis são editados (a verificar componente atual de `profile_papeis` — provável ficha `/pessoas/[id]`). Adicionar `Select` "Turma" `[NOVO]` visível só quando papel = supervisor, options = `getTurmas()`/labels de `cronogramas.turma` (pré-47).
- Microcopy: "Auxiliar desta turma — enxerga todas as duplas dela" (Opção A) / "…só as duplas designadas" (Opção B).

## Estados

- Auxiliar sem `escopo_turma` e sem `supervisor_id`: `/duplas` vazia com "Nenhuma turma atribuída — peça à coordenação." `[NOVO]` (hoje seria lista vazia muda).
- Erro/permission: writes fora do escopo falham na RLS — action devolve `{error}` → toast (padrão casa).
- Loading: páginas são server-rendered; sem skeleton novo.

## Mobile → desktop

Sem mudança de layout — é mudança de escopo de dados. Agrupamentos/colapsos usam os `Collapsible` e chips já existentes.

## Acessibilidade

- Selects novos com `aria-label`; cabeçalhos de turma mantêm hierarquia `h2`/`h3`.
