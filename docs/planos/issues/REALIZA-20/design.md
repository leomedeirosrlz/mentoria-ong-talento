# REALIZA-20 — Design

## Persona / JTBD

- **Jovem (mentorado), mobile-first, sem login**: "abri o link no ônibus,
  escrevi metade, cheguei em casa e quero continuar no computador da
  biblioteca — sem recomeçar".
- **Mentor DPP**: "quero ver se ela já começou antes de cobrar; e se vier
  incompleto, devolver com uma frase em vez de reemitir".
- **Coord**: mesmo monitoramento, qualquer dupla.

## Superfícies tocadas

1. `/f/[token]` — o form público (`formulario-publico.tsx` + `instrumentos/`).
2. "Minha jornada" (`/jovem/materiais`) — estado "em andamento" real.
3. Ficha da dupla — `instrumentos-dupla.tsx`: status + devolução.

## Fluxos

### Rascunho cross-device (jovem)

- Abre o link → `marcar_link_visto` fire-and-forget.
- Digita → debounce 800ms → `salvarRascunho`; indicador discreto
  "Salvando…" → "Rascunho salvo" (não bloqueia, não rouba foco).
- Falha de rede/offline → cai pro localStorage (status quo) e volta a
  sincronizar na próxima mudança — silencioso, sem alarme.
- Reabre em outro aparelho → servidor devolve rascunho → banner
  "Continuando de onde você parou" + campos preenchidos.
- Conflito (rascunho local mais novo que o server): preferir o **server** se
  `salvo_em` > timestamp local; caso contrário mesclar pelo local e salvar —
  na dúvida, nunca perder o que está na tela.

### "Em andamento" (mentor/coord/jovem)

- Ficha: célula do instrumento pendente mostra badge "Em andamento" quando
  `resposta.status='rascunho'` (em vez de só "Pendente").
- Jornada do jovem: estação `a_fazer` com rascunho server-side exibe
  "Em andamento" (substitui o pill local-only do `JornadaRascunho` quando o
  servidor informa; pill local segue como fallback).

### Devolução

- No resultado enviado (ficha): botão "Devolver para correção" → dialog:
  "A resposta volta pra {nome do jovem} revisar. Quer deixar um recado?"
  (textarea opcional) → confirma.
- Jovem (via notificação + próxima abertura do link): form abre com
  respostas preenchidas + banner amarelo "Seu mentor pediu uma revisão:
  {motivo}" → re-submete normalmente.
- Após re-envio: status 'enviada', `devolvido_*` mantido (histórico).

## Estados

- Link inválido/expirado/outra pessoa/já respondida: estados existentes em
  `/f/[token]` não mudam — 'devolvida' é o único caso "respondida mas
  editável" (mensagem própria).
- Loading: form segue skeleton atual; autosave nunca bloqueia.
- Erro de salvamento: silencioso (retry no próximo debounce) + Sentry.
- Sucesso de devolução: toast + célula vira "Devolvida p/ revisão".

## Reuso de componentes (`src/components/ui/` + existentes)

- `Dialog`/`Textarea`/`Button`/`Badge` — padrão da casa.
- `JornadaRascunho` (badge warn "Em andamento") — reusado, fonte do dado muda.
- `InstrumentosDupla` células — extend, não recriar.
- Nenhum componente novo inventado: banner de devolução usa o mesmo
  `Banner`/alert-pattern dos erros de campo (`ErroCampo`/`notice` styles).

## Microcopy pt-BR

- Salvando: "Salvando rascunho…" / "Rascunho salvo às 14:32".
- Restore: "Continuando de onde você parou."
- Devolver (mentor): "Devolver para correção" / confirmação "A resposta
  volta pra revisão dela. Tudo que ela escreveu continua lá."
- Jovem devolvido: "Seu mentor pediu pra você revisar algumas respostas."

## a11y

- Autosave anunciado por `aria-live="polite"` uma vez (não a cada tecla).
- Banner de devolução `role="alert"` na abertura; depois `role="note"`.
- Foco preservado durante saves (não re-render destrutiva — o form é
  controlado).
