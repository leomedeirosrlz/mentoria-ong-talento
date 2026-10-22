# REALIZA-178 — sdr.md

Revisão de segurança e dados. O produto opera dados reais de **menores** —
LGPD é constraint de design, não anexo.

## 1. Superfícies novas e quem acessa

| Superfície | Acesso | Mecanismo |
|---|---|---|
| `GET /api/export?tipo=<novo>` | coord | gate existente `route.ts:127-134` (401/403); mesma rota |
| `/relatorios?secao=*` | coord | `page.tsx` já redireciona não-coord; nav já coord-only |
| `POST /api/jobs/digest-semanal` | Vercel cron | `Authorization: Bearer $CRON_SECRET`; rota na lista pública do middleware [NOVO] |
| `enviarDigestSemanal()` | coord | mesmo gate das actions: `me()` → `eu.role !== "coordenacao"` → `{error}` (padrão `actions-email.ts:254`, `actions-importar-registros.ts:144`) |
| `gerarNarrativaCiclo()` | coord | idem + `IA_NARRATIVA_OK` + provider |
| `dupla_saude_snapshots` | leitura coord/super | tabela da 182 — aqui só o consumo |
| `emails_enviados` (tipo digest) | coord | policies existentes (0056:34-42) |

Nenhuma superfície nova é pública/anon. `anon` segue com zero grants
(0032). O digest não cria link público novo — o CTA é `/relatorios`
autenticado.

## 2. Minimização — o que vai pra onde

| Canal | Conteúdo | PII de menor? |
|---|---|---|
| CSV export | linhas operacionais; mentorado = **primeiro nome** quando a linha identifica dupla | mínima — mesmo padrão do `ciclo` atual; coord-only |
| E-mail digest | primeiro nome + motivo do semáforo + contagens | primeiro nome apenas — **sem sobrenome, sem texto livre, sem contatos** |
| Provider LLM (narrativa) | `AgregadosCiclo` — **por tipo, só `number`/distribuições**; nenhum `string` livre | **zero** |
| `ia_eventos.args` (narrativa) | `{agregados:true, ciclo}` | zero |
| `emails_enviados` | assunto/audiência/contagens | zero |

Regra do digest: mentorado aparece como primeiro nome (helper existente
`primeiroNomeDaDupla` em `src/lib/agenda-minha.ts:236`) + motivo do
semáforo ("2 encontros atrasados"). Nunca `dados_civis`, nunca telefone,
nunca `registros.reflexao`/texto livre. A lista completa vai no detalhe
autenticado (link), não na caixa de entrada.

## 3. Provider — gate de entrada

- Antes de `IA_NARRATIVA_OK=1`: confirmar **DPA + retenção zero
  contratual** do provider (opencode API per doc `ia-chatbot-mcp.md` —
  a confirmar). Sem confirmação, flag fica desligada e o botão não
  renderiza.
- Env pro server-only: `IA_API_KEY` jamais em `NEXT_PUBLIC_*`; chamada só
  em server action.
- Timeout (`IA_TIMEOUT_MS`, default 20s) + sem retry automático (evita
  dupla cobrança e duplo `ia_eventos` — o evento registra a tentativa).
- Sentry: inputs/outputs de GenAI já desligados; verificar que o texto da
  narrativa não vaza em breadcrumbs (adicionar o path
  `/relatorios`/`gerarNarrativaCiclo` à cobertura do scrub existente).

## 4. Autorização

- Todas as leituras de `dados.ts` usam o **client da sessão** — RLS faz o
  scope (coord já lê tudo; se no futuro supervisor ganhar seção, a policy
  é o bound).
- Cron usa `createAdminClient` **somente** para o digest agregado —
  nunca em rota que responda dado a usuário (mesmo padrão do
  `/resumo/[slug]` que usa admin pra leitura agregada podada).
- `CRON_SECRET` é bearer de infra; a rota não aceita session cookie —
  separado do fluxo de usuário. Sem rate limit externo na rota do cron
  (secret já é o gate); registrar `skipt`/`enviados` no response pra
  auditoria no painel Vercel.

## 5. Auditoria e retenção

- `ia_eventos`: toda chamada `narrativa_ciclo` grava `{canal:narrativa,
  args:{agregados:true,ciclo}, ok, duracao_ms}` — **sem** o texto gerado
  e **sem** payload (padrão `tools.ts`: metadados, não conteúdo).
- `emails_enviados` já é o log de disparo; digest usa `tipo='digest'`
  (migration 0107 — CHECK é `emails_enviados_tipo_check`, conjunto atual
  0084:1053-1054).
- Snapshots são dado derivado; retenção = histórico do programa (sem
  expurgo proposto nesta fase). LGPD: snapshots carregam semáforo+motivos
  — já é a categoria de dado operacional existente.
- Export CSV: download gera arquivo local — fora do controle; mitigação
  existente é o gate coord + filename datado. Não logamos download hoje
  (não introduzir log novo aqui — decisão consciente, alinhada ao
  comportamento atual).

## 6. Riscos específicos

| Risco | Mitigação |
|---|---|
| Digest vaza PII pra caixa de entrada | só primeiro nome + motivo; kill switch `EMAIL_ENVIO_LIBERADO` |
| Cron rodado fora da Vercel (replay) | `CRON_SECRET` + dedup semanal via `emails_enviados` |
| Narrativa alucina número | UI marca "gerado por IA — confira"; `ia_eventos` registra versão; prosa ancorada no JSON de agregados |
| `database.types.ts` declara `dupla_saude_snapshots` antes de aplicada | schema-contract quebra — só gerar types depois do `db push` (regra do AGENTS) |
| `vercel.json` interfere no Ignored Build Step | verificar no dashboard Vercel antes do merge |
| CSP/CORS | nada novo no browser — fetch server-side não passa por CSP; rotas novas são same-origin |
| Rate/custo do provider | narrativa é ação manual por clique (1 call/click), sem polling; `duracao_ms` no evento permite monitorar |

## 7. Checklist LGPD

- [x] Mínimo necessário: digest sem sobrenome/contatos; narrativa sem PII.
- [x] Finalidade: prestação de contas interna da coordenação.
- [x] Base: execução do programa (legítimo interesse institucional) —
  dados de menores mantidos na categoria já tratada pelo app.
- [x] Operador novo (LLM): gate contratual antes de ligar.
- [x] Auditável: `ia_eventos` + `emails_enviados` + `duracao_ms`.
- [ ] Pendente (fora do escopo): registrar no DPO-mapa o novo operador
  quando `IA_NARRATIVA_OK` for ligada.
