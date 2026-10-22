# Requisitos que REALIZA-181 absorve de REALIZA-142

Origem: REALIZA-142 (Metas: submetas recursivas). Revisto no alinhamento
(Kelyng, out/2026): submetas são **cascateadas** — o PDM nativo precisa
absorver:

1. **Submetas recursivas** — uma submeta pode ter submetas, em qualquer
   profundidade prática; **~20 submetas no total por ficha** (limite
   flexível decidido). Nada de lista flat de 5. Modelo natural:
   `pdm_itens` com `parent_id` (a estrutura que
   `docs/planos/atividades-interativas.md` já propõe) — **a mesma
   estrutura serve Metas e PDM** ("transcreve ou compartilha?" →
   compartilha: submeta do Metas e do PDM é o mesmo dado).
2. **`prazo_alvo` + `atingida_em`** — duas datas por meta/submeta;
   checkbox "meta atingida" revela "quando?".
3. **Retrospectiva** — metas atingidas entram no resumo de encerramento
   (alimenta o `ResumoJornadaSection`/relatório final).
4. **UI da árvore é o ponto delicado** — indentação leve, collapse,
   "adicionar dentro desta", sem vira-lâmina de níveis; variantes
   próprias na rodada de mockups (REALIZA-137).
5. **`instrumento-resultado`/leituras** mostram árvore + prioridade +
   prazo vs. atingimento; respostas antigas (JSONB flat `meta_N`) seguem
   renderizando.

Decisões abertas que 181 herda (anotar no plano dela):

- Metas atingidas na retrospectiva: automático ou o jovem revisita antes?
- Profundidade visual: limitar exibição a N níveis com "ver mais" ou
  renderizar tudo?

Coordenação com Cluster I (este cluster): a âncora de identidade é
`dupla_id`/`mentorado_id` (REALIZA-16) — `pdm_metas`/`pdm_itens` nascem
pendurados nela; e a distribuição/leitura via link segue a espinha de
`formulario_links` (REALIZA-20) — o PDM nativo é projeção de domínio que
convive com a resposta de form até a transcrição definitiva.
