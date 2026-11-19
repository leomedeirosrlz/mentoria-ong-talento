# Spec — telemetria rica e inteligência nos relatórios

**Feature:** `specs/008-telemetria-nov` · **Status:** Clarified
**Fila:** brief ws11 (`.devin-ctx/brief.md`) · **Data:** 19/nov/2026

> Cinco histórias sob o mesmo guarda-chuva de adoção/inteligência.
> **US1 (explorador DuckDB)** é um bug localizado que pode sair em PR
> própria antes do resto — entra aqui porque a correção durável muda
> contrato de infra (CSP × asset vendored) e merece intenção registrada.
> US2–US5 são spec-only: aprovam o desenho, a implementação espera a
> fila. Auditoria de base: `docs/audits/telemetria-2026-11.md`.

## Problema e resultado

### US1 — Explorador de adoção quebrado

- **Dor hoje:** a coordenação abre o console SQL da aba Adoção e ele
  falha na preparação: `Failed to load
  https://extensions.duckdb.org/v1.5.4/wasm_eh/parquet.duckdb_extension.wasm`
  — o `parquet_scan` autoloadeia a extensão de um CDN que o CSP bloqueia
  (`next.config.ts:26-31` vs `src/lib/adocao-duckdb.ts:76-79`).
- **Resultado observável:** o explorador abre, carrega os gestos e roda
  consultas sem depender de nenhuma origem externa.
- **Como saberemos que funcionou:** "Abrir o explorador" chega em
  "pronto" e um preset devolve linhas, sem request a `duckdb.org` na
  aba Network.

### US2 — Gestos ricos de uso

- **Dor hoje:** a telemetria vê pageview e clique, mas não vê **quanto
  a pessoa ficou** numa tela nem **até onde rolou** — "ninguém lê o fim
  da ficha" é hoje intuição, não dado. `data-telemetry-alvo` existe e
  nenhum JSX o usa (`produto-telemetry.tsx:137-143`), então não dá pra
  nomear o gesto no CTA certo.
- **Resultado observável:** o cru de `produto_eventos` passa a contar
  permanência por superfície, profundidade de rolagem e gestos nomeados
  — por tela, por papel e por pessoa, sem PII no payload.
- **Como saberemos que funcionou:** o explorador responde "mediana de
  tempo na ficha da dupla por papel" e "percentual que chega ao fim da
  página" com dados reais.

### US3 — Renderizações da telemetria

- **Dor hoje:** mapa de calor, tempo por tela e rolagem só existem como
  SQL de preset no explorador (`adocao-sql.ts:84-125`) — a coordenação
  depende de rodar query manual pra responder "onde o pessoal clica".
- **Resultado observável:** a aba Adoção mostra mapa de calor de cliques
  por superfície, tempo por tela e profundidade de rolagem — recortáveis
  por janela e papel, com drill por pessoa.
- **Como saberemos que funcionou:** os três painéis respondem a pergunta
  "onde investir em UX" sem abrir o explorador.

### US4 — Leitura inteligente dos relatórios

- **Dor hoje:** cada aba mostra número e fila, mas a interpretação é
  trabalho da coordenação: o que mudou, o que pede ação agora, o que é
  ruído. A decisão registrada (`docs/planos/relatorios-inteligencia.md`)
  é regra explicável em TS primeiro — LLM só redige sobre agregados.
- **Resultado observável:** cada painel de relatório carrega uma leitura
  determinística — achados priorizados com proposta de intervenção e
  legenda clara de como ler.
- **Como saberemos que funcionou:** a aba diz em texto "3 duplas
  pioraram o semáforo em 14 dias — priorize as 2 sem contato recente"
  e cada achado mostra a métrica e o denominador que o geraram.

### US5 — Perguntar à Liza nos relatórios

- **Dor hoje:** a dúvida sobre um gráfico exige abrir a bolha e digitar
  a pergunta com contexto de memória; a resposta morre no localStorage
  do browser (`assistente-conversa.tsx:105-141`) — nada fica no
  relatório pra quem abre depois.
- **Resultado observável:** um botão "Perguntar à Liza" por seção envia
  a pergunta com o recorte da tela (aba, janela, papel, turma) e a
  resposta vira um card persistido no relatório, visível até ser
  regenerado.
- **Como saberemos que funcionou:** outra pessoa da coordenação abre a
  mesma aba e lê o card gerado, com data e recorte declarados;
  "Regenerar" produz versão nova sem apagar a anterior.

## Fora de escopo

