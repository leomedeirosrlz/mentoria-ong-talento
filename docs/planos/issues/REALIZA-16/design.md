# REALIZA-16 — Design (mínimo: issue é quase toda de dados)

## Persona / JTBD

- **Coordenação**: "quando o jovem ganhar conta, quero que tudo que ele já
  respondeu apareça — sem re-coletar nada".
- **Mentorado (futuro usuário)**: "entro e minha jornada inteira já está lá".

Não há tela nova no caminho principal (o vínculo `profile_id` já é feito pela
coord no cadastro/convite). O único UI possível é o **plano B** do plan.md —
reconciliação de resposta órfã, se links genéricos forem mantidos.

## Plano B adotado pro legado: "Vincular resposta"

(Revisão ux: o `Command`/busca-pessoa citado aqui **não existe** — o picker
real é o `Select` de `src/components/ui/`, mesmo padrão da seleção de
mentorado em `nova-dupla-dialog.tsx`.)

- Superfície: ficha do formulário em `/formularios/[id]` — respostas órfãs
  (link genérico manual, pré-0116) aparecem com badge "sem vínculo" e ação
  "Vincular a um jovem" no rodapé do card expandido
  (`respostas-section.tsx`); o link genérico ainda vivo (pendente/expirado)
  recebe o mesmo badge + botão na lista de links (`formulario-links.tsx`).
- `vincular-resposta.tsx` [NOVO]: `Dialog` + `Select` com `items` de
  mentorados (a página já carrega a lista) — sem busca assíncrona.
- Confirmação exibe o que será vinculado: formulário + data da resposta +
  jovem escolhido. Microcopy pt-BR: "Vincular esta resposta a {nome}? Todo o
  histórico dela passa a contar na jornada dessa pessoa."
- Estados: vazio (sem órfãs → nada aparece), erro (toast `erroAmigavel` via
  action), sucesso (toast + refresh; badge some no re-render).

## Estados

- Constraint ativa (plano A): tentativa de emitir link sem âncora → erro
  amigável na ação de emissão ("Escolha uma dupla ou um destinatário — links
  sem vínculo não são mais aceitos").
- Auditoria: relatório do script não é UI — sai no CI log.

## a11y

Dialog com foco preso (Base UI), busca com `aria-label`, resultado anunciado
via `role="status"`.
