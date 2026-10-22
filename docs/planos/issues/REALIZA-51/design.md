# REALIZA-51 — Design

## Persona / JTBD

- **Coordenação**: "acabou o encontro 1 — quero mandar a Visão pra 24
  duplas de uma vez, sem abrir ficha por ficha".
- **Mentor**: continua encaminhando manualmente (WhatsApp) — nada muda.
- **Jovem**: recebe e-mail com link direto (ou o mentor repassa).

## Superfície

`/materiais` (coord) → `painel-jornada.tsx`: a tabela instrumento×dupla
já mostra quem respondeu. Fluxo:

1. Cabeçalho da coluna do instrumento ganha ação "Enviar em lote" (só
   quando há pendentes) →
2. Checkbox por linha nas pendentes ("selecionar pendentes" default) →
3. Dialog confirmação →
4. Relatório.

## Hierarquia do dialog

```
Enviar "Construindo a Visão" em lote
────────────────────────────────
18 duplas selecionadas
Quem recebe o e-mail:
  ● Jovem (14 com e-mail)   ○ Mentor repassa
  ⚠ 4 jovens sem e-mail → cai pro mentor
────────────────────────────────
Prévia do e-mail ▾  (assunto + corpo com {nome} e link)
[Cancelar]            [Enviar 18 e-mails]
```

## Relatório pós-envio

Lista por dupla: ✓ enviada · ↺ link reutilizado · ⚠ pulada (sem e-mail /
encerrada / trilha) · ✗ falhou — cada linha de falha/pulada com botão
`wa.me` "mandar no WhatsApp" (o deep link per-dupla já existe — reuso de
`waLink`/`msgsContato`).

## Estados

- Vazio: instrumento sem pendentes → ação some/razão ("todas já
  responderam ou receberam link").
- `EMAIL_ENVIO_LIBERADO=false`: banner no dialog "Envio de e-mail está
  desligado no ambiente — os links são emitidos e ficam prontos pra
  WhatsApp manual". (Comportamento honesto: lote ainda emite.)
- Erro parcial: relatório mostra falhas com retry por linha.
- Loading: botão vira spinner; dialog trava durante envio (ou resultado
  progressivo se streaming — simples: aguardar).

## Reuso (`src/components/ui/` + existentes)

- `Dialog`, `Checkbox`, `Button`, `Badge`, `RadioGroup`(se existir —
  senão o padrão de segmentos usado nos instrumentos).
- `NudgeButton`/`waLink` existentes pros fallbacks manuais.
- `enviar-email-dialog.tsx` (lote de material já existe!) — **reuso de
  padrão**: mesmo modelo mental (selecionar→confirmar→relatório); copiar
  estrutura.

## Microcopy pt-BR (e-mail)

- Assunto: "{instrumento}: chegou a sua vez na jornada 🌱"
- Corpo: "Oi {nome}, seu mentor abriu a {instrumento} pra você. É seu —
  responda no seu tempo, sem senha: {link}. Vale até você enviar."
- Fallback mentor: "…repasse pra {jovem}: {link}".

## a11y

- Checkbox com label "Selecionar {dupla}"; relatório com `role="status"`;
- erros por linha com `role="alert"` discreto.
