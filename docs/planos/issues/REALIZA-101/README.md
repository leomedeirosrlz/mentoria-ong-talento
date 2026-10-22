# REALIZA-101 — Fila de espera: visão "aguardando par" com tempo de espera e contato

**Jira:** REALIZA-101 · **Tier:** A (veredito FEITO — README de evidência) · **Status:** entregue, fechar no Jira

## Veredito

**FEITO.** A fila é derivada ao vivo (sem tabela nova): mentorados sem
nenhuma dupla no histórico + mentores com vaga livre, com tempo de espera,
origem e WhatsApp rápido — exatamente o contexto que faltava.

## Evidências

- **Núcleo puro:** `src/lib/fila.ts` — `filaMentorados`/`filaMentores`,
  `esperaDesde` (created_at ou carimbo do Google Forms em `form_bruto`:
  serial Excel, `dd/mm/aaaa hh:mm` ou ISO — `carimboFormBruto`),
  `textoEspera` ("há N dias"). Comentário de header cita REALIZA-101.
- **UI:** seção "Aguardando par" em `/pessoas` —
  `src/components/fila-espera.tsx` montada em `pessoas-listas.tsx:425`;
  trilha operacional na agenda da coordenação —
  `src/components/fila-acompanhar.tsx` montada em
  `agenda-coordenacao.tsx:254` (import `:19`, chip por turma `:193` no
  `PillTurma` do recon). WhatsApp rápido via `msgAguardandoPar`
  (catálogo `whatsapp-msgs`).
- **Mentor na fila:** `vagas` = `capacidade`/`capacidade_especialista` −
  duplas ativas/pausadas (pool por trilha, híbrido devolve as duas —
  `fila.ts` `trilhasDe`); mentorado fora do programa (`foraDoPrograma`,
  0077) não entra.
- **Demo:** dataset evergreen tem pessoas sem par (fixtures de fila no
  `seed-e2e-staging.mjs` e `demo/data.ts` — recon).
- **Testes:** `tests/fila.test.ts` — serial Excel do carimbo, `esperaDesde`,
  filas dos dois lados.
- **Sem migration:** confirmado — derivação pura como a issue permitia.

## Restos conhecidos

Nenhum funcional. Badge permanente vs. filtro: resolvido como seção
dedicada em `/pessoas` + rail na agenda — cobre a decisão aberta da issue.

## Esforço

N/A — encerrar.
