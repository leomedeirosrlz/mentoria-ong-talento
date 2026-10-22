# REALIZA-144 — design.md (wizard de formulário público)

## Persona & JTBD

- **Respondente público** (mentor/candidato/mentorado no celular, link do
  WhatsApp): "responder um formulário longo sem me perder" — ~26 campos
  do intake ficam digeríveis em capítulos.
- **Coordenação**: "formulário com seções já vira wizard sozinho" — sem
  toggle extra pra aprender (a estrutura é a intenção).

## Hierarquia de tela (wizard ativo)

1. Pill sticky topo: **`Etapa 2 de 5`** + barra de progresso por etapa.
   (Substitui "N de M respondidas" — dois contadores confundem; dentro da
   etapa, caption `text-xs` "3 de 5 nesta etapa" se a etapa tiver >1
   obrigatória respondida… na prática: omitir — menos é mais; decisão:
   só "Etapa X de N".)
2. Card de título do form (faixa lime) — só na etapa 1? **Não**: sempre
   visível no topo do passo 0; etapas seguintes abrem direto no card da
   seção (scroll já está no topo pelo foco/scroll-into-view).
3. Card da etapa: heading `secao.label` + perguntas da etapa (um card por
   pergunta, padrão v2).
4. Rodapé sticky: `← Voltar` | `Avançar →` / `Enviar resposta`.

## Microcopy pt-BR (final)

- `Etapa {x} de {n}` · `Voltar` · `Avançar` · `Enviar resposta`
- Etapa sem `secao` inicial: heading fallback **"Suas informações"**.
- Erro de etapa: `"Revise os campos marcados."` (banner de validação já
  existente) + erros inline por campo.
- Sucesso: inalterado ("Resposta enviada!").

## Estados

- **Validação por etapa**: erros inline só da etapa atual ao Avançar;
  submit final pula pra primeira etapa com erro + foco.
- **Campo condicionalmente oculto** (36) não conta na etapa.
- **Secao vazia consecutiva**: fundida/ignorada em `etapas()` — nunca
  renderiza passo em branco.
- **Preview**: Avançar/Voltar vivos, submit off ("Envio desligado na
  prévia" já existe).

## Mobile → desktop

- Mobile-first: rodapé sticky com safe-area (`pb-[env(safe-area-inset-bottom)]`),
  botões 44px; em `sm+` rodapé inline dentro do card (não sticky —
  preview da house).
- Grade/tabela larga (grid_disponibilidade do 36) rola dentro do card.

## Movimento

- `motion.div` por etapa: `fade` + `x: ±12` direcional (avançar → entra
  pela direita; voltar → esquerda), `T.micro`. `reducedMotion="user"`
  global já cobre.
- Pill e conteúdo sem stagger (anti-slop: nada de 35 animações).

## Acessibilidade

- Heading da etapa `tabIndex={-1}` recebe foco a cada passo (ref
  callback); leitor de tela anuncia "Etapa 2 de 5 — <label>".
- `role="group"`/`aria-labelledby` por etapa; erros com `role="alert"`
  estável no DOM (região persistente, padrão atual).
- Enter em campo de etapa intermediária = Avançar (não submit); Último
  passo tem o único `type="submit"`.
- Wizard desligado (sem `secao`) = markup atual intacto.

## Reuso

`Button`, `Badge`, `fade`/`T`/`motion`, pill sticky existente, honeypot,
estrutura de cards v2. Nada de `ui/` novo.
