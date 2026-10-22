# REALIZA-70 — plan.md

Pré-requisito: REALIZA-36 mergeado (os 4 tipos existem na engine).
Numeração de migration: `0107` (após `0106` do 36; `a verificar` conflito
na hora — última real é `0105`).

## Passo 1 — migration `0107_intake_links_e_seed_mentores.sql`

### 1a. Link multi-uso (ver sdd.md para alternativas)

```sql
alter table public.formulario_links
  add column multi_uso boolean not null default false,
  add column origem text not null default 'manual'
    check (origem in ('manual','intake'));
```

- `formulario_respostas.link_id UNIQUE` → drop + trigger
  `resposta_unica_guard` (sdd.md §decisão) que preserva "1 resposta por
  link" **exceto** `multi_uso`.
- `submeter_resposta_formulario` (CREATE OR REPLACE): quando link é
  `multi_uso`, **não** seta `usado_em`, não rejeita segunda resposta;
  rate: rejeita se `count(respostas do link) >= 500` (cap de sanidade —
  ajustável) ou `>= 50/dia`.
- `formulario_por_token`: sem mudança (token acha o form igual).
- `formularios_sistema_check`: `alter ... add value`/`replace function` —
  novo valor `intake_mentor` (e `intake_mentorado` — mesma migration
  cobre o 69 ou cada um na sua; **decisão: uma migration por form**,
  `0107` mentores, `0108` mentorados).

### 1b. Seed do form oficial

`insert into formularios (titulo, descricao, campos, sistema, ativo)`
verbatim de `forms-google-mapeamento.md` §Form 2:

```jsonc
campos = [
  {"id":"sec_dados","tipo":"secao","label":"Dados pessoais"},
  {"id":"nome_civil","tipo":"texto","label":"Nome completo civil","obrigatorio":true},
  {"id":"nome_social","tipo":"texto","label":"Nome social"},
  {"id":"nascimento","tipo":"data","label":"Data de nascimento","obrigatorio":true},
  {"id":"genero","tipo":"select","label":"Gênero","obrigatorio":true,
   "opcoes":["Cisgênero feminino","Cisgênero masculino","Transgênero","Não binário","Prefiro não informar"]},
  {"id":"cor_raca","tipo":"select","label":"Cor/raça","obrigatorio":true,
   "opcoes":["Negra","Branca","Amarela","Parda","Indígena"],"permite_outro":true},
  {"id":"cidade","tipo":"texto","label":"Estado/município de residência","obrigatorio":true},
  {"id":"sec_trajetoria","tipo":"secao","label":"Trajetória pessoal e profissional"},
  {"id":"hobbies","tipo":"texto_longo","label":"Hobbies","descricao":"Até 3 hobbies","obrigatorio":true},
  // …esportes, inspiracoes, valores, realizacoes, auto_descricao, companheiro_descreveria
  {"id":"sec_trabalho","tipo":"secao","label":"Trabalho e emprego"},
  {"id":"cargo","tipo":"texto","obrigatorio":true},
  {"id":"empresa","tipo":"texto","label":"Empresa/instituição","obrigatorio":true},
  {"id":"curriculo","tipo":"arquivo","label":"Currículo","obrigatorio":true,"max_mb":10},
  {"id":"linkedin","tipo":"texto","label":"LinkedIn"},
  {"id":"sec_contato","tipo":"secao","label":"Dados de contato"},
  {"id":"email","tipo":"texto","obrigatorio":true},
  {"id":"telefone","tipo":"texto","obrigatorio":true},
  {"id":"sec_mentoria","tipo":"secao","label":"A mentoria"},
  {"id":"formacao_erlich","tipo":"sim_nao","obrigatorio":true},
  {"id":"experiencia_previa","tipo":"sim_nao","obrigatorio":true},
  {"id":"experiencia_descricao","tipo":"texto_longo",
   "label":"Caso possua experiência prévia, descreva-a",
   "visible_if":{"campo":"experiencia_previa","em":["Sim"]}},
  {"id":"objetivos","tipo":"texto_longo","label":"Objetivos/expectativa","obrigatorio":true},
  {"id":"pref_genero_mentorado","tipo":"select","obrigatorio":true,
   "opcoes":["Mentorado homem","Mentorada mulher","Sem preferência"]},
  {"id":"foto","tipo":"arquivo","label":"Foto de perfil","obrigatorio":true,"max_mb":10},
  {"id":"disponibilidade","tipo":"grid_disponibilidade","label":"Disponibilidade","obrigatorio":true},
  {"id":"sec_comprovantes","tipo":"secao","label":"Comprovantes"},
  {"id":"doc_identidade","tipo":"arquivo","label":"Anexo do RG ou CNH","obrigatorio":true,"max_mb":10},
  {"id":"comprovante_residencia","tipo":"arquivo","label":"Comprovante de residência","obrigatorio":true,"max_mb":10}
]
```

