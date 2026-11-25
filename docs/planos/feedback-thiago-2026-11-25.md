# Feedback do Thiago — 25/11/2026

> Registro bruto para o pipeline `feedback → recon → issues → specs → implementação → review`.
> Nada aqui foi implementado ainda. As imagens citadas são as do feedback enviado no chat.

**Issues Jira abertas (25/11):** REALIZA-525 (mobile Pessoas/Especialistas/self view), REALIZA-530 (agenda/retroativo/CTAs), REALIZA-528 (materiais), REALIZA-526 (ficha/plano/especialista/combinados), REALIZA-527 (Liza), REALIZA-529 (badges 2.0 — Claude).

## 1. Badges, nível e ilustrações (frente autoral do Claude)

- A badge atual ficou **poluída**. Quero algo **minimalista**: só a badge, sem o bloco/caixa em volta.
- A badge de nível deve ser **configurável**: a pessoa escolhe **até 3 badges** para mostrar no perfil.
- Layout responsivo e bem alinhado; o print mostra o selo “SEU NÍVEL / Constância” no header do perfil e o usuário quer só a peça visual enxuta.
- As **ilustrações em si** continuam estáticas e feias. Não é para manter a família atual com outro CSS.
- O **Claude** deve ser o dono criativo e de implementação dessa refatoração:
  - usar skills de **ícones isométricos animados**;
  - animação de verdade, não um keyframe genérico;
  - pode usar subagentes Haiku/Sonnet conforme precisão;
  - sem escopo fechado/instruções de desenho além do feedback: ele idea e implementa como dono.
- A lista de badges está tomando muito scroll; esconder atrás de dropdown/expansão.
- O selo deve abrir detalhe, mas sem o peso visual atual.

## 2. Pessoas / rede / perfil do jovem

- **Aba Pessoas do jovem está quebrada no mobile.**
- Filtros sem `trunc`; categorias estouram a largura. O certo é **scrollável** quando não couber.
- **Não quero pills de categorias** expostas. Esconder tudo em uma entrada **“Filtros”**.
- “Filtros” deve abrir um **modal rico**, com as opções completas de filtragem, não pills soltas.
- **Especialistas está bugado no mobile**, com scroll horizontal.
- **Pessoas também está bugado no mobile**.
- **Não quero colegas de turma em “Sua rede”** no perfil do jovem.
- O **self view do perfil** está feio; deve ficar mais parecido com o jeito que você vê o perfil de outras pessoas.
- O perfil pessoal precisa ser repensado na hierarquia/visual, não só no card de badges.
- Botão de **WhatsApp para mentores em Pessoas**: hoje a área está vazia; eles precisam conseguir se comunicar.

## 3. Agenda do jovem, encontros e registro retroativo

- **Agendar encontro no mobile ainda abre picker nativo**; precisa ser o picker custom.
- Em “Outro dia”, ao tocar, deve **abrir o picker custom/nativo imediatamente**, sem um clique extra, se possível.
- A **posição da Liza mudou sem necessidade**; melhor sair do nav.
- O texto/copy de **registrar encontros que não aparecem nos espaços normais** foi removido? Precisa facilitar o **registro retroativo de encontros passados**.
- Criar um botão **“Registrar encontro” perto de “Agendar”**, abrindo uma área só para escolher data e encontro, no mesmo estilo do fluxo existente.
- Botões nos cards de lista mobile (ex.: “Próximos” da agenda do jovem) parecem jogados: só listamos os botões e eles se ajustam sem regra.
- Padronizar CTAs em cards:
  - um botão principal visível;
  - restante escondido em **três pontinhos**;
  - exemplo: card do 7º encontro tem 4 botões + badge; deve ter 1 CTA principal + menu.
- Cards de agenda do mentor: botões jogados, padding estranho, espaço inútil e assimétrico.
- Na visão por mentorado da agenda, “**Você acompanha, não participa**” é ruim; trocar por algo como “**Trilha especialista · Larissa**”.

## 4. Materiais

- No jovem, o **primeiro card no topo ocupa espaço demais no mobile**; compactar.
- Criar **thumbs para a view em cartões** dos materiais **baseadas no título**.
- Seções “Conteúdos e roteiros”, “Modelos”, “Guias” etc. devem ser **colapsáveis**.
- O 029 (alternador Cartões/Lista) entra nessa frente; manter o que já foi feito, mas aplicar o feedback de densidade/mobile.

