# REALIZA-20 — `atividade_links`: link multi-sessão tokenizado com rascunho

- **Jira**: REALIZA-20 (migrada de REALIZA-17) · Feature · High
- **Veredito**: **ABERTO — a espinha existe com outra forma; falta o delta de multi-sessão**. A issue pedia uma tabela `atividade_links`; o código convergiu `formulario_links` + instrumentos de sistema pra esse papel (0080/0096/0099). O plano abaixo **evolui o que existe** — não cria tabela paralela (a própria issue proíbe).

## O que já existe (verificado)

- Token bearer 192 bits url-safe, `usado_em`/`expira_em`/`contexto`/`dupla_id`/`dest_mentorado_id` — `formulario_links` (0036).
- Emissão escopada: `emitir_link_instrumento` RPC definer (coord ou mentor DPP da dupla viva; gate trilha/status 0097) + `emitir_instrumento_core` reusável (0099) + auto-emissão por progresso (`jornada_autoemit`, 0099).
- Links de instrumento **sem expiração** (`expira_em` null no core de instrumentos).
- Rascunho **local**: `localStorage["rascunho:/f/<token>"]` em `use-resposta.ts` — multi-sessão **só no mesmo aparelho**; pill "Em andamento · rascunho salvo neste aparelho" (`JornadaRascunho`) é honesta sobre isso.
- Estados hoje: pendente → respondido (`usado_em`) / expirado. Ficha mostra enviar/pendente/reenviar/resultado (`instrumentos-dupla.tsx`).
- Resultado visível na ficha pro mentor DPP + coord (+ supervisor via `instrumentos_da_dupla`) — `InstrumentoResultado`.

## O que falta (o delta desta issue)

- **Rascunho server-side**: retomar de outro aparelho; mentor/coord verem "em andamento" de verdade (hoje é localStorage = invisível ao servidor).
- **Status mais rico**: `aberto` (viu o link) / `iniciado` (rascunho existe) — hoje só há pendente/respondido/expirado.
- **Devolução**: mentor devolve a resposta pro jovem corrigir — hoje `usado_em` é terminal; a saída é reemitir nova rodada (funciona, mas apaga o vínculo resposta↔revisão).
- **`tipo 'pdf'`**: fora de escopo aqui — é a REALIZA-55 (editor PDF); quando entrar, usa esta mesma espinha.

## Escopo do plano

- Evoluir `formulario_respostas` (status rascunho↔enviada + devolução) e `formulario_links` (`visto_em`), com RPCs definer novas — sem tabela nova.
- `use-resposta.ts`/`formulario-publico.tsx`: autosave server-side com debounce, restore com prioridade servidor > local.
- Ficha + Minha jornada: status "em andamento" real e ação "Devolver para correção".

## Dependências / bloqueios

- REALIZA-16 (âncora de identidade — herda; nada aqui cria órfão).
- Alimenta REALIZA-19 (Visão — já entregue, herda o delta), REALIZA-18 (roda), REALIZA-51 (lote), e downstream REALIZA-55/181.
- BLOCKER: devolução pode reabrir a **mesma** resposta (status volta a rascunho) ou exige ciclo novo? Recomendado: mesma resposta reabre — preserva vínculo e histórico.

## Esforço: **M**

## Riscos

- Rascunho server-side aumenta superfície pública (RPC definer nova) — caps e validação idênticos ao submit atual.
- Devolução muda semântica de `usado_em` — consumidores (jornada, painel, autoemit "respondida descansa") precisam revisar `usado_em` como "enviada", não "terminal".
- Conc corrida rascunho×submit: upsert atômico no banco.
