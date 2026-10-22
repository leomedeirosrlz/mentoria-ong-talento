# REALIZA-16 — Design (mínimo: issue é quase toda de dados)

## Persona / JTBD

- **Coordenação**: "quando o jovem ganhar conta, quero que tudo que ele já
  respondeu apareça — sem re-coletar nada".
- **Mentorado (futuro usuário)**: "entro e minha jornada inteira já está lá".

Não há tela nova no caminho principal (o vínculo `profile_id` já é feito pela
coord no cadastro/convite). O único UI possível é o **plano B** do plan.md —
reconciliação de resposta órfã, se links genéricos forem mantidos.

## Se o plano B for adotado: "Vincular resposta"

- Superfície: ficha do formulário em `/formularios/[id]` (onde já existe a
  lista de links — `src/app/(app)/formularios/formulario-links.tsx`) —
  respostas órfãs aparecem com badge "sem vínculo" e ação "Vincular a um
  jovem".
- Dialog reutilizando padrão `Command`/busca de pessoa já usado em
  `nova-dupla-dialog.tsx` (seleção de mentorado) — **reuso**: `Dialog` de
  `src/components/ui/`, input de busca, lista de resultados.
- Confirmação exibe o que será vinculado: formulário + data da resposta +
  jovem escolhido. Microcopy pt-BR: "Vincular esta resposta a {nome}? Todo o
  histórico dela passa a contar na jornada dessa pessoa."
- Estados: vazio (sem órfãs → seção some), loading (skeleton padrão),
  erro (toast/mensagem amigável `erroAmigavel`), sucesso (badge vira
  "vinculada a {nome}").

## Estados

- Constraint ativa (plano A): tentativa de emitir link sem âncora → erro
  amigável na ação de emissão ("Escolha uma dupla ou um destinatário — links
  sem vínculo não são mais aceitos").
- Auditoria: relatório do script não é UI — sai no CI log.

## a11y

Dialog com foco preso (Base UI), busca com `aria-label`, resultado anunciado
via `role="status"`.
