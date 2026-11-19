# Plano — UX, visual e copy, rodada nov/2026

**Spec:** `specs/007-ux-visual-nov/spec.md` · **Status:** Draft

> Documento duplo: (1) **mapa de auditoria** — estado atual por item com
> `arquivo:linha` verificado em 19/nov/2026; (2) **decisões técnicas**
> por cluster, incluindo as de schema/RLS das fatias spec-only
> (US11–US14). Nada aqui foi implementado neste worktree — é a base de
> implementação das issues em `.devin-ctx/issues.md`.

## Mapa de auditoria (estado atual, verificado)

### US1 — "Ler tudo" do encontro da semana

- `src/components/materiais-mentor-biblioteca.tsx:159` — `CONDUZIR_LIMITE = 240` (gate em caracteres).
- `:205-248` — `<details class="group/cc">`: prévia `line-clamp-3 … group-open/cc:hidden` no `<summary>` (`:211-219`), toggle "Ler tudo/Mostrar menos" (`:220-230`), texto cheio no `<p>` fora do summary (`:234-239`).
- Textos reais: `src/lib/como-conduzir.ts:136-228` — 290–585 chars; 3 linhas em container largo (`app-shell.tsx:316`, `max-w-5xl`→`2xl:max-w-7xl`) cabem ~420–520 → a prévia quase nunca trunca no desktop.
- Mesmo padrão (mesmo quirk): `src/components/jovem-trilha-card.tsx:286-307` ("Ler devolutiva completa"). Alternativa existente: `GuiaPopover` (`guia-popover.tsx`, usado em `semana-do-programa.tsx:161`); expansão animada por `grid-rows-[0fr→1fr]` em `corpus-documento.tsx:378-380`.

### US2 — Indicador de leitura

- `src/components/biblioteca-lista.tsx:125-130` — `lido` → `Badge outline` na meta; título `:105-107` e `<li>` `:138-140` não mudam.
- `src/components/materiais-mentor-biblioteca.tsx:134-139` — check sem rótulo visível (só `title="Lido"` + `sr-only`).
- Dados: `getMateriaisLidos()` `queries.ts:909-928` → `Set<string>`; único fetch `src/app/(app)/materiais/page.tsx:57`; escrita `LinkComLeitura.onClick` → `marcarMaterialLido` (`material-leitura.tsx:43-46` + `actions.ts:4972-4989`, upsert `onConflict:"profile_id,ref"`); doc nativo registra na montagem (`RegistrarMaterialLido`).
- Lacuna: portal do jovem não usa `LinkComLeitura` nem registra leitura — indicador existe só em `/materiais` (staff/mentor/especialista).
- Contrato a preservar: `tests/e2e/demo/material-leitura.spec.ts` asserta nome acessível `/lido/i`.

### US3 — Instrumentos do mentor + abas

- Entrada única: `/materiais?aba=instrumentos` (`/materiais/instrumentos` redirecta, `src/app/(app)/materiais/instrumentos/page.tsx:5-6`).
- Visibilidade da aba: `src/app/(app)/materiais/page.tsx:140-149` — coord/supervisor/mentor_dpp.
- Ordem das abas: `page.tsx:246-256` — `abas` = `[instrumentos, biblioteca]`; `padrao` = instrumentos se `painel.length>0` senão biblioteca. Mentor já abre em Biblioteca (painel vazio).
- Seletor inexistente: nomes como links `text-xs underline` no rodapé dos cards (`instrumentos-programa.tsx:503-525`, `:562-577`); `fichasMentor` montado em `page.tsx:150-161`.
- Página por instrumento: `src/app/(app)/materiais/instrumentos/[chave]/page.tsx` — linhas `LinhaDupla` `:155-187` (`divide-y`), seletor de instrumentos em pills `:513-539` (padrão a reusar pro seletor de mentorado).
- Capacidade: `mentor_profiles.capacidade smallint default 1` (`supabase/migrations/0001_init.sql:27`); trigger de capacidade `0025`; típico 1–2 → dropdown só acima do limiar.
- Nav staff: `src/components/app-shell.tsx:44-61` (`/materiais` = "Materiais", um item só — "inverter nav" é a ordem das **abas**, não da NAV do shell).
- e2e que assume coord abrindo em instrumentos: `tests/e2e/app/materiais-painel.spec.ts:52-56,82,95,264-282`.

