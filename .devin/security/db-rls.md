# Auditoria de segurança — camada de banco (Supabase Postgres)

**Projeto auditado:** `/home/thiago/realiza.vc` — Supabase remoto `yhjzmxleotahijinjepl`
**Data:** auditoria pontual, baseada nas migrations `supabase/migrations/0001`–`0052` (todas lidas) e em probes reais contra o banco remoto.
**Método:** leitura integral das 52 migrations + probes autenticados (mentor), anônimos (anon key) e de inspeção (service role, somente leitura/limpeza) via PostgREST e Storage API. Nada foi corrigido no schema, nas policies ou no código; as poucas escritas de teste foram revertidas com service role. Nenhuma chave, token ou PII é reproduzida neste relatório.

Decisões de design assumidas como intencionais (não reportadas como falha por si só): endpoints públicos por token (`/f/<token>`, `/assinar/<token>`, `login_handoffs`), RPCs anônimos de formulário/assinatura/handoff, flags transaction-local `realiza.*_sync`, e modo demo por cookie.

---

## Achados (ordenados por severidade)

### ALTA — 1. Aceite de solicitação de especialista fora do RPC atômico (estado inconsistente confirmado em produção)

**Evidência:**
- `0027_trilha_especialista.sql:102-123` — `sol_update` permite que `mentor_especialista` atualize solicitação `status='aberta'` com `with check` exigindo apenas `status='aceita' and especialista_id = my_profile_id()`. Não exige `dupla_id`, `respondida_em`, nem a existência da dupla especialista.
- `0028_aceite_especialista.sql:69-125` — `aceitar_solicitacao(p_id)` é o fluxo atômico previsto (cria dupla, marca `respondida_em`, valida janela), mas nada obriga a passar por ele.
- **Probe real:** um PATCH direto como `mentor_especialista` em `/rest/v1/solicitacoes_especialista` com `{status:'aceita', especialista_id:<eu>}` retornou **HTTP 204** e persistiu: `status="aceita"`, `especialista_id` preenchido, **`dupla_id=null`, `respondida_em=null`**. A linha foi restaurada via service role.
- Variante confirmada: o mentor DPP da dupla consegue escrever `especialista_id` em solicitação `aberta` da própria dupla (o `with check` só exige `status in ('aberta','cancelada')` + posse da dupla) — probe com uuid inexistente retornou `23503` (FK), provando que o UPDATE passa pelo check de role e só falha na FK. Mentor + especialista podem assim produzir "aceita sem dupla" mesmo sem má intenção.

**Impacto:** o mural/UI passa a tratar a solicitação como aceita sem que exista dupla de trilha especialista — quebra o invariante central do fluxo (aceite = dupla criada), dispara a notificação `especialista_aceitou` sem vínculo real, e abre janela de corrida que o RPC atômico foi criado exatamente para evitar.

**Correção sugerida:** remover do especialista a capacidade de UPDATE direto na transição (ou adicionar trigger `before update` que rejeite `status='aceita'` fora de contexto autorizado — ex.: flag transaction-local setada só por `aceitar_solicitacao`, mesmo padrão de `realiza.*_sync`). Alternativa mínima: exigir no `with check` `dupla_id is not null and respondida_em is not null`, e impedir que o ramo do mentor escreva `especialista_id`/`dupla_id`/`respondida_em` em linhas `abertas` (colunas imutáveis fora da coordenação).

---

### ALTA — 2. Evidências de assinatura forjáveis e `p_dados` arbitrário gravado em `dados_civis` (sync-back)

**Evidência:**
- `0046_dados_civis.sql:202-241` — `assinar_com_token(p_token, p_dados, p_texto, p_ip, p_ua, p_hash)` grava `ip = p_ip`, `user_agent = p_ua`, `hash_documento = p_hash`, `dados_snapshot = p_dados`, `assinatura_texto = p_texto` **diretamente dos argumentos do chamador**. A função é `security definer` e está concedida a `anon, authenticated` (`0046:248-251`).
- `0046:229-238` — sync-back grava `p_dados` **bruto** em `profiles.dados_civis` (ou `mentorados.dados_civis` / `mentorados.responsavel`), sem validação de schema/chaves — `dados_civis` é campo coord-only, ou seja, um endpoint público escreve JSON arbitrário num campo privilegiado.
- `src/lib/actions-assinaturas.ts:30-43` (`ipUa()` lê `x-forwarded-for`/`user-agent`) e `:242-254`/`:315-329` (`hashDocumento` SHA-256 server-side) — a aplicação deriva os valores no servidor, mas isso não protege a RPC: qualquer chamada direta ao PostgREST com o token fornece os valores que quiser.

