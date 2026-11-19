# QA — REALIZA-419 a 434 · perfil & onboarding do jovem

Auditoria dos 16 cards em "In Test" contra o código da branch
`test/qa-perfil-jovem` (base `docs/regression-proof`, HEAD no start:
`f7863b9`), executada em worktree `ws2-qa-jovem`.

## Método

- **Leitura de implementação** por rota/componente/action (`rg`), com
  `arquivo:linha` como evidência primária.
- **Unit:** `pnpm test` — 2335 testes verdes, incl. `conquistas.test.ts`
  (11 testes da estante v2) e `adocao-sql.test.ts` (guard + presets).
- **E2E app** (Supabase local `supabase_db_realiza.vc`, `db reset` +
  `seed:e2e` + `seed:demo`, app em `next start :3200` com envs locais):
  - `tests/e2e/app/jovem.spec.ts` — 11/11
  - `tests/e2e/app/jovem-onboarding.spec.ts` — 2/2
  - `tests/e2e/app/avaliacao.spec.ts` — 8/8
  - `tests/e2e/app/jovem-agenda.spec.ts` + `jovem-pessoas.spec.ts` — 20/20
- **E2E demo** (mesmo servidor, `--project=demo`): `smoke`,
  `jovem-jornada`, `ajuda`, `instrumentos`, `nav-mobile` — 26 specs,
  24 passaram na 1ª rodada; as 2 falhas viraram o defeito D-1 abaixo e
  repassam após a correção (5/5).
- **Verificação dirigida** (Chromium headless, login `jovem-e2e`,
  viewport 1280×800 e 390×844): screenshots em
  `docs/audits/qa-perfil-jovem-2026-11/`.

## Sumário

| Resultado | Qtd | Issues |
|---|---|---|
| Cumprido | 15 | 419, 420, 421, 422, 423, 424, 425, 426, 427, 428, 430, 431, 432, 433, 434 |
| Parcial | 1 | 429 (copy removida; mecanismo Gravatar segue ativo pro e-mail do jovem) |
| Não | 0 | — |

Defeitos: **1 corrigido** (D-1, crash de todos os `/f/<token>` de
instrumento — regressão do commit 85056dea), **1 ambiental** (D-2,
storage local quebrado por drift de imagem — não é código),
**1 flag de decisão** (F-1, Gravatar × e-mail de menor — ver 429).

## Tabela por issue

