# Lacunas e riscos — registro da revisão LGPD

> Achados da revisão estrutural (REALIZA-33) + revisão de segurança
> consolidada (`docs/planos/issues/_reviews/seguranca.md`). Cada item tem
> estado e dono. **Vivo** — atualizar quando o estado mudar.
>
> Estado: `aberto` · `em revisão` · `mitigado` · `aceito` (risco assumido
> por decisão) · `fechado`.

## Registro

| # | Lacuna / risco | Evidência | Severidade | Estado | Dono |
|---|---|---|---|---|---|
| L-1 | **Terceiros sem consentimento** — `terceiros_contatos` guarda nome+WhatsApp de amigos/familiares do jovem que nunca consentiram; sem aviso, sem caminho de exclusão a pedido | `0103_avaliacao_terceiros.sql`; decisao.md gap 3 | alta | **aberto** — mitigação barata proposta: aviso no convite + cobertura no termo do jovem (revisão §5) + exclusão a pedido | Thiago/jurídico + dev |
| L-2 | **Dados sensíveis de menor sem base legal específica** — Roda da Vida coleta saúde/equilíbrio emocional/espiritualidade/relação afetiva; cor/raça e anamnese idem; cláusula 2.1 do rascunho não os menciona | `0080:639-657`; `texto.ts:119-122` | alta | **em revisão jurídica** — item §5 de `base-legal.md` | Thiago/jurídico |
| L-3 | **`mentorados.notas` legível por mentor/supervisor** — notas livres da coord (potencialmente sensíveis) estão no grant de coluna lido pela dupla | `0034:194` | média | **aberto** — pergunta em aberto no `decisao.md`: volta a coord-only (`*_pessoal`)? | Thiago (decisão) → dev |
| L-4 | **`comprovante_bancario`** é tipo aceito de `documentos_pessoa` — dado bancário de menor/responsável, provavelmente desnecessário | `0054:129` | média | **aberto** — minimização: remover do enum ou justificar | Thiago (decisão) → dev |
| L-5 | **Bucket `avatares` público com foto de menor** — qualquer um com o link abre; decisão consciente, registrada em `/privacidade` §4 | `0014`; `privacidade/page.tsx` | média | **aceito provisório** — confirmar na revisão jurídica (§5 item 2) | Thiago/jurídico |
| L-6 | **Janela de exposição pública do link legado** — `/resumo/t2-x7k4m9qf2w8j` segue **sem senha** (`senha_hash` NULL) até `expira_em` (+120d do seed) ou a coord definir senha; serve nome/cidade/par de menores | `0110:153-166`; review seguranca §167 | média | **mitigado** — bound = `expira_em` 120d + RPC rejeita após; pendente ação humana de definir senha | coordenação (ação manual) |
| L-7 | **Subprocessadores não publicados** — `/privacidade` não lista Supabase/Vercel/Resend/Sentry nem DPAs; cobertura jurídica do relatório a parceiros (prestar contas ≠ finalidade do programa no rascunho) | `privacidade/page.tsx`; `base-legal.md` §4 | média | **aberto** — depende da revisão do termo (§5 item 4) | Thiago/jurídico + dev (editar página) |
| L-8 | **Órfãos de storage sem ciclo de vida** — upload abandonado antes do submit (anexos de registro/chamado) deixa objeto sem dona nos buckets privados; nenhuma varredura periódica existe | review seguranca §36; buckets `registro-anexos`/`chamado-anexos` | baixa | **aberto** — job de varredura de objetos sem row >N dias, ou cleanup na expiração | dev |
| L-9 | **Sem procedimento de eliminação/portabilidade do titular** — `/api/export` é relatório operacional; RPCs `meus_dados_civis` (0046)/`meus_dados_pessoais` (0048) existem mas não viram endpoint do titular | `0046`/`0048`; decisao.md gap 6 | média | **aberto** — aceitável no volume atual (canal manual); endpoint é follow-up | dev (quando priorizado) |
| L-10 | ~~**IP do cliente não confiável**~~ — `ipCliente()` lia `x-forwarded-for[0]` (spoofável): evidência de IP das assinaturas forjável | review seguranca §2 | alta | **fechado** — `src/lib/ip.ts:10-17` usa `x-vercel-forwarded-for` na Vercel e o **último** elemento do XFF fora dela | — |
| L-11 | **`p_ip_hash` forjável na `abrir_relatorio`** — rate-limit por IP recebe a identidade como argumento; bound real é só o cap global 50/24h por slug | `0110:378-404`; review seguranca §3 | baixa | **aceito** — documentado na RPC; endurecer cap é follow-up | dev (se escalar) |
| L-12 | **Retenção zero fora dos itens decididos** — desistentes de ciclos passados seguem com PII completa | `0077`; decisao.md gap 2 | média | **mitigado pelo escrito** — política em `politica-retencao.md`; execução manual a cada encerramento de ciclo | coordenação + Thiago (confirmar N) |

## Riscos aceitos por decisão (não são lacuna)

- **`pessoa_notas` autor-only** — nem coord lê/apaga a caderneta privada
  (`0017`). Deliberado; o preço é não poder moderar conteúdo ali.
- **`assinaturas.token` exposto ao jovem** via `jovem_assinaturas`
  (`0070`) — é o jovem quem encaminha a autorização ao responsável.
- **Bearer token = posse** em `/f`, `/t`, `/assinar`, `/avaliar` — links
  individuais são o mecanismo de acesso de quem não tem conta.
- **Fail-open da auditoria** em `abrir_relatorio` — auditoria quebrada não
  derruba o relatório; `audit_fail` alerta o Sentry.
- **`anon` com zero grants** — toda superfície pública é RPC definer
  revisada; não há leitura direta de tabela anônima.

## Pendente de confirmação externa

- **N meses** da anonimização de desistentes (`politica-retencao.md` C-9)
  — proposta 6; o gatilho certo é o encerramento do ciclo.
- **Quem revisa o termo** — jurídico pro bono da org ou validação do Léo
  (pergunta em aberto no `decisao.md`).
- **DPA dos subprocessadores** — registrar quando o jurídico responder
  (Supabase/Vercel/Resend/Sentry).