### US4 — "Ver resposta"

- Mentor na página do instrumento: `<details>/<summary>` `text-xs muted`, label fixo, sem ícone — `[chave]/page.tsx:633-648` (idem avaliações `:198-200`, 360º staff `:592-601`).
- Staff lazy: `detalhe-instrumento-lazy.tsx:50-64` — `Button ghost` que já alterna "Esconder respostas", sem animação; payload via `detalheInstrumentoDaDupla` (`actions-formularios.ts:209-238`).
- Ficha da dupla: `instrumentos-dupla.tsx:371-400` — `Dialog xl` "Ver resultado" com `respostasAnterior` → `RodaComparada` (na página `[chave]` a roda sai sempre simples).
- Vocabulário de motion existente: `src/components/motion.tsx:13-24,55-78` (fade, `T.panel`, `height:"auto"`).

### US5 — "Construindo sua visão"

- Leitura: `src/components/instrumento-resultado.tsx:368-399` (`VisaoResultado` → `Declaracao` `:55-67` + `RespostaLista`).
- `src/components/resposta-lista.tsx:196-206` — pergunta `dt text-sm font-medium`, resposta `dd mt-1 text-sm`, número `span tabular-nums text-muted-foreground` (`:196-203`); eyebrow `:184-186`.
- Precedente de hierarquia (lado de preenchimento): `src/components/instrumentos/visao.tsx:116-141` — número em disco lime `size-8 bg-[--brand-lime]/15`, pergunta `text-lg font-semibold tracking-tight`.
- Tokens: `--ok-text` (`globals.css:88`), `--destaque` + `--destaque-foreground` (`:118-121`); convenção "cor de papel/status = marcador, nunca cor de texto" (`:135-137`); `--inst-visao` roxo (`:150`).
- Blast radius: `RespostaLista`/`InstrumentoResultado` servem também 360º, forms genéricos, `/formularios/[id]` e "Rever resposta" do jovem — decidir escopo do novo estilo (ver decisão D2).

### US6 — ViaCEP

- Implementação spec 005: `src/lib/viacep.ts:24-46` · `src/lib/actions-endereco.ts:23-47` (`buscarCep`, pública, timeout 5s, cache 24h, fixture demo).
- Único input de CEP: `DadosCivisFields` `src/components/assinatura-form.tsx:46-295` (input `:181-195`); consumidores: `assinatura-form.tsx:371`, `(app)/assinar/page.tsx:167`, `assinar/[token]/page.tsx:405`, `onboarding-flow.tsx:767`, `(jovem)/jovem/onboarding-jovem.tsx:313`, `pessoas-dialogs.tsx:299,469,486`, `pessoa-actions.tsx:265`, `mentorado-actions.tsx:217,238`.
- Texto a remover: `STATUS_CEP.idle` `"CEP completo consulta o ViaCEP e preenche o endereço."` — `assinatura-form.tsx:30`, render `:204-210` (`aria-live` preservar para os demais estados). Transparência LGPD: `docs/lgpd/base-legal.md:60` lista o ViaCEP como operador — o hint não é a única divulgação.
- Gap `compacto`: `assinatura-form.tsx:96-98` — autofill não preenche `cidade`/`uf`; campos simples em `pessoas-dialogs.tsx:339-342,437-441`, `pessoa-actions.tsx:338-341`, `mentorado-actions.tsx:183-186`. Perfil próprio (`(app)/perfil/perfil-form.tsx:355-363`, `(jovem)/jovem/perfil/perfil-form.tsx:124-133`) não tem CEP — fora de escopo.
- Hints de propósito do bloco (também "interface se explicando"): `pessoas-dialogs.tsx:300-302,470-472`, `pessoa-actions.tsx:271-273`.

