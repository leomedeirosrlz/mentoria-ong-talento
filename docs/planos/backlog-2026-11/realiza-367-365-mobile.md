# REALIZA-367 + REALIZA-365 — Mobile: scroll horizontal na agenda por mentorado + recorte de turma na visão geral

Issue: `mobile`,`ux` (367 — crítico), `ux` (365). Fonte: batch `mobile-ui` do `_contexto.md`. Implementação em voo: branch `thiago/mobile-ui-fixes` (worktree `convite`) — diff em working tree, não commitado. Status: em implementação.

## O que exige vs. o que existe

**REALIZA-367** — a aba "Por mentorado" da `/agenda` do mentor DPP rolava na horizontal a 390px. Recon feito: o estourador real **não** era uma section nem a grade — era o `Badge` global (`src/components/ui/badge.tsx:8`: `shrink-0` + `whitespace-nowrap`). Dois conteúdos de texto livre o inflavam:

1. o badge de turma no header do `CardMentorado` (`agenda-por-mentorado.tsx`) — `turmaLonga` gera labels longos tipo "Turma 1 · 2026/2027";
2. o `SolicitacaoStatusChip` — "Especialista: <nome comprido> · trilha encerrada" / "Negociando horário com <nome>".

O `<article>` do card e os filhos diretos são flex/grid items: sem `min-w-0`, `min-width:auto` resolve pro min-content do filho mais largo → o badge nowrap propagava a largura pra cima e esticava `document.documentElement` além do viewport. Estado verificado no branch: `min-w-0` aplicado no `article` e em **todos** os filhos diretos flex (header, bloco de progresso, `section` de pendências, footer de ações, `ProximoEncontro`, `TrilhaBlock`, `TrilhasAnteriores`, `PedidoEspecialistaBlock`, `SemTrilhaBlock`, `PedidosAnterioresLine`); o badge de turma e o chip de status ganharam `min-w-0 max-w-full shrink` + `<span class="truncate">` interno + `title` com o rótulo íntegro (regra do AGENTS.md: metadado trunca, íntegro fica no `title`). `solicitacao-status-chip.tsx` foi reescrito de returns-por-case pra `label`+`cls` únicos — um único JSX de saída, impossível esquecer o truncate num caso novo.

**REALIZA-365** — três incômodos da visão geral:

1. **re-clique no chip de turma não limpava o filtro** — `TurmaHubCard` ativo apontava pra `/?turma=<mesma>` (no-op). Fix: quando `ativa`, o link vira `/?turma=todas` — o mesmo destino do "ver todas", que a page resolve como `origem:"todas"` e o sync apaga o cookie (`turma-contexto.ts:136`). `aria-label` ganha o sufixo "· remover o recorte".
2. **dropdown de contexto redundante no topo da home** — `seletorContexto` renderizava `TurmaContextoSelect` logo acima do `TurmaHub`, que já é o controle de contexto. Fix: `TurmaContextoSelect` sai; entra `TurmaFocoSync` (`turma-contexto-select.tsx:54`) — o componente headless que só faz o efeito de gravar a `?turma=` aterrissada no cookie. Deep links continuam funcionando.
3. **cards de papel da demo desalinhavam** — títulos de 2 linhas ("Auxiliar executivo", "Mentor especialista") desnivelavam persona/descrição dos irmãos. Fix em `demo-enter-button.tsx`: título `text-balance min-[360px]:min-h-10` (piso de 2 linhas só no grid de 2 colunas) e descrição `text-pretty`.

## Decisões

- **Truncar o badge, não o texto livre envolvente.** O `Badge` global é `shrink-0 nowrap` por contrato — mexer nele mudaria todos os usos. A correção fica no ponto de uso: `min-w-0` na cadeia + `shrink`/`truncate` no badge problemático, com `title` carregando o íntegro. Mesma receita nos dois componentes (turma e status-chip).
- **`min-w-0` em toda a cadeia, não só no culpado.** Qualquer filho flex sem piso pode virar o próximo estourador quando o conteúdo muda (nome de especialista novo, anexo com nome longo — por isso o `break-words` na lista de anexos do `RegistroSessao`, :1108).
- **`?turma=todas` reutiliza o caminho do "ver todas"** em vez de criar verbo novo: page já resolve `origem:"todas"` e o `TurmaFocoSync` apaga o cookie — um único código de limpeza.
- **Seletor sai, sync fica.** Remover o `TurmaContextoSelect` do topo não podia quebrar `?turma=` em link externo (WhatsApp, e-mail) — `TurmaFocoSync` é exportado do mesmo arquivo e mantém o efeito de persistência sem UI.

