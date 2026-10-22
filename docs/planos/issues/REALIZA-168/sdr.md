# REALIZA-168 — security & data review (leve)

## Superfície

- `registro_lembretes`: ledger `(encontro_id, marco)` — metadado de
  automação, sem PII além da referência.
- `processar_lembretes_registro`: RPC definer de varredura — lê
  `encontros`/`registros`/`duplas`, escreve ledger + `notificacoes`. Sem
  input de usuário (só `p_hoje` opcional, service-role only).
- Notificação contém nome do mentorado no corpo — vai só pro mentor da
  própria dupla (mesmo escopo da ficha dele).
- `importar_registros` com `p_somente_ausentes` — altera o comportamento
  de update pra skip; reduz (não aumenta) superfície de escrita.

## Ameaças e mitigações

| Ameaça | Mitigação |
|---|---|
| Job dispara flood de pings | Ledger `unique(encontro_id, marco)` + `on conflict do nothing` — fire-once estrutural. Máx. 2 pings/encontro ever. |
| RPC executável por authenticated via REST | `revoke ... from public, anon, authenticated` — só service role (handler). |
| Notificação vaza nome de menor | Destinatário = `dupla.mentor_id` apenas; RLS do sino restringe a leitura ao profile_id dono. Coord não recebe (já tem a fila `registro_pendente` no radar). |
| Import tardio pisa em registro nativo | `p_somente_ausentes=true` no último import → registro existente vira skip; `precisa_apoio` nunca é tocado pela RPC (0082 por desenho). |
| Mentor burla autoria escrevendo como outro | Fora de escopo do job — `guard_autoria`/`salvarRegistro` existentes governam o write nativo; o job não escreve `registros` nunca. |
| `p_hoje` forjado | Mesma análise da 169: só service role executa — parâmetro é pra teste, não vetor. |
| Deep-link `#` no href da notificação | CHECK `^/[^/\\]` aceita (fragmento é dentro da string); sem open-redirect — o host não vem do banco. |

## LGPD

- Nenhum dado novo coletado — o registro nativo já existia; a mudança é de
  **canal** (Google fora → plataforma dentro), o que **reduz** exposição:
  respostas param de viver no Google Forms (processador externo) e ficam só
  no Supabase.
- Histórico do Google: o Form fica "não aceitando respostas" mas dados
  antigos permanecem no Google — o runbook inclui export+arquivo na Drive
  da ONG e decisão de retenção no Google (apagar respostas lá é opção de
  minimização — registrar como decisão do Thiago).
- `emails_enviados` não muda; e-mail segue gateado por
  `EMAIL_ENVIO_LIBERADO`.

## Checklist

- Grants/revokes explícitos; RPC definer com `search_path`
- Ledger fire-once por constraint; job só lê dados operacionais
- Notificação escopada ao mentor da dupla; href interno validado
- Transição com `p_somente_ausentes` não sobrescreve registro nativo
- Google Form desativado só após último import (sem perda de resposta)
