# REALIZA-179 — design.md

`.devin/skills/ux-review/SKILL.md`. Componentes reais: `page-header`,
`button`, `card`, `badge`, `dialog`, `textarea`, `input`, `skeleton`,
`sonner`, `filter-chip`, `tooltip`, `password-input`. **Não existe
Sheet/Drawer** em `src/components/ui` — o assistente é página própria
(melhor no mobile, sem inventar primitiva).

## 1. `/assistente` — página do chat (todos os papéis)

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
- **Card de confirmação**: `Card` inline no transcript com o `resumo`
  pt-BR + botões "Confirmar" (primary) / "Cancelar" (ghost). Após
  confirmar, o card vira read-only "Confirmado ✓" e a resposta chega em
  nova bolha. Cancelar → "Ação cancelada — nada foi alterado."
- **Citações**: quando o resultado da tool `guia_consulta` tem `fontes`,
  a bolha renderiza badges abaixo do texto: `Guia do Mentor · p.12`.
  (Sem link — guia é corpus interno; a referência textual basta.)
- **Demo**: transcript inicial com 1 troca enlatada; chips funcionam com
  respostas fixas; input livre → resposta fixa "Na demonstração o
  assistente tem respostas de exemplo — no ambiente real ele responde com
  seus dados." Banner discreto no topo dizendo isso.

### Nav

Item "Assistente" (`ChatCircle`/`Sparkle`) no `app-shell.tsx` — `roles:
null` (todos) ou staff-only na primeira entrega (decisão de produto no
plan; default todos os papéis). Bottom-nav mobile entra no grupo
secundário.

## 2. `/perfil` — "Conectar IA externa" (coord-only)

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
  composer após envio.
- Bolhas com contraste AA; max-width ~75ch; scroll automático pro fim na
  nova mensagem.
- Card de confirmação com `aria-label` claro ("Confirmação de ação").
- Mobile: página full-width, composer fixo no rodapé acima da bottom-nav
  (`sticky bottom`), chips scroll horizontal.
- Tudo server-render exceto `assistente-chat.tsx` (client isolado).

## 5. O que NÃO entra (escopo visual)

- Nenhum drawer/modal de chat global — página própria (Sheet não existe
  na lib).
- Sem histórico de conversas, sem sidebar de threads (transcript não
  persiste).
- Sem voz/anexo no chat — texto só.