| issue | título | evidência (arquivo:linha / teste / screenshot) | status (cumprido / parcial / não) | defeito encontrado | comentário sugerido no Jira |
|---|---|---|---|---|---|
| 419 | foto no perfil (self-upload) | `perfil/page.tsx:117-122` `FotoPerfil` + `perfil-form.tsx:206-317` (upload instantâneo → bucket `avatares` pasta `profile_id`, `setAvatarJovem` grava `mentorados.avatar_path`); policy `avatares_insert` confere `foldername(name)[1] = my_profile_id()`; verificação dirigida: upload real de PNG → toast "Foto atualizada", "Remover foto" persiste após reload → remoção OK. Screenshot `perfil-foto-upload.png` | cumprido | ver D-2 (uploads locais falhavam por drift de imagem storage-api × postgres — ambiental, não código) | "Verificado localmente: a câmera do avatar faz upload direto pro bucket, grava `mentorados.avatar_path` e persiste — remoção também funciona. Nota: na stack local o storage-api v1.77.5 estava com o índice de upsert sem `COLLATE "C"` e todo upload respondia 500 (42P10) até ajuste manual; vale conferir se a versão do storage em staging está consistente." |
| 420 | ficha editável pelo mentorado | `perfil-form.tsx:323-407` `FormFichaJovem` → `salvarFichaJovem` → RPC `jovem_update_ficha` 3 args (migration `0202`); gaveta `FichaSecao:416-507` com badge de pendências e lápis; `jovem.spec.ts:472` lápis passa; dirigido: salvou objetivos+motivação e refletiu na ficha | cumprido | — | "Ficha edita objetivos, motivação e escolaridade via RPC dedicada (o papel não tem UPDATE direto em mentorados — correto por RLS). Verificado com escrita real no banco local." |
| 421 | bio | campo `Sobre você` no `DialogoDados` (`perfil-form.tsx:136-155`, 1000 chars + contador); render no header `perfil/page.tsx:138-142` e na linha `perfil-form.tsx:195`; dirigido: bio salva aparece sob o nome e na seção. Screenshot `perfil-desktop.png` | cumprido | — | "Bio editável em 'Seus dados' e exibida no header do perfil quando preenchida." |
| 422 | perfil visual/desktop | grid `xl:grid-cols-[minmax(0,1fr)_340px]` (`perfil/page.tsx:150`): conteúdo na principal, Privacidade+Conta no trilho; `PessoaBanner` + avatar sobreposto no header; mobile empilha com bottom-nav. Screenshots `perfil-desktop.png` / `perfil-mobile.png` | cumprido | — | "Layout duas colunas em xl e pilha única no mobile, com banner por papel — como o desenho de staff." |
| 423 | perfil paritário ao staff | mesmos primitivos do `/perfil` de staff importados de `(app)/perfil/perfil-form` (`BotaoLapis`, `Linha`, `ContaLinha`, `DialogoEmail`, `DialogoSenha`, `FormSecao`, `cliqueSoDoDialog`) + `PessoaBanner` e `ContaSecao` (e-mail, senha, aparência, sessão); `jovem.spec.ts:442` e `:472` pinam o desenho | cumprido | — | "O perfil do jovem usa literalmente os mesmos componentes do perfil de staff — paridade estrutural, não cópia divergente." |
| 424 | esconder "pedidos de ajuda" vazio | `jovem-chamados.tsx:36-37` retorna `null` sem itens e sem detalhe selecionado; dirigido: seção "Meus pedidos" ausente no perfil do jovem-e2e (sem chamados) e presente quando há (spec `jovem.spec.ts:244` cobre o caminho com chamado) | cumprido | — | "Seção some quando não há chamado — verificado nos dois estados." |
| 425 | enxugar textos de privacidade | `privacidade-card.tsx:53-84`: um card, um toggle, uma frase que muda conforme `temWhatsapp`; toast de confirmação contextual. Copy lida ao vivo: "Compartilhar meu WhatsApp com os colegas — Seu cadastro ainda não tem WhatsApp…" | cumprido | — | "Card reduzido a um opt-in só, com explicação honesta do estado desabilitado (sem WhatsApp na ficha)." |
| 426 | onboarding do jovem com Liza | `onboarding-jovem.tsx:121-516`: wizard com `LizaBlob`, promessa em 3 pontos, tour de 6 superfícies reais, grade de disponibilidade, termo auto-emitido e passo de contato/privacidade; `jovem-onboarding.spec.ts` 2/2 verdes (wizard grava a grade; "Preencher depois" deixa lembrete na home) | cumprido | — | "Wizard completo verde no e2e: boas-vindas com Liza, tour, grade semanal persistida, termo e contato." |
| 427 | badges com stats | derivação pura em `src/lib/conquistas.ts` (`conquistasDoJovem`: marcos datados + instrumentos + contagens + próximo marco); UI `conquistas-card.tsx`; `conquistas.test.ts` 11 testes; screenshot mostra "1 conquista · Primeiro encontro · 16 de nov de 2026" | cumprido | — | "Estante com estatísticas reais derivadas de encontros/instrumentos, coberta por teste unitário." |
| 428 | CTA "avaliar encontro fora da lista" | rodapé das avaliações na home `page.tsx:648-665`: copy + link sublinhado `/jovem/agenda` + `JovemRetroativoDialog` inline; mesma orientação no histórico `agenda/page.tsx:482-496`; dirigido: copy e link presentes. Screenshot `home-desktop.png` | cumprido | — | "O texto 'quer avaliar um encontro que não apareceu?' leva pra agenda (futuro) e abre o retroativo do próprio jovem (passado) — melhor do que o pedido original, que era só orientação." |
| 429 | remover copy gravatar/IA externa/origem editável | commit `1e5454cb`: sem seção "Conectar IA externa", sem copy "usamos a do seu e-mail" (dirigido: nenhuma das strings na página), `origem` saiu da whitelist da ficha (`0202` RPC 4→3 args; `FichaSecao` mostra como só-leitura `perfil-form.tsx:488-491`; dirigido: 0 input `origem` no dialog) — **mas** `gravatarUrlSeExiste(me.email)` ainda é chamado no perfil (`page.tsx:121`) e no shell (`layout.tsx:172`): o HEAD para `gravatar.com` com hash MD5 do e-mail do jovem segue acontecendo server-side | parcial | F-1: mecanismo Gravatar ativo pro e-mail de menor, ausente do inventário LGPD e da `/privacidade` | "Copy e edição de origem resolvidos. Pendente de decisão: o perfil/shell do jovem ainda consulta gravatar.com com o hash do e-mail dele (fallback de avatar). Se a intenção era cortar o fluxo pra terceiro — e o inventário LGPD não lista Gravatar como subprocessador — sugiro remover o `fallbackSrc` no `(jovem)` ou documentar o tratamento na base legal." |
| 430 | CTA avaliar: quem agenda + link pra agenda | `page.tsx:650-659` distingue futuro ("agende você na sua agenda" → `/jovem/agenda`) de passado (retroativo do jovem via `JovemRetroativoDialog`, migration `0207`); `agenda/page.tsx:484-488` repete a orientação; `jovem-agenda.spec.ts` 13/13 cobre agendar/remarcar/retroativo end-to-end | cumprido | — | "Copy explica quem agenda nos dois casos e linka a agenda do jovem. O retroativo próprio (437/0207) substituiu o 'peça pro mentor' do texto original." |
| 431 | conquistas v2 (earned-only + "a caminho") | estante só com conquistas ganhas (`conquistas-card.tsx:128-136`, nenhum cadeado — docblock do card fixa a decisão); faixa "A caminho" com marco, `x de y` e progressbar `conquistas-card.tsx:140-167`; `conquistas.test.ts` cobre `proximoMarco` (vazio→marco, metade, jornada completa→null); screenshot: "A caminho: Metade do caminho · 1 de 8 · Faltam 7 encontros" | cumprido | — | "Implementado como pedido: futuro nunca vira cadeado na estante; progresso mora na faixa 'a caminho'." |
| 432 | copy dos instrumentos voltada ao jovem | `jornada.ts:205-266` — todas as descrições na 2ª pessoa ("As 16 áreas da sua vida", "5 perguntas pra imaginar o seu futuro", "Você refaz a Roda", "A sua libera aqui"); `demo/jovem-jornada.spec.ts` e `instrumentos.spec.ts` pinam a estante | cumprido | — | "Copy revisada: instrumentos falam com o jovem, não do processo interno." |
| 433 | adoção fase C (viewport/cliques/timeline) | `produto-telemetry.tsx`: pageview com `vw/vh/dev` (`:92-98`), clique `pointerdown` com `x/y/vw/vh` + `data-telemetry-alvo` opt-in (`:111-150`), debounce 500ms, ignora inputs/botão auxiliar/scrollbar; endpoint `api/produto-eventos/route.ts` → RPC `registrar_produto_eventos`; presets novos `adocao-sql.ts:62-132` (Jornada de uma pessoa, Heatmap 10×10, Viewport×classe); `dispositivo.ts` classifica UA+toque+largura; dirigido: 2 beacons capturados na navegação; testes `adocao-sql.test.ts` validam presets no guard | cumprido | — | "Coleta rica ativa: pageview com viewport+classe, heatmap de clique normalizado e timeline por pessoa no explorador de adoção. Beacons confirmados ao vivo." |
| 434 | LGPD: inventário produto_eventos/registro_tentativas + analytics em /privacidade | `docs/lgpd/inventario-dados.md:128-130` inventaria `produto_eventos` (whitelist de ações, meta sem texto livre, poda 90d `produto_eventos_reter`), `produto_eventos_dia` (agregado sem profile_id) e `registro_tentativas`; `/privacidade` seção 2 `page.tsx:48-54`: "Uso da plataforma … Guardado por 90 dias; depois disso permanece apenas como contagem diária agrupada". Dirigido: texto presente. Screenshot `privacidade-pagina.png` | cumprido | — | "Inventário e política pública consistentes com o schema: 90d de cru, agregado sem pessoa depois." |

