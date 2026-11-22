# Mapa de regressão — invariante ↔ o que o protege

Quem mexe no repo sem contexto precisa de duas coisas: saber **qual regra não pode quebrar** e saber **qual teste fica vermelho se quebrar**. Este mapa amarra os dois. Não é documentação de comportamento (isso é `docs/convencoes/architecture.md`); é a lista de proteção ativa.

## Proteção ativa (vitest — roda em todo push/PR)

| Invariante | Guardado por |
|---|---|
| Allowlist de rotas públicas + redirect com `next` preservado + `next` externo rejeitado | `tests/middleware-publico.test.ts` |
| Matcher do proxy (assets, metadata, tunnel do Sentry fora) | `tests/proxy-matcher.test.ts` |
| Numeração de migrations: única, lacunas conhecidas, stubs vazios | `tests/migrations-integridade.test.ts` |
| Toda tabela com RLS; `security definer` com `search_path` | `tests/migrations-integridade.test.ts` |
| Rotas de cron autenticadas; cron único do `vercel.json`; registro de jobs do tick | `tests/jobs-registry.test.ts` |
| Gates de publicação (`[deploy]`, `[e2e-preview]`, fila `e2e-staging`, gates do `ci.yml`) | `tests/deploy-gates.test.ts` |
| Migrations do base imutáveis (só entra arquivo novo) | `scripts/repo-guard.mjs` R1/R9 + job `repo-guard` do CI |
| Objeto criado em migration presente em `database.types.ts` | `scripts/repo-guard.mjs` R2 |
| Sem `.env*` nem segredo versionado; bloco do Next no `AGENTS.md`; links de docs; JSON/scripts válidos | `scripts/repo-guard.mjs` R3–R5, R10 |
| Semáforo (risco/atenção/ok, apoio fora) | `tests/ciclo-semaforo.test.ts` |
| Registro entregue = conteúdo (tema/reflexões/observações/atividade): registro vazio, inclusive legado de defaults, não fecha o passo nem apaga a pendência em nenhuma leitura (semáforo, jornada, agenda, resumos, relatórios), e `salvarRegistro` recusa sem conteúdo | `tests/ciclo-registro-conteudo.test.ts`, `tests/estado-encontro.test.ts`, `tests/agenda-minha.test.ts`, `tests/painel-dia.test.ts`, `tests/dupla-resumo.test.ts` |
| Pedido de especialista nasce no mural: criação/aceite não notificam a coordenação e o legado `aguardando_coord` lê como `aberta` | `src/lib/solicitacoes-coord.test.ts` + `tests/e2e/app/solicitacao-esp.spec.ts` |
| Cron: 503 sem env, 401 bearer errado, idempotência por ledger | `tests/saude-snapshots.test.ts`, `tests/digest-semanal.test.ts`, `tests/whatsapp-lembretes.test.ts` |
| Digest configurável: row ausente/inválida = comportamento legado; `desligado` não monta nem loga; quinzenal deduplica por janela de 14d; destinatários = união dedup papéis+pessoas+e-mails; `digest_config` RLS coord-only | `tests/digest-semanal.test.ts` + `tests/e2e/app/relatorios.spec.ts` (papel negado via REST) |
| Handoff do login (nonce, cooldown, tombstone) | `tests/login-pedido.test.ts`, `tests/login-erros.test.ts` |
| Escrita valida em camada única | `tests/escritas.test.ts` |
| Emissão de documento (idempotência, menor de idade) | `tests/documentos-mentorado.test.ts` |
| `/resumo` público (allowlist de recorte, motivos) | `tests/relatorio-publico.test.ts`, `tests/relatorio.test.ts` |
| Scrub do Sentry (PII não vai pro evento) | `tests/sentry-scrub.test.ts` |
| Corpus RAG fail-closed por audiência | `tests/corpus-audiencia.test.ts` |
| Contrato do CSV de export | `tests/relatorios-csv.test.ts`, `tests/export-route.test.ts` |
| IA: impersonação, rate-limit, tokens MCP, prompt | `tests/ia-*.test.ts`, `src/lib/ia/*.test.ts`, `tests/tokens-mcp.test.ts` |
| Cronograma importado nunca persiste sem revisão; parser produz `EventoRascunho` válido | `src/lib/importar-cronograma/normalizar.test.ts` + `tests/e2e/app/turmas-importar.spec.ts` |
| Import de cronograma por IA (spec 009 US1): complexo vai ao tier `forte` da ia_config sem clique, escaneado nunca chama modelo, falha/limite devolve determinístico+aviso, args de auditoria sem conteúdo do documento | `tests/importar-cronograma-action.test.ts` + `tests/importar-cronograma-ia.test.ts` |
| PII do `/resumo` (`hashIpAcesso` por salt, null em prod sem env + aviso 1×, UA truncado) | `tests/resumo-acesso.test.ts` |
| Paridade TS × SQL de vocabulários fechados (`AcaoProduto` × RPC vigente, `AUDIENCIAS` × check/policies da `0139`, `ROLES_POR_AUDIENCIA` × check de comunicados) | `tests/paridade-ts-sql.test.ts` |
| Auth do `/api/mcp` (401 sem Bearer, 401 PAT inválido, 403 sem papel, `papeis[]` manda) e `PAPEIS_MCP` = 5 papéis | `tests/mcp-auth.test.ts` |
| Semântica do handoff em SQL (registrar resgata `failed`, falhar é `do nothing`, pegar distingue expirado) | `tests/handoff-sql.test.ts` |
| Regexes de token público consistentes com o mint (32 base64url em `/f` `/t` `/avaliar`; uuid em `/assinar` `/api/assinar-token`) | `tests/token-formato.test.ts` |
| Janela de adoção ≤ retenção do cru; RPCs `adocao_*` e export não leem o rollup | `tests/adocao-janela.test.ts` |
| Gestos ricos de telemetria (453/454): `marcoRolagem` emite o maior marco da estadia (fundo ≥98%), derivações dos painéis fixos (grade 10×10 = preset do explorador, mediana de estadia, marco cumulativo, denominadores declarados), demo fabrica permanencia/rolagem/alvo com meta válida | `tests/adocao-ricos.test.ts` |
| Explorador DuckDB sem CDN: extensão parquet vendored por versão×plataforma do engine, repo same-origin via `custom_extension_repository`, CSP sem `duckdb.org` | `tests/adocao-duckdb-ext.test.ts` |
| Ordenação de /duplas: `?ordem=` parse/serializa coluna+dir, radar por `pesoFila`, coluna "Situação" (apoio→risco→atenção→em dia, fora no fim nas 2 direções), desempate A→Z estável | `tests/duplas-ordem.test.ts` + `tests/e2e/demo/duplas.spec.ts` (ciclo do header) |
| Autoria do PDM (0211): RPCs carimbam `my_profile_id()`+`now()` (nunca parâmetro), marca "editado por" só quando a escrita muda de mãos, projeção de instrumento imune a edição manual (`atualizado_por`/`visao_por` null-guard), `formulario_respostas` intocável, gates `pdm_pode_editar`/`pdm_da_dupla` fail-closed (NULL fora do escopo não passa) | `tests/pdm.test.ts` + `tests/e2e/app/pdm.spec.ts` (teste US13: escrita e leitura negadas, autoria, imunidade) + `tests/e2e/demo/pdm.spec.ts` |
| Card "Aguardando par": aberto por padrão com fila não-vazia, contagem separada dos dois lados, fila por espera, busca+chip de turma recortam, espera visível no Parear, lista fixa nunca vira esqueleto, "Formar dupla" primário e sempre visível, entrada por âncora a partir de /duplas | `tests/e2e/demo/fila-espera.spec.ts` + `tests/e2e/app/operacional.spec.ts` |
| Leitura determinística dos relatórios (455): achados sempre com explicação+métrica+intervenção, regras puras sobre agregados canônicos (semáforo/aderência/adoção), nunca texto livre | `tests/leituras.test.ts` + `tests/e2e/demo/relatorios-liza.spec.ts` |
| Cards "Perguntar à Liza" (456): `relatorio_ia_cards` RLS coord-only, escrita só via `relatorio_ia_card_registrar` (dedup por contexto+pergunta, supersede atômico do vigente), `contexto_hash` marca "Desatualizado" e nada regenera sozinho | `tests/relatorio-liza.test.ts` + `tests/e2e/app/relatorios-liza.spec.ts` + `tests/e2e/demo/relatorios-liza.spec.ts` |
| Canal IA `'relatorio'` válido no CHECK e nas RPCs do ledger (padrão 0193); prompt da Liza só com agregados — texto livre de menor nunca sai do servidor | `tests/e2e/app/relatorios-liza.spec.ts` (insert aceita/'bogus' 409) + `tests/relatorio-liza.test.ts` |
| Sessão que cobre N passos do guia (448): um encontro realizado + um registro por nº (nunca linha reaproveitada), régua única UI×servidor em `passosCobertosCandidatos`, último passo e oficial não-vencido fora, `realizado_em` do fato nunca reescrito | `tests/ciclo-cobertura.test.ts` + `tests/e2e/app/plano-em-dia.spec.ts` |
| Retroativo do jovem via Liza (461): tools `mentorado`-only (leitura `encontros_retroativo` + escritas `jovem_registrar_retroativo`/`jovem_desfazer_retroativo`), escrita só no envelope de confirmação (prévia não toca a RPC, uso único, args mínimos), domínio nas RPCs 0207/0208 | `tests/ia-tools.test.ts` + `tests/ia-allowlist.test.ts` + `tests/e2e/app/jovem-agenda.spec.ts` ("pela Liza") |
| Recesso opcional por dupla (462): default = usa o recesso (comportamento de sempre); `usa=false` só libera a janela pra dupla que declarou (planner sugere dentro, agenda do mentor nomeia o par); declaração nunca vira atraso (semáforo inalterado); decisão segue o ID do evento; escrita só via RPC `declarar_recesso` (coord ou mentor da dupla, última vale com autoria+data), leitura escopada incluindo `jovem_recessos` | `tests/recesso-dupla.test.ts` + `tests/ia-allowlist.test.ts` + `tests/e2e/app/recesso.spec.ts` |
| Plano "ficar em dia" persistido (459): um plano aberto por dupla; `contestado` é terminal (acordo novo = versão+1); escrita só via RPCs com guard de membro (`plano_propor` coord/mentor, `plano_responder`/`plano_aplicar_passo` os dois lados, aplicar atômico+idempotente na linha do encontro); `jovem_plano`/`resumo_dupla` recortam por papel — semáforo/motivo interno nunca chega ao jovem; atraso acordado (aceito/ativo com data futura no escopo) não infla o semáforo; nível FR-011 sonda ritmo 1×2 e nomeia o mínimo que fecha antes do encerramento | `tests/plano-overlay.test.ts` + `tests/ia-allowlist.test.ts` + `tests/ia-tools.test.ts` + `tests/jobs-registry.test.ts` + `tests/e2e/app/plano-acordo.spec.ts` |
| Rota dedicada de registro (473): `/duplas/[id]/registrar/[encontroId]` é criar, não editar — guarda de papel/estado (RLS → action → página; `ritoPendente` mantém o último encontro registrável), a sessão que cobriu N passos (007 US11) vale na rota com a mesma régua da ficha, o fallback `#registrar-{id}` segue abrindo o form da ficha e salvando, e os blocos do mentor e do jovem nascem fechados com o hash abrindo os dois | `tests/registro-contexto.test.ts` + `tests/e2e/app/registro-rota.spec.ts` + `tests/e2e/demo/registro-rota.spec.ts` |
| Diretório do jovem (484) é a rede dele e só lê projeções de view: `jovem_contatos`/`jovem_especialistas`/`mentorados_turma` com as colunas travadas (especialista sem contato direto, colega sem e-mail, nada de bio/linkedin/notas/documento fora do recorte), WhatsApp de colega só atrás do opt-in, ficha sem card de catálogo | `tests/diretorio-jovem.test.ts` + `tests/e2e/demo/jovem-pessoas.spec.ts` |
| Liza fora da zona de ação no mobile (505): o FAB encaixado na faixa reservada da bottom-nav nunca intersecta alvo interativo (link, botão, tablist, `role=status`/`alert`, footer) a 390px, o balão de fala não abre sozinho <768px (vira ponto no FAB; "Respondi" sai por status sr-only), painel abre por toque/teclado e Esc fecha com foco de volta ao FAB; no desktop o balão segue automático | `tests/e2e/demo/liza-posicao.spec.ts` |

E2e `app` (backend real, obrigatório no PR) e `demo` cobrem os fluxos por papel — a lista de specs por subsistema está no índice do Playwright.

## Lacunas conhecidas (proteção pendente)

Gap real, com teste viável já especificado — entregar como spec de regressão, não como "melhoria":

1. **`refazer` instrumento (`0209`)**: allowlist da action × RPC × catálogo.
2. **Trigger de encerramento automático** (`0102`) e RPC `rematch_dupla` — regra de banco sem harness; cobrir por asserção de texto SQL ou e2e dedicado.
3. **251 policies RLS** — sem teste de banco; mitigação atual: policy é migration nova + caso e2e do papel negado.

## Ambiguidades que travam teste (decisão humana, não código)

- **Documento revogado**: `0206` não ressuscita; emissão manual cria row nova. Contraditório de propósito? Decidir e travar com teste.
- **Dupla tardia** sem grace period (nasce em atenção, morre em risco) — decisão de produto aberta.
- **Especialista fora de "Aguardando par"** — decisão com o Leo.
