# REALIZA-170 — Relatórios públicos com senha (`relatorio_links`)

**Jira:** [REALIZA-170] "Relatórios públicos com senha — links revogáveis
configurados pelos filtros do export CSV"
**Tier:** A — doc set completo + sdr pesado (dado de menor em superfície pública)
**Status:** ABERTO — hoje o `/resumo/[slug]` é um único slug fixo por
obscuridade (`RESUMO_SLUG_T2`, `src/lib/relatorio.ts:5`), sem senha, sem
revogação, sem gestão.

## Resumo

Direção do Thiago: `/resumo` vira **relatório público protegido por senha** —
a coord monta o recorte (mesmos filtros do `/api/export`: tipo, turma,
cronograma, colunas), gera um link `slug` + senha, compartilha por WhatsApp,
revoga quando quiser. `relatorio_links` guarda slug + `senha_hash` + `config`
jsonb + revogação + expiração + `criado_por`. O acesso público é por RPC
`security definer` (anon não tem grant de tabela nenhuma — 0032), com rate
limit na verificação da senha contando falhas em `resumo_acessos` (183).

## Escopo

- **`relatorio_links`** [NOVO]: `id`, `slug` (24B b64url), `titulo`,
  `senha_hash` (bcrypt via `crypt()` do pgcrypto — já habilitado, 0001),
  `config jsonb` (tipo + filtros + granularidade + colunas + `expor_contato`),
  `criado_por`, `expira_em`, `revogado_em`/`revogado_por`, `created_at`.
- **`resumo_acessos`** ganha `ok bool` + `motivo text` (ALTER da migration da
  183 ou co-evolução) — tentativas de senha falhas viram linhas; o rate limit
  as conta.
- **RPCs definer** (grant `anon, authenticated`):
  - `relatorio_link_info(slug)` → `{existe, precisa_senha, titulo}` — shell da
    página, sem dado.
  - `abrir_relatorio(slug, senha, ip_hash, ua)` → `{ok, config, dados}` ou
    `{ok:false, motivo}` — verifica revogado/expirado/rate/senha, loga o acesso
    e devolve config + dados crus **já podados** no SQL (colunas sensíveis nem
    saem do banco).
- **Tipos de relatório público** (config.tipo): `grade` (o resumo atual —
  pessoas/duplas), `ciclo` (encontros), `assinaturas` (status por pessoa, sem
  evidências). **`respostas` fica fora do público em v1** — ver sdr.md
  (anamnese/360º = texto livre sobre menores; o corte é deliberado e reversível).
- **`/resumo/[slug]`** vira gate de senha: formulário → server action → cookie
  httpOnly por slug → render. Mantém `RelatorioCanvas` + a poda client-side.
- **UI coord** em `/relatorios`: card "Links públicos" — listar, criar (o
  builder captura o recorte corrente), copiar link+senha (senha mostrada **uma
  vez**, gerada no servidor), revogar, definir validade opcional.
- **Seed:** o slug `t2-x7k4m9qf2w8j` vira row (link em circulação não quebra;
  nasce `senha_hash=null` = acesso livre até a coord definir senha — ver sdd).
- LGPD: colunas de contato (e-mail/WhatsApp de menor) continuam **opt-in**
  (`expor_contato` no config) e os campos `*_pessoal`/`dados_civis` nunca entram
  no payload público — allowlist de colunas por tipo, nunca select cru.

## Dependências

- **183** (`resumo_acessos`) — rate limit e auditoria usam a tabela. Pode
  aterrissar na mesma migration se 183 não estiver pronta (o DDL aqui a recria
  com `create table if not exists` compatível — decidir no PR).
- **167** cria a versão mínima de `relatorio_links` (sem senha) se aterrissar
  antes — esta issue então faz `alter table` + a camada de senha. Ordem
  sugerida: **167 → 183 → 170**; cada doc é executável sozinho.
- `pgcrypto` já existe (0001) — `crypt()`/`gen_salt('bf')`/`gen_random_bytes()`
  disponíveis.

## Esforço: M–G

Migration média (tabela + 2 RPCs + ALTER acessos + seed), ~3 RPCs/actions novas,
page de senha + UI de gestão, poda por tipo em `relatorio.ts`, e2e + validador
REST. A parte cara é a disciplina de allowlist por tipo (sdr).

## Riscos

- **Dado de menor atrás de senha compartilhada** — senha é fator fraco por
  natureza; mitigações: bcrypt, rate limit, expiração, revogação, auditoria por
  acesso, allowlist de colunas (sdr.md é o coração da issue).
- **Senha em cookie** — desenho no sdd (httpOnly, path-scoped, 7d; a senha já é
  um segredo compartilhado, o cookie não piora o modelo).
- **Enumeração de slugs** — slug não encontrado e senha errada respondem o
  mesmo `{ok:false}` genérico na RPC; página faz 404 só quando `info.existe=false`.
- **Demo:** UI de gestão mostra links canned do dataset; mutações → `DEMO_MSG`.

> DECIDIDO (Thiago): v1 = link+senha, só dados operacionais; respostas brutas de instrumentos fora.