- ML/preditivo de verdade, text-to-SQL e NLP sobre texto livre de
  registros — gate legal fechado (`docs/lgpd/README.md`,
  REALIZA-178/179/180) e decisão do brainstorm: agregados primeiro.
- Telemetria nas superfícies públicas (`/f`, `/t`, `/assinar`,
  `/avaliar`, `/resumo`, `/demo`) e identificação por sessão
  (`session_id`) — profile×dia já sessioniza na escala atual.
- Instrumentar cada CTA do app com `data-telemetry-alvo` — a fase cobre
  os alvos declarados no plano; varredura total é trabalho contínuo.
- Export/dashboard pra público além da coordenação (supervisor,
  mentor): a aba inteira segue coord-only nesta rodada.
- Reescrever o kit viz com biblioteca de chart — a decisão "viz da casa"
  do REALIZA-417 permanece.
- Mudança de retenção: o rico obedece os mesmos 90 dias do cru.

## Histórias de usuário

### US1 — Explorador abre sem CDN (P1)

- **Por que P1:** menor recorte que já destrava a única ferramenta
  ad-hoc da coordenação; independente de qualquer outra história.
- **Teste independente:** abrir `/relatorios/operacionais?aba=adocao`,
  clicar "Abrir o explorador", rodar o preset "Superfícies mais usadas".

Cenários:

1. **Dado** a coord na aba Adoção **quando** abre o explorador **então**
   o motor sobe, o parquet registra e a view `eventos` fica pronta —
   sem nenhum request fora da própria origem.
2. **Dado** um browser sem suporte ao bundle eh **quando** o
   `selectBundle` cai no mvp **então** a extensão correspondente ao mvp
   também resolve — os dois caminhos funcionam.
3. **Dado** o arquivo de extensão ausente/incompatível **quando** o
   bootstrap falha **então** o painel mostra o estado "falha" com
   "Tentar de novo" — nunca trava a aba inteira.
4. **Dado** a versão do pacote bumpada **quando** CI roda **então** um
   guard-test falha se a extensão vendored não casar com a versão do
   engine e a plataforma.

### US2 — Coleta de gestos ricos (P2)

- **Por que P2:** habilita US3 e alimenta o explorador; sem ela os
  painéis novos nascem sem dado.
- **Teste independente:** navegar e rolar na ficha de uma dupla, sair,
  e ver `permanencia`/`rolagem` no cru via export ou RPC.

Cenários:

1. **Dado** a pessoa navegando entre superfícies **quando** sai de uma
   **então** um gesto de permanência grava a duração em ms da estadia.
2. **Dado** uma página com scroll **quando** a pessoa atinge marcos de
   profundidade **então** o gesto registra a profundidade máxima — em
   marcos, não por pixel nem por evento de scroll.
3. **Dado** um componente marcado com `data-telemetry-alvo` **quando**
   recebe o clique **então** o gesto carrega o nome do alvo — sem ele,
   só a geometria (como hoje).
4. **Dado** um lote em rajada (muitos gestos seguidos) **quando** a fila
   enche **então** o beacon descarta o mais antigo ou compacta — nunca
   atrasa a navegação nem estoura o teto do lote na RPC.
5. **Dado** qualquer gesto novo **quando** chega na RPC **então** `meta`
   é validado: objeto JSON, teto de bytes, sem texto livre — payload
   fora da régua é recusado inteiro, não truncado.
6. **Dado** ação nova na whitelist **quando** CI roda **então** o teste
   de paridade TS↔SQL passa só se os dois lados listarem a mesma ação.

### US3 — Painéis de telemetria rica (P2)

- **Por que P2:** transforma o cru em resposta visual — depende de US2
  para scroll/duração, mas o mapa de calor já renderiza com o `clique`
  de hoje (x/y/vw/vh existem desde a 0203).
- **Teste independente:** na aba Adoção, alternar `?janela=`/`?papel=`
  e ver os três painéis reagirem ao recorte.

Cenários:

1. **Dado** cliques com x/y/vw/vh no período **quando** a aba abre
   **então** o mapa de calor 10×10 por superfície mostra onde se toca —
   escala sequencial única, número na célula, vazio honesto.
2. **Dado** gestos de permanência **quando** o painel de tempo por tela
   renderiza **então** cada superfície mostra mediana e faixa, com
   denominador de sessões declarado.
3. **Dado** gestos de rolagem **quando** o painel de profundidade abre
   **então** cada superfície rolável mostra o percentual de sessões que
   alcançou cada marco — "quem lê o fim" respondido.
