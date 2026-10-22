# Review consolidada — persona seguranca-lgpd (21 issues sensíveis)

Agente cde2573a. Base: `_recon/ops-mapa.md` (anon zero grants, sem rate-limiter
genérico, honeypots+caps existentes, sem pg_cron) + código conferido.

**Vereditos: 2 REPROVADO (169, 182 — cron inalcançável) · 171 SEM PLANO ·
7 COM-AJUSTES (20, 35, 36, 51, 159, 170, 178, 179, 180, 183) · resto APROVADO.**

## REPROVADO — bloqueio estrutural

- **169 + 182** — **o endpoint do cron é inalcançável**: `/api/jobs/*` não está
  em `isPublic` do middleware (`src/lib/supabase/middleware.ts:50-77`) → Vercel
  Cron (GET sem cookie) recebe **307→/login** e o check Bearer nunca roda.
  178 e 179 documentam corretamente ("rota pública + 401 JSON, não redirect").
  Fix único: `/api/jobs/` em `isPublic` + 401 JSON sem Bearer + criar
  `vercel.json` (ausente do repo; 3 crons previstos vs limite do plano —
  Hobby=1/dia → consolidar num `/api/jobs/tick` se preciso).

## Falha sistêmica 2 — IP do cliente não é confiável (afeta 170, 183, assinaturas hoje)

`ipUa()` lê `x-forwarded-for[0]` — o elemento **mais à esquerda, spoofável**
(`actions-assinaturas.ts:48-50`, replicado em `183/plan.md:78-80`). Corrigir
pro **último** elemento (o que a edge Vercel anexa) ou `request.ip`/
`x-vercel-forwarded-for`. Sem isso: evidência de IP das assinaturas é forjável
(bug em produção HOJE), `ip_hash` da 183 instável, régua `(slug,ip)` da 170
ilusória. **Ação real no código pendente** (fora do escopo de review).

## Falha sistêmica 3 — `p_ip_hash` forjável na 170

`abrir_relatorio(p_slug,p_senha,p_ip_hash,p_ua)` recebe a identidade do rate-
limit como parâmetro — caller randomiza por tentativa; o bound `(slug,ip_hash)`
5/15min é ilusório em PostgREST direto. A régua **global por slug** (50/24h) é o
único bound real e é suficiente (31⁸≈8×10¹¹) — SDR deve dizer isso honestamente
e considerar endurecer o cap (20-30/24h).

## Ajustes por issue

