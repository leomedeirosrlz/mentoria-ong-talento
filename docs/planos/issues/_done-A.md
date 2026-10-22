# Cluster A — "Agenda do mentor" — inventário de planejamento

Todas as issues do cluster auditadas e documentadas. A telinha de dupla é a
tela de trabalho do mentor — o cluster cobre o que falta pra agenda/ações/
contexto ficarem estáveis nela.

## Inventário

| Issue | Veredito | Escopo restante | Documentos |
|---|---|---|---|
| [REALIZA-21](REALIZA-21/README.md) | ABERTO | `[NOVO] encontro_intencoes` (checklist privada do mentor por encontro) + UI na ficha + aviso na Minha agenda | README · plan · sdd · design · sdr · acceptance |
| [REALIZA-22](REALIZA-22/README.md) | PARCIAL | Agendar fora do "Mais" quando `pendenteRegistro` + microcopy "oficial = sugestão" em `/agenda` | README · plan · design · acceptance |
| [REALIZA-26](REALIZA-26/README.md) | ABERTO | `[NOVO] encontro_reagendamentos` append-only via trigger em `encontros` + histórico no detalhe | README · plan · sdd · design · sdr · acceptance |
| [REALIZA-62](REALIZA-62/README.md) | ABERTO | Convenção de placeholder de prazo nulo (o literal `a partir de —` já não existe — padronização preventiva) | README · plan · design · acceptance |
| [REALIZA-27](REALIZA-27/README.md) | FEITO | — | README (evidência) |
| [REALIZA-28](REALIZA-28/README.md) | FEITO | — | README (evidência) |
| [REALIZA-61](REALIZA-61/README.md) | FEITO | — | README (evidência) |
| [REALIZA-64](REALIZA-64/README.md) | FEITO | — | README (evidência) |
| [REALIZA-96](REALIZA-96/README.md) | DUPE → 21 | — | README (fecha no Jira) |
| [REALIZA-97](REALIZA-97/README.md) | DUPE → 22 | — | README (fecha no Jira) |

## Ordem sugerida de implementação

1. **REALIZA-22** (PP, UI pura) — destrava o débito visível mais barato.
2. **REALIZA-62** (PP, convenção) — sweep + comentário; provável zero mudança
   de runtime.
3. **REALIZA-26** (M, migration+trigger+UI) — append-only; a decisão
   trigger-vs-action está resolvida no sdd (trigger cobre action + RPC +
   PATCH + SQL sem duplicar).
4. **REALIZA-21** (M, migration+UI) — `encontro_intencoes`; a decisão
   nova-tabela-vs-extender-`encaminhamentos` está resolvida no sdd (nova
   tabela — intenções são privadas do mentor, encaminhamentos são bilaterais
   e jovem-visíveis).

Nenhuma dependência entre as quatro — podem ir em paralelo ou na ordem
acima por tamanho.

## Decisões arquiteturais que atravessam o cluster

- **Chave `(dupla_id, numero)`, não `encontro_id`** — `encontros` é
  `unique(dupla_id,numero)` e a row pode ser deletada (0072 desmarca via
  DELETE). Intenções (21) e histórico de reagendamento (26) usam a mesma
  chave de `encontro_notas`: pertencem ao **nº do guia**, sobrevivem a
  remarcação/desmarcação.
- **Append-only via trigger** (26) — a única forma de cobrir action + RPC do
  jovem + PATCH direto + SQL manual de uma vez, sem duplicar lógica nem
  depender de disciplina de quem escreve.
- **Privacidade por omissão de policy** — intenções (21) e histórico (26)
  não têm ramo `mentorado` na policy de leitura: o jovem não lê dado
  operacional interno do mentor. Se surgir necessidade de transparência, é
  uma policy a mais — as tabelas estão modeladas pra isso.
- **Convenção > abstração** (62) — a regra de placeholder de prazo fica
  escrita no código; helper só se uma superfície "prazo é o ponto" surgir.

## Bloqueios / pendências fora do cluster

- Nenhuma migration foi aplicada — os `plan.md` das issues 21 e 26 incluem o
  passo "aplicar no staging antes do push" (schema-contract CI).
- REALIZA-97/96 precisam ser fechadas **no Jira** (não há ação no repo além
  dos READMEs).
