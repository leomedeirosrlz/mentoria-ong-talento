# Auditoria de segurança — Server Actions e API Routes

**Escopo:** todas as Server Actions exportadas (`src/lib/actions.ts` — 43 exports,
`src/lib/actions-{assinaturas,encerramento,especialista,formularios,presenca,supervisao}.ts`,
`src/lib/forms/actions.ts`, `src/lib/demo/actions.ts`) e todas as rotas sob
`src/app/api/**` (7 route handlers), mais as RPCs security-definer e policies
RLS/storage que elas invocam (`supabase/migrations/0001`–`0052`). Produção:
`https://realizavc.vercel.app` (projeto `yhjzmxleotahijinjepl`).

**Método:** revisão estática linha a linha + probes ao vivo com a anon key
contra o Supabase remoto e a produção Vercel. Nenhuma correção foi aplicada —
relatório de auditoria.

**Modelo de ameaça assumido:** tokens de formulário/assinatura e o nonce do
handoff são credenciais bearer por design — avalia-se o que um portador do
token consegue fazer além do fluxo previsto (chamada direta à RPC via
PostgREST, corrida, reuso, enumeração). O cookie `demo_role` é forjável; a
propriedade exigida é que modo demo nunca escreva nem leia dados reais.

---

## Achados

Formato: `SEVERIDADE | título | evidência (arquivo:linha + probe real se houver) | impacto | correção sugerida`

---

### MÉDIA | `assinar_com_token` grava evidência e dados civis fornecidos pelo chamador — bypass total da validação da action via RPC anônima

**Evidência:** `supabase/migrations/0046_dados_civis.sql:202-241` — a RPC
recebe `p_dados jsonb, p_texto text, p_ip text, p_ua text, p_hash text` e grava
todos verbatim: `dados_snapshot`, `assinatura_texto`, `ip`, `user_agent`,
`hash_documento` (linhas 223-227) e ainda faz sync-back de `p_dados` em
`profiles.dados_civis` / `mentorados.dados_civis` / `mentorados.responsavel`
(linhas 231-239). O único check no caminho é `jsonb_typeof = 'object'`
(0046:21-28); não há validação de chaves, tipos, tamanhos, CPF/CEP nem teto em
`p_texto`/`p_ip`/`p_ua` (colunas sem cap em 0033:44-51). O grant é
`to anon, authenticated` (0046:250-251).

A action `assinarComToken` (`src/lib/actions-assinaturas.ts:284-332`) faz tudo
certo — `parseDadosCivis` com DV de CPF/CEP, IP/UA de `headers()` (linha 314,
`ipUa()` em :32-36), hash SHA-256 server-side (:315-322) — mas nada disso é
exigível: a RPC é pública e o PostgREST está exposto. **Probe real:**
`POST /rest/v1/rpc/assinar_com_token` com anon key + token inexistente
retornou `400 {"message":"link inválido"}` — ou seja, a função executa para
anon; só o token barrou. Com um token pendente válido (o responsável recebe o
link por WhatsApp), o mesmo curl grava `ip="1.2.3.4"`, `user_agent` e
`hash_documento` arbitrários — o hash é sha256 de um payload que o próprio
chamador controla, então nem a consistência interna é atestada pelo servidor.

**Impacto:** (a) a evidência de não-repúdio (IP/UA/hash) é auto-atribuída —
um signatário malicioso pode fabricar evidência coerente ou plantar evidência
absurda e depois contestar a assinatura; (b) sync-back escreve JSON civil
arbitrário na ficha do mentorado/profile, corrompendo dados usados no prefill
e no PDF; (c) snapshot incompatível faz `renderDocumentoAssinado` lançar →
500 permanente em `/api/assinatura/[id]` e `/api/assinar-token/[token]` —
DoS da via assinada (a action já trata renderer que lança, `route.ts:18-28`).

**Correção sugerida:** mover a confiança pra dentro da RPC — capturar IP/UA de
`current_setting('request.headers', true)::jsonb` (o PostgREST expõe os
headers do request), calcular `hash_documento` na própria função sobre os
valores gravados, e validar `p_dados` no banco (schema de chaves, DV de CPF,
tamanhos) ou ao menos rejeitar chaves fora da allowlist do template. Enquanto
isso, `p_ip`/`p_ua`/`p_hash` não deveriam ser parâmetros — são saídas, não
entradas.

