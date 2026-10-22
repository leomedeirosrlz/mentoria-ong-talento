# REALIZA-170 — software design

## 1. Modelo de dados

### `relatorio_links` [NOVO]

```sql
create table public.relatorio_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[A-Za-z0-9_-]{16,128}$')
    default translate(encode(extensions.gen_random_bytes(18),'base64'),'+/=','-_'),
  titulo text not null check (char_length(titulo) between 1 and 120),
  -- bcrypt do pgcrypto; NULL = link legado sem senha (transitório — ver §4)
  senha_hash text check (senha_hash is null or char_length(senha_hash) between 20 and 100),
  config jsonb not null default '{}'::jsonb,
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  expira_em timestamptz,
  revogado_em timestamptz,
  revogado_por uuid references public.profiles(id)
);
```

Sem `updated_at` — edição = revoga + recria (link é artefato imutável: quem tem
o papel impresso do recorte vê o mesmo recorte).

### `resumo_acessos` — ALTER (da 183, aplicada aqui se 183 ainda não aterrissou)

```sql
alter table public.resumo_acessos
  add column if not exists link_id uuid references public.relatorio_links(id)
    on delete set null,
  add column if not exists ok boolean not null default true,
  add column if not exists motivo text
    check (motivo is null or motivo in
      ('senha','limite','revogado','expirado','sem_link'));
create index if not exists resumo_acessos_falhas
  on public.resumo_acessos (slug, ip_hash, acessado_em desc) where ok = false;
```

### `config jsonb` — shape (validado em TS antes de salvar)

```ts
type RelatorioLinkConfig = {
  tipo: "grade" | "ciclo" | "assinaturas";        // 'respostas' vetado no público
  turma: string | null;                          // null = todas
  cronograma_id?: string | null;                 // filtro do export ciclo
  // só tipo='grade':
  granularidade?: "pessoas" | "duplas";
  colunas?: string[];                            // ids do catálogo do tipo
  // opt-in explícito — sem ele, e-mail/whatsapp de menores nem saem do banco
  expor_contato?: boolean;
  // só tipo='assinaturas':
  documento?: string | null;                     // slug do template
  status_assinatura?: string | null;             // pendente|assinado|revogado|expirado
};
```

## 2. RPCs `security definer`

Molde: `login_handoffs` (0049) — tabela sem nenhum grant público, acesso só por
RPCs; `grant execute ... to anon, authenticated`. Mesma família de
`terceiro_por_token`/`avaliacao_por_token` (verificações dentro da função,
retorno jsonb).

### `relatorio_link_info(p_slug text) → jsonb`

```text
retorna { existe: bool, precisa_senha: bool, titulo: text|null }
```
- `existe=false` também para slug revogado/expirado? **Não** — a página
  diferencia: inexistente → 404 puro; revogado/expirado → card neutro "Este
  resumo não está mais disponível" (o portador do slug já tinha acesso antes;
  confirmar existência a ele não é vazamento novo). `info` devolve
  `{existe, estado: 'ativo'|'revogado'|'expirado', precisa_senha, titulo}`.
- Não loga (a página loga via abrir ou via acesso direto — evitar duplo count:
  acesso a info sem senha **também** loga? Decisão: loga só na tentativa de
  abertura e no acesso sem senha — info é só o shell; quem tem o link e nunca
  digita senha não aparece. **Registrado como limitação consciente** no sdr).

### `abrir_relatorio(p_slug, p_senha text, p_ip_hash text, p_ua text) → jsonb`

Ordem dos checks (cada falha → log + retorno genérico `{ok:false, motivo}` —
**nunca** revelar qual check falhou além do necessário à UX):

1. Link por slug → ausente: `{ok:false, motivo:'sem_link'}` (sem log — slug
   inválido não vira row, mesmo motivo da 183).