4. **Dado** o recorte `?papel=mentorado` **quando** os painéis renderizam
   **então** todos refletem só aquele papel — e declaram o recorte.
5. **Dado** uma pessoa específica **quando** o drill por pessoa abre
   **então** a trilha de gestos dela na janela aparece em ordem —
   mesmo conteúdo do preset "jornada", sem SQL manual.
6. **Dado** a janela além dos 90 dias do cru **quando** um painel rico
   consulta **então** declara "só os últimos 90 dias" — ou responde do
   rollup dedicado se a decisão de persistência for essa (ver plano).

### US4 — Leitura e intervenção priorizada (P3)

- **Por que P3:** alto valor mas exige as fontes estáveis; vem depois
  que os painéis existem.
- **Teste independente:** aba por aba, a leitura cita métrica +
  denominador e linka a ação (drill, ficha, nudge) — verificável a olho.

Cenários:

1. **Dado** dados do período **quando** a aba renderiza **então** um
   bloco "Leitura" lista achados ordenados por prioridade, cada um com
   a métrica, o denominador e o porquê da ordem.
2. **Dado** um achado acionável **quando** a coord clica **então** cai
   no alvo da intervenção proposta (fila da aba, ficha, ou o caminho do
   nudge) — nunca num texto solto.
3. **Dado** período sem anomalia **quando** a leitura renderiza **então**
   diz isso explicitamente — nunca inventa urgência.
4. **Dado** qualquer painel novo ou existente **quando** tem viz
   **então** uma legenda/"como ler" acompanha — status nunca só por cor.
5. **Dado** a mesma regra de leitura **quando** roda em Vitest com
   fixtures **então** o achado e a ordem são determinísticos — a leitura
   é derivação pura, não heurística solta em componente.

### US5 — Card da Liza persistido no relatório (P3)

- **Por que P3:** depende da bolha e do provedor; o valor é reter a
  resposta, não o chat.
- **Teste independente:** clicar "Perguntar à Liza" numa seção, fechar,
  reabrir com outro usuário coord e ver o card.

Cenários:

1. **Dado** uma seção de relatório **quando** a coord clica "Perguntar à
   Liza" **então** a pergunta vai com o recorte da tela (aba, janela,
   papel, turma, cronograma) — o modelo nunca recebe dados fora do
   escopo da tela nem texto livre de registros.
2. **Dado** a resposta gerada **quando** o card persiste **então** fica
   visível pra qualquer coord naquela seção até regenerar — com data,
   modelo e recorte declarados.
3. **Dado** um card já existente **quando** alguém clica "Regenerar"
   **então** uma versão nova é criada e passa a ser a vigente — a
   anterior fica linkada (supersede), nunca é reescrita.
4. **Dado** um card vigente **quando** a página abre **então** ele é
   servido do banco sem nenhuma chamada ao provedor — gerar só acontece
   por clique explícito; se o recorte ou os dados mudaram desde a
   geração, o card mostra selo "desatualizado".
5. **Dado** a cota de 20 req/min estourada ou provedor fora **quando**
   a geração falha **então** mensagem pt-BR explica e o card anterior
   (se houver) permanece — nunca some o que existia.
6. **Dado** um usuário sem papel de coordenação **quando** tenta gerar
   ou ler **então** o banco nega — o card nasce coord-only em RLS, não
   só na tela.

## Casos de borda

- Beacon em browser antigo: `sendBeacon` ausente → `fetch keepalive`;
  os dois falhos → o lote se perde, nunca a navegação (comportamento
  atual, preservar).
- `meta.ts` do client adulterado/fora da janela → a RPC já descarta e
  usa `now()` (0203) — permanência e rolagem herdam a mesma guarda.
- Pessoa com papel híbrido (`profile_papeis`): o evento grava
  `my_role()` primário — recortes por papel podem subcontar papéis
  secundários; declarar na UI se o recorte filtra por papel.
- Viewport mudando no meio da sessão (rotação, resize): x/y normaliza
  pelo vw/vh **do gesto**, que é gravado junto — mistura é inerente;
  heatmap é de fração de tela, não de pixel absoluto.
- Retenção: gesto rico some aos 90 dias como todo o cru — painel novo
  com janela >90d precisa declarar o corte ou ler rollup dedicado.
- Card da Liza: recorte com turma vazia/janela sem dados → pergunta vai
  com o contexto mesmo assim; a resposta deve dizer "sem dados no
  recorte" — não inventar número (régua do prompt).