---

### MÉDIA | `assinar_com_token`: corrida pode sobrescrever a evidência da assinatura (TOCTOU sem gate atômico)

**Evidência:** `supabase/migrations/0046_dados_civis.sql:209-227` — o fluxo é
`select ... where token` → `if a.status <> 'pendente' then raise` →
`update ... where id = a.id` **sem** predicado de status no UPDATE e sem
`for update` no SELECT. Duas chamadas concorrentes com o mesmo token passam
juntas no check de `pendente` e ambas executam o UPDATE — a segunda
sobrescreve `dados_snapshot`, `assinatura_texto`, `ip`, `user_agent` e
`hash_documento` da primeira (last-writer-wins), e o sync-back de dados civis
roda duas vezes. Contraste com a RPC irmã `submeter_resposta_formulario`
(`0036_formularios.sql:340-347`), que faz certo: `update ... set usado_em =
now() where id = l.id and usado_em is null` — gate atômico, o perdedor da
corrida devolve a resposta já gravada.

**Impacto:** sobrescrita da evidência de assinatura por quem detém o token
(combinável com o achado anterior: corrida de payload legítimo vs. payload
fabricado via RPC direta). Também abre resultado não-determinístico para
duplo-clique/retry em conexão ruim — o snapshot gravado pode não ser o do
hash que o usuário viu.

**Correção sugerida:** mesmo padrão da 0036 — `update assinaturas set ...
where id = a.id and status = 'pendente'` seguido de `if not found` → devolver
`a.id` (idempotente) ou reler a row; alternativa: `select ... for update`.

---

### BAIXA | Fluxos públicos sem rate limiting (formulários, assinatura por token, handoff, nudge)

**Evidência:** `submeterRespostaFormulario` (`src/lib/forms/actions.ts:400-430`)
tem só honeypot (:407); `assinarComToken`
(`src/lib/actions-assinaturas.ts:284`), `assinaturaPorToken` (:266),
`/api/assinar-token/[token]` (`route.ts:27-77`), `/api/nudge`
(`route.ts:19-83`) e as RPCs `registrar/pegar/falhar_login_handoff`
(`0049`/`0050`) não têm throttling nenhum — nem na edge, nem por IP, nem por
token. **Probe real:** chamadas consecutivas a `pegar_login_handoff` e
`registrar_login_handoff` com anon key foram todas aceitas (sem 429). O OTP
do magic link é o único ponto limitado — pelo próprio GoTrue.

**Impacto:** mitigado pela entropia (uuid v4 = ~122 bits; tokens de
formulário = 192 bits base64url via `randomBytes(24)` em
`forms/actions.ts:266`; nonce handoff = uuid do `crypto.randomUUID()` em
`login-form.tsx:245`), então brute-force de token é inviável. O que fica
aberto: spam de submissões em token vazado, scraping do endpoint público de
PDF, martelar RPCs definer (custo de banco pago pelo projeto) e enumeração
por timing/volume.

**Correção sugerida:** rate limit por IP nas rotas públicas (Vercel
Firewall/edge middleware) e/ou tabela de tentativas por token/IP nas RPCs
públicas — o dedup de 60s do nudge (`route.ts:60-69`) mostra o padrão já
aceito no código.

---

### BAIXA | `assinatura_por_token` devolve dados civis completos e `formulario_por_token` expõe nome + estado — para qualquer portador do link, para sempre

**Evidência:** `supabase/migrations/0046_dados_civis.sql:87-142` —
`assinatura_por_token` devolve `alvo.nome` + o prefill civil completo
(`dados_civis` com RG/CPF/endereço, ou `responsavel` no template
`autorizacao-responsavel`) sem filtrar por `status`: link já `assinado`,
`expirado` ou `revogado` continua servindo os mesmos dados a quem tiver a URL.
`formulario_por_token` (`0036_formularios.sql:261-296`) devolve primeiro nome
do destinatário + status distintos (`pendente`/`respondido`/`inativo`/
`expirado`). **Probe real:** `POST /rest/v1/rpc/assinatura_por_token` e
`formulario_por_token` com anon key e token inexistente → `null` (200) — sem
diferenciação observável entre "não existe" e outros estados nesse caso, o
que é bom; o ponto é o que um token *válido* expõe.