**Impacto:** quem possui um token válido (o próprio signatário ou quem capturar o link) pode: (a) forjar IP, user-agent e hash — a "trilha de evidência" do documento deixa de ser evidência, pois é fornecida pelo cliente; (b) injetar `p_dados` arbitrário — corrompendo `dados_civis` (RG/CPF/endereço) ou plantando chaves extras que a UI renderize; (c) assinar com `assinatura_texto` livre (não verificado contra o snapshot). O vetor exige o token — não permite assinar sem ele — mas invalida a confiabilidade probatória do registro.

**Correção sugerida:** não aceitar evidência como argumento confiável — ler headers de request no contexto do banco (`current_setting('request.headers', true)` quando disponível) ou mover a mutação para um endpoint server-only que seja o único chamador; recomputar o hash canônico em camada confiável sobre o payload efetivamente armazenado; validar `p_dados` no banco (chaves permitidas por template, tamanhos, CPF com DV) antes do update e do sync-back.

---

### ALTA — 3. Guard de papel com bypass por NULL em `revogar_assinatura` / `regenerar_token_assinatura` (privilégio retido por usuário desativado)

**Evidência:**
- `0033_assinaturas.sql:225-233` e `:236-251` — ambas usam `if public.my_role() <> 'coordenacao' then raise exception ...`. Em PL/pgSQL, `IF NULL` é tratado como falso: quando `my_role()` retorna **NULL**, o raise é pulado e o UPDATE executa como definer.
- `0003_ativo_gate.sql:5-8` — `my_role()` retorna NULL para `ativo=false` (desativado) e para `role is null` (pré-cadastro sem papel, estado real: "cadastro recebido"). `0004` endureceu outros guards com `is distinct from` (ex.: `guard_registro_apoio`, `0004:20-24`), mas estas duas funções ficaram com o padrão antigo.
- Grants: `0033:300-304` — `execute` concedido a `authenticated` (qualquer JWT válido).
- Cadeia: desativar uma pessoa (`ativo=false`) **não revoga** seus JWTs/refresh tokens. Um coordenador desligado conhece os ids de todas as assinaturas (leitura plena enquanto ativo); dentro da validade do token — e refresh tokens podem estendê-la — ele chama `revogar_assinatura(id)` (sabotagem em massa: `assinado→revogado` derruba `termo_ok` via trigger `assinatura_reflete_termo_ok`, `0033:255+`) ou `regenerar_token_assinatura(id)` (retorna token novo → `/assinar/<token>` público expõe `civis` e aceita assinatura — combinável com o achado 2).

**Impacto:** o gate de desativação (`0003`/`0004`) é contornado exatamente no cenário para o qual foi criado — usuário desligado retém poder de mutação sobre assinaturas e pode mintar links de assinatura/PII. Requer conhecer o id da assinatura (UUIDs não enumeráveis, mas ex-coordenação/ex-mentor conhecem os próprios).

**Correção sugerida:** trocar para `if public.my_role() is distinct from 'coordenacao'` nas duas funções (padrão já adotado em `0004`). Auditoria de consistência: revisar toda função `security definer` que use `<> 'papel'` em vez de `is distinct from`. Considerar revogação de sessões no fluxo de desativação.

---

### MÉDIA — 4. `assinatura_completa_por_token` expõe a row inteira (`to_jsonb(a)`) ao portador do token

**Evidência:**
- `0051_assinatura_pdf_template.sql:14-27` — `select to_jsonb(a) || jsonb_build_object('template', ...)`: devolve **todos os campos** de `assinaturas` para quem tem o token. Probe anônimo real retornou as chaves: `id, profile_id, mentorado_id, template_id, token, token_expira_em, status, dados_snapshot, assinatura_texto, assinado_em, ip, user_agent, hash_documento, created_by, created_at` + `template`.
- `0046_dados_civis.sql:87-147` — `assinatura_por_token` já usa allowlist (`id/status/assinado_em/template/alvo.nome/civis`), mas devolve `civis` (RG/CPF/endereço completos — confirmado em probe real) mesmo quando `status` é `assinado`, `revogado` ou `expirado`, quando o prefill não tem mais função.

