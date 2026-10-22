# REALIZA-37 — sdr.md (segurança, dados, riscos)

## Classificação

**Integração com terceiro + dado pessoal (endereço de menor/voluntário).**
O dado que sai pra fora é **somente o CEP** (8 dígitos), enviado do
**nosso servidor** — o IP do usuário (jovem/responsável no token público)
não é exposto ao ViaCEP. Retorno: endereço público de base postal, sem
dado pessoal nosso de volta.

## Controles

| Superfície | Controle |
|---|---|
| `buscarCep` (server action pública) | Input regex `\d{8}` rejeita tudo mais; sem acesso a banco — nada a vazar por ela |
| Egress | `fetch` com `AbortSignal.timeout(5s)` + `revalidate 86400` — menos chamadas, sem pendurar request |
| Dado pessoal | ViaCEP recebe só CEP; `dados_civis` continua coord-only (`*_pessoal`) — o autofill escreve no client, a persistência é a de hoje |
| Demo | Sem rede externa: fixture interna quando `demoRole()` |
| Autoridade | `parseCivis` (actions.ts:288-340) continua validando — ViaCEP é sugestão, nunca bypass |

## Riscos

1. **ViaCEP indisponível/lento** → estado `falha`, formulário segue
   manual (nunca bloqueia). Timeout 5s.
2. **Abuso da action pública** (rate de CEPs): sem auth → qualquer um
   chama. Mitigação natural: `revalidate 86400` por CEP (cache PostgREST/Next),
   ViaCEP é o rate-limit real deles; se virar problema → throttle por IP
   depois (fora de escopo agora; CEP brute-force tem valor baixo).
3. **Resposta envenenada** (ViaCEP comprometido): `parseViaCep` whitelista
   4 chaves string e trunca tamanho; `parseCivis` revalida no submit —
   nada executa (campos de texto).
4. **CEP de outra pessoa** no form do token público: usuário digita o CEP
   que quiser — já podia escrever o endereço que quisesse; sem vazamento
   (a resposta é dado postal público).
5. **Divergência autofill×edição**: o salvo é o input final — sem risco.

## Dados / LGPD

- Endereço de menores continua em `dados_civis` (coord-only); nenhum
  transporte novo além do CEP → ViaCEP (HTTPS, GET público).
- Registrar no doc: "endereço pode ser sugerido por serviço de CEP
  (ViaCEP) — apenas o CEP sai; nada do titular é enviado".
