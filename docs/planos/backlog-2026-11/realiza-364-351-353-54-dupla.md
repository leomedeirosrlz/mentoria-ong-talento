# REALIZA-364 + 351 + 353 + 54 — Linha de dupla: Editar no ⋯, anexo no rito, mentorado no chamado e PDM nos arquivos

Issue: `ux`, `bug`, `rls`. Fonte: backlog 2026-11 (batch dupla-fixes). Implementação em voo: branch `thiago/dupla-fixes`, commit `1f5d2d0`. Status: em implementação.

## O que exige vs. o que existe

### REALIZA-364 — "Editar dupla" no ⋯ da linha

O ⋯ real da `DuplaLinha` (`DuplaLinhaMenu`) tinha "Ver ficha" (redundante — a linha inteira já navega pelo link esticado) + formulario/remanejar/encerrar. A edição completa da dupla (`EditarDuplaDialog`) só existia no cabeçalho da ficha — a coord abria a ficha só pra editar status/desfecho/mentor.

### REALIZA-351 — Anexo oferecido pela UI, recusado pela RLS

A 0102 conclui a dupla quando o último encontro é registrado e abre o rito de fechamento (`encerramentos.tipo = 'pendente'`, 0156). A ficha já libera anexo nessa janela — `podeAnexar` em `duplas/[id]/page.tsx:874` inclui `ritoPendente` (o retroativo pode pousar o 16º encontro sem foto nem follow-up). Mas a policy `registro_anexos_mentor_insert` (0021) travava o insert em `d.status = 'ativa'` — a UI oferecia e o banco recusava.

### REALIZA-353 — `mentorado_nome` voltava da query e não aparecia

`queries-chamados.ts` já preenche `mentorado_nome` (:257, :451) e `Chamado` já tipa (`types.ts:737`) — mas nem a fila (`chamados-app.tsx`) nem o detalhe (`chamado-detalhe.tsx`) renderizavam. Na fila do **autor** (mentor/staff não-coord) o `contexto` vem `null` — sem o mentorado a linha ficava sem âncora da dupla.

### REALIZA-54 — Aba/seção de arquivos sem o PDM e invisível quando vazia

`ArquivosDupla` listava só `registro_anexos` e retornava `null` vazio — o PDM (documento vivo da trilha DPP) não entrava e a dupla não tinha onde descobrir pra que serve anexar.

## Decisões

- **364 — "Editar dupla" entra, "Ver ficha" sai.** O menu só traz ação real: `editar` abre o `EditarDuplaDialog` em modo controlado (`trigger={null}`, `open`/`onOpenChange` pelo `DialogId`) — mesmo padrão de `RemanejarDuplaDialog`. Ligado nos três callers de coordenação: `dashboard-coordenacao.tsx` (menuDa), `duplas-lista.tsx` VisaoCoordenacao, `fila-acompanhar.tsx`. "Ver ficha" removido — era o mesmo destino do clique na linha.
- **Supervisor fica sem menu real**: `menuDa` devolve `null` (dashboard) e VisaoSupervisor não passa mais `menu` — o ⋯ **decorativo** do `DuplaLinha` (`dupla-linha.tsx:269-278`, aria-hidden, pointer-events-none) mantém o visual da casa. `DuplaLinhaMenu` também devolve `null` quando nenhum item se aplica (:118).
- **Reset por abertura no `EditarDuplaDialog`**: estado (status/mentor/desfecho/motivo/trilha) zera na **transição da prop `open`** durante o render (padrão `abertoAntes`) — no modo controlado o Base UI não chama `onOpenChange` quando o item de menu abre de fora, então o ajuste `onOpenChange` anterior não disparava e edição abortada vazava seleção pra próxima abertura.
- **351 — relaxar a policy, não esconder a UI.** A affordance já era intencional (o retroativo precisa anexar evidência no rito); o errado era o gate da 0021. Migrou o `with check` pra `ativa` **ou** `concluida` com `encerramentos.tipo = 'pendente'` — a janela fecha sozinha quando a coordenação decide o rito. Delete e storage.objects inalterados.
- **353 — mentorado como âncora, sem redundância.** Fila: pra papel ≠ mentorado mostra `Mentorado: <nome>` quando `mentorado_nome` existe; o jovem não vê o próprio nome como "contexto" (a dupla é ele). Detalhe: meta usa `contexto ?? Mentorado: <nome>` (pro staff o contexto já embute "Dupla de <nome>"). `mentorado_nome` entrou na busca da fila.
- **54 — "Documentos da dupla" agrega o PDM como primeiro item.** `ArquivosDupla` aceita `pdm?: PdmDoc | null`: item "Plano de desenvolvimento" com meta "documento vivo · X de Y metas" (`progressoPdm`), link `?aba=instrumentos#pdm` — não é baixável, abre na aba onde o doc vive. Seção **sempre renderiza**: vazia mostra "Nada anexado ainda. Quando a dupla anexar evidências num registro, elas aparecem aqui." `#pdm` vira deep link (`AbaPorHash` → aba instrumentos; `PdmDupla` ganha `id="pdm"`).