- `sistema='intake_mentor'` — imutável via `formularios_sistema_guard`.
- Labels/descric̃ões verbatim do mapeamento; `*`→`obrigatorio:true`.
- **a verificar/confirmar** (do mapeamento §Pendente): grid 1× ou 2× no
  form real — se 2×, segundo campo `disponibilidade_2` ou ajuste de
  label; por ora **1 grid** (artefato provável).

## Passo 2 — gestão do link de intake (coord)

- `/formularios/[id]`: seção "Link de inscrição" [NOVO] para forms
  sistema-intake — botão "Gerar link público" → action
  `gerarLinkIntake(formularioId)` [coord]: cria `formulario_links` com
  `multi_uso=true, origem='intake'` (um por form — reutiliza se já ativo,
  padrão "genérico reutiliza o pendente") → URL `/f/[token]` (mesma
  rota pública, zero superfície nova).
- Faixa de status: "Link ativo · N respostas" + botões Copiar/WhatsApp
  (componentes `src/components/forms/` já existem) + "Desativar link"
  (`ativo=false` ou `expira_em=now()` — o que o schema permite sem nova
  coluna; `a verificar` coluna `ativo` em links — se não existir, expira).
- Lista de links manuais: filtrar `origem='intake'` pra não poluir
  (pequeno `where`/filtro client).

## Passo 3 — promoção resposta → cadastro

`src/lib/actions.ts` [NOVO]:

```ts
promoverRespostaIntake(respostaId): Promise<{ prefill?: Prefill; error?: string }>
```

- coord-only; lê `formulario_respostas` join link join form; mapeia
  campos por `id` conhecido do seed (`nome_civil`→nome, `email`→email,
  `telefone`→whatsapp via `normWhatsapp`, `disponibilidade`→
  `profiles.disponibilidade` shape canônico, `cor_raca`/`genero`/
  `nascimento`→campos de matching `*_pessoal` conforme schema 0034/0038 —
  **a verificar** nomes exatos das colunas de matching em `profiles`).
- Retorna `prefill` → front abre `NovaPessoaDialog` (`role=mentor_dpp`)
  já preenchido — **humano confirma**; nada de auto-insert (auditável,
  evita duplicata: dialog já valida e-mail único).
- Após criar: `formulario_respostas.link_id` — registrar vínculo? As
  respostas ficam anônimas por natureza (link intake não tem
  `dest_profile_id`). Decisão: coluna `promovido_profile_id uuid null`
  em `formulario_respostas` [NOVO] — coord vê "promovido ✓" na grade.
- Termo: ao promover mentor, sugerir emitir `termo-voluntario` (já
  existe) — **decisão: hint no sucesso do dialog** ("Lembre de enviar o
  termo"), não automação; automação é fase 2.

## Passo 4 — leitura (49) + demo + testes

- Grade (49) cobre tipos novos → intake lê sozinha.
- Demo: form intake demo + link público demo + 2 respostas fake —
  promoção retorna `DEMO_MSG`.
- e2e app: abrir `/f/<token-intake>` anônimo → submeter → segunda
  resposta no mesmo link funciona (multi-uso) → coord vê 2 linhas na
  grade → promove uma → dialog com prefill.

## Rollback

Migration aditiva: `multi_uso`/`origem`/`promovido_profile_id` são
colunas novas, trigger é novo, seeds são insert com id fixo — rollback =
delete do seed + drop das colunas (dados de resposta órfãos seriam
perdidos — documentar).