### US7 — Gráficos

- Sem lib de gráficos; kit próprio `src/components/viz/*` + `BarraSegmentada` (`barra-segmentada.tsx:46,118-138` — prop `legenda` existe).
- Sem legenda hoje: `TrajetoriaAvaliacoes` (`trajetoria-avaliacoes.tsx:6-71`, escala `COR_AVALIACAO` de `semaforo.tsx:5-15`: ok/lime/warn/danger), `ContextoAvaliacaoCard` (`contexto-avaliacao.tsx:47-58`), barra "Esta semana" (`dashboard-coordenacao.tsx:399-410`), `BarraSegmentada` da Liza (`assistente-cards.tsx:421-432,1116-1130,1443-1451`) e evals (`ia-evals/historico.tsx:206-220`), `TiraEncontros` (`retrospectiva-jornada.tsx:151-184`, nota parcial `:276-288`).
- Com legenda (referência): `SaudePrograma` (`saude-programa.tsx:175-213` + popover `:307-326`), `LegendaEncontrosDupla`/`ResumoEncontrosDupla` (`agenda-calendario.tsx:496-524,3373`), `FunilEtapas` (`viz/funil-etapas.tsx:133-156`), `MapaCalor` (`viz/mapa-calor.tsx:273-285`).
- Micro-labels a 10px em eixos (`grafico-tempo.tsx:162`, `sparkline.tsx:265`, `mapa-calor.tsx:201`) — permitidos pela convenção; manter.

### US8 — /duplas ordenação

- Server ordena `created_at ASC` (`queries.ts:476,520`); toda a ordenação de exibição é client (`duplas-lista.tsx`).
- Default radar: `pesoFila`+`porPrioridade` (`:1223-1232`), `ORDEM_SEMAFORO` (`ciclo.ts:2360-2364`), `saudadeDaDupla` (`ciclo.ts:1362`).
- Controle existente: `OrdemCol = "nome"|"encontros"|"nota"` (`:221`), `parseOrdemDupla` (`:224-233`), `comparadorDe` (`:268-282`), `ColunaOrdenavel` (`:533-563`), `clicarColuna` (`:1236-1241`), URL↔estado `?ordem=` (`:1156-1194`); cabeçalho "Situação" é `<span>` fixo não ordenável (`:579`).
- Ordenação explícita desliga colapso da massa saudável (`semRecorte` exige `!ordem`, `:1291-1294`).
- Mesma ordenação por situação: `paraAcompanhar` (`agenda-coordenacao.ts:490-494`), dashboard "Precisa de você" (`dashboard-coordenacao.tsx:551-690`, rank próprio `:584`).

### US9 — Fila/pareamento

- Derivação: `src/lib/fila.ts` — `filaMentorados` (`:203-223`), `filaMentores` (`:252-275`), `porEspera` (`:191-194`), `textoEspera` (`:180-187`), `tetoMentor` (`:230-240`).
- UI: `FilaEspera` (`src/components/fila-espera.tsx:67-602`) dentro de /pessoas, coord-only (`pessoas-listas.tsx:1196-1210`; page `src/app/(app)/pessoas/page.tsx:233-248`). Card fechado por padrão (`:106-108`); contador misturado (`:103,318-319`); colunas `max-h-[28rem]` sem busca (`:893,899`); espera some no Parear (`:259-262`); "parear" ghost-icon (`:769-779`); CTA no fim de 3 gestos (`:584-595`).
- Matching: RPC `matching_ranquear` via `src/lib/actions-matching.ts:36-56` (SUG_SIM_MIN 0.58); `AfinidadePar` (`matching-afinidade.tsx`); `NovaDuplaDialog` refaz 5 queries por abertura (`nova-dupla-dialog.tsx:137-157`, idem `remanejar-dupla-dialog.tsx:136-159`).
- Especialista não pareja aqui (mural `demandas-especialista.tsx:49-341`); remanejo por `RemanejarDuplaDialog` → RPC `rematch_dupla` (`actions.ts:2313,2380`).