## Schema

**`0183_registro_anexos_rito.sql`** — drop + recreate de `registro_anexos_mentor_insert` com a condição ampliada (`ativa` OU `concluida`+rito pendente); resto verbatim da 0021 (created_by = `my_profile_id()`, prefixo `registro_id/%`, mentor da dupla). Sem mudança em delete nem em `storage.objects`.

⚠ **Número fora da reserva do `_contexto.md`**: a tabela reserva 0183/0184 pra jovem-consistencia e **0186** pra dupla anexos — a branch tomou 0183 (livre na base, staging em 0182). Reviewer: ou renumera pra 0186, ou atualiza a reserva — se jovem-consistencia subir com 0183 próprio colide no `supabase db push`.

## Domínio (`src/lib/`)

Nenhum helper novo — a migração é schema-only e as queries de chamados já entregavam `mentorado_nome`. `EditarDuplaDialog`/`DuplaLinhaMenu`/`ArquivosDupla`/`AbaPorHash`/`PdmDupla` são UI.

## UI

- `dupla-linha-menu.tsx`: prop `editar`, item "Editar dupla" com `PencilSimple`, `DialogId` + `editar`, "Ver ficha" e o `DropdownMenuSeparator` fora; `return null` sem itens.
- `editar-dupla-dialog.tsx`: modo controlado (`trigger`/`open`/`onOpenChange`), trigger default "Editar" preservado pro header da ficha, reset de estado na subida de `open`.
- `arquivos-dupla.tsx`: título "Documentos da dupla", prop `pdm`, item PDM (`FileText` ssr + `Link`), empty state, subtítulo condicional.
- `pdm-dupla.tsx`: `id="pdm"` âncora.
- `aba-por-hash.tsx`: `#pdm` → `?aba=instrumentos`.
- `chamados-app.tsx`/`chamado-detalhe.tsx`: `mentorado_nome` na meta/fila/busca.

## Seed + demo

Nada — `registro_anexos` e chamados não têm caminho demo alterado; o PDM demo já existe e passa a aparecer na seção por tabela.

## Testes

- Sem spec vitest/e2e nova no diff — a cobertura é: migration aplicada em staging antes do e2e-preview (policy relaxada exercitada pelo fluxo de anexo) + inspeção.
- ⚠ gap: nenhum teste trava o menu "Editar dupla", o fallback de `mentorado_nome` na fila/detalhe nem o deep link `#pdm`.

## Critérios de aceite

- [ ] ⋯ de uma linha de dupla pra coordenação mostra "Editar dupla" e abre o `EditarDuplaDialog` completo (home, /duplas, fila de acompanhar).
- [ ] "Ver ficha" não existe mais no menu — a linha continua navegando pelo link esticado.
- [ ] Reabrir o dialog depois de abortar uma edição mostra o estado atual da dupla, não seleções velhas.
- [ ] Supervisor vê o ⋯ decorativo (sem popup) — nenhum item de coordenação aparece pra ele.
- [ ] Menu vazio (dupla morta sem `editar`) rende `null` e cai no ⋯ decorativo.
- [ ] Mentor consegue anexar no registro da dupla `concluida` com rito `pendente` — insert passa na policy nova.
- [ ] A janela fecha ao decidir o rito (`tipo` sai de 'pendente') e nunca abriu pra `encerrada`/desistente.
- [ ] Fila de chamados do autor mostra "Mentorado: <nome>" quando `contexto` é null; detalhe idem na meta.
- [ ] Busca da fila encontra chamado pelo nome do mentorado.
- [ ] "Documentos da dupla" aparece mesmo sem anexos, com o empty state; com PDM ele é o 1º item e linka pra `?aba=instrumentos#pdm` rolando até o doc.
- [ ] Migration 0183 aplica limpa no staging; número resolvido contra a tabela de reservas (⚠ acima).
- [ ] `npx tsc --noEmit` e `npx eslint src/` limpos.

## Fora de escopo

- Esconder a affordance de anexo (alternativa descartada — a janela é intencional).
- Mudar `registro_anexos` delete/storage policies — não era o buraco.
- Edição inline de dupla por supervisor — coord-only por design.
- Novos tipos de documento na seção (termos, assinaturas) — seguem na ficha pessoa.