## Defeitos

### D-1 — corrigido: TDZ quebrava TODOS os `/f/<token>` de instrumento

`src/components/instrumentos/use-resposta.ts` — o commit `85056dea`
(rodada UI/UX) adicionou `.filter((c) => visivel(c, valores))` sobre
`camposPerguntas(campos)` **acima** da declaração
`const [valores, setValores] = useState(...)`. O filter executa o
callback já no primeiro render → `ReferenceError: Cannot access 'n'
before initialization` → `InstrumentoFlow` caía na tela de erro em
qualquer link de instrumento (visão, metas, PDM, roda). Pego por
`demo/instrumentos.spec.ts:74` e `:128` — reproduzido e confirmado no
console do browser.

**Correção (neste PR):** `perguntas` movido pra depois das declarações
de state — mesma semântica, sem TDZ. Guard de regressão: os próprios
specs demo que falharam — agora `instrumentos.spec.ts` 5/5 verde
(rebuild + rerun).

### D-2 — ambiental: storage local rejeita qualquer upload (500 · 42P10)

`storage-api:v1.77.5` faz upsert com
`ON CONFLICT (bucket_id, name COLLATE "C") WHERE archived_at IS NULL`,
mas o índice da imagem postgres (`idx_objects_current_version`) foi
criado **sem** `COLLATE "C"` → nenhum arbiter casa → todo upload no
stack local responde `500 DatabaseError`. Afeta avatar, anexos, tudo.
Workaround só-local aplicado pra verificação (índice `_c` criado como
`supabase_admin`; não commitado, some no próximo `db reset`).
**Ação:** checar se a versão do storage em staging/preview casa com o
schema — se a mesma combinação for pro CI ou pro Supabase managed,
uploads quebram em produção. Fora do escopo das 16 issues (infra, não
app), mas bloqueou a verificação de 419 até o patch local.