**Impacto:** o token é bearer credential por design; a falha é a amplitude — além da PII civil necessária ao fluxo, vazam IP/UA do signatário, hash, snapshot integral, texto da assinatura, ids internos e o próprio token de volta (auto-eco). Se o link vazar em logs, histórico, referrer ou analytics, a exposição é maior que o necessário para renderizar a página/PDF público.

**Correção sugerida:** trocar `to_jsonb(a)` por allowlist explícita (template versão/slug/título, nome do signatário, snapshot necessário à renderização, `assinatura_texto`/`assinado_em` se forem exibidos); não devolver `token`, `ip`, `user_agent`, `hash_documento`, `created_by` nem ids internos no endpoint público; restringir `civis` em `assinatura_por_token` a `status='pendente'`. Evidências completas permanecem acessíveis à coordenação via queries autenticadas.

---

### BAIXA — 5. Bucket `avatares` valida só extensão; MIME arbitrário aceito

**Evidência:** `0024_avatares_ext.sql:7-24` (`avatares_insert`) e `:15-24` (`avatares_update`) checam `lower(name)` contra `.png/.jpg/.jpeg/.webp` — nenhuma policy inspeciona `metadata->>'mimetype'`. **Probe real:** upload de objeto `*.png` com `Content-Type: text/html` foi **aceito** (HTTP 200/key retornada). O GET público serviu `text/plain` (storage normalizou), então execução ativa de HTML/SVG não foi demonstrada — mas a policy em si não impõe coerência de conteúdo. Objeto de teste removido via service role (ver achado 6).

**Impacto:** content-type confusion; se a entrega/CDN/consumidores futuros servirem o objeto como HTML/SVG, vira XSS em origem pública. Bucket é público, o que amplifica.

**Correção sugerida:** exigir `metadata->>'mimetype'` na allowlist de imagens na policy (defesa em profundidade junto à extensão); idealmente decodificar/re-encodar server-side ou servir avatares por proxy controlado com content-type fixo.

---

### BAIXA — 6. `avatares` sem policy de SELECT para autenticado: dono não atualiza nem deleta o próprio objeto

**Evidência:** policies em `storage.objects` para `avatares`: `avatares_insert` (`0024:7`), `avatares_update` (`0024:15`), `avatares_delete` (`0014_avatar_perfil.sql:27`) e `avatares_coord_write` FOR ALL (`0024:28`, só coordenação). **Nenhuma policy de SELECT para o dono.** Na Storage API, UPDATE/DELETE passam por visibilidade de row (select) antes do `using`: **probes reais** — `DELETE` do próprio objeto → **403**; `list` da própria pasta → `[]`. Em `src/lib/actions.ts:894` o app chama `storage.from('avatares').remove([pathAntigo])` na troca de foto — falha silenciosamente para usuários comuns.

**Impacto:** cada troca de avatar deixa o arquivo antigo órfão e **permanentemente público** via URL direta (foto de perfil antiga = PII residual sem caminho de remoção self-service); usuário não consegue sobrescrever o mesmo path (app contorna com UUID novo por upload).

**Correção sugerida:** policy de select em `avatares` para `(storage.foldername(name))[1] = public.my_profile_id()::text or my_role()='coordenacao'`, mantendo insert/update/delete como estão.

---

### BAIXA — 7. Integridade de agenda/registros dentro do próprio escopo

**Evidência (código + probes):**
- `0047_delete_hardening.sql:42-50` — `registros_mentor_insert` exige apenas que o `encontro_id` pertença a dupla do mentor; **não exige `encontros.status='realizado'`** → registro (follow-up "pós-encontro") pode ser criado em encontro `agendado`/`cancelado`.
- `registros_mentor_update` (`0047:52-67`) — `encontro_id` é regravável; o check amarra à dupla do mentor, mas permite **reatribuir o registro a outro encontro** da mesma dupla (probe: mover para encontro alheio → `42501` confirmado; dentro do próprio escopo passa).
- `encontros` — `dupla_id` regravável entre duplas do mesmo mentor; `numero` pode ser trocado entre encontros próprios (unique por dupla só impede colisão); `status` livre exceto saída de `realizado` (guard `0043` — probe confirmou `encontro realizado não pode mudar de status`).

