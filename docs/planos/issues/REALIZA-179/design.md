# REALIZA-179 — design.md

`.devin/skills/ux-review/SKILL.md`. Componentes reais: `page-header`,
`button`, `card`, `badge`, `dialog`, `textarea`, `input`, `skeleton`,
`sonner`, `filter-chip`, `tooltip`, `password-input`.

**Entregue diferente (REALIZA-243):** o assistente não virou página —
virou **bolha** (`AssistenteBolha`, FAB fixo no AppShell; `Popover`
não-modal no desktop, `Sheet` de rodapé no mobile — `ui/sheet` passou a
existir pra ela). O painel interno é o `AssistenteConversa` nos dois.
Gate: env `IA_BOLHA=1` + papéis staff/mentores (jovem fora — shell
próprio). `/assistente` virou `redirect("/")` pra links antigos. O
desenho abaixo segue valendo pro conteúdo do painel; os deltas estão
anotados.

## 1. assistente — painel da bolha (era: página `/assistente`)

### Layout

```
PageHeader "Assistente"  sub: "Pergunte sobre a operação ou os guias do programa."
[chips de sugestão por papel]
─────────────────────────────────────────────
[transcript]  (bolhas: user à direita, assistente à esquerda)
  ├─ resposta com fontes → rodapé "Guia do Mentor · p.12" (badge)
  └─ card de confirmação → resumo + [Confirmar][Cancelar]
[textarea] [Enviar →]
"Respostas geradas por IA podem errar — confirme informações críticas." (texto 11px muted)
```

- **Sem transcript persistente**: estado em `useState`; refresh limpa —
  intencional (LGPD, decisão do doc-fonte). Aviso sutil não é necessário;
  a página recomeça limpa.
- **Chips de sugestão** por papel (`papeisDoUsuario` resolve server-side
  e passa pro client):
  - mentor: "Como está minha semana?" · "O que diz o guia sobre o
    encontro X?" · "Minha dupla tem registros pendentes?"
  - coord: "Resumo da semana" · "Quem está aguardando par?" ·
    "Pendências de documentos" · "Capacidade dos mentores"
  - jovem: "Como funciona o programa?" · "O que é o PDM?"
- **Composer**: `Textarea` + `Button` (ícone `PaperPlaneRight`), Enter
  envia / Shift+Enter quebra linha; disabled enquanto `pending`.
- **Loading**: bolha assistente com 3 pontos animados (CSS) — não-skeleton
  de mensagem.
- **Provider off** (`!providerConfigurado`): página renderiza header +
  card "O assistente está indisponível no momento." — composer some.
  (Mesmo padrão do botão narrativa da 178: feature flag honesta.)
- **Vazio**: estado inicial = chips + mensagem de boas-vindas fixa
  "Oi! Posso ajudar com a sua operação ou com os guias do programa."
- **Erro de tool**: a própria resposta do assistente explica ("Não
  consegui consultar isso — essa consulta é da coordenação.") — vem do
  contrato de `executarTool` + system prompt; sem estado de erro separado.
- **Erro de transporte** (5xx/429): toast `sonner` + bolha do assistente
  com a mensagem amigável.
- **Card de confirmação** — *pendente (REALIZA-290–297)*, depende das
  tools de escrita: `Card` inline no transcript com o `resumo` pt-BR +
  botões "Confirmar" (primary) / "Cancelar" (ghost). Após confirmar, o
  card vira read-only "Confirmado ✓" e a resposta chega em nova bolha.
  Cancelar → "Ação cancelada — nada foi alterado."
- **Citações** — entregue mais simples: o modelo cita guia/seção na
  própria prosa ("segundo o Guia do Mentor, cap. 10…") e a meta da bolha
  lista as tools usadas ("fontes: guia_consulta"); links internos na
  resposta viram chips de ação (REALIZA-286). Os badges "Guia · p.N"
  separados ficam como melhoria possível.
- **Demo** — entregue: aviso "Na demonstração, o assistente responde com
  exemplos fixos." + respostas enlatadas por regex sobre o dataset (sem
  fetch ao provider/API — `DEMO_RESPOSTAS`).