- Regeneração em rajada: a cota 20/min já é o freio natural; clicar 2×
  rápido não pode disparar duas gerações (dedup por recorte em voo).
- Custos: card servido do banco não toca o provider; `contexto_hash`
  divergente por `meta` não-essencial (ts) não pode invalidar cache —
  o hash é do recorte+dados, não do cru literal.

## Requisitos funcionais

- **FR-001:** o explorador executa `parquet_scan` sem nenhum request a
  origem fora de `'self'` — a extensão parquet é servida self-hosted,
  na variante correspondente ao bundle (eh e mvp), pinada à versão do
  pacote.
- **FR-002:** nenhuma origem externa nova entra no CSP para o
  explorador; um guard-test compara o layout vendored com a versão do
  pacote e falha em drift.
- **FR-003 (US2):** cada ação nova na whitelist chega por migration que
  redefine `registrar_produto_eventos`, com o membro correspondente em
  `AcaoProduto`, o rótulo em `ROTULO_ACAO` e o peso no gerador demo —
  o teste de paridade existente enforça.
- **FR-004 (US2):** a RPC passa a rejeitar `meta` que não seja objeto
  JSON ou exceda o teto de bytes definido no plano — o gesto fora da
  régua é recusado por inteiro, nunca truncado (a política do lote está
  no plano).
- **FR-005 (US2):** permanência por superfície é emitida na saída
  (troca de superfície, ocultar a aba, `pagehide`) com `dur_ms`;
  rolagem registra marcos de profundidade (ex.: 25/50/75/100%) com a
  profundidade máxima — nenhum dos dois emite por evento contínuo.
- **FR-006 (US2):** `data-telemetry-alvo` passa a marcar os alvos
  declarados no plano (CTAs primários e FABs); o valor segue ≤48c,
  enum-like, sem id de entidade.
- **FR-007 (US3):** a aba Adoção ganha painéis de mapa de calor de
  cliques (grade por superfície, escala sequencial única, número na
  célula, drill), tempo por tela (mediana + distribuição com
  denominador) e profundidade de rolagem (marcos × superfície) —
  respondendo à régua janela×papel existente.
- **FR-008 (US3):** o drill por pessoa mostra a trilha de gestos da
  janela em ordem, coord-only, com o mesmo escopo do feed `adocao_*`.
- **FR-009 (US3):** dados para os painéis vêm de RPCs `adocao_*`
  `security invoker` novas — o RLS vigente segue sendo a única barreira
  de escopo (não-coord recebe agregado honesto do próprio uso).
- **FR-010 (US4):** cada seção de relatório coberta tem leitura
  determinística: achados ranqueados por regra explicável, cada um com
  métrica + denominador + proposta de intervenção linkada; "nada a
  declarar" é um estado válido e explícito.
- **FR-011 (US4):** a regra de leitura vive em módulo puro testável
  (`src/lib/`), sem dependência de Next nem de provider de IA — LLM, se
  entrar, só redige sobre os achados já decididos.
- **FR-012 (US5):** "Perguntar à Liza" por seção monta a pergunta com o
  recorte explícito; o contexto trafega agregados/estruturados apenas —
  nunca `*_pessoal`, `dados_civis`, nem texto livre de
  registros/respostas.
- **FR-013 (US5):** a resposta persiste numa tabela coord-only
  (`relatorio_ia_cards` ou equivalente): recorte canônico,
  `contexto_hash`, pergunta, resposta, modelo/tier, `request_id`
  correlacionado a `ia_eventos`, autor, `gerado_em`, `superseded_by`
  para versionamento por supersede (a linha antiga aponta a nova).
- **FR-014 (US5):** abrir o relatório nunca gera card — a vigente é
  sempre servida do banco; `contexto_hash` desatualizado vira selo
  "desatualizado" no card. Gerar/regenerar consome a mesma cota
  `ia_contexto_e_limite` com canal próprio e grava o evento em
  `ia_eventos` (tokens/custo/tier como no chat).
- **FR-015 (US5):** a geração deduplica por recorte em voo — duplo
  clique ou dois coords simultâneos produzem uma geração, não duas
  (unique parcial no vigente por recorte ou lock na RPC).

## Requisitos não funcionais

- **RLS:** `produto_eventos` mantém policy self+coord — gestos novos
  entram sob a mesma linha. `relatorio_ia_cards` nasce `my_role() =
  'coordenacao'` com escrita só por RPC `security definer`. RPCs
  `adocao_*` novas seguem `security invoker` + grant authenticated.
