# REALIZA-34 — design.md

## Persona & JTBD

- **Coordenação**: "recebi o cronograma oficial da turma nova em PDF/planilha — quero criar a turma sem redigitar 20 datas" e "quero revisar antes de virar calendário oficial".

## Fluxo

`/turmas` → "Nova turma" → `/turmas/novo` → **escolha de origem**: "Montar do zero" (wizard atual) | "Importar de um arquivo" `[NOVO]`.

```
[arraste ou selecione — .pdf .xlsx .csv .docx]
        ↓ action: importarCronogramaRascunho
   "Lendo o arquivo…" (CircleNotch)
        ↓
   Passo 2 do builder pré-preenchido + painel de avisos
   ("3 encontros sem data reconhecida", "recesso detectado entre 14º e 15º")
        ↓ revisão/edita normal
   "Criar cronograma" → criarCronograma (inalterada)
```

## Detalhes de UI

- **Painel de avisos** `[NOVO]`: lista `avisos[]` da normalização acima da lista de eventos — tom `muted`, não bloqueante; avisos de confiança baixa são a fila de revisão, não erro.
- **Badge "IA"** `[NOVO]` (componente `Badge` existente, variante neutra) nas linhas vindas do Gemini — aparece só quando `origem='ia'`.
- Empty state de parse zero: ícone `FileX`/similar Phosphor + "Não consegui ler esse arquivo" + "tente PDF com texto selecionável ou planilha" + botão "Montar do zero" (fallback sempre visível — nunca beco sem saída).
- Erro de upload (tamanho/tipo): `toast.error` via sonner (padrão do builder).
- Success pós-gravação: redirect `/turmas/[id]` (comportamento atual do builder).

## Mobile → desktop

- Upload: `Input type=file` estilizado + área de drop só ≥sm (drag-drop é conveniência desktop); no mobile o file picker nativo resolve.
- Lista de revisão: mesma tabela do builder (já responsiva — scroll horizontal da prévia).

## Microcopy (pt-BR real)

- "Importar cronograma" / "Só pra revisar — nada é salvo antes de você confirmar."
- Aviso IA: "Parte da leitura foi feita por IA — confira as datas marcadas."
- Confiança baixa: "Revise com atenção: a leitura automática teve baixa confiança."

## Acessibilidade

- File input com `Label` real; lista de avisos com `role="status"`; foco move pro painel de avisos após parse (anuncia resultado a leitores de tela).
