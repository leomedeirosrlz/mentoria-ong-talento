# REALIZA-22 — Plano de implementação

Dois recortes pequenos e independentes, um PR só:
**(A)** Agendar sempre visível no header da ficha quando `podeAgendar`;
**(B)** microcopy "oficial = sugestão" nas superfícies do mentor em `/agenda`.
UI pura — sem schema, sem action, sem query nova.

## Passo A — `src/app/(app)/duplas/[id]/page.tsx`

**A1.** Apagar o ramo que empurra o Agendar pro overflow (`:566-583`):

```tsx
// APAGAR este bloco inteiro:
if (pendenteRegistro && podeAgendar) {
  maisItens.push(
    <AgendarEncontroDialog … trigger={<DropdownMenuItem …>…Agendar encontro</DropdownMenuItem>} />
  );
}
```

**A2.** Na linha de ações (`:818-919`), tornar o Agendar **sempre renderizado**
quando `podeAgendar`, com peso variável por contexto — substituir o ramo
`:829-839` (`souMentor && !pendenteRegistro && podeAgendar`) por:

```tsx
{souMentor && podeAgendar && (
  // ação mais frequente do mentor — posição e presença estáveis: primária
  // quando não há pendência, secundária ao lado do Registrar quando há.
  // Nunca dentro do "Mais" (REALIZA-22)
  <AgendarEncontroDialog
    duplaId={dupla.id}
    numero={proximoNumero}
    atual={encontroAlvo}
    sugerido={sugeridoProximo}
    piso={dupla.iniciada_em ?? undefined}
    jovemNome={primeiroNomeMentorado}
    trigger={
      pendenteRegistro ? (
        <Button variant="outline" size="sm">
          <CalendarPlus size={16} />
          Agendar encontro
        </Button>
      ) : undefined  // undefined → trigger padrão do dialog (primário "Agendar encontro")
    }
  />
)}
```

Notas de implementação:
- `CalendarPlus` já é importado (`page.tsx` usa no item do menu que estamos
  apagando — o import permanece válido).
- `Button` e `buttonVariants` já importados.
- Ordem na linha: `Registrar encontro` (primário, `:821-828`) → `Agendar
  encontro` (outline) → `Pedir apoio` → resto. A posição é estável: Agendar é
  sempre o 1º ou 2º botão, nunca dentro do `DropdownMenu` `:897-918`.
- O caso `ehEsp` (`:840-851`) fica intocado — sessão de especialista só
  remarca a tentativa existente e já é renderização própria.
- Resultado: `maisItens` nunca recebe Agendar → o "⋯ Mais" volta a ser só
  formulário/especialista/encerramento.

**A3.** Verificar se `maisItens` pode ficar vazio para mentor sem as outras
ações — já tratado por `{maisItens.length > 0 && …}` (`:897`), nada a fazer.

## Passo B — microcopy "oficial = sugestão" em `/agenda`

**B1.** Subheader do ramo mentor (`src/app/(app)/agenda/page.tsx:254-259`) —
a mesma frase vale pras 3 abas do mentor (minha / por-mentorado / calendário):

```tsx
<p className="mt-1 text-sm text-muted-foreground">
  Os encontros do ciclo, os que você marcou com suas duplas e o que seus
  jovens fazem com os especialistas. As datas oficiais do guia são sugestões
  — vocês combinam a real e registram aqui.
</p>
```

**B2.** Rodapé da legenda do calendário para o mentor
(`src/components/agenda-calendario.tsx`, `LegendaAgenda` `:3823-3902`) —
linha discreta ao final da barra de legenda, renderizada só quando quem vê é
o mentor DPP (a legenda já recebe props condicionais; passar `role` ou um
`mostrarNotaSugestao` do caller — `AgendaCalendario` já recebe `role` e
`papeis` em `:436`):

```tsx
{mostrarNotaSugestao && (
  <span className="w-full text-xs text-muted-foreground sm:w-auto sm:ml-auto">
    As datas oficiais são sugestões — vocês combinam e registram a real.
  </span>
)}
```

`mostrarNotaSugestao = temPapel(papeis, "mentor_dpp")` — coord/sup não
precisam da explicação operacional (eles não agendam; a nota é instrução de
trabalho do mentor).

**B3.** Ficha da dupla: **nada a fazer** — `Encontros · datas sugeridas pelo
guia` (`page.tsx:1315-1321`) já comunica o conceito onde a dupla de fato
agenda.

## Passo C — gates

- `npx tsc --noEmit` + `npx eslint src/` limpos.
- `pnpm test` — sem teste novo obrigatório (mudança de JSX/copy; os asserts
  de domínio ficam nos e2e).
- e2e: estender spec existente de ficha (demo, papel mentor) — ver
  acceptance.md; não precisa spec nova de arquivo.

## Rollback

Dois hunks de JSX e duas linhas de copy — `git revert` do PR. Zero dados.

## Questões em aberto

Nenhuma. (Se o Thiago quiser "Agendar o Nº encontro" no rótulo do header — a
issue 27 já pede nº explícito — o dialog já abre com `numero={proximoNumero}`
e o título interno é "Nº encontro"; manter o rótulo curto "Agendar encontro"
é o default deste plano, consistente com o restante do header.)