- **Auth:** nenhuma rota pública nova; o beacon continua exigindo
  sessão (fora de `isPublic` — o `profile_id` confiável é o mecanismo).
- **LGPD:** payload numérico/enum — sem seletor CSS, texto de elemento,
  id de entidade no alvo; vw/vh/dev já são coletados (LI).
  `docs/lgpd/inventario-dados.md` é atualizado na PR (drift atual +
  chaves novas). Card da Liza = prosa sobre agregados, coord-only,
  retenção a definir no plano (proposta: segue `ia_eventos`). Sem PII
  de menor em prompt — regra inegociável do gate legal.
- **Demo:** gerador sintético cobre as ações e dimensões novas
  (`dadosAdocaoEventosDemo` + pesos); leitura determinística funciona
  sobre o dataset demo; card da Liza em demo = resposta enlatada —
  paridade completa, sem chamada real.
- **A11y/perf:** mapa de calor é `role="grid"`/tabela de verdade com
  leitura por célula; valor sempre em texto (intensidade é reforço);
  legenda nomeada e "como ler" por painel; beacon fica <2KB de lógica,
  sem listener que atrase o gesto (passive, throttle); painéis novos
  respondem dentro do orçamento das RPCs existentes (~ms em 100k
  eventos/janela).

## Entidades e dados

- **`produto_eventos`** (existente): sem mudança de colunas — `meta`
  jsonb carrega `dur_ms`, profundidade, `alvo`, além das chaves atuais.
  Invariantes: ação sempre na whitelist da RPC; `meta` objeto com teto
  de bytes; `created_at` honra `meta.ts` dentro da janela de
  plausibilidade.
- **Rollup rico** (decisão no plano): o `produto_eventos_dia` atual
  (papel×superficie×ação) não carrega grade 10×10 nem distribuição de
  duração. Opções: aceitar 90d pro rico (recomendado — declara na UI) ou
  tabela de rollup dedicada. Não criar segunda fonte sem necessidade.
- **`relatorio_ia_cards`** (nova): uma linha vigente por (seção,
  recorte canônico); versões antigas encadeadas por `superseded_by`;
  `contexto_hash` marca desatualização; `request_id` liga ao rastro de
  custo em `ia_eventos`. Invariantes: só coord lê/escreve; conteúdo
  nunca é reescrito (a linha antiga só ganha o ponteiro da substituta);
  resposta é markdown sanitizado.
- **`ia_eventos`** (existente): ganha o canal de geração de card —
  CHECK da coluna **e** validação dentro da RPC de lote (os dois lugares
  que a 0193 tocou pra `'importacao'`).

## Critérios de sucesso

- **SC-001:** explorador abre e roda preset em staging sem request a
  `*.duckdb.org` — verificável na aba Network.
- **SC-002:** "quanto tempo o mentor fica na ficha da dupla" e "que
  porcentagem rola até o fim" respondidos por painel, não por SQL.
- **SC-003:** mapa de calor de uma superfície mostra cliques reais
  recortáveis por papel — denominador de sessões declarado.
- **SC-004:** a leitura de uma aba cita métrica + denominador por
  achado e nunca reporta urgência inexistente (teste com fixture).
- **SC-005:** card da Liza persiste entre sessões e usuários coord,
  mostra data/modelo/recorte, e regenerar não apaga histórico.
- **SC-006:** custo de IA dos cards aparece em `/ia` como os demais —
  zero chamada quando o card vigente já cobre o recorte.

## Premissas

- A correção do explorador é **self-host da extensão** (opção B da
  auditoria), não abertura de CSP — o desenho atual já vendorea o
  wasm/worker; estender o mesmo padrão à extensão é o caminho coerente.
  Se a validação no ambiente mostrar outra causa, a alternativa fica
  registrada no plano.
- Marcos de profundidade (não percentual contínuo) bastam para a
  pergunta "quem lê o fim"; por-evento de scroll é volume sem ganho.
- Sem `session_id`: profile×dia×ordem sessioniza na escala atual
  (decisão já usada em `adocao_caminhos`, 0198). Se a jornada por
  pessoa pedir mais, a próxima spec decide.
- LLM sobre **agregados/estruturados** é o tier liberado pelo
  brainstorm de inteligência — texto livre e `*_pessoal` seguem fora,
  independente de provedor.
- O card da Liza é coord-only porque as abas o são — abrir pra outros
  papéis é decisão de produto posterior, não desta spec.
- A bolha da Liza segue atrás de `IA_BOLHA=1`/demo; o botão nos
  relatórios pode habilitar a mesma flag por rota — decidido no plano.