2. `revogado_em`/`expira_em` → `{ok:false, motivo:'revogado'|'expirado'}` + log.
3. Rate limit: `count(resumo_acessos where slug=p_slug and ip_hash=p_ip_hash
   and ok=false and motivo in ('senha','limite') and acessado_em > now() - 15
   min) >= 5` → `{ok:false, motivo:'limite', retry_em}` + log. Regua por
   `pg_advisory_xact_lock(hashtextextended(slug, 170))` — molde da 0094 — pra
   serializar tentativas concorrentes no mesmo slug (TOCTOU do count).
4. `senha_hash is not null` → `crypt(p_senha, senha_hash) = senha_hash`; falha →
   `{ok:false, motivo:'senha'}` + log + `pg_sleep(0.3)` antes do retorno
   (custo marginal por tentativa; bcrypt já custa ~80ms).
   `senha_hash is null` → passa direto (link legado T2).
5. Sucesso → log `ok=true` + montar `dados` por `config.tipo` (ver §3) +
   devolver `{ok:true, config, dados}`.

`p_senha` pode ser null — link sem senha passa; link com senha falha no check 4.

### `dados` por tipo — o que sai do banco

A RPC monta os recortes **no SQL** e poda antes de devolver — coluna sensível
não atravessa a fronteira:

| tipo | dados |
|---|---|
| `grade` | `duplas(id,turma,mentor_id,mentorado_id,supervisor_id,status,iniciada_em,demanda)` + `profiles(id,nome,cidade,uf[,email,whatsapp])` + `mentorados(id,nome,cidade,uf[,email,whatsapp])` — contato só se `config.expor_contato`. O `montarLinhas` roda no app (fonte única TS). |
| `ciclo` | duplas (mesmas colunas mínimas) + `encontros(dupla_id,numero,data_hora,realizado_em,status,motivo_reagendamento,duracao_min)` + `registros(encontro_id,created_at,avaliacao,atividades)` — **sem** tema/reflexoes/observacoes/detalhes/precisa_apoio (texto livre + flag interna). |
| `assinaturas` | `assinaturas(id,profile_id,mentorado_id,status,assinado_em,created_at,token_expira_em)` + `documento_templates(titulo,versao)` + nomes — **sem** dados_snapshot/cpf/rg/ip/ua/hash_documento/assinatura_texto/token. |

Implementação: `jsonb` montado por subselects (`jsonb_agg` de `to_jsonb` de
rowtype podado). O formato `dados` por tipo é o contrato — tipar em
`src/lib/relatorio.ts` (`RelatorioDados`, `RelatorioDadosCiclo`…).

### RPCs de gestão (coord, `grant authenticated`)

- `criar_relatorio_link(p_titulo, p_config, p_expira_em interval default null)`
  → `{slug, senha}` — senha **gerada no banco** (`gerar_senha_legivel()`:
  2×4 chars de alfabeto sem ambíguos `abcdefghjkmnpqrstuvwxyz23456789`, ex.
  `k7f2-m9xw`), `senha_hash = crypt(senha, gen_salt('bf'))`. Retorna a senha
  **em claro uma única vez** — nunca é lida de volta (a UI avisa).
- `revogar_relatorio_link(p_id)` → set `revogado_em/revogado_por` — idempotente.
- `redefinir_senha_relatorio_link(p_id)` → `{senha}` nova (invalida a anterior
  na hora — o hash é por link, não por sessão).
- `regenerar_slug_relatorio_link(p_id)` → novo slug — opcional, pule se
  scope apertar; revogar+criar cobre o caso.

## 3. Camada app

### `/resumo/[slug]` — fluxo

1. `relatorio_link_info(slug)` → `!existe` → `notFound()` (como hoje).
   `estado≠ativo` → card neutro "Este resumo não está mais disponível."
2. `precisa_senha`: lê cookie `resumo_<slug>` → se ausente/inválido, renderiza
   `<ResumoSenhaForm slug>` (client, `password-input.tsx` existe).
