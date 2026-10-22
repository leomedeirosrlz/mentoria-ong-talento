# REALIZA-38 — Perfil canônico rico: endereço completo + máximo de dados na pessoa

**Jira:** REALIZA-38 · **Tier:** A (veredito FEITO — README de evidência) · **Status:** entregue, fechar no Jira

## Veredito

**FEITO.** A decisão registrada na issue (endereço completo no cadastro,
`dados_civis` coord-only como repositório canônico) está implementada.

## Evidências

- **Schema:** `profiles.dados_civis` e `mentorados.dados_civis`/`responsavel`
  jsonb — `supabase/migrations/0046_dados_civis.sql`; views coord-only
  `profiles_pessoal`/`mentorados_pessoal` ganharam a coluna na mesma migration.
- **Tipo canônico:** `DadosCivis`/`Endereco` com
  `logradouro/numero/complemento/bairro/cep/cidade/uf` —
  `src/lib/types.ts:896-915`.
- **Termos leem do perfil (não pedem de novo):** `assinatura-form.tsx`
  (`DadosCivisFields` com `defaults` = prefill; `AssinaturaForm` `:263`) e o
  sync-back ao assinar (`assinar_termo`/`assinar_com_token`, 0053/0059 —
  self-declared é a fonte mais fresca).
- **Intake escreve o canônico:** `importar.ts:686-702` (parse CSV Forms) e
  `parseCivis` em `src/lib/actions.ts:288-340` (valida CPF/CEP, não grava
  esqueleto vazio) — usado por `createPessoa`/`updatePessoa`/`createMentorado`/
  `updateMentorado` e `importPessoas`/`importMentorados`.
- **Cadastro expõe os campos:** `pessoas-dialogs.tsx:262,409,424`,
  `pessoa-actions.tsx:373`, `mentorado-actions.tsx:215,235`.
- **LGPD:** `dados_civis` fora do grant por coluna — leitura só via views
  `*_pessoal` (coord-only) ou `meus_dados_civis()` (self, RPC definer 0046).

## Restos conhecidos

- ViaCEP pra autocompletar o endereço = **REALIZA-37** (aberta, cluster M).
- Migrações futuras de dados (princípio "máximo no perfil") seguem pelo mesmo
  caminho — sem débito aberto.

## Esforço

N/A — encerrar.
