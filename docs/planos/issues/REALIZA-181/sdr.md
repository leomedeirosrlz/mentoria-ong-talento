# SDR — REALIZA-181 PDM nativo

Metas e submetas são **autorrelato de vida pessoal de jovens, em sua maioria
menores** (estudo, família, saúde, amoroso — as 16 áreas da Roda). LGPD é
linha de frente, não detalhe (regra do `_contexto-agentes.md`).

## Modelo de ameaças

| Ameaça | Vetor | Mitigação |
|---|---|---|
| Mentor de outra dupla lê/edita PDM | `pdm_da_dupla(outra_dupla)` ou write RPC com `p_dupla_id` alheio | Scope check **dentro** de cada RPC definer (`d.mentor_id = my_profile_id()` para escrita; mesma régua de `instrumentos_da_dupla` pra leitura) + policy `pdm_select` como última linha. Cross-dupla → `raise exception`. |
| Mentorado acessa PDM de outro jovem | mesmo vetor | `d.mentorado_id = my_mentorado_id()` (`0066`) — o helper resolve o mentorado do JWT; não confia em id passado pelo cliente. |
| Jovem edita PDM de dupla encerrada | write RPC | gate `status in ('ativa','pausada')` — documento congela no rito. |
| Item cross-PDM (mover nó pra outro plano) | `pdm_salvar_item` com `p_parent_id` de outro `pdm_id` | RPC valida `parent.pdm_id = pdm da dupla`; sem validação no client. |
| Ciclo na árvore | re-parenting | Impossível por desenho: `parent_id` só se define no insert; não há RPC de mudança de pai. |
| Token público `/f/[token]` | a projeção roda via `submeter_resposta_formulario` (definer) | O token só escreve `formulario_respostas` + projeção determinística por slot — não toca itens manuais, nunca deleta (ausente→`descartada`). Um token vazado estraga a *resposta* dele, não o documento. |
| Escalada anon → tabela | PostgREST direto | Zero grants de tabela pra `anon`; `authenticated` só `select` via policy — toda escrita é RPC. |
| Enumeração de `pdm_id`/`dupla_id` | brute-force uuid | RPCs checam escopo **antes** de devolver — resposta uniforme `raise exception 'sem permissão'` (não vaza existência). |

## LGPD / menores

- **Minimização:** os campos são os do guia (titulo, porque, indicador, área,
  prazo) — nenhum dado civil, contato ou `*_pessoal` entra no modelo. Conteúdo
  sensível livre fica no texto que a própria jovem escreve.
- **Base/autorização:** mentorado <18 já tem `autorizacao-responsavel` no rito
  de entrada (`documento_templates`, `0033`/`0046`) — cobre a participação no
  programa e seus instrumentos. Pendência jurídica pré-existente
  (`atividades-interativas.md` §7.10: cobre autorrelato específico?) —
  **não bloqueia** o modelo (os instrumentos já coletam isso hoje via form),
  mas fica registrada pra revisão do termo junto ao cluster D (33/53/65).
- **Quem vê o quê (decisão registrada, sdd D7):**
  - coordenação: **lê conteúdo completo** — convenção atual de
    `instrumentos_da_dupla` (`0080`) e regra 4 ("coord vê tudo de conteúdo").
    É operação legítima (acompanhamento do programa); agregados pra
    relatórios continuam possíveis sem leitura nominal.
  - supervisor da dupla: lê como mentor (regra 4) — **leitura, nunca escrita**.
  - mentor_especialista / mentor de outra dupla / auxiliar turma: **nada**.
  - público (`anon`): nada — nem a resposta do form sai sem token.
- **Retenção:** PDM é dado da jornada — segue o ciclo de vida da `duplas`
  (delete cascade junto). Nenhuma cópia fora (o `formulario_respostas` de
  origem é o snapshot; não duplicar em storage/arquivo).
- **Snapshot no encerramento:** `resumo_jornada` (texto gerado,
  `actions-encerramento.ts:168`) passa a citar metas atingidas — conteúdo do
  PDM vai parar num snapshot histórico da dupla. Legítimo (é o relatório do
  guia), mas registrado: quem apaga `pdm` não reescreve snapshots antigos —
  mesma regra de `formulario_respostas`.

## RLS detalhada

```sql
-- pdm / pdm_itens: SELECT apenas, idêntico escopo de instrumentos_da_dupla
my_role() = 'coordenacao'
or dupla.mentor_id = my_profile_id()
or dupla.supervisor_id = my_profile_id()
or dupla.mentorado_id = my_mentorado_id()
```

- Sem `insert`/`update`/`delete` policies e sem grants de escrita — RPCs
  definer são o único caminho (padrão `chamados`/`login_handoffs`).
- RPCs de escrita: gate = mentor **ou** mentorado da própria dupla (a
  co-edição) ∧ trilha DPP ∧ dupla viva. `pdm_da_dupla`: gate = a régua do
  select acima.
- `pdm_projeta_resposta`: `revoke all … from public, anon, authenticated` —
  só callable por dentro de `submeter_resposta_formulario`/backfill.

## Auditoria e observabilidade

- **Procedência por item:** `origem` (`manual`|`metas`|`pdm`|`visao`) +
  `origem_campo` + `created_by` — dá pra responder "de onde veio essa meta"
  sem tabela de auditoria. Suficiente pro escopo (documento co-editado pela
  dupla, não registro clínico).
- **`updated_at`/`created_at`** por item e no `pdm` — linha do tempo mínima.
- **Sem tabela de histórico de versões na v1** — decisão consciente: o diff
  completo de co-edição não é requisito do guia e dobra o custo; o snapshot
  das rodadas (`formulario_respostas`) já guarda os marcos formais. Se o
  uso real pedir "quem mudou o quê", candidato natural é `pdm_item_eventos`
  — fora de escopo, registrado.
- **Notificações:** nenhuma na v1 (a ficha mostra `updated_at`; avisar o
  outro lado a cada edição vira ruído — se necessário, `pdm_atualizado` é o
  tipo candidato, vocabulário `notificacoes_tipo_check`).
- Sentry: conteúdo de item **nunca** em breadcrumb/context — respeitar
  `src/lib/sentry-scrub.ts` (títulos de meta são PII em potencial).

## Rate limiting

- RPCs autenticadas escopadas à própria dupla — o blast radius de abuso é o
  próprio PDM do chamador; não justifica rate limit além do que o PostgREST/
  Supabase já dá. Revisitar se aparecer escrita em lote (IA, 178/180).
- Projeção via token público: `submeter_resposta_formulario` já é one-shot
  (`usado_em`) — o token morre no primeiro submit; a projeção não abre
  superfície nova de escrita pública.

## Verificações obrigatórias antes de mergear

1. REST contra staging: `select pdm_itens` como mentor de outra dupla → 0
   rows; `pdm_da_dupla(outra)` → `raise`; `pdm_salvar_item` cross-dupla →
   `raise`; como `anon` → `permission denied`.
2. Jovem logada só vê/edita o próprio (JWT `mentorado` → `my_mentorado_id()`).
3. Dupla encerrada: write RPC → `raise`; select segue legível.
4. Trigger cap: 11ª meta raiz → `raise`; 21ª submeta → `raise`.
