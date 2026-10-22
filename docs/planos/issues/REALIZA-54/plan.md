# REALIZA-54 — plan.md

## Estado atual (verificado)

| Ponto | Hoje | Arquivo |
|---|---|---|
| Seção | `ArquivosDupla({arquivos})` — tipo `RegistroAnexo & {encontroNumero}` | `src/components/arquivos-dupla.tsx:5-53` |
| Empty | `if (!arquivos.length) return null` | `arquivos-dupla.tsx:14-15` |
| Fonte | flatten de `anexosPorRegistro` por registro→encontro, sort por `created_at` | `duplas/[id]/page.tsx:403-412` |
| Render | `<ArquivosDupla arquivos={arquivosDaDupla} />` | `page.tsx:1051` |
| PDM hoje | instrumento `sistema='pdm'` em `getInstrumentosDaDupla` (RPC `instrumentos_da_dupla`, 0080) → `InstrumentoDupla{sistema, titulo, entregas[]}` | `src/lib/forms/queries.ts:324-354` |
| Download anexo | `/api/anexo/[id]` → signed URL 300s, bucket privado | `ops-mapa.md`, `arquivos-dupla.tsx` |
| `duplas.pdm_url` | **removida** | `0098_remove_pdm_url.sql` |
| Card instrumentos | `InstrumentosDupla` já abre `InstrumentoResultado` com a resposta | `duplas/[id]/instrumentos-dupla.tsx` |

## Passos

1. **`src/components/arquivos-dupla.tsx`** — novo tipo exported:
   ```ts
   export type ArquivoDaDupla =
     | { kind: "anexo"; anexo: RegistroAnexo; encontroNumero: number }
     | { kind: "pdm"; titulo: string; respondido_em: string;
         resposta_id: string | null };
   ```
   Render por `kind`: anexo = linha atual (ícone por mime + nome + "Encontro
   N" + botão download). pdm = linha com `FileText`/ícone de doc + "PDM —
   Plano de Desenvolvimento Mútuo" + "respondido em dd/mm" + ação "Ver"
   que dispara `onAbrirPdm` (prop callback — o dialog `InstrumentoResultado`
   é controlado pelo page pai, que já tem a entrega completa).
2. **Empty state** — substituir o `return null` por bloco:
   ícone muted + "Nenhum arquivo ainda" + sub "Evidências dos registros e
   o PDM respondido aparecem aqui." Manter a mesma `Card`/seção shell (a
   seção continua existindo — consistência com as demais).
3. **`duplas/[id]/page.tsx`** — após montar `arquivosDaDupla` (:403-412):
   ```ts
   const pdmEntrega = instrumentos
     .find(i => i.sistema === "pdm")
     ?.entregas.filter(e => e.status === "respondido")
     .sort((a,b) => (b.respondido_em ?? "").localeCompare(a.respondido_em ?? ""))[0];
   const arquivos = [
     ...(pdmEntrega ? [{ kind:"pdm", titulo:"PDM — Plano de Desenvolvimento
        Mútuo", respondido_em: pdmEntrega.respondido_em, resposta_id:
        pdmEntrega.resposta_id /* conferir campo real em InstrumentoEntrega */ }] : []),
     ...arquivosDaDupla,
   ];
   ```
   `onAbrirPdm`: state no page (ou lift do `InstrumentoResultado` já
   usado pelo card — extrair `const [pdmOpen, setPdmOpen]` e renderizar
   o dialog uma vez compartilhado; **mais simples**: o item PDM rola até
   o card Instrumentos? Não — abrir o dialog direto é melhor UX; reusar a
   mesma instância de `InstrumentoResultado` se o componente aceitar
   `open`/`onOpenChange` controlado — senão criar instância própria aqui,
   é leve).
   - **Audiência**: checar quem vê `InstrumentosDupla` hoje (o card é
     renderizado sob qual role?) — a seção Arquivos herda a mesma condição
     do card pra exibir o item PDM; mentorado vendo a ficha: se o card
     Instrumentos aparece pra ele, o item PDM pode aparecer; se não,
     filtrar `kind==='pdm'` antes de passar (defesa no page, comentada).
4. **Múltiplas respostas PDM** (revisão de meio de percurso gera nova
   entrega): item mostra a mais recente; `estadoAtual` do card já faz
   essa escolha — reusar a mesma lógica (extrair helper de
   `instrumentos-dupla.tsx` se precisar, ou duplicar as 8 linhas — é o
   mesmo critério "respondidas ordenadas desc").
5. **Opção B (REALIZA-181)** — documentada: quando `pdm_*` nativo chegar,
   trocar a montagem do item `kind:'pdm'` pra apontar pra rota nativa (ou
   export) — zero mudança no componente, que só conhece a union. Não
   criar nada de `pdm_*` agora.
6. **Demo** — `demoInstrumentosDaDupla` já existe (queries.ts:343): se o
   fixture tem entrega `pdm` respondida, o item aparece em `/demo`
   de graça; conferir e, se não houver, marcar uma entrega pdm como
   respondida no fixture (dado sintético, barato). Empty state: dupla
   demo sem anexos mostra o bloco.

## Casos de borda

- Dupla sem nenhum instrumento enviado → só empty state.
- PDM pendente/expirado (não respondido) → **não** vira item de arquivo
  (o card Instrumentos já cobre o status — Arquivos é só o produzido).
- Trilha especialista (sem instrumentos DPP) → sem item PDM, só anexos.
- `instrumentos` falhou na RPC (`error → []`) → seção degrada pra anexos +
  empty state honesto (o card também some — consistente).
- Anexos órfãos de registro sem encontro → já tratado no flatten atual.

## Verificação

`npx tsc --noEmit` · `npx eslint src/` · `pnpm test` (sem lib nova — se
extrair helper de "entrega atual", testar em `tests/`) · e2e demo: ficha
de dupla com PDM respondido mostra item PDM + anexos; dupla vazia mostra
empty state · e2e app staging: upload de anexo + resposta de PDM via
`/f/[token]` → ambos na seção; "Ver" abre o resultado.
