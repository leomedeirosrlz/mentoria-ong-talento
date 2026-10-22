# REALIZA-35 — design.md

## Persona & JTBD

- **Mentor/mentorado no primeiro acesso** (muitas vezes Hotmail/Outlook):
  "cliquei no link do e-mail — entrou certo na MINHA conta? deu certo?"
- **Coordenação**: "quero que o pedido de acesso chegue até mim sem eu
  ficar checando planilha".

## Telas/estados

### `/auth/confirmado` (aba do e-mail)

- **Novo**: card ganha "Tudo certo, **{primeiro nome}**! Você entrou como
  **{papelLabel}**." quando `sessionStorage.handoff_quem` presente —
  senão, copy atual ("Entrada confirmada…"). Check lime já existente.
- Frase de mão dupla fica: "Pode fechar — a aba onde você pediu o link
  entra sozinha."

### `/auth/definir-senha` (aba que pediu, 1º acesso)

- Linha de contexto no topo: "Você está entrando como **{nome}** —
  **{papel}**." (dados via `profiles` do próprio usuário, sessão criada).
  Confirma identidade **antes** de definir senha.
- Recovery mantém copy de redefinição; dispensável inalterado.

### `/login` — e-mail não cadastrado

- Hoje: só texto. Novo card: "E-mail não cadastrado" + corpo "Seu e-mail
  precisa estar liberado pela coordenação pra entrar." + `Button`
  "Pedir acesso" → estado "Pedido enviado — a coordenação vai liberar e
  te avisar." + link mailto discreto "Falar com a coordenação".

### "Link enviado"

- Corpo atual → "Enviamos um link para {email}. Se não chegar em alguns
  minutos, confira o **lixo eletrônico/spam — Outlook e Hotmail filtram
  o primeiro e-mail** de um remetente novo."
- Sub-linha: "Marque como 'não é lixo' pra próximos chegarem direto."
- Reenvio/cooldown/`esta página entra sozinha` inalterados.

## E-mail (magic-link.html)

- Adicionar após o parágrafo principal: "Este link entra como
  **{{ .Email }}** — se não é você, ignore este e-mail." (única
  identidade injetável no template GoTrue).

## Microcopy pt-BR (todas as novas)

- "Tudo certo, {nome}! Você entrou como {papel}."
- "Pode fechar — a aba onde você pediu o link entra sozinha."
- "Você está entrando como {nome} — {papel}."
- "E-mail não cadastrado" / "Pedir acesso" / "Pedido enviado — a
  coordenação vai liberar e te avisar." / "Falar com a coordenação"
- "lixo eletrônico/spam — Outlook e Hotmail filtram o primeiro e-mail"

## Estados obrigatórios

- RPC antiga sem retorno de identidade → fallback genérico (forward
  compat com staging velho).
- `solicitar_acesso` erro → toast/inline "Não foi possível registrar —
  fale com a coordenação" + mailto.
- Já cadastrado digitando de novo → mensagem normal de e-mail cadastrado.

## A11y

- `role="status"`/`role="alert"` no padrão dos cards atuais; foco via ref
  callback (AnimatePresence `mode="wait"` atrasa alvo — mesmo cuidado do
  `focoEnviado`).