### US10 — Liza blob

- Contrato: `tamanho: number` px (`liza/tipos.ts:19`); internos dependentes do número: `detalhe = tamanho>=28` (`liza-blob.tsx:429`), `kOlho = (tamanho-28)/36` (`:476`), `ciliosMini <40` (`:495`), `px2u` (`use-olhar.ts:41`); `size-auto` resiste a `[&_svg]:size-4` do kit (`:529-532`).
- Callers: `assistente-bolha.tsx:361` (34, header), `:1040-1044` (FAB `desktop?44:48`), `assistente-conversa.tsx:1177` (96, empty), `:1412,1428` (22/24, avatares), `liza-dormindo.tsx:40` (40/56), `onboarding-flow.tsx:1034` (64), `onboarding-jovem.tsx:516` (64).
- Viewport JS: `desktop` = `matchMedia("(min-width: 768px)")` (`assistente-bolha.tsx:483-487`).
- Painel redimensionável: `--painel-w/h` (`PAINEL_CLS`, `TAM_MIN/MAX` 352→960).
- Convenção container-query: `dupla-linha.tsx:19-28`, `duplas-lista.tsx:1685`, `assistente-cards.tsx:8`, `ui/card.tsx:27`.
- Teste a preservar: `tests/liza-smoke.test.ts:41-49` pina `kOlho` por `tamanho`.

### US11 — Registros/encontros

- `encontros`: `unique(dupla_id,numero)` + `numero` = nº do guia (`0001_init.sql:67-79`); satélites por nº: `materiais.encontro_num`, `encontro_notas` (0015), `encontro_intencoes` (0152), `encaminhamentos.numero` (0157); identidade selada `guard_encontro_identidade` (0053:676-693); `realizado` terminal (0043).
- `registros`: `encontro_id unique` (0001:82-93); INSERT do mentor exige `encontro.status='realizado'` (0053:641-652 — `salvarRegistro` marca antes, `actions.ts:3376-3387`).
- Avaliação do jovem: `avaliacoes_encontro`/`avaliacao_links` unique por encontro (0071); trigger `avaliacao_ao_realizar` minta link.
- Encadeado existente: "Registrar o {N}º também" (`registro-form.tsx:1334-1348`, prop `proximoRegistro` `:121,149`).
- Retroativo: `registrarEncontroRetroativo` (`actions.ts:3173-3286`, DPP exige nº do guia `:3217-3220`; especialista = ordinal `max+1` `:3226-3257`, cap 5).
- Regra de domínio vigente: coord não agenda nem registra ("quem agenda é a dupla", `escritas.ts:68-70`, `actions.ts:3300-3302`).

### US12 — Feedback de terceiros

- Domínio próprio `0103`: `terceiros_contatos` (convite+token, cap 9 por trigger `guard_terceiros_cap`, livre por vínculo desde `0195`), `terceiros_respostas` (`contato_id unique`, imutável, só insert via RPC `submeter_resposta_terceiro`), `terceiros_consolidacao` (síntese do mentor — única peça que o jovem lê, gate `publicado_em`).
- RLS: contatos SELECT/DELETE + INSERT 4 colunas + UPDATE `nome,vinculo,whatsapp` (`0103:107-147`); respostas SELECT apenas; consolidação escrita só via `salvar_consolidado_terceiros` (`0103:324-364`).
- UI: `TerceirosDupla` (`src/app/(app)/duplas/[id]/terceiros-dupla.tsx:689-794`, consolidação `:580-686`, mount `page.tsx:1407-1419`, aba Instrumentos).
- Público: `/t/[token]` (`middleware.ts:65-67`; `terceiro_por_token` `0103:200-224`; submit `:227-278`).
- Gap: sem coluna de proveniência (`respondido_via`/`registrado_por` ausentes); mentor não tem write-path.

### US13 — Mentor edita instrumentos

