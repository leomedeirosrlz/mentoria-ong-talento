# REALIZA-180 — design.md

`.devin/skills/ux-review/SKILL.md`. Estende `importar-registros-dialog.tsx`
(`sm:max-w-6xl` — maior dialog do app, já é quase página; manter o padrão
da tabela). Componentes reais: `dialog`, `button`, `badge`, `select`,
`input`, `textarea`, `card`, `sonner`, `skeleton`, `tooltip`.

## 1. Entrada — dropzone de arquivo

Hoje o dialog pede o CSV colado/arquivo `.csv`. Nova entrada:

```
[ Arraste ou escolha o arquivo ]
 CSV, PDF ou foto da planilha — até 10 MB / 20 páginas.
 [Escolher arquivo]  (accept=".csv,.pdf,.png,.jpg,.jpeg,.webp")
```

- CSV → fluxo atual idêntico (sem chamada de IA).
- PDF/imagem + `IA_IMPORTACAO_OK` → passo "Lendo o documento…" com
  `Skeleton` da tabela + aviso "O documento é processado pelo assistente
  de IA — os campos extraídos aparecem pra sua revisão antes de gravar."
- PDF/imagem **sem** flag/provider → o seletor aceita o arquivo mas mostra
  `EstadoCard`: "A leitura por IA está desligada — converta pra CSV ou
  fale com a coordenação." (honesto, sem falhar feio).
- Aviso de privacidade fixo sob o dropzone (ver microcopy) — o documento
  sai da máquina da coord pra API do provider.

## 2. Tabela de revisão — adições IA

A tabela atual (linha · mentor · mentorado · dupla select · confiança ·
encontro · ação) ganha:

- **Badge `Sugerido por IA`** (`ConfTag` nova variante `ia`, ícone
  `Sparkle`) ao lado da confiança quando `sugeridoIa` presente; tooltip/
  texto pequeno com a `razao` ("nome parecido e mesma dupla do ciclo").
- Select da dupla **pré-selecionado** no candidato sugerido — linha segue
  `revisar` até o humano confirmar/trocar (a pré-seleção não é aprovação).
- Linhas extraídas por visão com `confianca<70`: borda/esquerda `warning`
  + tag "extração incerta".
- **Caixa "Corrigir por texto"** por linha (expandível — linha chevron):
  `Input` + `Aplicar` → mostra "entendi: <ação>" inline → `[OK]`/`[Desfazer]`.
  Aplicada → tag "corrigido por texto" na linha.
- **Caixa de instrução em lote** acima da tabela: `Textarea` 1 linha +
  `Aplicar nas linhas selecionadas` — pra renumeração narrativa
  ("numera a partir do 3º encontro") e instruções gerais.
- Linha `sem-par`: além do select, botão **"Criar dupla"** que abre o
  `NovaDuplaDialog` existente com nomes pré-preenchidos → ao criar, a
  linha re-avalia (re-run do preview daquela linha) → a dupla nova entra
  como candidata.
- Resumo do lote no rodapé (já existe) + contagem "N sugestões de IA ·
  M correções por texto".

## 3. Estados

- **Extraindo**: skeleton da tabela + "Lendo página X de Y…" se o provider
  devolver progresso; senão indeterminado.
- **Provider fora/timeout**: toast erro + o documento fica selecionado —
  botão "Tentar de novo" ou "Enviar como CSV"; nada é perdido.
- **Semântico rodando**: badge "Analisando…" na coluna IA das linhas
  `manual`; linhas já revisáveis enquanto roda (não bloqueia).
- **NL não entendeu**: toast + texto inline "Não entendi — reformule ou
  edite direto na tabela."
- **Demo**: seções IA visíveis porém desabilitadas; aplicar → `DEMO_MSG`
  no toast (paridade honesta — demo não chama provider).
- **Empty pós-extração**: "Não achei linhas de registro nesse documento —
  confira se é a planilha certa ou envie em CSV."

## 4. Microcopy (pt-BR, sem emoji)

- Dropzone: "CSV, PDF ou foto da planilha — até 10 MB."
- Privacidade: "Arquivos que não forem CSV são lidos pelo assistente de IA
  pra extrair as colunas. Revise tudo antes de importar — nada é gravado
  sem sua confirmação."
- Badge: "Sugerido por IA" / tooltip com a razão.
- Extração incerta: "Extração incerta — confira os campos marcados."
- NL linha: "Corrigir por texto — ex.: 'é a outra Nicolly' ou 'encontro 4'".
- Lote: "Instrução pra todas as linhas — ex.: 'numera a partir do 3º'".
- `criar_dupla`: "Essa dupla ainda não existe — crie pelo fluxo normal e
  re-rode a prévia."
- Footer: "N sugestões de IA · M correções por texto · X linhas a
  importar".

## 5. A11y / consistência

- Tabela mantém o padrão atual (já é scrollável em `sm:max-w-6xl`).
- Caixa NL com `label` visível ("Correção por texto") e `aria-describedby`
  com o exemplo.
- Badge IA com `Tooltip` (não depender de hover no touch — tocar abre).
- Botão "Criar dupla" `variant="outline"` — não competir com "Importar".

## 6. O que NÃO entra

- Nenhum editor de imagem/crop — se a foto tá ruim, a extração marca
  incerteza e o humano edita na tabela.
- Preview do documento renderizado (PDF viewer) — fora de escopo; a
  tabela é a verdade.
- Chat livre dentro do dialog — NL é por caixa de instrução, não conversa.
