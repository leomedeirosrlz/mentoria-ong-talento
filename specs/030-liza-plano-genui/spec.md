# Spec — Liza: pills no escopo, fluxo "ficar em dia" e GenUI de documento

**Feature:** `specs/030-liza-plano-genui` · **Status:** Draft para revisão
**Origem:** REALIZA-527 + feedback §6 (recon `docs/planos/issues/_recon/liza-1125.md`) · **Data:** 25/11/2026

> Spec leve de implementação (rodada 527): registra as decisões tomadas antes de codar. Sem migrations — todo o gesto novo usa RPCs existentes.

## Problema e resultado

- **Pills fora do recorte:** o catálogo filtra por tool (allowlist), mas não por recorte — o mentor recebia "Quantos chamados abertos?" (pergunta de equipe; `chamados_resumo` dele devolve só os pedidos dele). Filtro novo por `papeis` na pill, além do grant da tool.
- **Plano "ficar em dia" pela metade no chat:** `plano_em_dia` só simulava o default — sem ritmo pedido, sem grade, sem fusão, sem recessos pendentes na saída. `plano_propor` ignorava decisões e excluía o jovem (a RPC 0225 já o aceita). `declarar_recesso` listava a coordenação na allowlist, mas a RPC 0234 só aceita a dupla — a tool prometia o que o banco recusa.
- **Copy bilateral remanescente:** o CardPlano ainda dizia "falta o aceite dos dois" e o comentário do `DuplaPlano` dizia "só sai de proposto com os dois" — sobrou da era bilateral (0224); a régua vigente é aceite ÚNICO (0225).
- **Remarcação em duas mensagens:** "remarca o 5º pra quinta 19h" virava pergunta de horário — a tool já aceita `data_hora` cheia, o prompt não ensinava a juntar dia+hora.
- **Link do instrumento cru:** `emitir_link_instrumento` devolvia só a URL e o card mostrava `/f/<token>` solto — sem copiar, sem WhatsApp, sem dizer pra quem é.
- **Datas ISO no card de confirmação:** os resumos de escrita colavam `data_hora` crua ("2026-12-01T19:00:00-03:00") no texto que a pessoa lê pra confirmar.

## Decisões

### D1 — Pill ganha `papeis?: AppRole[]` (escopo semântico)

`catalogo()` filtra em duas camadas: `p.papeis` (a quem a pergunta serve) e `PILLS_TOOL_ROLES` (a tool responde). "Quantos chamados abertos?" fica `coordenacao|supervisor`; a agenda ganha "Como está minha dupla?" pra mentor não perder itens. O prompt (`sugestoes`) repete a régua: sugestão só promete o recorte da pessoa.

### D2 — `plano_em_dia` espelha o planner

Schema: `{dupla_id, ritmo?, sem_grade?, fusao?, decisoes_recesso?}` — os três últimos são a simulação do wizard (combinar sem grade, sessão fusa, "e se atravessarmos o recesso?") sem gravar nada. Saída nova: `recessos_pendentes` (o que trava a proposta), `grade {mentor, jovem, dias_comuns}` (o modelo sabe se pede disponibilidade), `doc` (o rascunho do combinado via `montarDocCombinado` — "ver rascunho" sem sair do card), `plano.falta` (`resumoCombinado`/`aceitesDoPlano`).

Grade: lida com client de serviço (o jovem e o cruzado não saem pela RLS) DEPOIS da allowlist + leitura da dupla — o padrão do `contextoPlano` (518): autorização pela sessão, leitura de referência idêntica. Interseção só quando os DOIS lados marcaram (`gradeCombinada`), `sem_grade` simula sem.

### D3 — `plano_propor` com decisões e lado jovem

- `roles` ganha `mentorado` (a RPC 0225 aceita `my_mentorado_id()`; a tool lia a dupla só pela RLS → fallback de serviço com o check `my_mentorado_id()` antes, espelhando `contextoPlano`).
- `decisoes_recesso: [{ciclo_evento_id, usa}]`: a run grava cada uma via `declarar_recesso` (RPC — recusa staff com "só a dupla", honesto) e carimba o snapshot em `escopo.decisoes` como o wizard faz.
- `sem_grade`/`fusao` entram na simulação e no snapshot.

### D4 — `declarar_recesso` alinha allowlist à RPC

`roles: [mentor_dpp, mentorado]` — a 0234 recusa a coordenação ("só a dupla"). A descrição deixa de prometer a coordenação e diz que a decisão é combinada da dupla (o outro lado acompanha).

### D5 — Nova tool `disponibilidade_semana` (escreve)

A grade semanal do CHAMADOR: mentor grava `mentor_profiles.disponibilidade` (update próprio), jovem usa `set_disponibilidade_mentorado` (RPC). Schema `{celulas: [{dia, periodo}]}`, confirmação no card. O modelo pergunta a grade depois do plano_em_dia acusar `grade.dias_comuns === 0` — fluxo do wizard reproduzido no chat.

### D6 — Copy de aceite único

`UiPlano.plano` ganha `falta` (de `aceitesDoPlano`/`resumoCombinado`). O CardPlano diz "falta um aceite da dupla" / "falta o aceite do mentor|do jovem" — nunca "dos dois". O comentário `DuplaPlano` (types.ts) e a descrição da tool são corrigidos na mesma PR.

### D7 — Dia + hora na mesma mensagem

Prompt: quando a pessoa traz dia e hora juntos, `data_hora` sai dos dois numa call só — nunca pergunta o que já veio. Eval novo em `casos.json` trava a rédea.

### D8 — GenUI de documento no card de confirmação

`emitir_link_instrumento` devolve `{token, url, reutilizado, sistema, jovem{nome,whatsapp}, mentor{nome,whatsapp}}` (o run já carrega a ficha). O CardConfirmacao, no estado "feito" pra essa tool, mostra "Link de <instrumento> pra <jovem>", `CopiarLink` (URL absoluta via `urlPublica` no client) e "Abrir no WhatsApp" (`waLink` + `msgLinkWhatsApp`, repasse `msgLinkWhatsAppRepasse` quando o jovem não tem WhatsApp e o mentor tem). O prompt diz pra não repetir a URL em texto — o card a mostra.

### D9 — Datas legíveis nos resumos de escrita

`formatDiaHora` nos 4 resumos com `data_hora` crua (`plano_aplicar_passo`, `agendar_encontro`, `jovem_agendar_encontro`, `jovem_registrar_retroativo`).

## Fora de escopo

- Migration/DDL (escopo.decisoes já é jsonb; disponibilidade já tem colunas).
- Wizard CombinarPlano (a aba Agora continua o gesto completo; o card linka pra lá).
- `proporPlano`/`combinarPlano` das actions seguem vivas pro app; a duplicação de orquestração é intencional nesta rodada (o chat não pode reusar a action porque o fetch de dupla/grafos difere por papel).

## Testes e gates

- `ia-pills.test.ts`: `papeis` cruzado com o catálogo + contextos 6–8.
- `plano2-auditoria.test.ts`: descrições sem "dois lados"; resumo formatado.
- `ia-tools.test.ts`: declarar_recesso sem coord; disponibilidade_semana mentor/jovem; plano_propor com decisões.
- `ia-ui.test.ts`: projetor com os campos novos.
- `casos.json`: gate do jovem em `plano_propor`/`declarar_recesso`/`disponibilidade_semana` e o caso dia+hora.
- `pnpm guard`, tsc, eslint, vitest, e2e demo (`assistente.spec.ts`).