- Respostas imutáveis por decisão REALIZA-435 (`instrumentos-dupla.tsx:260-265`); correção = reemissão (`emitir_link_instrumento` `0099:155-200`) ou refazer do jovem (`refazer_instrumento_jovem` `0209:11-87`).
- `formularios*` tabelas: policy única coord FOR ALL (`0036:86-99`); mentor/jovem só por RPCs definer (`instrumentos_da_dupla` `0080:477-553`, `submeter_resposta_formulario`).
- Exceção viva: **PDM nativo** (`0109`) — `pdm`/`pdm_itens`, `pdm_pode_editar` = mentor OU mentorado (`0109:225-229`), RPCs `pdm_salvar_visao/item/status_item/remover_item` (`:306-424`); projeção `pdm_projeta_resposta` no submit (`:788-795`) sem sobrescrever `origem='manual'`; UI `PdmDupla` `podeEditar = souMentor && viva` (`page.tsx:1396-1405`).
- Gap: sem `atualizado_por`/`editado_em`; `created_by` só na criação.

### US14 — Digest semanal

- Job `rodarDigestSemanal` (`src/lib/jobs-digest.ts:26-76`): `SEGUNDA=1` hardcoded (`:16,31`), dedup por semana (`:38-48`), log `audiencia:["coordenacao"]` (`:59`).
- Conteúdo fixo: `src/lib/relatorios/digest.ts` — `corpoDigestSemanal` (`:42-127`: intro, encontros por cronograma `:75-94`, riscos `:96-116`, pendências `:118-124`); audiência fixa coord (`:155-159`); e-mails por `profiles_contato` (`:218-229`); CTA `/relatorios/operacionais`.
- Manual: `enviarDigestSemanal` coord-only (`actions-email.ts:899-933`) + `digest-botao.tsx:12-48`.
- Cron: tick diário `vercel.json` `0 6 * * *`; `JOBS.digest_semanal` (`api/jobs/tick/route.ts:42`); bearer `CRON_SECRET`.
- Zero config: nem tabela, nem env dedicada, nem opt-out; migration `0188` só adiciona `'digest'` ao CHECK de `emails_enviados.tipo`.

## Decisões técnicas

### D1 — "Ler tudo": gate por render, não por caracteres

Manter `<details>` nativo; trocar a decisão "precisa de toggle" de
`conduzir.length > 240` por medida real: `conduzir` sempre em um único
`<p>` e a prévia por `line-clamp-3` **com o controle ao fim do bloco**
(o texto é âncora; abrir só revela as linhas restantes). Como `<details>`
não permite saber se o clamp mordeu sem JS, e o gate em caracteres falha
por largura, a medida exige client component (`useRef` + `scrollHeight`
vs `clientHeight` no mount/resize — ~20 linhas) ou decidir gate por
"linhas estimadas" (`conduzir.length / (charsPorLinha da largura)`). A
medida real é a única correta em qualquer largura — recomendação:
componente client `ExpandirTexto` reutilizável (mesmo bug existe em
`jovem-trilha-card.tsx`) que recebe o texto e renderiza clamp + toggle
condicional, controle no fim, `aria-expanded`. Fallback SSR: renderiza
sempre com clamp + toggle visível (flash aceitável) — ou clamp só no
client sem toggle (decisão de implementação; SSR nunca mostra controle
que não funciona).

### D2 — Seletor de mentorado e hierarquia da Visão: padrões existentes

- Seletor = trilha de pills do seletor de instrumentos
  (`[chave]/page.tsx:513-539`) com `FadeX`; limiar 3 (≤3 botões, >3
  `Select` do kit). Estado por `?dupla=<dupla_id>` (`nuqs`/`useSearchParams`
  já no padrão das abas). Com 1 dupla: seletor some (redundância honesta).
- Abas: reordenar `abas` para `[biblioteca, instrumentos]` —
  `padrao` inalterado. e2e `materiais-painel.spec.ts` segue válido
  (default staff = instrumentos); se o e2e assertar ordem visual,
  ajustar o seletor.
- "Ver resposta": sair de `<details>` para estado React na página
  `[chave]` (o lazy staff já é o modelo); animação por
  `grid-rows-[0fr→1fr]` + fade (vocabulário `motion.tsx`). Na ficha,
  manter Dialog — rótulo unificado "Ver resposta".
