# Polish /duplas + /relatorios — rodada nov/2026

Dores reportadas pelo Thiago (coordenação), uma rodada só.

## 1. WhatsApp da linha de dupla — escolher o destinatário

**Hoje:** `acaoWhatsAppDupla` (`src/lib/acao-lembrete.ts`) devolve UM destino
(mentor; mentorado só quando apoio vem do jovem) e `DuplaWaAcao` abre o
preview direto. Não dá pra falar com o mentorado.

**Quer:** opção de mandar pros 2 da dupla — escolher quem recebe **antes** de
ver o preview da mensagem.

**Regras de domínio a preservar:**
- Mentorado nunca recebe cobrança operacional (agendar/registrar é dever do
  mentor). Pro jovem a mensagem é contato neutro ("Como estão as coisas?") ou
  resposta de apoio quando `apoioJovem`.
- `Lembrar` in-app continua com `nudge.destino` fixo (a pendência decide pra
  quem vai a notificação) — a escolha do destinatário é do caminho WhatsApp/
  copiar.
- `Dupla` já carrega `mentor.whatsapp` e `mentorado.whatsapp`.
- `acaoWhatsAppDupla` retorna dados dos DOIS destinos → as 7 superfícies que
  spreadam o resultado (`duplas-lista`, `fila-acompanhar`, `dashboard-coord`,
  `agenda-auxiliar`, `agenda-por-mentorado`, `duplas/[id]`, `instrumentos-
  programa`) ganham a escolha de graça.

## 2. Botão ⋯ da linha não faz nada

**Hoje:** o "Ações / ⋯" em `DuplaLinha` é decorativo (`aria-hidden` +
`pointer-events-none`) — clique cai no stretched link e abre a ficha.

**Quer:** menu real com as opções que existem na ficha (`mais-menu.tsx`:
Enviar formulário, Solicitar/Sugerir especialista, Remanejar, Encerrar
trilha).

**Cuidados:**
- Controle real precisa de `relative z-20` (acima do stretched link).
- Menu mostra só o que os dados da lista permitem — `RemanejarDuplaDialog`
  precisa só do objeto `Dupla` (tem); `EncerrarTrilhaDialog` idem;
  formulário/especialistas precisam de catálogos que a página /duplas não
  carrega — decidir: carregar lazy ou omitir. Nunca item quebrado.
- Sem aplicação, volta a não renderizar (como hoje).

## 3. Desistentes na contagem

**Hoje:** `resumoDaLista` faz `${lista.length} duplas` — inclui encerradas/
desistentes no número principal.

**Quer:** desistente fora da contagem real — "31 duplas · 1 desistente" com o
sufixo menor e mais apagado (`text-xs text-muted-foreground` ou similar).
Critério = o mesmo do chip `desistente` (linha ~466: `status==="encerrada" ||
ehDesistente`).

## 4. Persistir filtros ao navegar

**Hoje:** só `?turma=` sincroniza URL (`escolherTurma` → router.replace).
`filtro` (chips de categoria), `busca`, `supSel`, `mentorSel` são `useState`
puro — abrir ficha e voltar zera tudo.

**Quer:** filtros sobrevivem à ida e volta da ficha.

**Direção:** params na URL via `window.history.replaceState` + init por
`useSearchParams` — zero roundtrip de servidor (router.replace refetaria a
página inteira, e a gente acabou de discutir custo Vercel). `?recorte=` do
deep-link (SaudePrograma) continua semeando. Turma/cookie intocados.
Back/forward e link "Voltar" restauram; deep-link filtrado fica compartilhável
de graça.

## 5. Ctrl+C em /relatorios copia a tabela inteira

**Hoje:** `relatorio-canvas.tsx` (linha ~176) intercepta Ctrl+C quando há
seleção de LINHAS e manda TSV — mesmo quando a pessoa selecionou texto com o
mouse (seleção nativa do browser).

**Quer:** texto selecionado copia o texto.

**Fix:** no keydown, só hijackar quando `selecionadas.size>0` **E**
`window.getSelection()` estiver vazio/ancorado fora do canvas. Seleção nativa
não-vazia → deixa o copy default.

## Execução

- Agente A: issues 1–4 (cluster `duplas-lista` + `dupla-linha` +
  `dupla-wa-acao` + `acao-lembrete`).
- Agente B: issue 5 (`relatorio-canvas`).
- Verificação: `npx tsc --noEmit` + `npx eslint` limpos; e2e dos specs de
  duplas no remoto depois do push.
