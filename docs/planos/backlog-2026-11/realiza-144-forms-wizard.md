# REALIZA-144 — Wizard por seções nos formulários públicos `/f/[token]`

Issue: `ux`, `forms`. Fonte: backlog 2026-11. Status: a fazer.

## O que exige vs. o que existe

Os formulários respondidos por link público (`/f/[token]`, sem login) viram
um wizard: uma seção por vez, progresso visível ("seção 2 de 5" + barra),
validação por seção, voltar livre sem perder nada.

Recon do que existe (`src/app/f/[token]/`):

- `formulario-publico.tsx:68-88` — o dispatcher: `sistema` reconhecido →
  `InstrumentoFlow` (visão/metas/PDM/roda, render sob medida); demais →
  `FormularioGenerico`.
- `formulario-publico.tsx` (~:330-800) — o genérico hoje é **uma página
  contínua**: campos `tipo:"secao"` viram divisores editoriais (:783-799),
  progresso fixo é só contagem "N de M" respondidos com barra (:404-425),
  visibilidade condicional via `visivel(campo, atuais)`, rascunho em
  `localStorage` sob a chave `rascunho:/f/${token}`, submissão única via
  `coletaRespostas`/`validaRespostas`/`leDeFormData`
  (`src/lib/forms/resposta.ts`).
- `src/lib/forms/instrumentos.ts` — `agrupaEmSecoes(campos)` agrupa campos
  pelo `secao` precedente; os 4 instrumentos sob medida já o usam para
  capítulos (`metas.tsx:6,43`, `pdm.tsx:6,41`, `visao.tsx:6,31`), mas
  renderizam tudo em continuidade — `Visao` documenta explicitamente "não
  é wizard trancado".
- `src/components/onboarding-flow.tsx` — padrão de wizard já praticado no
  repo: estado `step`, `AnimatePresence`+`motion/react` por passo, footer
  Voltar/Avançar, salvar parcial por passo, foco gerenciado na troca,
  progresso `step+1/total`, dados preservados ao voltar.
- `motion/react` + `AnimatePresence` já são dependência usada nos
  instrumentos e no form público (fade entre etapas enviado/erro).

## Decisões

1. **Alvo: `FormularioGenerico` apenas.** Os 4 instrumentos sob medida
   (visão, metas, PDM, roda) já têm UX própria de capítulos decidida por
   design — a Roda já é interativa por eixo, o PDM tem sumário lateral
   responsivo, a Visão é propositalmente um documento único. O wizard
   resolve a dor real: formulários genéricos longos (inscrição, avaliações
   360 finais com 10–18 perguntas, forms de coord) hoje em scroll único.
   Quando o form genérico tiver **0 ou 1 seção com perguntas**, renderiza
   como hoje (página única) — wizard só ativa com ≥2 seções.
2. **Modelo: stepper "uma seção por vez", não scroll-animado.** Justificativa
   (público jovem, mobile-first, respondendo pelo WhatsApp):
   - Seção = unidade de sentido do form (o `tipo:"secao"` já é chapter
     break semântico); validar por seção localiza o erro onde ele está,
     em vez de saltar o scroll pro primeiro erro.
   - Stepper é o padrão já provado no repo (onboarding) — transição
     `AnimatePresence` com `mode="wait"`, `key={etapa}`.
   - Scroll-contínuo com seções desbloqueando foi considerado e descartado:
     mantém o form inteiro no DOM (pior em telas fracas), o progresso por
     posição de scroll é menos explícito, e a validação por seção fica
     ambígua quando várias seções estão visíveis.
3. **Estado: todas as seções montadas, só a corrente visível.**
   `hidden`/`display:none` na não-corrente, `key` estável por seção.
   Razão: a coleta via `FormData` + `leDeFormData`/`coletaRespostas`
   continua **byte-a-byte igual** — payload idêntico, `visivel()` segue
   filtrando campos condicionais, o rascunho `rascunho:/f/<token>` segue
   com o mesmo formato (serializa valores, não DOM), e voltar nunca perde
   digitação. Alternativa (state controlado estilo `useResposta`)
   duplicaria a coleta — rejeitada por risco de divergência de payload.
4. **Navegação e validação:**
   - Footer fixo: `Voltar` (sempre habilitado, nunca valida, nunca perde
     dados) + `Avançar` (valida só a seção corrente) — na última seção o
     botão vira `Enviar resposta` e o submit segue o fluxo atual
     (honeypot, `submeterRespostaFormulario`, estados enviado/erro).
   - Validação por seção: mesmas regras de `validaRespostas` aplicadas ao
     subconjunto de perguntas visíveis da seção corrente; erros ficam
     marcados na seção e o usuário pode voltar mesmo com erro pendente —
     **voltar nunca é bloqueado**; avançar com erro não muda de seção.
   - Progresso: header sticky com "Seção N de M" + barra (mesma gramática
     visual do progresso atual por perguntas, agora por seção). Seções
     passadas ficam marcadas como vistas; não há pulo direto entre seções
     não-visitadas (linear, mas sem trava de "completar tudo" para voltar).
   - Visibilidade condicional vive dentro da seção (`visivel()` inalterado);
     campo que some continua não-bloqueante, como hoje.
   - Acessibilidade: `aria-live`/foco no título da seção ao trocar (padrão
     do onboarding), `aria-disabled` no Avançar durante validação, motion
     já coberta pelo guard global de `prefers-reduced-motion`.
   - Rascunho: a seção corrente persiste junto do rascunho (`rascunho` já
     salva valores; adicionar `etapa` ao payload do draft para reabrir onde
     parou — compat: draft antigo sem `etapa` cai na seção 1).
   - Upload/disponibilidade em `extras` seguem na mesma estrutura — o
     componente de grid/upload permanece dentro da sua seção.
