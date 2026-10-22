# REALIZA-54 — design.md (UI)

## Componente

`src/components/arquivos-dupla.tsx` — a lista vira mixta (union
`ArquivoDaDupla`). Manter o shell/seção atual (header "Arquivos" +
lista) para anexos e PDM.

## Itens

| kind | Linha |
|---|---|
| `anexo` | (atual) ícone por extensão/mime + nome do arquivo + meta "Encontro {n} · {data}" + botão de download (`/api/anexo/[id]`) |
| `pdm` | ícone `FileText`/`Notebook` + "PDM — Plano de Desenvolvimento Mútuo" + meta "respondido em {data}" + ação "Ver" (abre `InstrumentoResultado`) |

PDM primeiro na lista (documento-mãe da jornada), depois anexos por
`created_at` desc (ordem atual). Se `respondido_em` antigo e o jovem
re-responder, a data do item atualiza (sempre a entrega mais recente).

## Empty state

```
[FileDashed]  Nenhum arquivo ainda
              Evidências enviadas nos registros e o PDM respondido
              aparecem aqui.
```

Bloco centralizado, muted, mesma tipografia dos empty states existentes
(`pessoas-listas.tsx:579` "Ninguém fora do programa" — mesmo padrão:
ícone + título + sub). A seção **não some** — gestor entende que a área
existe e está vazia.

## Estados

| Estado | Comportamento |
|---|---|
| loading | a seção é server-rendered — sem spinner próprio (a página suspensa cobre) |
| erro na RPC de instrumentos | degrada pra anexos + empty se vazio (nunca quebra a ficha — mesmo comportamento do card) |
| sem permissão de ver PDM | item omitido (defesa no page — vide plan) |
| PDM só pendente | não aparece em Arquivos (status vive no card Instrumentos) |

## Ação "Ver" do item PDM

Abre o mesmo `InstrumentoResultado` do card Instrumentos (leitura
estruturada das metas/IS/prazo) — `kind:'pdm'` nunca vira download de
arquivo. Se 181 trouxer view/print própria, o item passa a linkar ela.

## Acessibilidade / mobile

- Lista é `<ul>`/`li` com botões reais (padrão atual); item PDM é
  `<button>` com texto "Ver PDM" — não link "aqui".
- Ícones `aria-hidden`; meta em `text-muted-foreground`.
- Mobile: linhas empilham como hoje (a lista já é vertical); empty state
  centraliza com padding.

## Microcopy pt-BR

- Empty: "Nenhum arquivo ainda" / "Evidências enviadas nos registros e o
  PDM respondido aparecem aqui."
- Item: "PDM — Plano de Desenvolvimento Mútuo" · "respondido em {dd/mm/aaaa}" · "Ver"

## Fora de escopo

- Download/export de PDM (depende da 181 — quando existir, o item pode
  ganhar menu "Baixar PDF").
- Anexos de `pessoa_notas`/outros domínios (Arquivos da DUPLA: registro +
  PDM apenas).
- Seção visível em trilha esp: segue a regra atual da ficha (se a seção
  aparece lá hoje, mantém — só anexos).
