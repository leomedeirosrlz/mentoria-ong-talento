# REALIZA-159 — sdr.md (segurança, dados, riscos)

## Classificação

**Escalada de privilégio + dados de (ex-)menor.** A pessoa promovida passa
a ler dados de outras pessoas (mentor vê jovens da sua dupla; especialista
vê pedidos). É a operação mais sensível do cluster — todo o peso fica em
(1) elegibilidade estrita, (2) atomicidade, (3) rastro.

## Controles

| Superfície | Controle |
|---|---|
| RPC `promover_mentorado_mentor` | `security definer`, `search_path=''`, guard `my_role()='coordenacao'`, grants padrão `rematch_dupla` |
| Elegibilidade | `situacao='concluido'` + sem dupla viva — re-cheque no SQL (não confiar na UI) |
| Papel alvo | whitelist `'mentor_dpp'/'mentor_especialista'` — nunca `coordenacao`/`supervisor` por este caminho |
| Identidade | `profile_id` unique — impossível ligar 2 mentorados ao mesmo profile; a criação usa o email do mentorado (colisão → erro) |
| Rastro | `pessoa_notas` vinculada nos dois lados + `created_by = my_profile_id()` — quem promoveu fica registrado |
| Dados pessoais | `dados_civis` copiado profile-novo / merge-só-vazios no existente — sem sobrescrever declaração mais recente |
| Sessão ativa | se o ex-jovem estiver logado quando promovido: `my_role()` muda no próximo request (lê `profiles.role` por token? — `my_role()` lê a linha atual a cada query; o JWT/claims do middleware podem cachear papel? **conferir**: `auth.getClaims()` é usado pra validar JWT — papel lido do banco por query, então o corte é imediato nas superfícies com RLS; a rota `/jovem` redireciona no próximo load). Documentar no e2e. |
| Consentimento | a promoção é decisão da coordenação; a assinatura do `termo-voluntario` é o consentimento formal — microcopy do dialog lembra (não bloqueia a promoção: operação do programa, não gate técnico). |
| LGPD | ex-menor vira adulto-staff: minimização mantida — ele só vê o que o papel mentor enxerga (RLS existente); `dados_civis` segue coord-only via `profiles_pessoal`. |

## Riscos

1. **E-mail errado/no mentorado** → profile pré-cadastrado nunca vincula
   (magic link vai pro e-mail errado). Mitigação: erro claro sem e-mail;
   a ficha da pessoa mostra user_id vazio até vincular (já existe esse
   estado pra qualquer pré-cadastro).
2. **Promover quem voltará como jovem** (reingresso no ciclo seguinte) —
   o modelo suporta? `profile_papeis` é multi-papel por escopo/turma:
   readmitir como mentorado depois exigiria papel `mentorado` de volta —
   fora de escopo; se ocorrer na operação, é fluxo manual novo
   (documentar como limitação conhecida, não blocker).
3. **`my_mentorado_id()` em policies de staff**: se alguma policy usa
   `my_mentorado_id()` pra algo além das views jovem (ex.: filtrar "o
   jovem que fui"), o promovido poderia ver dados do próprio histórico
   como staff — **auditar `grep my_mentorado_id` nas migrations** antes
   de codar; o esperado é que só views `jovem_*` usem, e elas já exigem
   `my_role()='mentorado'`.
4. **Notas/notificações duplicadas**: insert único por chamada; idempotência
   de UI pelo disabled-during-transition.

## Auditoria

- `pessoa_notas` = rastro visível na ficha (padrão do codebase — sem
  `audit_log` genérico).
- Sucesso retorna `profile_id` — a action loga `revalidatePath` + toast;
  quem auditou acha a nota com `created_by`.

## Demo

Write bloqueado (`DEMO_MSG`); o dialog e a copy demonstram o fluxo sem
efeito. Fixture opcional: 1 mentorado `concluido` no dataset demo pra
linha renderizar o item (dataset já tem "fora do programa" — confirmar;
se só tem desistente, adicionar um concluído sintético).