## 5. Cards de dupla / plano / ficha (mentor)

- No header do card da dupla, **clicar abre a ficha da dupla**.
- Card de propor plano (escolher juntar encontros):
  - incluir **nome dos encontros**, não só número/data;
  - botões estão **flutuando muito em cima**; devem ficar mais abaixo;
  - dar **margin-bottom maior** no form para os botões não cobrirem conteúdo;
  - adicionar **feedback da simulação** de quando a dupla fica em dia conforme a quantidade de encontros juntados;
  - ao abrir o dropdown “Ler o documento do combinado”, os botões ficam no meio do texto (bug de layout/sticky).
- Em “sugerir especialista” pela ficha:
  - no mobile, a badge “Selecionado” come ~1/3 da largura, o botão ~1/3 e o ícone outro; o texto fica confinado;
  - **não precisa da copy “Selecionado”**; usar indicador de rádio + borda accent;
  - clicar no card deve **abrir o perfil da pessoa**;
  - adicionar animações ao abrir dropdown, selecionar, fechar etc.;
  - ao abrir a lista de especialistas, **subir a parte de cima do form** para dar espaço útil; ao fechar, voltar.
- **Jovens também precisam criar combinados**, como os mentores.
- Aba Instrumentos da ficha:
  - “Checklist de competências do mentor” aparece como se fosse do mentorado e não abre; revisar ownership e ação.
  - PDM na ficha: usuário achou que era duplicado, mas confirmou depois que os dados aparecem; revisar clareza entre PDM nativo e PDM da ficha, edição e leitura.

## 6. Liza

- Pills de sugestão mostram perguntas **fora do escopo** do papel (ex.: “quantos chamados abertos” para mentor). Precisa filtrar por papel/allowlist.
- A Liza **não dispara o fluxo e2e de montar o plano**: ela até monta um plano, mas para; falta GenUI do plano, perguntar disponibilidade por semana, ver rascunho e publicar.
- A Liza fala que “precisa dos dois lados para aprovar”; o contrato atual é **um aceite da dupla**.
- Reagendar: ela pede o dia e depois a hora, em mensagens separadas; pedir **dia + hora na mesma mensagem**.
- Componente dela mostra **data crua**; formatar.
- Várias GenUIs mostram **IDs crus**, ex.: emitir documento mostra link/id. Deixar apresentável.
- Emitir documento: incluir na GenUI botões de **copiar link** e **enviar no WhatsApp**.
- Deixar a GenUI do plano “ficar em dia” **redonda** de ponta a ponta.

## 7. Critérios transversais

- Animações em **todos os forms**: abrir/fechar dropdown, selecionar, fechar, transições. O motion P2 foi feito, mas o feedback indica superfícies que ainda estão sem vida.
- Padronizar CTAs de cards mobile (1 principal + menu) em agenda, materiais, pessoas, especialistas, ficha.
- Responsividade mobile é prioridade: Pessoas, Especialistas, agenda, materiais, sugestão de especialista, badges.
- Nada de picker nativo no mobile onde o fluxo tem picker custom.
- Não expor IDs/datas cruas em GenUI.
- Acessibilidade: alvos, foco, truncamento, scroll horizontal zero, labels.

## 8. Itens que precisam de decisão de produto antes de implementar

1. Badges: quais 3 badges são elegíveis para o perfil? Só nível + conquistas? Como escolher/salvar (perfil/localStorage)? O Claude pode propor.
2. “Sua rede” sem colegas: rede passa a ser só adultos/mentores/equipe? Colegas ficam só no diretório?
3. Registro retroativo: botão “Registrar encontro” separado de “Agendar” ou dentro do mesmo menu?
4. Card de plano: juntar encontros mostra nomes; o feedback de simulação é sempre visível ou só ao selecionar grupos?
5. Liza: o fluxo de plano deve ser GenUI + wizard no chat ou redirecionar para `/duplas/...` em um passo?
6. Pessoas/Especialistas: filtros em modal único; manter pills de papel em algum lugar?
7. CTAs mobile: menu de 3 pontos em todos os cards ou só quando houver 2+ ações?