3. Form → server action `abrirResumo(slug, senha)` → RPC → ok →
   `cookies().set('resumo_'+slug, senha, {httpOnly, secure, sameSite:'lax',
   path:'/resumo/'+slug, maxAge: 7d})` + `redirect` pra mesma URL (reload
   renderiza com dados).
4. Com cookie: `abrir_relatorio(slug, cookieValue, ipHash, ua)` → ok → montar
   `linhas` no servidor via `montarLinhas`/`montarLinhasCiclo`/… → poda
   client-side como hoje (`permitidas`) → `RelatorioCanvas`.
   Falha (senha trocada, limite) → limpa cookie + volta ao form com erro.

Por que cookie com a senha e não um token de sessão: um token exigiria tabela
de sessões (mais superfície). A senha já é credencial compartilhada — o cookie
httpOnly+secure só evita redigitar; se vazar, equivale à senha. `path` scoping
impede o envio fora do slug. Alternativa HMAC(`slug|exp`) precisaria de segredo
env extra — mesma disciplina do salt, benefício marginal.

### `src/lib/relatorio.ts` — extensões

- `RelatorioLinkConfig` + `configLinkOk(cfg)` (validação pura — espelha os
  CHECKs; a action valida antes de chamar a RPC).
- `COLUNAS_CICLO`, `COLUNAS_ASSINATURAS` [NOVO] + `catalogoDeTipo(tipo)` —
  catálogo público separado do de export (o público é subconjunto estrito).
- `montarLinhasCiclo(dados)` / `montarLinhasAssinaturas(dados)` [NOVO] — mesma
  assinatura de `montarLinhas` (`LinhaRelatorio[]`), sem `__alvos`/`__links`
  (público nunca edita).
- `RESUMO_SLUG_T2` morre como gate — vira seed; `parseConfig`/`configParaSearch`
  seguem pro builder interno.

### `/relatorios` — UI de gestão (design.md detalha)

- `RelatorioLinksCard` [NOVO] no builder: lista links (título, tipo, criado_em,
  expira, nº acessos via count em `resumo_acessos`, estado) + ações copiar/
  revogar/redefinir senha.
- `NovoLinkRelatorioDialog` [NOVO]: captura `cfg` corrente do builder
  (botão "Publicar este recorte como link") ou escolhe tipo+filtros; gera →
  mostra link+senha **uma vez** com botão copiar conjunto.
- Actions em `src/lib/actions-relatorio-links.ts` [NOVO] — padrão `{error}`/`{ok}`,
  gate `me.role==='coordenacao'` + `demoAtivo() → DEMO_MSG`.

## 4. Seed do slug atual

```sql
insert into public.relatorio_links (slug, titulo, config, criado_por)
values (
  't2-x7k4m9qf2w8j',
  'Resumo da turma — T2 · 2026/2027',
  '{"tipo":"grade","turma":"T2 · 2026/2027","granularidade":"pessoas",
    "colunas":["papel","nome","cidade_uf","par","status_dupla","iniciada_em",
    "demanda","auxiliar"],"expor_contato":false}',
  null
);
```

`senha_hash=null` preserva o comportamento atual (o link em circulação não
morre no deploy). A UI marca "Sem senha" + CTA "Definir senha" — quando a coord
definir, a rota passa a exigir. **Links novos sempre nascem com senha** (a
action gera sempre; `null` só existe no legado).

## 5. Invariantes

- Anon nunca toca `relatorio_links`/`resumo_acessos` — só as 2 RPCs públicas.
- `dados` é montado por allowlist no SQL — `*`/`select cru` proibido.
- Senha nunca gravada em claro (só `senha_hash`); nunca retornada após a
  criação; nunca vai pra logs/Sentry (o scrub já cobre `token`/`code` — a RPC
  recebe `senha` como arg, args de RPC não vão ao Sentry por `databaseQueryData:false`).
- Falhas de senha são indistinguíveis fora do motivo interno no log.