## Schema

Nenhuma.

## Domínio (src/lib/)

Inalterado — o fix é inteiro de apresentação. `turmaLonga`, `TURMA_TODAS` e a resolução de foco já existiam e foram reutilizados.

## UI

- `src/components/agenda-por-mentorado.tsx` — `min-w-0` no `article` (:351), header (:358), bloco DPP (:409), `section` pendências (:488), footer (:597), `ProximoEncontro` (:736), `TrilhaBlock` (:799), `TrilhasAnteriores` (:1124), `PedidoEspecialistaBlock` (:1254), `SemTrilhaBlock` (:1340), `PedidosAnterioresLine` (:1448); badge de turma truncável com `title` (:372-381); `break-words` na linha de anexos (:1108).
- `src/components/solicitacao-status-chip.tsx` — reescrito: um único retorno com `Badge title={label} className="min-w-0 max-w-full shrink"` + `<span class="truncate">`. Mesmas labels/classes de antes, zero mudança visual além do corte.
- `src/components/turma-hub.tsx` — `TurmaHubCard` ativo linka `/?turma=todas`, `aria-label` + "· remover o recorte", `aria-current` mantido.
- `src/app/(app)/(home)/page.tsx` — `seletorContexto` agora recebe `<TurmaFocoSync>` (headless) em vez de `<TurmaContextoSelect>`.
- `src/components/demo-enter-button.tsx` — título `text-balance min-[360px]:min-h-10`, descrição `text-pretty`.

Copy inalterada; sem travessão novo em texto visível.

## Seed + demo

Sem mudança de fixture. O teste e2e usa o dataset demo existente (3 duplas do mentor Ricardo: trilha ativa, pedido no mural, concluída) — é a superfície real onde a regressão morava.

## Testes

- `tests/e2e/demo/agenda-dpp.spec.ts` — novo spec "Por mentorado a 390px: nenhum chip/badge estica o documento (REALIZA-367)": viewport 390×844, entra como `mentor_dpp`, espera os três cards (Bia, Matheus Gonçalves, Gustavo Batista) e mede no DOM real: `document.documentElement.scrollWidth <= window.innerWidth` **e** nenhum `[data-slot="badge"]` dentro de `<article>` com `getBoundingClientRect().right` além da borda direita do próprio card (+1px de tolerância). Dupla régua: documento não rola **e** badge não vaza.
- ⚠ gap: nenhum teste cobre o re-clique do `TurmaHubCard` (365) nem a remoção do seletor — critério verificável só por inspeção/e2e manual.

## Critérios de aceite

- [x] `/agenda?aba=por-mentorado` a 390×844 não rola na horizontal (`scrollWidth <= innerWidth`) — coberto por spec e2e no branch.
- [x] Nenhum badge/chip vaza a borda direita do card-pai — régua por elemento no mesmo spec.
- [x] Badge de turma e chip de especialista truncam com reticências e carregam o rótulo íntegro no `title`.
- [x] Re-clicar no card da turma em foco limpa o recorte (vai pra `?turma=todas`, cookie apagado pelo sync).
- [x] Home não mostra mais o dropdown de contexto no topo; `?turma=` de link externo continua gravando o cookie.
- [x] Cards de papel da `/demo` mantêm persona/descrição alinhados com título de 2 linhas.
- [ ] ⚠ gap: re-clique do hub + sync headless sem teste automatizado (verificar manual ou cobrir depois).

## Fora de escopo

- Outras telas a 390px (a régua `min-w-0` foi aplicada na superfície reportada; varredura global de overflow não entrou).
- Mudar o contrato do `Badge` global (shrink-0/nowrap segue — quem precisa ceder declara no uso).
- Reflow/zoom 200% (WCAG) além do caso concreto.
