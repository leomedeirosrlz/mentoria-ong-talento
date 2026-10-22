# Cluster E — inventário de produção (`docs/planos/issues/`)

Escopo: forms/intake, anexos/evidências, grade de respostas,
primeiro-acesso e issues já entregues adjacentes. Vereditos do
`_recon/issues-status.md` + leitura direta de código/migrations.

## FEITO — evidência auditada (README apenas)

| Issue | Tema | Evidência-chave |
|---|---|---|
| `REALIZA-63/` | Encerramento do ciclo (checklist + resumo) | `0037_encerramentos.sql`, `EncerramentoDupla`, `resumo-jornada.tsx`, `0102` auto-close |
| `REALIZA-147/` | Avaliação do especialista pela dupla | `0104_avaliacao_especialista.sql` (seed sistema + emissão automática + `avaliacao_esp_da_dupla`) |
| `REALIZA-72/` | Identidade de papel no shell + onboarding | `app-shell.tsx` (`papelCurto`/`papelLabel`), `onboarding-flow.tsx` `RECURSOS` por papel |
| `REALIZA-40/` | `/duplas` para não-coordenação | `duplas/page.tsx` (~L20-55) visões por papel + `getMinhasDuplas`/RLS |

## PARCIAL — plano só do restante

| Issue | Falta | Tier | Docs |
|---|---|---|---|
| `REALIZA-36/` | Tipos `arquivo`, `grid_disponibilidade`, `visible_if`, "Outro" livre (10 tipos existem; `secao` já é divisor) | A | README · plan · sdd · design · sdr · acceptance |
| `REALIZA-144/` | Wizard: seções → etapas com progresso/transições — **instrumentos primeiro** (escopo do issue), genérico junto | A | README · plan · sdd · design · sdr · acceptance |
| `REALIZA-66/` | Compressão canvas→WebP client-side (caps/buckets/signed URLs já existem) | B | README · plan · design · acceptance |

## ABERTO — plano completo

| Issue | Tema | Tier | Docs |
|---|---|---|---|
| `REALIZA-49/` | Grade respondente×campo nas respostas (reusa `RelatorioCanvas`, ≠ relatório) | A | README · plan · sdd · design · sdr · acceptance |
| `REALIZA-35/` | Primeiro acesso: identidade no link + ação p/ não-cadastrado + deliverability | B+ | README · plan · design · sdr · acceptance |
| `REALIZA-70/` | Template sistema "Matching de Mentores" (~26 campos) + link intake multi-uso | A | README · plan · sdd · design · sdr · acceptance |
| `REALIZA-69/` | Template sistema "Matching de Mentorados" (~17, leve) | B | README · plan · acceptance (sdd/design/sdr compartilhados com 70) |

## Grafo de dependências

```
36 (tipos novos) ──► 70 (mentores: arquivo+grid+visible_if+outro)
                ──► 69 (mentorados: arquivo+outro)
                ──► 49 (grade renderiza tipos novos)
                ──► 66 (campo arquivo herda compressão)
70 (link multi_uso) ──► 69 (reusa mecanismo)
144 (wizard) depois de 36 — mesmos arquivos (formulario-publico/use-resposta)
49 forte par de 69/70 (intake se lê em grade)
35, 66 ortogonais
```

Ordem sugerida de merge: **36 → 66 → (49 ∥ 144) → 70 → 69 → 35**.

## Blockers / pendências de usuário

1. **REALIZA-70**: grid de disponibilidade 1× ou 2× no form real?
   (`forms-google-mapeamento.md` §Pendente — provável artefato de cópia;
   assumido 1×).
2. **REALIZA-35**: SPF/DKIM/DMARC + From-name "Realiza.vc" no
   Supabase/Resend = **ops do Thiago** (checklist no `plan.md` Frente C2).
3. **REALIZA-36**: shape exata de `disponibilidade_ok` (`0034`/`0100`) —
   fixar o payload do grid igual (marcado `a verificar` nos docs).
4. Migrations propostas: `0106` (36: anexos+sanitizer), `0107` (70:
   multi_uso+seed mentores), `0108` (69: seed mentorados), `010N` (35:
   handoff+solicitar_acesso) — números a confirmar na hora (última real:
   `0105`).

## Convenções aplicadas

- Nada inventado: todo artefato novo marcado `[NOVO]`; toda suposição
  marcada `a verificar` com o arquivo onde conferir.
- Anon sem grants (RPC definer é a porta) preservado; `security definer`
  explícito; RLS `my_role()`/`my_profile_id()`; actions `{error}`/`{ok}`;
  copy pt-BR; demo counterpart em todo issue visível.
