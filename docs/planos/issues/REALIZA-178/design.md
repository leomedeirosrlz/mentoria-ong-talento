# REALIZA-178 — design.md

Segue `.devin/skills/ux-review/SKILL.md`. Componentes reais de
`src/components/ui/`: `page-header`, `button`, `card`, `badge`, `select`,
`filter-chip` (classes `filterChipCls`), `dialog`, `sonner`, `skeleton`.
Sem lib de charts no repo — visualizações são CSS/DOM (padrão do app).

## 1. Hub `/relatorios` (coord-only — nav já restringe, `app-shell.tsx`)

### Estrutura

```
PageHeader  "Relatórios"   sub: "Saúde do ciclo, operações e prestação de contas."
[Select turma] [Select cronograma]            ← filtro global da visita
[chips: Saúde · Aderência · Pendências · Operação · Encerramento · Grade livre]
─────────────────────────────────────────────
<seção ativa>
```

- Chips reutilizam `filterChipCls` (mesmo padrão de `/duplas`); seção vem
  de `?secao=` — linkável, back-button friendly.
- Filtro turma/cronograma fica no header da página, vale pra todas as
  seções e é repassado aos botões "Baixar CSV" como query param.
- **Grade livre** = `RelatorioBuilder` atual intacto — nada muda ali; vira
  a última aba. O link público `/resumo/[slug]` continua funcionando por
  baixo dela.

### Seção "Saúde do ciclo" (default)

- Linha de 3–4 cards destaque (`ui/card`): `N duplas ativas` ·
  `X em risco` (badge `destructive`-like; o app usa badges amarelo/vermelho
  do semáforo) · `aderência média %` · `registros pendentes N`.
- Lista "Atenção primeiro": top ~8 duplas por severidade (mesma ordenação
  de `resumo_semana`): cada linha = badge semáforo + nomes (mentor ·
  primeiro nome mentorado) + motivo + link "abrir ficha" → `/duplas/[id]`.
- Bloco "Tendência" (só com snapshots da 182): barras CSS por semana com a
  distribuição ok/atenção/risco. Sem snapshots → o bloco não renderiza.
- Botão "Enviar resumo da semana agora" (secondary) → `enviarDigestSemanal`
  → toast "Resumo enviado para N endereços da coordenação." / erro.
- Botão "Gerar narrativa do ciclo" (ghost) — **só renderiza se
  `providerConfigurado()`**; abaixo, quando gerada, card com a prosa +
  rodapé *"Gerado por IA sobre números agregados do ciclo — confira antes
  de compartilhar."*
- Ações por seção: `Baixar CSV completo` (ícone `DownloadSimple`,
  linka `/api/export?tipo=aderencia&turma=…`).

### Seções operacionais (aderência / pendências / operação / encerramento)

Mesmo padrão: 2–3 cards destaque → preview `RelatorioCanvas` read-only
(máx 8 linhas + "+N linhas no CSV") → botão "Baixar CSV completo".

| Seção | Cards | Preview |
|---|---|---|
| Aderência | aderência %, maior atraso de registro | linhas `aderencia` |
| Pendências | assinaturas vencendo, presenças ausentes, forms sem resposta, avaliações pendentes | 3 mini-listas (uma por tipo) |
| Operação | nudges na semana, solicitações abertas, supervisões no mês | linhas `interacoes` |
| Encerramento | checklist completo %, `concluida` × `encerrada`, autoavaliações recebidas | linhas `encerramento` |

### Estados

- **Empty**: padrão de card central vazio do app (`EstadoCard`
  compartilhado em `src/components/estado-card.tsx`; `EstadoVazio` é
  local de `duplas-lista.tsx:547` — seguir o mesmo formato) — ex.: turma
  sem duplas → "Nenhuma dupla nesse recorte. Ajuste o filtro acima."
- **Loading**: `loading.tsx` da rota já existe; `Skeleton` nos previews.
- **Erro de fetch**: `error.tsx` do grupo + inline `EstadoCard` com retry.
- **Demo**: seções leem `demoDuplas("coordenacao")` — mesma densidade;
  botão de envio de digest retorna `DEMO_MSG` no toast (padrão de todas as
  actions em demo).

### Mobile

- Chips com scroll horizontal (overflow-x-auto, padrão chips do app).
- Cards destaque em grid 2 colunas no mobile, 4 no desktop.
- Preview `RelatorioCanvas` já é scroll horizontal — manter.

## 2. Digest — e-mail semanal (Resend)

- `emailLayout` (`src/lib/email-templates.ts:57` — card 600px, CTA,
  tagline/preheader). Assunto: `"Semana <dd/mm–dd/mm> · N duplas em risco
  — Realiza.VC"`.
- Corpo: parágrafo `textoResumoSemana` + seções com `<h2>` compactos:
  "Duplas em risco" (primeiro nome mentorado + motivo — **sem sobrenome,
  ver sdr**), "Registros pendentes", "Presença nas formações",
  "Assinaturas vencendo", CTA botão "Abrir relatórios" → `/relatorios`.
- Rodapé: "Enviado automaticamente toda segunda · você recebe porque faz
  parte da coordenação."

## 3. Narrativa LLM

- Botão discreto (ghost + `Sparkle`), loading state "Gerando…", resultado
  em `Card` com prosa + rodapé de disclaimer (texto acima). Erro → toast
  `error` padrão.
- pt-BR obrigatório; sem emoji; o prompt pede ~150 palavras executivas.

## 4. Microcopy (todas novas, pt-BR)

- Chips: "Saúde do ciclo", "Aderência", "Pendências", "Operação",
  "Encerramento", "Grade livre".
- Botões: "Baixar CSV completo" · "Enviar resumo da semana agora" ·
  "Gerar narrativa do ciclo".
- Empty: "Nenhuma pendência nesse recorte — bom sinal." /
  "Nenhuma dupla nesse recorte. Ajuste o filtro acima."
- Digest erro demo: `DEMO_MSG` padrão ("Disponível só no ambiente real…" —
  string exata em `src/lib/demo/shared.ts`, reutilizar).

## 5. A11y / consistência

- Chips com `aria-pressed`/links reais (`<a>` com `?secao=`) — navegação
  é link, não botão.
- Barras de tendência com `title`+texto ao lado (não depender só de cor).
- Hierarquia `h2` uppercase 11px nas seções (padrão do app).
- Nenhum Dialog/Sheet novo — a página inteira é server-rendered, só os
  botões de ação são client.
