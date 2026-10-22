# REALIZA-37 — acceptance.md

## Critérios executáveis

1. **Happy path (demo, determinístico)**
   - `/demo` coord → `/pessoas` → Nova pessoa → digitar CEP válido →
     logradouro/bairro preenchem com o fixture; campos editáveis após;
     submit salva os valores **editados** (não os do fixture) — assert em
     `dados_civis` no fixture não muda, mas o fluxo de digitação+save é o
     assert do dialog.
2. **Estados**
   - CEP válido inexistente (ex.: 99999999 no real; em demo o fixture
     responde ok — pra `nao_encontrado` testar via unit `parseViaCep` e,
     em staging real, CEP inexistente) → hint correto, form editável.
   - ViaCEP down → hint de falha, form editável (manual QA/REST).
   - CEP com letra/incompleto → action não é chamada (só 8 dígitos).
3. **Controlado × defaultValue**
   - Editar pessoa com `dados_civis` já salvos → campos abrem
     preenchidos; mudar o CEP dispara nova busca e reescreve; salvar
     persiste tudo (regressão do prefill).
   - `compacto` não cria inputs cidade/uf — assert DOM.
4. **Edição vence**
   - Autofill → usuário altera logradouro → submit salva o digitado.
   - Busca A em andamento, usuário muda pra CEP B → resposta de A não
     sobrescreve (assert com dois CEPs válidos em demo — fixture pode
     variar por CEP pra testar; senão unit-test do guard).
5. **Token público**
   - `/assinar/[token]` (responsável): CEP autocompleta igual — action
     funciona sem sessão (REST/e2e app em staging com fixture de link).
6. **Soberania server-side**
   - Forçar CEP inválido via devtools → submit ainda rejeita com a
     mensagem de `parseCivis` (o autofill não é caminho de validação).
7. **Acessibilidade**
   - Status anunciado (`aria-live`); spinner tem sr-only; Tab passa por
     todos os campos na ordem visual.
8. **Gates**
   - `npx tsc --noEmit` · `npx eslint src/` · `pnpm test` com
     `viacep.test.ts` · e2e demo spec novo (autofill no dialog de pessoa)
     · e2e app no preview (um assert de digitação+save tolerante a rede —
     marcar `test.slow()` ou fixar CEP real conhecido, ex.: 01310-100
     Av. Paulista) · 1 revisor (Tier B).

## Não-escopo

- ViaCEP fora do bloco `dados_civis` (cidade/uf simples da ficha).
- Obrigatoriedade nova de CEP/endereço.
- Persistir o "raw" do ViaCEP.
