# REALIZA-54 — acceptance.md

## Critérios executáveis

1. **Agregação**
   - Ficha de dupla DPP com PDM respondido → item "PDM — Plano de
     Desenvolvimento Mútuo · respondido em {data}" no topo da seção
     Arquivos; "Ver" abre `InstrumentoResultado` com a resposta.
   - Dupla com anexos mas sem PDM respondido → só anexos, sem buraco/ghost.
   - Dupla com PDM respondido e anexos → ambos; PDM primeiro.
   - PDM respondido 2x (revisão de meio) → item único com a data mais
     recente; "Ver" abre a resposta mais recente.
2. **Empty state**
   - Dupla sem anexos e sem PDM respondido → seção visível com "Nenhum
     arquivo ainda — evidências enviadas nos registros e o PDM respondido
     aparecem aqui." (e não ausência da seção).
   - Falha na RPC `instrumentos_da_dupla` (simular) → seção não quebra;
     anexos continuam + empty honesto se nenhum.
3. **Permissões**
   - Mentor da dupla / supervisor / coord veem a seção como hoje.
   - Mentorado vendo a própria ficha: item PDM só aparece se o card
     Instrumentos também aparecer pra ele (assert de paridade — o critério
     é "mesma audiência do card", qualquer que seja).
   - Download de anexo segue `/api/anexo/[id]` 401/403 pra quem não tem
     vínculo (regressão — nada mudou nas rotas).
4. **Trilha especialista**
   - Ficha de dupla esp: sem item PDM (instrumentos são da jornada DPP);
     anexos e empty state funcionam.
5. **Demo**
   - `/demo`: dupla fixture com PDM respondido → item visível; uma dupla
     sem arquivos → empty state. Zero writes.
6. **Regressão visual**
   - Desktop/mobile: itens não quebram layout; ícone + nome + meta +
     ação alinhados como os anexos.
7. **Gates**
   - `npx tsc --noEmit` · `npx eslint src/` · `pnpm test` · e2e demo spec
     (seção com PDM + empty) · e2e app em preview (upload anexo +
     responder PDM via `/f/[token]` → ambos na seção) · 1 revisor (Tier B).

## Dependência documentada

- REALIZA-181 (PDM nativo): quando `pdm_*` existir, o item `kind:'pdm'`
  troca de fonte/ação (view nativa/export) — mudança local na montagem do
  array no page, componente intacto. Registrar isso no comentário do tipo
  `ArquivoDaDupla`.

## Não-escopo

- Tabelas/colunas de anexo de PDM (não existem — não criar).
- Export/download do PDM nesta issue.
- Anexos de outros domínios na seção.