**Impacto:** corrupção interna do histórico (registro migrado de encontro, encontro renumerado/realocado) — baixa, pois exige ação do próprio mentor contra seus dados, mas o semáforo/prestação de contas dependem dessa integridade.

**Correção sugerida:** exigir `e.status='realizado'` no insert de `registros`; trigger impedindo mudança de `encontro_id`/`dupla_id`/`numero` após criação (ou check `is not distinct from old`).

---

### BAIXA — 8. Trilhas de consentimento e supervisão falsificáveis pelo próprio usuário

**Evidência:**
- `profiles.consent_lgpd_em` é self-writable: **probe real** `PATCH profiles` `{consent_lgpd_em: <agora>}` → **204** persistido (revertido). O guard `guard_profiles_self` (`0023:~118-135`) protege `email/role/ativo/user_id/documento_path`, mas não o timestamp de consentimento.
- `supervisoes_insert` (`0041_supervisoes.sql:56-61`) exige só `role='supervisor' and supervisor_id=myself` — `mentor_id` e `dupla_id` livres → supervisor registra sessão de supervisão sobre **mentor não supervisionado**, que recebe notificação `supervisao_registrada` (`0041:86+`).

**Impacto:** trilha de compliance LGPD passa a poder ser forjada pelo titular (carimbo retroativo); supervisor pode fabricar registros/notificações de supervisão fora do escopo — integridade de auditoria e sinalização falsa.

**Correção sugerida:** incluir `consent_lgpd_em` no guard de colunas protegidas (gravável só por fluxo dedicado); no insert de `supervisoes`, exigir `exists(duplas where supervisor_id=me and mentor_id=new.mentor_id)` quando `dupla_id`/`mentor_id` informados.

---

### INFORMATIVO — 9. Minimização, limites de tamanho e índices de RLS

- `profiles.user_id` está no grant de select a todos os autenticados (`0026:10`) — expõe o `auth.users.id` de qualquer usuário; sem exploit confirmado, mas contrário à minimização (a UI não precisa dele alheio).
- `mentorados.documento_path` está no column grant — necessário à avaliação da policy de storage (`exists` por path); vaza o caminho (não o conteúdo) do documento do mentorado. Aceitável, mas documentado aqui.
- Sem caps de tamanho: `interacoes.nota`, `profiles.nome/whatsapp/bio`, `materiais.titulo` etc. (0023 capou URLs; textos livres seguem ilimitados) — payloads gigantes por linha.
- `assinaturas.token_expira_em` é nullable — link sem validade se a coordenação inserir sem prazo (regenerar sempre seta +30d).
- `assinatura_por_token` retorna `civis` em qualquer status (ver achado 4).
- Índices ausentes em colunas avaliadas por policies a cada query: `duplas.mentor_id`, `duplas.supervisor_id`, `duplas.mentorado_id`, `solicitacoes_especialista.especialista_id`, `encaminhamentos.dupla_id` — seq scan por check de RLS; hoje irrelevante no volume atual, degrada com o crescimento.
- Função interna `rls_auto_enable` é executável via RPC (erro de tipo de retorno, sem efeito) — revogar `execute` por higiene.
- `registrar_login_handoff` aceita qualquer nonce (design intencional): "envenenar" um handoff exige conhecer o nonce — que **é** o próprio link — então equivale a interceptar o link; sem finding. `falhar_login_handoff` segue a mesma lógica (DoS só com posse do nonce).

---

## Verificado como seguro

Confirmado por probes reais e/ou revisão de código, salvo indicação:

