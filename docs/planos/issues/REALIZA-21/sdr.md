# REALIZA-21 — Security & data review

`encontro_intencoes` guarda texto livre curto **escrito pelo mentor sobre a
dupla** — conteúdo operacional que pode mencionar o mentorado (menor).
Mesma classe de dado de `encontro_notas` (0015): não é `*_pessoal`
(coord-only) nem `dados_civis`, mas é dado interno de menor — LGPD manda
mínimo + escopo fechado.

## Superfície de ataque

| Vetor | Avaliação |
|---|---|
| Leitura indevida pelo mentorado | **Fechada por omissão**: nenhuma policy, view `jovem_*` ou RPC expõe a tabela — igual a `encontro_notas`. A policy `select` lista coord/mentor/sup explicitamente, sem ramo `mentorado`. |
| Escrita por não-mentor | A policy `for all` exige `coordenacao` ou `duplas.mentor_id = my_profile_id()`; a action adiciona `temPapel(mentor_dpp|mentor_especialista)` + `dupla.status='ativa'`. Supervisor lê mas não escreve (mesmo contrato da nota). |
| Escrita em dupla de outro mentor | `with check` da policy faz o join em `duplas` — forjar `dupla_id` alheio falha na policy. |
| `numero` fora do teto | A action mede o teto no `cronograma_id` **da dupla** (não global — lição da 0061); a coluna é `smallint`, então absurdos não gravam. |
| XSS via `texto` | React escapa por padrão; 280 chars cap na CHECK; sem `dangerouslySetInnerHTML`. |
| `anon`/público | Zero grants pra `anon` (padrão do schema); nenhuma rota pública (`/f`, `/t`, `/avaliar`, `/assinar`) lê a tabela. |
| Demo | `client-stub` só existe no bundle demo; fixtures usam mentorados fictícios (`de000000-*`). |

## LGPD / minimização

- **Finalidade**: preparo operacional do encontro pelo mentor — legítimo
  dentro do contrato de mentoria (mesma base da nota/registro).
- **Mínimo**: 280 chars por item desencoraja despejo de prontuário; não há
  campo estruturado de dado pessoal — é texto operacional, igual à nota.
- **Retenção**: `on delete cascade` de `duplas` — a intenção morre com a dupla.
  Sem expurgo próprio: segue o ciclo de vida do dossiê da dupla (qualquer
  decisão de retenção da 33 — revisão LGPD estrutural — cobre esta tabela
  automaticamente por estar pendurada em `duplas`).
- **Acesso a agregado**: o aviso da Minha agenda leva só contagem + nº mais
  antigo — nenhum texto de intenção sai da ficha pro rail/aviso (o texto fica
  onde sempre esteve).
- **Não entra em export/relatório** nesta versão — se `api/export` um dia
  incluir, a regra de `*_pessoal` deve ser revisitada (hoje a tabela não é
  sensível no nível coord-only; o mentor já lê tudo que escreveu).

## Auditoria

- `created_by` + `created_at`/`updated_at` + `feito_em` cobrem "quem criou /
  quando mexeu / quando fechou". Sem log append-only — a checklist é volátil
  por natureza (não é registro oficial; diferente de `encontro_reagendamentos`
  da REALIZA-26).
- Sem rate limit próprio: as actions são writes autenticados pequenos sob a
  mesma proteção das demais (abuso exigiria sessão válida de mentor; o cap de
  280 chars limita a blast radius).

## Ameaças residuais aceitas

- Coord escrevendo na dupla de terceiro: permitido pela policy (mesmo desenho
  de `encontro_notas`) — é poder de coordenação já concedido no domínio, e a
  action não expõe o caminho pra ela (UI read-only pra coord).
- Texto com dado sensível do menor digitado pelo mentor: mitigado por
  convenção (a nota livre já permite o mesmo) — não há enforcement técnico;
  documentado pra revisão LGPD estrutural (REALIZA-33) agregar se quiser
  regra de conteúdo.