### Flags / decisões humanas

- **F-1 (429):** manter ou remover o fallback Gravatar no shell/perfil
  do jovem — ver comentário na tabela. Recomendo remover o
  `fallbackSrc` no grupo `(jovem)` (2 linhas) **ou** adicionar Gravatar
  à seção de subprocessadores do inventário/base legal. A consulta hoje
  vaza o hash MD5 do e-mail de um menor pra um terceiro sem base
  documentada.
- **F-2 (corpos das issues):** os títulos bastaram pra 15/16; se algum
  corpo no Jira pede algo além do título (ex.: 429 exigindo remover o
  mecanismo, não só a copy), preciso do texto — MCP Jira não roda neste
  CLI.

## Ressalvas de ambiente

- Stack local compartilhada com outras sessões de QA: `db reset` +
  seeds foram refeitos por sessão paralela durante a auditoria; todas
  as suítes reportadas rodaram contra o estado final consistente.
- Porta `3100` ocupada por outro worktree — app servido em `3200`.
- Senha e2e local: `e2e-senha-teste` (convenção do `.env.local`); a
  documentada no CI (`realiza123`) falha — seeds locais usam a do env.
- Fixture restaurada após as verificações dirigidas (bio/objetivos/
  motivacao/avatar do `jovem-e2e` de volta ao estado do seed; objeto de
  teste removido do bucket).
