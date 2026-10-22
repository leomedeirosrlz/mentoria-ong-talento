# REALIZA-175 — aceite

- Dado `/registros?grupo=dupla` em `xl` (≥1280px), quando a lista carrega,
  então os registros aparecem sob headers `Dupla: X × Y · K registros`, em
  até 2 colunas de grupos — não uma coluna única `max-w-3xl`.
- Dado `?grupo=semana`, quando carrego, então os headers são
  `Semana de dd/mm` e os registros caem no bucket da data de criação.
- Dado `?grupo=avaliacao`, quando carrego, então os headers são
  `Avaliação N★` e cada registro está no bucket do seu `avaliacao`.
- Dado um grupo sem itens (ex.: nenhuma avaliação 1★), quando a lista
  renderiza, então o header desse grupo **não** aparece.
- Dado busca `?q=ana` + `?grupo=dupla`, quando filtro, então os grupos se
  aplicam sobre os itens filtrados — combinação funciona.
- Dado o dialog "Filtros" aberto em desktop, quando meço a largura, então é
  ~`max-w-md` — sem fundo ocioso além do conteúdo dos fieldsets.
- Dado mobile, quando agrupo por dupla, então os grupos empilham em coluna
  única com rail por grupo.
- Dado papel `mentor`, quando abro `/registros`, então o switcher existe e
  a lista segue escopada às duplas dele (RLS).
- Vitest: `agruparRegistros` cobre dupla/semana/avaliação + itens sem
  campo-chave (ex.: `avaliacao` null → bucket "Sem avaliação").
