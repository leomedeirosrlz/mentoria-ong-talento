# REALIZA-183 — security & data review

## Superfície

`/resumo/<slug>` é página pública (proxy libera `/resumo/*`,
`src/lib/supabase/middleware.ts:70-72`) que serve dados de pessoas — incluindo
mentorados menores — via service role. O log criado aqui é a **primeira
telemetria** dessa superfície: antes dele, compartilhar o link era invisível.

## Ameaças e mitigação

| Ameaça | Vetor | Mitigação |
|---|---|---|
| IP cru vaza em dump de banco | `resumo_acessos` lida por coord + service key em envs | IP gravado só como `ip_hash` = SHA-256(`SALT:ip`), salt fora do banco (`RESUMO_ACESSO_SALT`, env server-only). Dump da tabela não re-identifica visitante sem o salt. |
| Dicionário de IPs (IPv4 tem ~2³² valores — hash puro é quebrável) | quem tem banco + salt roda força bruta | Salt é aleatório por ambiente (Vercel env); fallback constante no código é documentado como *menos* seguro — aceitável só em dev/preview. Mitigação parcial reconhecida: SHA-256 não é KDF; o objetivo é minimização (não armazenar dado identificável em repouso), não proteção de credencial. |
| Inflar o log (crawler/bot) | requests repetidos ao slug | Baixo custo real: tabela estreita, índice (slug, em). Sem captcha — o page já é `noindex` e não listado. Poda lazy proposta abaixo. |
| Enumeração de slugs gravada | acesso a slug inexistente vira sinal | **Gate antes do log**: `notFound()` primeiro — slug errado não gera row. O log responde "quem abriu", não "quem tentou adivinhar". |
| UA com dados do client | `user-agent` revela browser/OS | Aceitável e necessário (é justamente o sinal de "foi o celular da diretora ou um bot"). Truncado em 500c. Não é dado sensível de menor — é metadado do visitante. |
| Log como PII por associação | `params` pode carregar query arbitrária | `params` é allowlist `{turma,gran,col}` — query extra não entra. |
| Acesso ao log por papel errado | select policy | `my_role()='coordenacao'` apenas; supervisor não lê (auditoria, não operação). |

## LGPD

- **Base legal:** legítimo interesse de segurança/auditoria do responsável pelo
  dado (a própria Realiza) — o log existe pra proteger justamente o dado de
  menor exposto pelo link.
- **Minimização:** sem IP cru, sem cookies gravados, sem fingerprint além de UA.
  `params` limitado a 3 chaves conhecidas.
- **Retenção:** sem poda nesta issue (tabela nasce vazia; volume estimado
  ínfimo — um link interno). **Proposta registrada** pra 170: quando a RPC de
  abertura varrer `resumo_acessos` pra rate limit, varrer também
  `acessado_em < now() - interval '13 months'` (o molde `login_handoffs` da
  0049 faz a mesma poda lazy por uso).
- **Direito de exclusão:** linhas são pseudonimizadas (hash não reversível sem
  salt+IP conhecido) — não há como atender pedido de eliminação "do meu acesso"
  sem conhecer o IP do titular, o que é compatível com minimização.

## Rate limit

Fora de escopo aqui — a 183 só cria o log. A 170 conta falhas de senha nesta
tabela; por isso o schema já prevê `ip_hash` indexável e `params` flexível (a
170 adiciona `ok`/`motivo` por ALTER — colunas novas, não rewrite).

## Auditoria

O próprio log **é** a auditoria. Leitura fica pra UI de gestão de links da 170
(por link: último acesso, nº de acessos, UAs distintos). Sem UI nesta issue —
consulta manual via SQL/Studio cobre o período intermediário.