- Hierarquia da Visão: aplicar **só em `VisaoResultado`** (não em
  `RespostaLista` global) — disco `--destaque`/`--destaque-foreground`
  para o número, pergunta `text-[15px] font-semibold text-[var(--ok-text)]`,
  resposta `text-base leading-relaxed text-foreground`. 360º e forms
  genéricos ficam como estão (blast radius contido).

### D3 — /duplas Situação ordenável

`OrdemCol` ganha `"situacao"`; comparador usa `pesoFila` (asc = mais
grave primeiro; desc = em dia primeiro). `ORDEM_ROTULO` + serialização
`?ordem=situacao`; `ColunaOrdenavel` no cabeçalho no lugar do `<span>`
fixo. Ciclo mantém asc→desc→default(radar). Visão supervisor herda
(mesma `DuplasLista`). Sem domínio novo — `ORDEM_SEMAFORO`/`pesoFila`
já são a fonte canônica.

### D4 — Fila/pareamento: reforma de superfície

- Card da fila passa a abrir por padrão quando `total > 0` e ganha
  header com contagem separada ("N mentorados · M mentores com vaga").
- Link/badge de entrada a partir de /duplas (na `SaudePrograma` ou junto
  do header) — decide implementação; a fila continua morando em /pessoas.
- Modo Parear: meta do mentorado volta a mostrar `textoEspera` e
  `mentoradosLivres` ordena por `porEspera`.
- Busca por nome (fuzzy, padrão `fuzzyMatch`) + chip de turma dentro do
  card (turma derivada já existe via `turma_inscricoes`).
- "parear" por linha vira `Button` com label; "Formar dupla" fixa como
  ação primária sempre visível.
- `NovaDuplaDialog`/`RemanejarDuplaDialog`: aceitar pools pré-carregados
  por prop (opcional — melhoria de perf, não bloqueia a US).

### D5 — Gráficos: ligar `legenda` + mini-chaves

`BarraSegmentada` recebe `legenda` nos call sites sem; `TrajetoriaAvaliacoes`
e `ContextoAvaliacaoCard` ganham chave `dot + rótulo` (`text-[11px]`,
padrão `LegendaEncontrosDupla`); `TiraEncontros` ganha mapa cor→nota.
Escalas compartilhadas passam por componente único de chave
(`viz/LegendaPontos` novo ou extensão da `BarraSegmentada`) — decisão de
implementação, sem duplicar mapa cor→texto.

### D6 — Liza: medir o slot, não a viewport

`LizaBlob` ganha modo `responsivo`: wrapper com `ResizeObserver` mede o
pai e alimenta `tamanho` (preserva `kOlho`/`detalhe`/`ciliosMini`/`px2u` —
invariante do `liza-smoke.test.ts`). Callers definem o slot:
FAB vira slot fixo (ex.: `size-11`/`size-12` dentro do botão — sem
`matchMedia`), empty state vira fração do painel (`--painel-w` × fator,
clamp 64→160px), header mantém 34. Fallback SSR = tamanho atual.
Remover o braço `desktop` do cálculo do blob (o `matchMedia` segue
valendo para Popover×Sheet — isso é estrutura, não tamanho).

### D7 — Registros flexíveis (US11): duas fatias, uma spec-only

- **Fatia A (implementável):** generalizar o encadeado — após salvar, a
  fila de pendentes (`encontros` realizados sem `registros`, já derivada
  na ficha) vira fluxo contínuo; opção "esta sessão cobriu mais de um
  encontro" abre seletor de nºs e o server grava par a par
  (`agendarEncontroCore`/`salvarRegistro` existentes, em sequência na
  action — nada de registro multi-nº). Nenhuma migration.