- **16** — `interacoes.tipo` CHECK fechado: 'vinculo_resposta' precisa alargamento; ids de auditoria fora de logs públicos de CI; órfãos legados (dest=null) no acceptance da reconciliação coord.
- **20** — rate-limit de rascunho "~1s" é inútil: bound concreto (N saves/min por link_id) ou documentar que payload cap + uso-único são o bound; cap `devolvido_motivo ≤500`; `marcar_link_visto` deve responder erro idêntico ao submit (sem oráculo de token).
- **21** — encaminhar convenção de conteúdo à 33; coord escrevendo em dupla alheia = poder aceito/documentado; mentorado nunca lê ✓ (omissão de policy, correto); append por `(dupla_id,numero)`+cascade ✓.
- **26** — append-only por omissão de grants é o desenho certo; cap motivo_detalhe; `sql_direto` honesto; mentorado não lê (decisão correta documentada).
- **33** — inventário vira documento vivo (tabelas novas do roadmap entram conforme aterrissam — `resumo_acessos` já falta); retenção manual explícita até follow-up C; avatares público na /privacidade ✓; arestas binárias: `mentorados.notas` legível por mentor/sup (0034:194), `comprovante_bancario` no enum (0054:129); **gap crítico**: `CLAUSULAS_AUTORIZACAO` rascunho sem fonte oficial (`texto.ts:100-103`) — priorizar revisão do texto.
- **35** — inconsistência interna: sdr diz `{ok}` sempre (anti-enumeração) vs plan/README `{error:"já cadastrado"}` — convergir pra resposta uniforme; `notificacoes.payload->>email` em claro (dedup 24h) — registrar retenção/limpeza; sessionStorage evita leak em URL ✓.
- **36** — **órfãos de storage sem ciclo de vida**: upload antes do submit deixa objeto sem dona — "limpeza manual" insuficiente pra LGPD: job cron varrendo objetos sem row >N dias ou cleanup na expiração do link; `form_anexo_put` rejeita reuso pós `usado_em`/`expira_em` no acceptance; orientação "só peça documento se exigido" vira texto obrigatório da UI.
- **37** — `buscarCep` proxy-grátis aceito (revalidate 86400); transparência "CEP sai pro ViaCEP" cobrar no acceptance; autofill nunca sobrescreve ✓.
- **51** — `emails_enviados` não persiste URL c/ token (bearer em log = credencial em repouso); cap `p_dupla_ids ≤100` como CHECK no definer; `mentorados.email` não vai a log/client-state.
- **54** — audiência do item PDM vira critério de aceite (teste com sessão jovem — sem alargamento acidental); item PDM não renderiza resposta além de metadado.
- **98** — rewrite de RPC gordo verbatim via `pg_get_functiondef` + diff mínimo + grants repetidos (já previsto); e2e do aceite cobrado.
- **159** — **auditoria obrigatória antes de codar**: `grep my_mentorado_id` nas policies — se alguma policy de staff usa além das `jovem_*`, promovido lê próprio histórico de menor como staff (único buraco real de privacidade retroativa); reingresso como mentorado = fluxo manual; merge-só-vazios em dados_civis ✓.
- **167** — **janela transitória**: links validados servem dado de menor SEM senha até a 170 ligar — encurtar janela/`expira_em` curto nos seeds; `turma_inscricoes.nota ≤300` entra no inventário da 33; slug 108 bits + CHECK anti-slug-fraco ✓.
- **170** — ajustes §3 acima + cookie `resumo_<slug>` guarda senha em claro (justificado — confirmar httpOnly+Secure+path-scoped+7d no acceptance, nunca em log); link legado `senha_hash=null` precisa de prazo ("definir senha ou revogar até X"); `relatorio_link_info` devolve título antes da senha (microcopy prevista); count fail-open → alerta Sentry obrigatório. **Allowlist SQL por tipo é exemplar** (dados_civis/form_bruto/*_pessoal/documento_path/cpf/rg/ip/hash nunca saem; respostas Art.11 fora da v1).
- **171 — SEM PLANO**: criar pasta. Nota: `devolutiva_pdm` segue visibilidade de devolutivas (autor+coord+jovem, inventário 33); `rematch_dupla` definer — rewrite verbatim com grants preservados (coordenar com 98).
- **178** — digest com primeiro nome+motivo do semáforo no e-mail (sinal comportamental de menor na caixa da coord — nunca texto livre/contato/dados_civis, cobrar no acceptance); **coortes minúsculas**: agregados por turma com N<3 quasi-identificam — só nível ciclo ou suprimir labels; adicionar `/relatorios`/`gerarNarrativaCiclo` ao scrub Sentry; `vercel.json`×Ignored Build Step verificar no dashboard.
- **179** — PAT→sessão GoTrue mintada: revogação deve invalidar sessão cacheada; documentar acúmulo de sessões; `ia_eventos.args` com texto do usuário (guia_consulta ≤300c) — cap enforced pra TODOS os args; `confirmado:true` é proteção de UX não de acesso (correto — trilha real no par proposta/confirmação); `/api/ia/chat` NÃO vai pra lista pública (usa cookie); `emitir_ia_token` coord-only.
- **180** — doc inteiro ao provider = gate absoluto (sem DPA não liga); `interpretar_revisao` recebe texto livre humano c/ possível PII — cap de args enforced; matching nunca envia dados_civis/contatos completos/form_bruto; retenção do upload temporário documentada; zero writes pela IA ✓ (toda escrita via RPC existente).
- **181** — entrar no inventário da 33 como potencial A11; `ausente→descartada` não reativa item manual (teste); projeção `/f` só toca slots próprios; coord lê tudo = decisão do programa documentada.
- **183** — corrigir XFF (§2); fallback de salt público: produção deve falhar visível sem env (não degradar silencioso); retenção do log delegada à 170 — dependência registrada; gate `notFound()` antes do log (slug inexistente não vira oráculo) ✓.

## Confirmado no código

- `saudadeDaDupla` (`ciclo.ts:1388-1523`) **não emite nomes** — `sinais[].texto` são contagens+labels de enum; pode persistir integral.
- Anon zero grants respeitado por todos os planos; todo plano novo declara `security definer`+`set search_path`+checks de escopo dentro da RPC.
- `vercel.json` ausente do repo; `isPublic` em `middleware.ts:50-77`.
