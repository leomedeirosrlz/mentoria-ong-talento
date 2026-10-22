# REALIZA-167 — security & data review (leve)

## Superfície

- `relatorio_links`: slugs públicos + turma dona — metadado, sem PII além do
  `criado_por`.
- `turma_inscricoes`: vínculo pessoa↔turma — referência a menor (`mentorado_id`)
  sem atributos novos (só turma+papel+status+nota curta).
- `/resumo/[slug]` deixa de ter gate por constante e passa a validar contra a
  tabela — via `createAdminClient` server-side (a página já o usa hoje).

## Ameaças e mitigações

| Ameaça | Mitigação |
|---|---|
| Anon enumera slugs/turmas lendo a tabela | `revoke all from public, anon`; nenhuma policy pra anon — a validação do slug roda como service role dentro do server component. Resposta 404 idêntica pra slug inexistente e revogado. |
| `turma_inscricoes` lê quem é mentorado de qual turma | Select coord-only v1 (a fila é instrumento da coord — mesmo escopo do relatório interno). Se supervisor precisar ver a fila das supervisionadas, follow-up amplia a policy — não agora. |
| Inscrição forjada via REST | Insert/update/delete policy `my_role()='coordenacao'` — único papel com grant. |
| Slug curto/previsível | Default `gen_random_bytes(18)` → ~108 bits; CHECK de formato `^[A-Za-z0-9_-]{16,128}$` barra slug manual fraco ("t3"). |
| `nota` com PII | Campo livre ≤300 — recomendação no comentário da coluna: "nota operacional, sem dado sensível" (mesmo cuidado do `observacao` interno). |
| Ponte 47 vira lock-in | Coluna `turma` text é o bridge pro `turmas.id` futuro — decisão deliberada (sdd §5), não acidente. |

## LGPD

- Sem categoria nova de dado: turma de um mentorado já é inferível por
  `duplas.turma`/`form_bruto`; a inscrição só o explicita antes do matching.
- `nota` — orientar uso operacional ("preferiu manhã"), não clínico.
- Retenção: cascata com `profile_id`/`mentorado_id` deletados.
- O log de acessos (183) segue por slug — a tabela de links não muda o que é
  auditado.

## Checklist

- Grants/revokes explícitos + RLS coord-only
- CHECKs: formato de slug, XOR pessoa, coerência papel×coluna, status fechado
- Seed com ids reais do código (verbatim relatorio.ts)
- `/resumo` mantém `noindex` + 404 neutro
