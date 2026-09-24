# Auditoria UX — Formulários (consolidado)

> **Status: implementado** — A1–A10, B1–B7, C1–C6. Auditoria por 3 agentes
> críticos, implementação em 3 frentes disjuntas, validação visual
> desktop+mobile + gates verdes. Itens adiados na seção "Fica de fora"
> seguem pro BACKLOG.

Fontes: 3 agentes críticos (lado coord, lado respondente, consistência/slop) sobre
código + screenshots. Regra da casa: SLC, sem placeholder, pt-BR, seguir o design
system existente (tokens em globals.css, motion em components/motion.tsx,
ui/* primitivos, `<details>` nativo, overline `text-[11px] font-semibold
uppercase tracking-[0.08em] text-muted-foreground`).

## O que entra (seleção)

### Frente A — "Gerar links" em massa (`formulario-links.tsx`, `enviar-formulario-dialog.tsx`, novo `src/components/forms/`)

A1. **Seleção por cargo** (pedido explícito do Thiago): dialog passa a agrupar
    destinatários por papel — Mentores DPP · Mentores especialistas ·
    Supervisores · Mentorados — com checkbox-mãe por grupo ("Selecionar todos"),
    contador "N de M selecionados", busca com `normaliza` (já existe em utils e
    no dialog irmão). Coordenação sai da lista de destino (nunca recebe form).
    Quem já tem link pendente (`comLinkVigente`) fica desmarcável mas identificado
    ("já tem link").
A2. **Estado "links prontos" pós-gerar**: hoje o dialog fecha e os 30 links caem
    no fim da lista (ordem `created_at asc`). Reusar o padrão que já existe em
    `enviar-formulario-dialog.tsx`: dialog permanece aberto mostrando cada
    destinatário com seu link + Copiar + "Enviar no WhatsApp".
A3. **Extração dos duplicados**: `CopiarLink`, `urlPublica`, `VALIDADE_OPCOES`,
    `primeiroNome`, campo "Validade dos links", row "pessoa+checkbox+detalhe"
    estão copiados verbatim entre `formulario-links.tsx` e
    `enviar-formulario-dialog.tsx` (já divergiram: token trunca 12 vs 14 chars).
    Extrair pra `src/components/forms/` — os dois dialogs passam a usar o mesmo.
A4. "link enviado" → **"já tem link"** (a UI afirma envio que nunca aconteceu).
A5. **Seleção reseta ao fechar o dialog** (`onOpenChange` limpa `selecionados`).
A6. **Link genérico**: não duplicar a cada clique — reusar genérico pendente;
    após gerar, auto-copiar a URL e destacar a linha.
A7. **Reemitir** em link expirado (mesmo destino, novo token — colapsa
    excluir→dialog→gerar) e esconder `Copiar` em link respondido (copia link morto).
A8. Links listados **pendentes primeiro** (respondidos/expirados depois).
A9. `NudgeButton` compõe `buttonVariants({variant:"outline",size:"sm"})` —
    hoje tem gramática própria ao lado de Button real (3 alturas na row).
A10. Overline do fieldset → `text-[11px]` (hoje `text-xs`/`text-sm` misturados);
    lista rolável ganha `scroll-fina`; `DialogFooter` real no enviar-dialog;
    crossfade `AnimatePresence` na troca form↔links prontos; chip "oficial" vira
    `<Badge>` em vez de `text-[10px]` hand-rolled.

### Frente B — ficha, builder e lista (`(app)/formularios/**`)

B1. **Selects vazando enum cru** (bug visível): `formulario-builder.tsx` tipo de
    pergunta mostra `escala_1_5`/`sim_nao` e `formulario-links.tsx` validade
    mostra `0` — falta `items=` no Select (os outros 14 Selects do app passam).
B2. **Ficha prioriza leitura**: hoje ~60% da página é o editor de perguntas (job
    raro e perigoso — editar versiona e órfã respostas). Faixa de status sob o
    header (`N pendentes · N respondidos · N expirados`), editor atrás de
    `<details>` "Editar perguntas" — a renderização de leitura já existe pro
    branch `sistema`, estender pra todo form.
B3. **Lista com "N pendentes"** (o número acionável) em warn-text; encerrados
    com opacidade reduzida. Query passa a selecionar `expira_em`.
B4. **Pré-visualizar**: botão na ficha/builder renderizando `FormularioPublico`
    read-only — a coord manda pra 30 pessoas sem nunca ter visto a página.
B5. "Excluir" sai do header (destrutivo não é CTA de primeiro nível) → zona de
    perigo no fim ou kebab.
B6. Respostas: rótulo da barra deixa de truncar sem saída no toque (wrap/`basis-full`
    no mobile); barras "Não"/negativas não pintam em lime de marca (neutro);
    `<summary>` ganha o `focus-visible:ring` da casa; empty states alinham
    (texto puro ou radius xl — hoje `border-dashed rounded-lg` diverge).
B7. Builder: remove `font-mono text-[0.8rem]` da textarea de opções; overlines
    → 11px; `/formularios/novo` ganha `loading.tsx` (convenção por rota).

### Frente C — formulário público `/f/[token]`

C1. **Validação por campo** (a dor real de 12 perguntas no celular): `noValidate`
    + mapa `erros` por campo → mensagem inline sob cada campo (`aria-describedby`
    + `aria-invalid`), scroll+focus no primeiro inválido, `role="alert"` em
    região estável. Acaba o drip-feed de "um erro por tentativa".
C2. **Progresso**: perguntas numeradas (`1.`–`12.`) + barra fina no topo do card
    com "N de M" (padrão do onboarding: `role="progressbar"` + barra lime).
C3. **Erro ≠ não encontrado**: `formularioPorToken` distingue falha de rede de
    token inválido → card "Não foi possível carregar" + "Tentar de novo".
C4. Micro-copy/confiança: linha de privacidade sob a descrição ("lidas apenas
    pela equipe" + link `/privacidade`); "N perguntas · leva ~X min"; nome
    capitalizado ("Olá, Thiago!" não "thiago"); `generateMetadata` com o título
    real do form (preview do WhatsApp hoje diz "Formulário").
C5. Estados de erro ganham ação: `mailto:mentoria@realiza.vc` nos cards
    expirado/inválido/inativo (hoje beco sem saída).
C6. Polish: `enterKeyHint="next"/"done"`; segmentos sim_nao/1-5 com
    `has-checked:ring-2` (seleção visível em tela barata/forced-colors);
    marcação vira "(opcional)" nos não-obrigatórios (convenção da casa — hoje
    `*` vermelho inverte a gramática); hint multi_select respeita obrigatório
    ("marque ao menos uma"); sucesso vira `<h1>`; EstadoCard com tom ok pro
    "já respondida"; logo com `width`/`height` (CLS); caption 11px.

## Fica de fora (registrar no backlog, não agora)

- Rascunho em localStorage do form público (privacidade sensível — avaliar)
- Tipo de campo `secao`/grupo (mudança de schema + builder)
- `rotulo_min`/`rotulo_max` e `ajuda` por campo (schema)
- Export CSV de respostas (`/api/export?tipo=respostas`)
- Filtros/busca na lista de formulários; aviso de título duplicado com oficial
- "Expandir todas" nas respostas
- Forced-colors/HC pass completo, swipe gestures, autosave do builder
