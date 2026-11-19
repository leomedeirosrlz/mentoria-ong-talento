# Spec — ops & infra, rodada nov/2026

**Feature:** `specs/005-ops-nov` · **Status:** Clarified
**Fila:** `REALIZA-37` · `REALIZA-98` · **Data:** 18/nov/2026

> Duas mudanças independentes sob o mesmo guarda-chuva de ops. **US1
> (ViaCEP)** é implementada nesta PR. **US2 (`duplas.dupla_dpp_id`)** é
> spec-only por decisão do brief ws7: o risco mora na reescrita de RPCs
> `security definer` críticas ao pareamento — o desenho fica aprovável
> aqui e a implementação espera a janela e o `db push` dedicado.

## Problema e resultado

### US1 — ViaCEP no cadastro de endereço (REALIZA-37)

- **Dor hoje:** coordenação no cadastro e responsável/jovem na assinatura
  digitam o endereço completo campo a campo — 7 inputs, fricção real e
  erro de digitação entrando no termo.
- **Resultado observável:** digitar o CEP preenche logradouro, bairro,
  cidade e UF sozinho; todos os campos seguem editáveis.
- **Como saberemos que funcionou:** cadastro/assinatura com CEP válido
  preenche sem tocar nos outros campos; CEP errado ou serviço fora nunca
  trava o formulário.

### US2 — Vínculo direto especialista → DPP (REALIZA-98)

- **Dor hoje:** a dupla de especialista só sabe quem é a DPP-mãe pela
  solicitação que a originou (`solicitacoes_especialista.dupla_dpp_id`) —
  um hop a mais em toda leitura e uma regra ("mesmo mentorado da DPP")
  que vive embutida na RPC de aceite.
- **Resultado observável:** `duplas` responde "qual a DPP desta trilha"
  numa coluna própria; as escritas que criam dupla esp preenchem a mãe.
- **Como saberemos que funcionou:** `select dupla_dpp_id from duplas
  where trilha='especialista'` responde sem join; dupla esp criada por
  aceite, efetivação ou cadastro manual da coord nasce com a mãe.

## Fora de escopo

- US1: obrigatoriedade nova de CEP/endereço; persistir o payload bruto do
  ViaCEP; autofill fora do bloco `dados_civis` (os campos simples
  `cidade`/`uf` da ficha seguem manuais).
- US2: reescrever consumidores além do necessário (o traversal atual via
  solicitação segue funcionando como fallback); remover `solicitacao_id`
  (fica como proveniência); qualquer UI nova sobre o vínculo.
- Issues 54/65/66 do brief ws7: auditadas — 54 e 66 já implementadas
  (ver `docs/audits/ops-2026-11.md`), 65 é decisão documentada em
  `docs/planos/issues/REALIZA-65/decisao.md`.

## Histórias de usuário

### US1 — Autocompletar endereço pelo CEP (P1)

- **Por que P1:** reduz fricção em todo formulário que já tem o bloco
  `DadosCivisFields`, sem mudar validação nem persistência.
- **Teste independente:** em `/demo`, abrir `/assinar/<token>` e digitar
  um CEP válido — os campos de endereço preenchem com o fixture.

Cenários:

1. **Dado** um campo CEP vazio **quando** o usuário completa 8 dígitos
   **então** logradouro, bairro, cidade e UF preenchem e seguem editáveis.
2. **Dado** um CEP inexistente (8 dígitos) **quando** a busca responde
   **então** um aviso discreto diz para preencher manualmente e nenhum
   campo é bloqueado.
3. **Dado** o ViaCEP fora do ar ou lento **quando** o timeout estoura
   **então** aviso discreto e formulário editável — nunca erro fatal.
4. **Dado** autofill aplicado **quando** o usuário edita um campo
   **então** o valor editado é o que o submit salva.
5. **Dado** uma busca em andamento **quando** o usuário troca o CEP
   **então** a resposta atrasada é descartada e não sobrescreve os campos.
6. **Dado** `dados_civis` já salvos **quando** o formulário abre
   **então** nenhuma busca dispara no mount (o endereço declarado vale).
7. **Dado** o bloco em modo `compacto` (sem inputs cidade/UF) **quando**
   autofill roda **então** só os campos renderizados preenchem — nada de
   inputs escondidos inventados.
8. **Dado** a página pública `/assinar/<token>` sem sessão **quando** o
   responsável digita o CEP **então** a busca funciona igual.

### US2 — Mãe DPP declarada na dupla de especialista (P2, spec-only)

- **Por que P2:** higiene de modelo + query direta; hoje só um traversal
  real (notificação de encerramento), então o ganho é estrutural, não
  urgência de produto — combina com implementação adiada.
- **Teste independente:** migration aplicada em staging → INSERT de
  dupla esp pelos três caminhos grava `dupla_dpp_id`; backfill cobre as
  que já existem.

Cenários:

1. **Dado** uma solicitação aceita por RPC (`aceitar_solicitacao`,
   `sol_efetivar`) **quando** a dupla esp nasce **então** `dupla_dpp_id`
   recebe a DPP da solicitação.