5. **Token/no-login inalterado.** Nenhuma mudança em rota, RPC, RLS ou
   `formulario_links`; o wizard é camada de apresentação do renderer.

## Schema

Nenhuma. (Mudança 100% client-side no renderer do `/f/[token]`.)

## Domínio (src/lib/)

- `src/lib/forms/resposta.ts`: expor `validaSecao(camposDaSecao, formData)`
  (ou param `escopo` em `validaRespostas`) — reusa as mesmas regras de
  obrigatório/`campoRespondido`, sem copiar lógica. `agrupaEmSecoes` já
  existe em `src/lib/forms/instrumentos.ts` — o genérico passa a usá-la.
- Nenhuma mudança em `coletaRespostas`, `leDeFormData`, `aplicaOutro` —
  contrato de payload preservado.

## UI

- `src/app/f/[token]/formulario-publico.tsx`:
  - `FormularioGenerico` ganha ramo wizard: `secoes = agrupaEmSecoes(campos)`
    → se ≥2 seções com pergunta visível, renderiza `WizardSecoes`; senão,
    o layout atual.
  - `WizardSecoes` (mesmo arquivo ou `wizard-secoes.tsx` novo):
    estado `etapa` (0-based), header sticky "Seção N de M" + barra
    (`motion` width animada), corpo = seções montadas com `hidden` salvo a
    corrente, footer fixo Voltar/Avançar(→Enviar), `AnimatePresence`
    `mode="wait"` `key={etapa}` com o fade/slide do `components/motion`.
  - Erros de validação de seção aparecem inline por campo (mesmo estilo
    de erro atual) + sumário curto no topo da seção em erro.
  - Capa/agradecimento e estados enviado/erro inalterados.
- Instrumentos sob medida: sem mudança (ver Decisões).

## Seed + demo

- Form de sistema com ≥3 seções (ex.: avaliação final mentorado, 18
  perguntas em seções — migration 0130) serve de caso-âncora nos e2e.
- Se a demo (`src/lib/demo/`) renderizar forms públicos, replicar o ramo
  wizard; se não renderizar, sem mudança.

## Testes

- vitest `resposta.test.ts`: `validaSecao` marca só campos da seção;
  seção sem obrigatórios passa; condicional oculta não bloqueia.
- e2e/componente:
  - `/f/<token>` com 3 seções → "Seção 1 de 3", Voltar ausente/na capa,
    Avançar com obrigatório vazio mostra erro e **não** troca de seção.
  - Voltar preserva todos os valores preenchidos (incl. multi-chip,
    textarea, upload stubado).
  - Draft: recarregar reabre na seção salva com valores; submeter limpa
    `rascunho:/f/<token>` como hoje.
  - Paridade de payload: interceptar `submeterRespostaFormulario` —
    campos/valores idênticos ao fluxo página-única (fixture: mesmo form
    respondido nas duas renderizações).
  - Form sem seções renderiza página única (regressão).
  - Token inválido/expirado e fluxo sem login inalterados.

## Critérios de aceite

- [ ] Form genérico com ≥2 seções abre em wizard: "Seção N de M" + barra,
  uma seção visível por vez, transição animada.
- [ ] Avançar valida somente a seção corrente; Voltar funciona sempre e
  nunca perde dados.
- [ ] Última seção envia com o payload **idêntico** ao atual
  (`coletaRespostas`/`leDeFormData` sem mudança de formato).
- [ ] Rascunho persiste por token e restaura seção + valores; limpa no
  envio (comportamento atual preservado).
- [ ] Campos condicionais (`visivel`) e uploads/grids (`extras`) funcionam
  dentro das seções.
- [ ] Sem login e sem mudança de token/rota; foco + `aria-live` na troca
  de seção; `prefers-reduced-motion` respeitado.
- [ ] `npx tsc --noEmit` e `npx eslint src/` limpos; vitest/e2e verdes.

## Fora de escopo

- Redesenhar os 4 instrumentos sob medida (visão/metas/PDM/roda) — já têm
  UX própria de capítulos.
- Permitir pulo não-linear para seções não-visitadas (sumário clicável).
- Mudanças no editor `/formularios` (criação/edição de campos).
- Validação server-side nova — a RPC `submeter_resposta_formulario` já
  revalida tudo; o wizard é UX honesta por cima.