### Nav — superseded

Sem item na nav: o acesso é o FAB (`Sparkle`) fixo no AppShell —
`assistente-bolha.tsx`. Gate real = `IA_BOLHA=1` + papéis
coordenacao/supervisor/mentor_dpp/mentor_especialista (o jovem não vê;
decisão mais restrita que o "todos os papéis" previsto). Estado aberto
persiste em `sessionStorage` (a aba lembra).

## 2. `/perfil` — "Conectar IA externa" (coord-only) — **PENDENTE (REALIZA-290–297)**

Seção nova no perfil (abaixo das existentes):

```
Card "Conectar IA externa"
  "Crie um token pra usar o Realiza no Claude/ChatGPT (MCP). Só a
   coordenação tem acesso."
  [Nome do token: input] [Gerar token]
  → mostra UMA VEZ: `rlz_xxxx…` com botão copiar + aviso "guarde agora —
    não aparece de novo"
  Lista de tokens: nome · criado em · último uso · [Revogar]
```

- Token em `PasswordInput`-like (ou `code` + botão copiar — padrão do
  token de formulário? não há copy-button component; usar `Button` com
  `navigator.clipboard` + toast "Token copiado").
- Revogar → `AlertDialog`/`Dialog` confirma → `revogado_em=now()`.
- Instrução colável: pequeno bloco `code` com a config MCP
  (`"url":"https://realizavc.vercel.app/api/mcp","headers":{…}`) —
  ajustar ao formato do cliente-alvo na implementação.

## 3. Microcopy (pt-BR, sem emoji)

- Boas-vindas: "Oi! Sou o assistente do Realiza. Posso ajudar com a sua
  operação ou com o que dizem os guias do programa."
- Provider off: "O assistente está indisponível no momento. Tente de novo
  em instantes."
- Rate limit: "Muitas mensagens seguidas — aguarde um instante."
- Confirmar escrita: usa o `resumo` da tool, ex. "Registrar contato com a
  dupla Ana · Luisa (motivo: remarcação)?" / botões "Confirmar" ·
  "Cancelar".
- Pós-escrita: "Feito — contato registrado." (+ link "ver na ficha" se
  `refId` for dupla/interação linkável).
- Demo: "Na demonstração, o assistente responde com exemplos fixos."
- MCP perfil: "Use o token pra conectar o Realiza ao seu assistente de IA.
  Ele enxerga o que você enxerga."

## 4. A11y / consistência

- Transcript: `role="log"` `aria-live="polite"` na lista; foco volta ao
  composer após envio. *(entregue — a rolagem só segue o fim quando o
  usuário já está perto dele)*
- Bolhas com contraste AA; max-width ~75ch; scroll automático pro fim na
  nova mensagem.
- Card de confirmação com `aria-label` claro ("Confirmação de ação") —
  pendente (290–297).
- Mobile *(entregue diferente)*: não é página full-width — é `Sheet` de
  rodapé (backdrop + focus trap, cobre a bottom-nav via z-50); composer
  no rodapé do painel, chips no empty state.
- Client isolado *(entregue)*: `assistente-conversa.tsx` +
  `assistente-bolha.tsx` são os únicos `"use client"` do fluxo; o layout
  resolve o gate server-side e passa `papeis`/`demo`/`configurado`/`nome`.

## 5. O que NÃO entra (escopo visual)

- ~~Página `/assistente` dedicada~~ → superseded: a 243 preferiu a bolha
  FAB (Popover/Sheet) sobre a página — `ui/sheet` nasceu pra ela.
- Sem histórico de conversas, sem sidebar de threads (transcript não
  persiste).
- Sem voz/anexo no chat — texto só.