- **RLS base:** grants de tabela a `anon` revogados (`0032`); todas as tabelas sensíveis com RLS habilitado; leituras anônimas diretas → 401/403 em todas as tabelas probadas. Nenhuma policy `using(true)` residual em tabela de dados.
- **Isolamento por papel:** mentor não lê/escreve fora da própria dupla — PATCH/DELETE em `encontros`, `registros`, `interacoes`, `pessoa_notas`, `encontro_notas`, `assinaturas`, `documento_templates`, `materiais`, `duplas` (status/mentor_id/trilha) retornaram 0-row ou `42501`, com estado confirmado intacto via service role. Supervisor é somente-leitura em duplas (`0004` removeu o update). Mentor não acessa notas de outras pessoas.
- **Autoria:** `created_by`/`autor_id` carimbados no servidor via triggers (`0023`, `0027`, `0041`) — forjar em `interacoes`, `pessoa_notas`, `solicitacoes` e `supervisoes` levanta exceção (probe confirmado).
- **Notificações:** `notificacoes_insert` (`0019`, estendida em `0041:98+`) restringe tipos e destinatários por papel — mentor só `pedido_apoio`→coord/supervisor e `demanda_especialista`→coord; `lida_em` self-only; tipos arbitrários rejeitados (probe).
- **Encontros realizados:** imutáveis em status (`0043` — probe: `encontro realizado não pode mudar de status`); DELETE coord-only em `encontros`/`registros` (`0047`); link somente http(s) (`javascript:` rejeitado em probe); `numero` com faixa/check e unique por dupla.
- **RPCs escopados:** `aceitar_solicitacao` (`0028:69`), `definir_pdm_url` (`0044`), `salvar_autoavaliacao`, `encerrar_trilha_especialista` — rejeitam chamadores sem vínculo/papel correto (probes `P0001`/`42501`). Todas as funções `security definer` revisadas fixam `search_path` (`public` ou `''`). As chamadas que falharam com `my_role()=NULL` do mentor inativo foram as únicas com o padrão vulnerável (achado 3).
- **Flags transaction-local:** `realiza.formacao_sync`/`realiza.assinatura_sync` (`0040`, `0052`) não são expostas — nenhuma RPC pública as seta; `set_config` não é alcançável via PostgREST (fora do schema exposto); o guard (`guard_mentor_profile`, `0052:38+`) nega a escrita fora do contexto do trigger.
- **Forms públicos:** `formulario_por_token` anônimo com token válido; token usado retorna `status: respondido`; reenvio idempotente retorna a resposta existente sem duplicar; `formulario_respostas.respostas` nunca exposto a `anon`; `formularios_limpa_respostas` puro/sem efeito externo (probe 401 para contexto errado).
- **Assinatura — fluxo legítimo:** token uuid único por documento, `assinaturas_token_idx`; expiração lazy marca `expirado`; idempotência (re-assinar retorna a row); `termo_ok` deriva por trigger e cai na revogação; `assinaturas_select` limita a dono+coordenação (`0033:73-77`); insert direto restrito.
- **`login_handoffs`:** RLS on, grants diretos revogados; **probe de round-trip**: `registrar`→`pegar` retorna tokens, `pegar` novamente → `null` (single-use confirmado); expirados são removidos na leitura; `falhar` marca erro consumível. TTL curto por design.
- **Signup/vínculo:** `handle_new_user` só vincula `user_id` quando e-mail pré-cadastrado em `profiles` e `user_id is null` (`lower()` normalizado); allowlist de signup (`0045`) — e-mail fora do pré-cadastro falha no magic link.
- **Storage — buckets privados:** `materiais`, `documentos`, `registro-anexos` não listáveis/upáveis por `anon` (probes); insert exige row correspondente com path = name (metadados conferidos); upload fora do escopo/pasta alheia → 403; extensões perigosas (`.html`) rejeitadas em `avatares`; documentos pessoais só via `profiles_contato` (coord/dono); rotas `/api/documento|material|anexo/[id]` delegam à policy (signed URL falha → 404 para não autorizado); `/api/export` exige `role='coordenacao'` no handler.
- **Dados sensíveis:** `dados_civis`, `motivacao`, `data_nascimento`, `responsavel`, `pref_genero_par` fora do column grant de `authenticated` — select direto → `42501`; leitura própria via `meus_dados_pessoais`/`meus_dados_civis` (probe: retorna só os próprios campos); `profiles_contato`, `*_pessoal` e `solicitacoes_mural` expõem o mínimo por papel.
- **Profiles self-update:** guard de colunas protegidas (`email/role/ativo/user_id/documento_path`) — tentativa de alterar → `campo protegido do perfil`; PATCH em profile alheio → 0-row (probe, nome confirmado intacto); mentor não insere/deleta profiles.
- **Demo mode:** cookies atuam só na camada de app; probes `anon` diretos ao banco real não retornam dados — nenhum caminho do demo alcança dados reais.

---

*Relatório de auditoria — sem correções aplicadas. Escritas de teste revertidas e objetos de probe removidos via service role.*
