# REALIZA-37 — plan.md

## Estado atual (verificado)

| Ponto | Hoje | Arquivo |
|---|---|---|
| Campos de endereço | `DadosCivisFields` (CEP com `maskCep`, inputs `defaultValue`) | `src/components/assinatura-form.tsx:31-135` |
| Validação | `parseCivis` strip não-dígitos, exige CEP 8 dígitos quando presente | `src/lib/actions.ts:288-340` |
| Máscaras | `maskCep`, `maskCpf`, `cpfValido` | `src/lib/utils.ts` |
| Consumidores do bloco | termos (logado + `/assinar/[token]`), novo-pessoa, editar pessoa, editar mentorado | `pessoas-dialogs.tsx:258-265`, `pessoa-actions.tsx`, `mentorado-actions.tsx` |
| Persistência | `dados_civis` jsonb — sem mudança | `0046_dados_civis.sql` |

## Passos

1. **`src/lib/viacep.ts`** [NOVO] — puro: `type ViaCepResult =
   {kind:'ok'; endereco:{logradouro,bairro,cidade,uf}} | {kind:'nao_encontrado'}
   | {kind:'erro'}` + `parseViaCep(json)` (trata `erro:true`, campos
   faltantes → string vazia) + `cepNormalizado(cep)` (reusa regex de 8
   dígitos). Testável sem rede.
2. **`src/lib/actions-endereco.ts`** [NOVO] — `"use server"` +
   `buscarCep(cep: string)`:
   - `cepNormalizado` inválido → `{kind:'erro'}` (UI nem chama sem 8
     dígitos, mas a action é pública — `/assinar/[token]` — então valida).
   - `demoRole()` → `{kind:'ok', endereco: FIXTURE}` com CEP válido.
   - `fetch("https://viacep.com.br/ws/"+cep+"/json/", {signal:
     AbortSignal.timeout(5000), next:{revalidate:86400}})`;
     `!res.ok`→erro; `json.erro===true`→nao_encontrado; senão
     `parseViaCep`. Nunca lança — union de retorno.
   - Sem auth check: action de leitura externa, nada do nosso banco —
     pública por natureza (mesmo padrão dos RPCs de token).
3. **`DadosCivisFields`** — controlar o sub-bloco endereço:
   `const [end,setEnd] = useState(() => ({logradouro: d?.logradouro ?? '',
   numero:…, complemento:…, bairro:…, cidade:…, uf:…}))` + `const [cep,
   setCep]`; inputs `value`/`onChange` com `name` preservado (o submit é
   `FormData` — os `name`s não podem mudar; `parseCivis` lê
   `<prefix>cep` etc.).
   - Trigger: `onChange` do CEP — quando `maskCep` resultar em 8 dígitos,
     `startTransition(buscarCep)`; também `onBlur` como rede de segurança
     (debounce simples ou guard "já buscado esse CEP").
   - Sucesso: `setEnd(e => ({...e, ...endereco}))` **apenas para campos
     visíveis** — em `compacto`, cidade/uf não renderizam mas continuam
     no state e no `FormData`? **Decisão:** em compacto cidade/uf não
     existem no form (inputs ocultos não existem) — preencher só o que
     renderiza; cidade/uf daquele cadastro seguem dos campos simples da
     ficha (comportamento atual preservado). Assert no e2e.
   - Estados: `status: 'idle'|'buscando'|'ok'|'nao_encontrado'|'falha'`;
     spinner `CircleNotch` dentro do campo CEP; hint com `aria-live=
     "polite"`; "ok" mostra check discreto ou nada (campos já mostram o
     resultado). `nao_encontrado` e `falha` deixam inputs intactos e
     editáveis.
   - **Não bloquear digitação**: durante `buscando`, inputs continuam
     editáveis; se o usuário editar um campo autofillado, o valor dele
     vence (setState onChange normal — a resposta tardia do fetch não
     sobrescreve? guardar o CEP que disparou; se o CEP mudou, ignorar a
     resposta).
   - Prefill existente (`defaults` com CEP já salvo): **não** dispara
     busca automática no mount (o endereço já está declarado; só busca
     quando o CEP muda).
4. **Sem mudanças em** `parseCivis`, dialogs consumidores, masks, tipos.
   O componente interno muda, a assinatura de props (`prefix`, `opcional`,
   `compacto`, `defaults`, `required`) é estável.
5. **Testes** `tests/viacep.test.ts` [NOVO]: parse ok/erro:true/campos
   vazios; `cepNormalizado`. Interação: cobrir por e2e (mock de route
   não é trivial com server action — e2e em demo com fixture cobre o
   caminho feliz; estados de falha podem ser unit-testados extraindo o
   reducer de estado pra `viacep.ts` se quiser — opcional).

## Casos de borda

- CEP 8 dígitos mas inexistente → `nao_encontrado` → hint, inputs livres.
- ViaCEP fora/lento → timeout 5s → `falha` → hint, inputs livres.
- CEP parcial/digitado errado e corrigido → nova busca a cada CEP válido
  completo (cache dedup por CEP).
- Autofill em `compacto` → não inventa inputs de cidade/uf.
- Resposta tardia após CEP editado → descartada (guard por valor).
- `/assinar/[token]` (anon): action funciona sem sessão — nada depende de
  `createClient`.
- Repetido "buscar" no mesmo CEP → sem novo fetch (guard por valor) +
  cache `revalidate` no server.

## Verificação

`npx tsc --noEmit` · `npx eslint src/` · `pnpm test` (novos testes da lib)
· e2e demo: dialog de pessoa preenche com CEP válido e salva · e2e app
(preview/staging, rede real pro ViaCEP — aceitar flakiness: retry ou
mock via `page.route` no `/ws/` do action? server action fetch é
server-side — não mockável por `page.route`; usar o fixture demo pro
assert determinístico e um teste manual/REST no staging pro real).
