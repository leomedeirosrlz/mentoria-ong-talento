# REALIZA-170 — design/UX

## Persona + JTBD

- **Quem monta:** coordenação (Léo/equipe) — "quero mandar pra diretoria/
  financiador um link sempre atualizado com o recorte X, sem dar acesso ao app
  e sem que vaze contato de menor".
- **Quem abre:** externo de confiança (diretoria, financiador, coord parceiro da
  ONG) — recebeu URL+senha no WhatsApp; quer **ler a grade**, não configurar.
- Perguntas nos 5s: "o que estou vendo?" (título+turma+tipo), "está atualizado?"
  (carimbo), "é seguro?" (senha + aviso de documento interno).

## Hierarquia — página pública `/resumo/[slug]`

Estrutura atual preservada (`page.tsx` — logo, kicker, H1 `<turma> · resumo`,
carimbo, `RelatorioCanvas`). Acima do canvas, **uma faixa de contexto nova**:

```
┌──────────────────────────────────────────────────┐
│ <logo> Programa de Mentoria Social               │
│                                                  │
│ T2 · 2026/2027 · Resumo da turma                 │
│ Relatório por pessoa · dados vivos, 14/10 09:32  │
│ 🔒 Link protegido — trate como documento interno │
│ [RelatorioCanvas]                                │
└──────────────────────────────────────────────────┘
```

- `<titulo>` do link (não mais só a turma) — a coord batiza ("Prestação T2 —
  outubro"), é o que o visitante reconhece.
- O subtítulo muda por `config.tipo`: "Resumo da turma" (grade), "Encontros do
  ciclo" (ciclo), "Documentos e assinaturas" (assinaturas).
- "Link protegido" substitui "Link não listado" — comunica o modelo real.

## Gate de senha — `ResumoSenhaForm` [NOVO]

Mobile-first, centrado (mesmo grid `min-h-[100dvh] place-items-center` dos
cards de erro da página):

| Estado | Conteúdo |
|---|---|
| Pedido | Logo + título do link + "Este resumo é protegido por senha." + `PasswordInput` + botão "Ver resumo". Sem hints de formato. |
| Erro senha | Mensagem única "Senha incorreta. Confira o link e a senha recebidos." — nunca "senha errada vs link inválido" separado (anti-oráculo). Input mantém foco, botão volta. |
| Limite | "Muitas tentativas. Aguarde ~N minutos ou peça um novo link à coordenação." — sem formulário. |
| Revogado/expirado | Card neutro: "Este resumo não está mais disponível. Peça um novo link à coordenação." — sem campo de senha (não adianta digitar). |
| Erro de carga | O atual "Não foi possível carregar agora…" mantido. |

Microcopy real: label "Senha do resumo", botão "Ver resumo", auxiliar "A senha
veio junto com o link — é diferente da senha de entrar na plataforma."

Componentes reutilizados: `PasswordInput` (`src/components/ui/password-input.tsx`),
`Button`, `Input`/`Label`, `SiteFooter`. Nada novo de UI kit.

## UI coord — `/relatorios`

### Card "Links públicos" (no builder, acima da grade)

Lista compacta (padrão `interacoes`/listas do app — linha com texto + ações
à direita, sem tabela nova):

```
Prestação T2 — outubro        grade · T2 · criado 10/10 · 23 acessos
  realizavc.vercel.app/resumo/abc…  [Copiar link] [Senha] [⋯]
Sem senha — defina uma →        (badge warn no legado)
```

Ações por linha: **Copiar link** (URL), **Copiar senha** (não — senha não se
recupera; a ação é "Redefinir senha" que gera nova e mostra uma vez),
**Revogar** (com confirmação "Quem tem o link perde o acesso na hora"),
**validade** no create (select "sem prazo / 30 / 60 / 90 dias").

### `NovoLinkRelatorioDialog`

Fluxo: builder → "Publicar este recorte como link" (substitui "Copiar link de
compartilhamento") → dialog pré-preenchido:

- Título (default "Resumo <turma> — <mês atual>")
- Recorte: chips read-only resumindo config (tipo + turma + nº colunas +
  "com contato" quando `expor_contato`) — revisão antes de publicar
- Validade select
- Toggle "Incluir colunas de contato (e-mail/WhatsApp)" — **off por default**,
  com aviso "inclui contato de mentorados — só para público interno"
- Confirmar → RPC → painel de sucesso com link + senha em caixas copiáveis +
  nota "A senha não fica salva — copie e envie junto com o link"

Estados: gerando (spinner no botão), erro (`{error}` da action → toast sonner),
sucesso (painel único, sem reedição).

### Densidade

Desktop: card à esquerda da barra de filtros ou acima da grade (width
`max-w-6xl` alinhado ao canvas). Mobile: empilha antes dos filtros. Sem nova
rota — vive em `/relatorios` (a página já é coord-only).

## a11y

- Form de senha: `Label` real + `aria-describedby` no erro; `role="alert"` no
  erro de senha e no card de limite.
- Dialog: `Dialog` de `src/components/ui/dialog.tsx` (focus trap + Esc).
- Tabela pública: `RelatorioCanvas` já é a11y (sort com aria-sort).
- Contraste: badge "Sem senha" usa `--warn` (já usado em `TrilhaPrazoBadge`).

## Decisões de UX fechadas

- Senha mostrada **uma vez** (hash no banco) — não há "ver senha" depois; o
  flow é redefinir.
- Revogação imediata e irreversível pela UI (reativar = novo link — mantém a
  invariante "link imutável" do sdd).
- Visitante nunca edita recorte (sem chips na pública) — o config é da coord.
