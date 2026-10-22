# REALIZA-36 — design.md (UX dos novos campos)

## Persona & JTBD

- **Candidato a mentor / mentorado** (respondente público, celular, link do
  WhatsApp): "responder o formulário de inscrição sem instalar nada nem
  criar conta" — inclui anexar CV/documento, marcar horários livres na
  semana e responder só o que se aplica a ele.
- **Coordenação** (builder): "montar o form de matching fiel ao Google
  Forms oficial sem pedir pra TI".

## Regras de apresentação (respondente)

- Os novos campos são **um card por pergunta**, mesma anatomia dos atuais
  (label 15–16px, `(opcional)`, erro = card vermelho sem layout shift).
- **`arquivo`**: botão `outline` "Escolher arquivo" (44px) → estado de
  upload (`CircleNotch` + "Enviando…") → chip com `nome` + `tamanho`
  formatado + botão "Trocar". Erro de tipo/tamanho inline:
  `"Envie PDF, PNG, JPG ou WebP até {N} MB."` iOS/Android: `accept` limita
  o picker; a câmera aparece naturalmente pra imagem.
- **`grid_disponibilidade`**: grade `role="grid"` **Seg–Sex × 09h–20h**
  (5 colunas × 11 faixas — verbatim do form oficial; o mapeamento
  `forms-google-mapeamento.md` manda replicar esse range, sem sáb/dom).
  Célula = `role="checkbox"`/`aria-pressed` com `aria-label`
  `"Terça às 19h"`; toque alterna, check visual lime.
  Header curto "Marque os horários em que você consegue participar".
  Mobile: 5 colunas cabem; célula ≥44px.
- **`visible_if`**: campo oculto **não renderiza** (nem vazio) — entrar/sair
  anima com `AnimatePresence`+`fade` existente. Barra de progresso usa
  "perguntas visíveis respondidas / visíveis" (decisão: progresso nunca
  regride — esconder pergunta re-conta ambos os lados).
- **`permite_outro`**: última opção "Outro" (radio/checkbox) → selecionar
  revela `Input` inline com label sr-only "Descreva"; placeholder
  `"Escreva aqui"`. Erro se marcou Outro sem texto: `"Descreva o outro."`

## Regras do builder (coordenação)

- Seletor de tipo ganha "Arquivo" e "Grade de disponibilidade"; mock
  inerte por tipo dentro do card (padrão sprint forms v2).
- `visible_if`: toggle "Só mostrar se…" no rodapé → linha
  `Select(campo anterior) + Select(valor)`. Campos inelegíveis (arquivo,
  grid, secao, texto_longo sem opção discreta) não aparecem na lista de
  condição — **só perguntas com resposta discreta**.
- `permite_outro`: `Switch` "Aceitar 'Outro' com texto livre".
- `arquivo`: `Select` tamanho (5/10/20 MB), hint "PDF, PNG, JPG ou WebP".

## Estados

- **Loading** upload: spinner no chip; **erro**: inline vermelho com retry
  implícito (escolher de novo); **sucesso**: chip nome+tamanho.
- **Empty** grid: hint "Nenhum horário marcado" não é erro se opcional.
- **Validação**: erros por campo no mapa existente (`aria-describedby` +
  scroll/focus no primeiro).

## Microcopy pt-BR

- "Marque os horários em que você consegue participar"
- "Escolher arquivo" / "Enviando…" / "Trocar"
- "Envie PDF, PNG, JPG ou WebP até {N} MB."
- "Descreva o outro." / "Outro" / "Escreva aqui"
- "Aguarde o upload terminar."

## Acessibilidade

- Grade: `role="grid"` + roving tabindex (mesma convenção do calendário);
  células com `aria-pressed`.
- Upload: input file real (keyboard-acionável), `aria-busy` no chip.
- `visible_if`: remover campo remove o erro e o valor — sem estado
  fantasma; `aria-live` educado no contador de progresso.

## Componentes reutilizados

`Button`, `Input`, `Switch` (ui/switch.tsx da sprint v2), `Select` (sempre
com `items`), `Badge`, `CircleNotch`, `AnimatePresence`/`motion`+`fade`.
[NOVO] `src/components/forms/grid-disponibilidade.tsx`.