2. **Dado** a coord criando dupla esp sem solicitação **quando** o
   `createDupla` deriva a turma da DPP do mentorado **então** a mesma
   DPP vira `dupla_dpp_id`.
3. **Dado** um rematch de trilha esp **quando** a herdeira nasce
   **então** herda a `dupla_dpp_id` da encerrada.
4. **Dado** duplas esp existentes **quando** a migration roda **então**
   backfill via `solicitacoes_especialista` preenche a mãe.
5. **Dado** trilha DPP ou esp sem DPP **quando** escrita **então**
   `dupla_dpp_id` é null — o CHECK só exige trilha esp para valor não
   nulo e impede auto-referência.

## Casos de borda

- US1: CEP com letra/incompleto não dispara busca; CEP de cidade única
  (ViaCEP sem logradouro/bairro) preenche o que vier; reposta
  envenenada/malformada é descartada pela whitelist de campos; edição do
  CEP para outro válido dispara nova busca.
- US2: dupla esp sem DPP (jovem pediu trilha sem jornada ativa) → null
  permitido; DPP remanejada depois → o vínculo fica com a mãe original
  (proveniência), `remanejada_de` resolve a cadeia viva; DPP apagada →
  `on delete set null`, a trilha esp não cai junta.

## Requisitos funcionais

- **FR-001:** ao completar 8 dígitos no CEP (ou blur com 8 dígitos), o
  formulário consulta o endereço uma vez por CEP — nunca por dígito.
- **FR-002:** a consulta roda server-side; do cliente só sai o CEP.
- **FR-003:** autofill preenche logradouro/bairro/cidade/UF e **nunca**
  número/complemento; todo campo preenchido segue editável e o submit
  salva o valor em tela.
- **FR-004:** resposta tardia de CEP anterior é descartada (guarda por
  valor do CEP que disparou).
- **FR-005:** `parseCivis` segue soberano — o autofill não é caminho de
  validação e CEP inválido no submit continua erro server-side.
- **FR-006:** a busca funciona sem sessão (o bloco serve `/assinar/*`).
- **FR-007:** estados de busca são anunciados (`aria-live`) sem travar a
  digitação.
- **FR-008 (US2):** `duplas.dupla_dpp_id` é self-FK `on delete set null`,
  com CHECK `null ou (trilha='especialista' e distinto de id)` e índice
  parcial.
- **FR-009 (US2):** todo caminho que grava dupla esp preenche a coluna:
  RPCs de aceite, `createDupla`, rematch herda da origem.
- **FR-010 (US2):** backfill cobre rows existentes via
  `solicitacoes_especialista.dupla_id`.

## Requisitos não funcionais

- **RLS:** nenhuma policy nova — US1 não toca banco; US2 é coluna lida
  pelas mesmas policies de `duplas`.
- **Auth:** nenhuma rota pública nova — server action de leitura externa,
  chamável por `anon` como hoje as páginas `/assinar/*` já são.
- **LGPD:** o ViaCEP vira operador novo na lista de subprocessadores —
  recebe só o CEP (dado não pessoal isolado); transparência in-situ no
  campo. US2 não adiciona dado pessoal (o vínculo já é inferível hoje).
- **Demo:** `buscarCep` devolve endereço fixture em `demoRole()` —
  autofill demonstrável offline, e2e determinístico sem rede externa.
- **A11y/perf:** spinner + status anunciado; timeout de 5s; resposta
  cacheada 24h no servidor.

## Entidades e dados

- US1: nada novo — `dados_civis.endereco` (jsonb, 0046) é preenchido no
  client e persistido pelo fluxo atual.
- US2: `duplas.dupla_dpp_id` — "a DPP que originou esta trilha esp".
  Invariantes: só trilha esp tem valor; nunca auto-referência; a mãe é
  fato de origem (não muda quando a DPP remaneja — `remanejada_de`
  responde "qual a viva"). `solicitacoes_especialista.dupla_dpp_id`
  permanece como proveniência do pedido.

## Critérios de sucesso

- **SC-001:** coord cadastra pessoa digitando só CEP + número (o resto
  autocompleta).
- **SC-002:** ViaCEP fora → o fluxo de assinatura do responsável segue
  intacto (zero bloqueio novo).
- **SC-003 (US2, pós-implementação):** leitura "quem é a DPP desta esp"
  não precisa mais juntar `solicitacoes_especialista`.

## Premissas

- O bloco de endereço vive em um único componente (`DadosCivisFields`) —
  o autofill cobre todos os consumidores de graça.
- Em `compacto`, cidade/UF são os campos simples da ficha — o bloco não
  os cria nem duplica.
- (US2) As RPCs que criam dupla esp são `aceitar_solicitacao`,
  `sol_efetivar` e `rematch_dupla` — as versões vivas são as das últimas
  migrations que as redefinem; conferir `pg_get_functiondef` no ambiente
  alvo antes de escrever o `create or replace`.
