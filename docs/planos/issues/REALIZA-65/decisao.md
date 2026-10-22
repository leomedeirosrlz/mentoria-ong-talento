# REALIZA-65 — Decisão: quando ativar o offload frio → Drive e o que migra

## Contexto

A **direção está decidida** (ata): "arquivos que o banco precisa processar
(IA, matching) ficam no Supabase; arquivos só para armazenamento vão para o
Google" (`docs/analise-transcricao-mentor.md:111`). O plano free do Supabase
dá **1 GB** de storage total; o Drive nonprofit oferece **6 TB**. Restam duas
perguntas abertas, que são o objeto desta issue: **quando** ativar e **o quê**
migra.

Estado atual do storage (verificado em `ops-mapa.md` §8):

| Bucket | Público | Conteúdo | Cap por arquivo | Quem escreve |
|---|---|---|---|---|
| `avatares` | **sim** | fotos de perfil | 2 MB | próprio usuário |
| `materiais` | não | biblioteca do programa | 20 MB | coord |
| `registro-anexos` | não | evidências de encontro | 10 MB | mentor da dupla |
| `documentos` | não | RG/CPF/comprovantes/currículo do intake | 20 MB | coord |
| `chamado-anexos` | não | anexos de chamados | 10 MB | autor do chamado |

Toda leitura passa por **rota `/api/*` + signed URL de 300 s** — a app media
cada download, então o backend de storage é trocável atrás dessas rotas sem
mexer em consumidores. Uso real atual: **a verificar** (dashboard Supabase →
Storage; nenhuma métrica no repo). Pressão conhecida: o editor de PDF (55)
estima **~0,6 GB** só de resultados de atividades (`editor-pdf.md:219`) — o
editor sozinho quase dobra o risco de estourar o teto.

## Classificação quente × frio (proposta)

**Fica no Supabase (quente — alimenta app/IA ou está no hot path):**

- `avatares` — URLs públicas servidas em toda tela; pequeno (2 MB cap);
  proxy via Drive degradaria o hot path sem ganho.
- `materiais` — biblioteca viva lida por todos os papéis; volume pequeno e
  acesso frequente.
- `registro-anexos` do **ciclo corrente** — evidência recente, aberta na
  ficha; viram frias quando a dupla encerra.
- `chamado-anexos` — ciclo de vida curto, ativo.
- Resultados de `atividades` recentes (55) — recém-entregues se abrem na
  ficha.

**Migra pro Drive (frio — arquivo morto, leitura rara):**

- `documentos_pessoa` — literalmente o "arquivo morto do intake" (0054);
  coord-only, aberto quase nunca depois do cadastro.
- `registro_anexos`/evidências de **duplas encerradas/concluídas** — mantém
  metadados; download via proxy segue igual pra quem tem acesso.
- `documento_path`/`curriculo_path` de pessoas de ciclos passados.
- Futuros PDFs oficiais arquivados (se a 178 decidir arquivar relatórios —
  `relatorios-inteligencia.md:178`).

**Cinza (decidir caso a caso):** `curriculo_path` de mentorado ativo
(confidencial, leitura rara — frio na prática, mas o volume é irrisório);
foto/documento de `profiles` ativos.

## Como a integração funciona quando ativar (referência, sem implementar)

- **Service account** do Google Cloud adicionada como membro do Shared Drive
  (a cota conta pro pool da org, não pra conta pessoal).
- **Metadados ficam no banco**: a row continua mandando; o arquivo vira
  `drive_file_id` (coluna irmã de `path`, ou `path` reutilizado com
  `storage_provider`). RLS/policies inalteradas — a autorização continua
  sendo a row.
- **Download**: a rota `/api/*` existente vira proxy — valida acesso (como
  hoje) → `files.get?alt=media` com a service account → stream. Drive não
  tem signed URL pública, então o proxy é o equivalente honesto do
  `createSignedUrl(path, 300)`: latência maior, mesma fronteira de permissão.
- **Upload novo** (quando frios forem gravados direto lá): client → rota
  autenticada → service account sobe no Drive.
- **Migração**: script service-role — baixa do bucket, sobe no Drive, grava
  `drive_file_id`, remove o objeto; rollback = guardar o path antigo até
  validar. Drive vira também a **história de backup** que hoje não existe
  (`ops-mapa.md` §6: "não existe script de backup/restore").

## Opções

### A — Ativar agora (integração real imediata)

Constrói service account + proxy + migração de `documentos` e anexos frios
já.

- **Prós:** resolve o teto antes de ele doer; Drive vira arquivo oficial.
- **Contras:** projeto M–G competindo com a fila quente (instrumentos,
  PDM nativo, T2 ao vivo); depende da 53 que ainda nem foi executada; hoje
  provavelmente estamos **longe** do teto — a verificar, mas o parque de
  arquivos é pequeno (caps 2–20 MB, dezenas de pessoas).

### B — Gatilho + regra registrada (recomendada)

Registra a classificação quente×frio acima como decisão, mede o uso real
agora, e arma o gatilho: ativar a integração quando **storage ≥ ~70% do
1 GB** (≈700 MB) **ou** quando o editor de PDF (55) entrar em
desenvolvimento **ou** na virada de ciclo (arquivar T1 inteira) — o que vier
primeiro. Até lá, uploads seguem no Supabase.

- **Prós:** não gasta ciclo em infra antes da hora; o design já nasce sabendo
  que `path` pode virar `drive_file_id` (as rotas `/api/*` são o ponto de
  troca — custo do swap futuro fica pequeno); a decisão difícil (o que
  migra) já fica assinada.
- **Contras:** se o uso estourar antes do gatilho disparar, a migração vem
  a quente — mitigado pela medição inicial + checagem na virada de ciclo.

### C — Arquivo manual (export + upload + flag)

Coord exporta periodicamente (`/api/export` já existe pra dados; para
arquivos seria download + upload manual no Drive) e a row marca "arquivado
externamente".

- **Prós:** zero código; serve pro "arquivo morto" de verdade.
- **Contras:** arquivo sai do alcance da app — clicar num anexo arquivado
  na ficha quebra; processo manual falível; é a gambiarra que as regras
  vetam quando toca dados ainda vivos. Só aceitável pra arquivo morto de
  ciclo encerrado — e mesmo assim B cobre melhor.

## Recomendação

**B.** Decidir agora a classificação (tabela acima) e o gatilho; executar a
integração quando ele disparar. Passo zero imediato e grátis: **medir o uso
atual** no dashboard e registrar aqui — se já estiver >50%, o gatilho
antecipa pra "próxima frente de trabalho". A 53 (Shared Drive) é pré-
requisito de qualquer caminho e vale fazer independentemente.

## Decisão que falta o Thiago assinar

**Confirma o gatilho "ativar a integração Drive quando storage ≥ ~70% do
1 GB free, ou quando o editor de PDF (REALIZA-55) entrar em desenvolvimento,
ou na virada de ciclo pra arquivar a turma anterior — o que vier primeiro",
com a classificação quente×frio acima como regra, e até lá novos uploads
seguem no Supabase?**
