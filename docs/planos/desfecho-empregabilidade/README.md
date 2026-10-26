# Desfecho de empregabilidade do jovem (REALIZA-216)

> Desenho para aprovação antes de implementar. Nada daqui está no código ainda.

## Por quê

A plataforma mede o **processo** (encontros, registros, instrumentos, semáforo), mas não o **resultado** que o Instituto entrega: o jovem estudando, trabalhando ou empreendendo depois da mentoria. Sem esse número, o `/resumo` conta esforço e não impacto, e o relato para ONGs, empresas e financiadores depende de planilha à parte.

## O que medir (o mínimo que responde à pergunta)

Duas perguntas obrigatórias e uma opcional, iguais nos dois momentos:

1. **Hoje você está…** (múltipla escolha, pode marcar mais de uma)
   estudando · trabalhando com carteira (CLT) · estágio · Jovem Aprendiz · trabalhando sem carteira / bicos · empreendendo · procurando trabalho · nenhuma das anteriores
2. **Quanto a mentoria ajudou nisso?** (1 a 5)
3. *(opcional)* **Quer contar alguma conquista?** (texto curto)

Dados que **já existem** e entram no mesmo retrato, sem perguntar de novo:
- Roda da Vida: leitura inicial × aplicação formal (diferença média por área);
- PDM: metas atingidas / metas totais;
- Avaliação média dos encontros (estrelas do jovem).

## Quando perguntar

| Momento | Gatilho | Canal |
|---|---|---|
| **Encerramento** | dupla vira `concluida` (0102) → emite o link junto do 360º | link na jornada do jovem + e-mail |
| **6 meses depois** | tick diário (`/api/jobs/tick`): dupla concluída há 180 dias → emite e avisa | e-mail + WhatsApp pela coordenação (lote, como a 0114) |

O link de 6 meses precisa valer para dupla **concluída**: hoje a emissão para em dupla encerrada. É uma exceção explícita só para este formulário.

## Como guardar (reaproveitando o que existe)

- **Formulário de sistema novo**, `sistema = 'desfecho'`, imutável como os oficiais (`0036`/`0115`). Respostas em `formulario_respostas`, link por `formulario_links`, com `contexto.momento = 'encerramento' | '6m'`.
- **Ledger** de emissão do 6m (fire-once por dupla), no molde da `0108`/`0122`.
- **Agregado** por turma numa RPC definer (`desfecho_agregado(p_turma)`), com só contagens e médias e **n mínimo de 5** por célula (abaixo disso, "dados insuficientes"), para nenhum jovem ser identificável.

## Onde aparece

- **`/resumo` (público, com senha):** card "Depois da mentoria", com "% estudando ou trabalhando", a mudança 0 → 6 meses, a melhora média na Roda e as metas atingidas. Só agregados.
- **Ficha da dupla (coordenação):** a resposta individual do jovem, junto do resumo da jornada.
- **`/relatorios`:** export CSV agregado por turma.

## LGPD

- **Finalidade** explícita no topo do formulário: "para o Instituto medir se a mentoria ajuda e prestar contas a quem apoia o programa; publicamos só números agregados".
- **Minimização:** não pergunta empresa, salário nem cargo.
- **Menores:** a pergunta vale também para quem tem menos de 18 anos. A autorização do responsável já cobre o tratamento no programa, mas vale confirmar com o jurídico (ver REALIZA-33).
- **Público:** só agregados com n ≥ 5. Texto livre nunca sai da ficha.

## Decisões que precisam do Thiago

1. As opções da pergunta 1 estão certas? Falta "serviço militar" ou "cuidando da família"?
2. O de 6 meses vai também por WhatsApp (lote pela coordenação) ou só por e-mail?
3. Perguntamos também ao **mentor** a percepção dele sobre o desfecho? (Recomendo que não, para não ter duas verdades.)
4. n mínimo de 5 no público está bom?

## Fatias de entrega (depois do aceite)

1. Migration: formulário `desfecho` + emissão no encerramento + agregado.
2. Tick do 6 meses + lote por e-mail/WhatsApp.
3. Card no `/resumo` + ficha + export.
4. e2e app: concluir → link → responder → agregado no `/resumo`.
