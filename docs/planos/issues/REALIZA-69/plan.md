# REALIZA-69 — plan.md

Pré-requisito: REALIZA-36 + REALIZA-70 mergeados (mecânica de link
multi-uso `multi_uso`/`origem='intake'` entregue lá — este plano é o seed
+ a promoção pra `mentorados`).

## Passo 1 — migration `0108_intake_mentorados.sql`

1. `formularios_sistema_check`: adicionar `intake_mentorado` (mesma
   técnica do `0107` — alter do check/function conforme a implementação
   real do guard — `a verificar` se é CHECK constraint ou trigger
   `formularios_sistema_guard`).
2. Seed verbatim (`forms-google-mapeamento.md` §Form 3), ~17 campos:

```jsonc
campos = [
  {"id":"sec_dados","tipo":"secao","label":"Dados pessoais"},
  // nome_civil*, nome_social, nascimento* (data), genero* (mesmas 5 opções),
  // cor_raca* (5 opções + permite_outro), cidade* — idênticos ao do mentor
  {"id":"sec_trajetoria","tipo":"secao","label":"Trajetória"},
  // hobbies*, coisas_que_gosta*, esportes*, auto_descricao*,
  // como_amigos_familia_descreveriam* — todos texto_longo obrigatório
  {"id":"sec_contato","tipo":"secao","label":"Dados de contato"},
  // email*, telefone*
  {"id":"sec_mentoria","tipo":"secao","label":"A mentoria"},
  {"id":"objetivos","tipo":"texto_longo","label":"Objetivos","obrigatorio":true},
  {"id":"pref_genero_mentor","tipo":"select","obrigatorio":true,
   "opcoes":["Mentor homem","Mentor mulher","Sem preferência"]},
  {"id":"curriculo","tipo":"arquivo","label":"Currículo","obrigatorio":true,"max_mb":10}
]
```

3. `sistema='intake_mentorado'`, `ativo=true`.

## Passo 2 — link de intake

Reusa `gerarLinkIntake` do 70 — nenhuma action nova; UI da ficha já cobre
("Link de inscrição" aparece pra qualquer `sistema` intake — garantir que
o check é por `origem`/`multi_uso` ou prefixo `intake_*`, não hardcoded
por valor).

## Passo 3 — promoção resposta → `mentorados`

`promoverRespostaIntake` do 70 precisa do ramo mentorado:

```ts
// dentro da action: se link→form.sistema = 'intake_mentorado'
// → retorna prefill pra MentoradoDialog em vez de NovaPessoaDialog
```

- `mentorados` ≠ `profiles`: **a verificar** colunas (`nome`, `nascimento`,
  `whatsapp`?, `email`? — se contato não existe em mentorados, vai pro
  responsável/observação — mapear só o que a tabela tem, o resto fica na
  resposta consultável).
- `promovido_profile_id` não serve (FK profiles) — **decisão**: generalizar
  pra `promovido_ref jsonb {tabela,id}` ou segunda coluna
  `promovido_mentorado_id uuid references mentorados(id)` [preferido —
  FK tipada]; `num_nonnulls(promovido_profile_id, promovido_mentorado_id)
  <= 1` check.
- Disponibilidade do mentorado: **não vem deste form** (oficial não
  pede) — não inventar campo; entra por outro canal (perfil do mentorado
  na plataforma ou cadastro manual).

## Passo 4 — demo/testes

- Demo: form mentorados demo + 1 resposta.
- e2e: submit → grade → promover a mentorado (prefill abre o dialog de
  mentorado, não o de pessoa).