**Impacto:** o link é bearer por design (o signatário precisa do prefill),
mas PII civil fica retida na URL para sempre — histórico do WhatsApp,
forwards, screenshots, proxy corporativo. Token respondido não precisa mais
revelar o nome do destinatário; assinatura concluída não precisa mais servir
o prefill. Enumeração em si é inviável (entropia dos tokens), mas a janela de
exposição de cada link vazado é permanente.

**Correção sugerida:** devolver `civis`/`destinatario` apenas quando
`status = 'pendente'`; para os demais estados, payload mínimo ("já
assinado", "expirado"). Considerar prefill parcial (ex.: CPF mascarado) — o
signatário confere e completa.

---

### BAIXA | `/api/material/[id]` e `/api/assinatura/[id]` não validam UUID — id malformado vira 500 em vez de 404

**Evidência:** `src/app/api/material/[id]/route.ts:49-56` — `.eq("id", id)`
direto; string não-uuid → erro PostgREST `22P02` → 500 "Não foi possível
abrir o material". Em `/api/assinatura/[id]`, `getAssinatura(id)`
(`src/lib/queries-assinaturas.ts:61-66`) faz o mesmo `.eq` e `throw` no erro
(:66) → exceção não capturada no handler → 500 genérico do Next. As rotas
irmãs fazem certo: `/api/anexo/[id]` valida com regex antes (`route.ts:37-39`)
e `/api/documento/[id]` valida `tipo` (:17-19).

**Impacto:** nenhum vazamento (o erro é genérico), só inconsistência de
contrato — 500 em vez de 404 polui monitoramento e sugere bug onde é input
inválido.

**Correção sugerida:** mesmo `UUID_RE` do anexo nas duas rotas antes da query
(`/api/assinatura/[id]` adicionalmente precisa de try/catch ou de um
`getAssinatura` que não lance em erro de cast).

---

### INFO | `login_handoffs`: RPCs aceitam tokens arbitrários e `falhar` pode queimar nonce antes do registro — sem ganho real pro atacante

**Evidência:** `0049_login_handoff.sql:24-32` — `registrar_login_handoff`
insere `p_access`/`p_refresh` sem validação de formato. **Probe real:** a RPC
gravou e devolveu as strings literais `ATK_PROBE`/`RTK_PROBE`; segundo
`pegar` no mesmo nonce → `null` (uso único confirmado) e `on conflict do
nothing` → primeiro escritor vence (probe: `FIRST` sobreviveu a `SECOND`).
`0050_login_handoff_falha.sql:11-13` — `falhar_login_handoff` faz `insert ...
values (nonce, '', '', true)` também para nonce inexistente: quem conhece um
nonce pode queimá-lo antes do `registrar` legítimo (DoS daquele login —
`pegar` devolve `{failed:true}`).

**Impacto:** nulo na prática — o nonce viaja **no mesmo link** que carrega
`#access_token`/`#refresh_token` (`login-form.tsx:257`), então quem conhece o
nonce já tem a sessão; o `falhar` antecipado não dá nada além do que o link
já dá. Tokens arbitrários são inócuos: `setSession` valida no resgate
(`login-form.tsx:212-219`). Tabela sem grant direto (probe: `login_handoffs`
→ 401), uso único e expiração de 10 min confirmados.

**Correção sugerida (higiene):** validar formato mínimo de JWT nas RPCs e
documentar que a credencial real é o link inteiro; considerar expurgo
periódico de `login_handoffs` (já há `delete ... expires_at < now()` inline
no `pegar`, `0050:23`).

---

### INFO | `/api/nudge` redireciona para qualquer `https://wa.me/<dígitos>` — não é open redirect, mas o destino não é conferido contra o cadastro

**Evidência:** `src/app/api/nudge/route.ts:13` — `WA_ME_RE =
/^https:\/\/wa\.me\/\d+$/` ancorado (o comentário :9-12 documenta o caso
`wa.me/1@evil.com` que um regex não ancorado abriria). O `to` vem do cliente:
um autenticado pode chamar `/api/nudge?to=https://wa.me/<qualquer número>` e
ser 302'd pra conversa de qualquer número WhatsApp — mas o host é sempre
`wa.me`, então não vira open redirect genérico nem vaza dados. O insert em
`interacoes` só ocorre se `d` for uuid válido E passar na RLS
(`interacoes_insert`, `0008:31-38` — mentor/supervisor da dupla ou coord) +
trigger `guard_autoria` (`0023:94-96`) que prende `autor_id` ao chamador —
o redirect acontece mesmo se o log falhar (:17-18, decisão explícita).
**Probe real:** `/api/nudge?to=https://evil.com`, `?to=javascript:alert(1)` e
`?to=https://wa.me/...` sem sessão → 307 para `/login` em todos (middleware +
check interno :34-42). `waLink()` (`src/lib/ciclo.ts:1098`) gera o destino
real a partir de `whatsapp` do banco com `\D` removido — injeção de protocolo
impossível, mas número malformado no cadastro vira destino inesperado.

**Impacto:** nenhum além de "redirect pra wa.me de número arbitrário" — valor
de phishing baixo (o domínio é do WhatsApp). Aceitável como está.

**Correção sugerida (opcional):** se quiser fechar o dedo solto, conferir que
`to` corresponde ao `whatsapp` cadastrado da dupla/pessoa antes do redirect —
custa uma query e mata o uso como redirector genérico pro wa.me.

---

### INFO | Distinções de status em rotas públicas não são enumeráveis

**Evidência:** `/api/assinar-token/abc` → 400 (regex `^[0-9a-f-]{36}$`,
`route.ts:14,32-34`) vs. uuid inexistente → 404; `assinatura_por_token`/
`formulario_por_token` → `null` para token inexistente (probes). Os estados
distintos (`pendente`/`assinado`/`expirado`/`revogado`,
`respondido`/`inativo`/`expirado`/`pendente`) só são revelados a quem já
possui um token válido — entropia alta (uuid v4 / base64url 192 bits) torna
adivinhação inviável. Login não enumera e-mail: `shouldCreateUser: false`
(`login-form.tsx:251`) + allowlist `guard_signup_allowlist` (0045) + mensagens
genéricas.

**Impacto:** nenhum explorável. Registrado para completude do escopo
(token/e-mail enumeration pedido no brief).

---

## Verificado como seguro

Controles conferidos por leitura + probe (sem achado):

**Autenticação e sessão**
- Todas as actions privadas seguem `me()` (`src/lib/actions.ts:40-50`):
  `getClaims()` → `profiles` por `user_id` → erro genérico se ausente.
  Middleware cobre tudo exceto lista pública explícita
  (`src/lib/supabase/middleware.ts:38-53`: `/login`, `/auth/*`, `/demo`,
  `/assinar/<token>`, `/api/assinar-token/`, `/f/`, `/privacidade`).
- **Probe:** 19 tabelas (`profiles`, `mentorados`, `duplas`, `encontros`,
  `registros`, `materiais`, `assinaturas`, `interacoes`, `formulario_links`,
  `formulario_respostas`, `comunicados`, `solicitacoes_especialista`,
  `pessoa_notas`, `encerramentos`, `supervisoes`, `presencas`,
  `notificacoes`, `login_handoffs`, `documento_templates`) → **401** para anon.
- **Probe:** `assinar_termo`, `revogar_assinatura`, `regenerar_token_assinatura`,
  `aceitar_solicitacao`, `definir_pdm_url`, `salvar_autoavaliacao`,
  `encerrar_trilha_especialista`, `meus_dados_civis`, `formularios_limpa_respostas`
  → **401 permission denied** para anon. Só as RPCs públicas projetadas
  executam — e retornam `null`/`link inválido` para token inexistente.
- **Probe produção:** todas as rotas `/api/*` autenticadas → 307 para `/login`;
  `/api/nudge` idem mesmo com `to` wa.me válido.

**Autorização e escopo (defesa em profundidade real)**
- Role checks na action **e** guard dentro da RPC definer:
  `definir_pdm_url` (0044:46-53), `aceitar_solicitacao` (0028:80-97),
  `salvar_autoavaliacao` (0037:131-137), `encerrar_trilha_especialista`
  (0037:217-219), `revogar`/`regenerar` assinatura (0033:229-243). Padrão
  `IS DISTINCT FROM` usado corretamente onde `my_role()` pode ser null.
- Escopo de dupla verificado server-side antes de escrever
  (`salvarRegistro` confere `encDb.dupla_id !== dupla_id`,
  `actions.ts:1789`), e a RLS cobre o resto (mentor só escreve na própria
  dupla; supervisor lê supervisionadas; coord tudo).
- Usuário inativo perde `my_profile_id()` (0004) → RLS fecha junto.

**Mass assignment e autoria**
- Todas as escritas usam allowlist explícita de campos (`camposFicha`,
  `camposMentor`, `camposApresentacao`, `fichaLinha`); `updateMeuPerfil`
  nunca envia `role`/`ativo`/`user_id` (`actions.ts:2395-2401`) — e triggers
  no banco barram independentemente (`guard_profiles_self_columns`,
  `guard_mentor_profile` 0052, `guard_autoria` 0023:94-96,
  `stamp_encerramento_decisor` 0037:92-107, `stamp_solicitacao_autor` 0027).
- `assinaturas_insert` policy (0033:81-88) só aceita a shape de solicitação
  coord-only (`status='pendente'`, `profile_id is null`); escrita de
  evidência só via RPC.
- CSV export sanitiza formula injection (`'` em `=+-@`,
  `api/export/route.ts:405`) e é coord-only com gate duplo (check de role
  :84-94 + views `*_pessoal` coord-only no WHERE, 0034/0046).

**Fluxos públicos por token**
- Formulários: `TOKEN_RE` (forms/actions.ts:25,408), rejeita array/não-objeto
  (:410), teto 200KB (:419), honeypot com falso-sucesso (:407), sanitização
  em-DB por `formularios_limpa_respostas` (0036:338), gate atômico
  `usado_em is null` + `unique(link_id)` (0036:340-351) — idempotente e
  single-use de verdade.
- Assinaturas: identidade do alvo resolvida **do token**, não do form
  (actions-assinaturas.ts:290,308); snapshot montado server-side; PDF público
  só para `status='assinado'` (0051) com `Cache-Control: private, no-store`
  (`api/assinar-token/[token]/route.ts:22`).
- Handoff: single-use confirmado por probe (segundo `pegar` → `null`),
  first-wins no conflito, expiração 10min, tabela sem grants diretos.

**Redirect / SSRF / URLs controladas**
- `next=`/`redirect_to` sempre por `pathInterno` (`src/lib/utils.ts` —
  rejeita `//host` e `/\host`) em middleware (:67), `/auth/confirm` (:9),
  `/auth/confirmado`, `/auth/definir-senha`, `notificacoes.tsx` (:286) — e a
  0019 impõe `href` interno no banco.
- URLs armazenadas: `linkSeguro` só http(s) (ciclo.ts:1124) + check
  constraints em `encontros.link`, `materiais.url`, `duplas.pdm_url`
  (0023/0044 — `^https://` no PDM). Nenhum fetch server-side de URL do banco
  — sem SSRF; downloads saem por signed URL do Supabase.
- Storage: buckets privados, signed URLs de 300s, policies espelhando
  audiência/escopo (`materiais` por audiência 0010; `registro-anexos` por
  dupla + prefixo `<registro_id>/` e dupla ativa no insert 0021; `documentos`
  coord-only + `sistema/` 0033:316-322; `avatares` por pasta do dono).

**Modo demo**
- Cookie `demo_role` forjável mas fail-safe: queries checam `demoRole()`
  antes de criar o client (nunca tocam o banco), todas as mutações retornam
  `DEMO_MSG` na primeira linha, rotas `/api/*` servem placeholders do dataset
  respeitando a mesma regra de papel (`api/export` coord-only :27,
  `api/documento` coord-only :25, `api/material` por audiência :22-27).
  `demo/actions.ts` só manipula cookies + redirect.

**Erros**
- Mensagens genéricas em todas as actions (`erroAmigavel` traduz códigos
  Postgres); `traduzErroSubmit` (forms/actions.ts:384-398) só repassa a
  whitelist pt-BR de mensagens de domínio; rotas API não vazam PostgREST.

---

Verificado como seguro