- **Fatia B (spec-only, decisão de produto):** encontro avulso fora da
  régua. Desenho proposto: `encontros.tipo text default 'guia'` +
  `numero` nullable só para `tipo='avulso'` (CHECK) + unique parcial
  `WHERE tipo='guia'`; satélites por nº não se aplicam (sem material/
  intenção); registro e avaliação seguem 1:1 por `encontro_id`.
  Alternativa rejeitada: número inventado acima do teto (colide quando o
  guia cresce e mente a jornada). **Aberto:** se "mais de um encontro" se
  resolve só pela Fatia A — validar com o Thiago antes de schema.

### D8 — Terceiros manual (US12): RPC + proveniência

- Migration nova: `terceiros_respostas.registrado_por uuid null` +
  `origem text not null default 'link'` (`'link'|'manual'`); índice nada
  exigido (volume ínfimo).
- RPC `security definer registrar_resposta_terceiro(dupla_id, contato_id
  | null, nome, vinculo, pontos_fortes, a_melhorar)`: gate = coord ou
  mentor da dupla DPP `ativa|pausada` (espelha `contatos_insert`);
  `contato_id` null → cria contato (mesma grant de coluna, `status`
  fixo `'manual'` ou `'respondido'` — decisão: `'respondido'` com
  `respondido_em=now()` e token não emitido, para não mentir "convite
  pendente"); insere resposta com `origem='manual'`,
  `registrado_por=my_profile_id()`.
- Regra um-por-contato: se o contato já tem resposta (link), lançar
  manual exige criar **segundo** registro? Não — `contato_id unique`
  veda; spec: contato respondido não aceita lançamento manual (usar
  contato novo ou consolidar o que veio). Erro pt-BR explícito.
- Leitura: ficha mostra selo "registrado por {nome}"; área de
  instrumentos do mentor ganha contagem/estado de terceiros no card da
  dupla (leitura já coberta por `contatos_select`/`respostas_select`).
- Demo: action devolve `DEMO_MSG`; dataset mostra uma resposta manual
  de exemplo.
- LGPD: atualizar `docs/lgpd/inventario-dados.md` — mesmo dado, novo
  canal de coleta (declarado pelo mentor sob responsabilidade dele).

### D9 — PDM autoria (US13): colunas + RPC vigente

- Migration nova: `pdm_itens.atualizado_por uuid null`,
  `pdm_itens.atualizado_em timestamptz null`; `pdm` idem para a visão
  (`visao_por`, `visao_em` já existem — revisar antes: `pdm.visao_em`
  existe; adicionar `visao_por`). Conferir `pg_get_functiondef` das RPCs
  `pdm_salvar_*` no ambiente alvo e reaplicar o corpo vigente + carimbo
  de autoria (mesmo padrão da spec 005 para RPC reescrita).
- Leitura: item mostra "editado por {mentor|mentorado}" quando
  `atualizado_por != created_by`; visão idem. O jovem vê a mesma marca —
  transparência deliberada (co-autoria é o modelo do PDM, não auditoria
  secreta).
- `origem='instrumento'`/`origem_campo` permanecem (proveniência ≠
  autoria); edição não muda `origem`.
- Sem write-path novo: `pdm_salvar_*` já são definer + gated — só o
  carimbo muda.

### D10 — Digest configurável (US14): `digest_config` singleton

- Migration nova: `digest_config` (`id boolean pk default true check
  (id)`, `dia_semana smallint 0-6 default 1`, `cadencia text default
  'semanal'` reservando `'quinzenal'`, `destinatarios jsonb` —
  `{"papeis":[], "emails":[], "profiles":[]}` — `secoes jsonb` —
  `{"encontros":true,"riscos":true,"pendencias":true}`, `updated_*`).
  RLS: `enable`, policy coord FOR ALL; ninguém mais lê/escreve.
- `rodarDigestSemanal`: lê config uma vez (service role no job), guard
  por `dia_semana`/`cadencia`; ausência de row = comportamento atual.
- `montarDigestSemanal`: destinatários = união (papéis via
  `profile_papeis` + e-mails explícitos + profiles) com dedup; seções
  filtradas por `secoes`; assunto e dedup inalterados.
- UI: card em `/relatorios/operacionais` junto ao `DigestBotao`
  (coord-only) — fields mínimos, validação server-side (dia 0-6,
  e-mail válido), action `{ ok }|{ error }`.
- Demo: card read-only com a config default.

**As-built (REALIZA-451, migration `0210`):** audit cols saíram como
`atualizado_em`/`atualizado_por` (FK `profiles`, convenção da `0148`);
`quinzenal` implementado como janela de 14d ancorada no último envio com
sucesso (a memória de `emails_enviados` é a régua — não calendário);
`papeis` configuráveis limitados a `PAPEIS_DIGEST` (coordenação +
supervisão) na validação — o normalizador aceita qualquer `AppRole`
válida guardada; público zerado é config inválida (a action rejeita e a
normalização cai no padrão — quem quer pausar usa `desligado`); o gate
da página usa `temPapel` (papel efetivo), mesma régua da action e da
policy `has_papel`; ledger ganhou `audiencia` derivada da config
(`lista_direta` marca pessoas avulsas/e-mails explícitos).

## Matriz de autorização (write-paths novos)

| Operação | coordenação | supervisor | mentor_dpp | mentor_especialista | mentorado | anon |
|---|---|---|---|---|---|---|
| `registrar_resposta_terceiro` (manual) | ✅ qualquer dupla | ❌ | ✅ só a dele, viva | ❌ | ❌ | ❌ |
| `pdm_salvar_*` (autoria) | ✅ (via policies vigentes) | ❌ | ✅ dupla viva (`pdm_pode_editar`) | ❌ | ✅ a dele | ❌ |
| `digest_config` ler/escrever | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| lote de registros (Fatia A) | ❌ (regra vigente) | ❌ | ✅ a dele | ❌ | ❌ | ❌ |
| encontro avulso (Fatia B, se aprovada) | ✅ | ❌ | ✅ a dele | ❌ | ❌ | ❌ |

Cada ✅ novo precisa de caso e2e do papel negado correspondente (A2).

## Paridade demo

- `src/lib/demo/`: `demoBaseMateriaisLidos` já existe — o novo estado de
  item lido aparece em /demo sem escrita; seletor de mentorado usa as 2
  duplas do Ricardo (demo `data.ts:2972-3002`); "Ver resposta" usa as
  respostas seedadas; digest_config read-only; terceiros manual e PDM
  autoria devolvem `DEMO_MSG` e exibem o estado seedado.
- A demo replica RLS em TS: as policies novas (D8–D10) precisam do
  espelho correspondente (A7).

## Testes

- **Unit:** `ExpandirTexto` (medida/clamp), `parseOrdemDupla`
  ("situacao"), comparador de situação, `fila` (ordem por espera no
  Parear), validação da `digest_config`, limpeza de `registrar_resposta_terceiro`.
- **E2E demo:** biblioteca com lido distinguível; abas na nova ordem;
  seletor de mentorado; "Ver resposta" expande; legenda de avaliações.
- **E2E app:** coord ordena por situação e URL persiste; mentor lança
  resposta de terceiros (papel negado: jovem/outra dupla → erro);
  mentor edita PDM e a ficha mostra autoria (negado: mentor de outra
  dupla); digest com config alterada honra dia/seções (job local).
- **Schema:** `pnpm schema:check` contra staging após cada migration.

## Riscos e desvios

- `ExpandirTexto` client em card hoje server — flash de clamp resolvido
  pelo fallback SSR (D1).
- `ResizeObserver` na Liza: jsdom não mede — `liza-smoke.test.ts` precisa
  do fallback por prop (preservado por D6).
- Ordem das abas: e2e `materiais-painel` pode pinar tab order — ajustar
  o spec, não a decisão (D2).
- US11 Fatia B e US12/US13/US14 dependem de migration → aplicam em
  staging antes do push da feature (ordem do `ci-e2e.md`); produção só
  na janela `staging → main`.
- **Desvio consciente registrado:** nenhum — as decisões ficam dentro
  dos artigos (RLS-first nos write-paths; spec-only até aprovação para o
  que toca schema).
