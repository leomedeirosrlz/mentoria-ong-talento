# Auditoria de copy — área do jovem (`/jovem`)

Escopo: rotas `src/app/(jovem)/jovem/**`, componentes `src/components/jovem-*.tsx` e afins usados pelo jovem (`catalogo-jovem`, `pedir-especialista-dialog`, `novo-chamado-dialog` no papel mentorado, `avaliacao-encontro-form`, `solicitacao-negociacao`, `retrospectiva-jornada`, `pdm-dupla`), libs `src/lib/*jovem*.ts`, `actions-jovem.ts`, `avaliacao-privacidade.ts`, `whatsapp-msgs.ts` e o conteúdo de ajuda filtrado para `mentorado` (`src/lib/ajuda/conteudo.ts`).

Critérios aplicados: sem tells de IA, sem claim inflado, linguagem concreta, sem travessão em texto exibido (regra do repositório), redundância cortada, sem mudar comportamento.

## Diagnóstico

A copy do jovem está em bom estado: voz informal consistente ("pra", "rolou", "rapidinho"), frases curtas, promessas concretas e honestas ("1 minuto", "só a equipe lê", "o pedido vai pro mural"). Não há buzzwords, claims inflados nem prova social inventada. Os problemas são pontuais: travessões em texto exibido, três vazamentos de gênero/sigla interna, um status de enum exibido cru e dois detalhes de pontuação/vocabulário.

## Corrigido nesta PR

| arquivo:linha | texto atual | problema | proposta |
|---|---|---|---|
| src/components/jovem-equipe-wa.tsx:44 | Escolha com quem conversar no WhatsApp — a mensagem já sai com a sua apresentação. | travessão em texto exibido | Escolha com quem conversar no WhatsApp. A mensagem já sai com a sua apresentação. |
| src/components/jovem-equipe-wa.tsx:90 | A equipe ainda não tem WhatsApp cadastrado — registre sua dúvida em Precisa de ajuda e a coordenação responde pela plataforma. | travessão em texto exibido | A equipe ainda não tem WhatsApp cadastrado. Registre sua dúvida em Precisa de ajuda e a coordenação responde pela plataforma. |
| src/lib/actions-jovem.ts:205 | Conta um pouco mais — entre 10 e 1.000 caracteres. | travessão em texto exibido (toast de validação) | Conta um pouco mais: entre 10 e 1.000 caracteres. |
| src/components/jovem-retroativo-dialog.tsx:124 | oficial ou o encontro de encerramento — esse quem registra é o seu mentor, que fecha a jornada com vocês. | travessão em texto exibido | oficial ou o encontro de encerramento. Esse quem registra é o seu mentor, que fecha a jornada com vocês. |
| src/lib/ajuda/conteudo.ts:138 | O encontro já entra como realizado e você avalia na hora — seu mentor é avisado pra contar como foi no registro dele. | travessão em texto exibido (item `encontro-ja-foi-jovem`, papel mentorado) | O encontro já entra como realizado e você avalia na hora. Seu mentor é avisado pra contar como foi no registro dele. |
| src/components/retrospectiva-jornada.tsx:538 | Aplicação formal — a leitura inicial não chegou a ser respondida. | travessão em texto exibido (jovem vê a retrospectiva) | Aplicação formal: a leitura inicial não chegou a ser respondida. |
| src/components/retrospectiva-jornada.tsx:539 | Leitura inicial — a aplicação formal ainda não aconteceu. | travessão em texto exibido | Leitura inicial: a aplicação formal ainda não aconteceu. |
| src/app/(jovem)/jovem/pdm/page.tsx:60 | O PDM nasce na jornada com a sua mentora: ... | assume gênero; o app chama a pessoa de "seu mentor" | O PDM nasce na jornada com seu mentor: ... |
| src/app/(jovem)/jovem/pessoas/[id]/page.tsx:153 | Seu mentor DPP | expõe sigla interna (DPP) ao jovem | Seu mentor |
| src/app/(jovem)/jovem/pessoas/[id]/page.tsx:180 | {base} {d.status} (ex.: "trilha concluida") | enum exibido cru, sem acento; staff usa "concluída"/"encerrada" | mapa de rótulos: trilha/mentoria + pausada, concluída, encerrada |
| src/app/(jovem)/jovem/pessoas/[id]/page.tsx:283 | Ele ainda não compartilhou o contato. Quando compartilhar, o WhatsApp aparece aqui. | "Ele" assume gênero do contato | Ainda não compartilhou o contato. Quando compartilhar, o WhatsApp aparece aqui. |
| src/components/jovem-especialista-card.tsx:61 | Sua especialista | badge assume gênero; o app usa "Seu especialista" | Seu especialista |
| src/components/catalogo-jovem.tsx:135 | Falar com a coordenação (abre um chamado) | parêntese com jargão interno ("chamado") no CTA | Falar com a coordenação |
| src/components/jovem-avaliacoes.tsx:91 | {pendente.numero}º encontro: como foi? | ignora `rotulo`; sessão de especialista vira "encontro" | usa `rotulo` quando existe ("3ª sessão com Sofia: como foi?") |
| src/components/jovem-avaliacoes.tsx:140-142 | Sua avaliação do {n}º encontro | idem: sessão de especialista rotulada como "encontro" | usa `avaliacao.rotulo` quando existe; fallback mantido |
| src/components/jovem-avaliacoes.tsx:409-414 | Meu mentor pode ler esta avaliação : normalmente ele só vê... | espaço antes de dois-pontos (" :") | dois-pontos colado no rótulo: "Meu mentor pode ler esta avaliação: normalmente..." |

## Observado, sem alteração (não é claro / decisão de produto)

| arquivo:linha | texto atual | problema | proposta |
|---|---|---|---|
| src/app/(jovem)/jovem/perfil/perfil-form.tsx:179-490 e pessoas/[id]/page.tsx:199-308 | valor={... \|\| "—"} | travessão como placeholder de célula vazia | manter: convenção de célula vazia do app inteiro; alternativa "não informado" mudaria a convenção global |
| src/components/retrospectiva-jornada.tsx:374,381 e solicitacao-negociacao.tsx:150 | : "—" / ?? "—" | idem, em célula de KPI e nome de autor | manter (mesmo motivo) |
| src/app/(jovem)/jovem/page.tsx:945 | use o “Precisa de ajuda?” acima | aspas curvas | manter: tipografia pt-BR correta para citação de rótulo |
| src/app/(jovem)/jovem/agenda/page.tsx:232 | seu/sua mentorado(a) | marcação de gênero dupla, um pouco pesada | manter: convenção inclusiva usada no app |
| src/lib/actions-jovem.ts:101 | Só o próprio jovem edita a ficha dele. | "ficha" é vocabulário interno | aceitável em erro de autorização (caso raro); alternativa: "Só o próprio jovem edita o próprio perfil." |
| src/components/jovem-encontro-acoes.tsx:69 | seu mentor registra como foi na ficha dele | "ficha" é vocabulário interno | manter: compreensível; alternativa: "seu mentor confirma como foi" |
| src/lib/avaliacao-privacidade.ts:14 | e você escolhe se ele lê esta. | "esta" fica sem referente explícito fora do contexto | opcional: "...se ele pode ler esta avaliação" |
| src/lib/ajuda/conteudo.ts:126 | ...já realizado — o mentor na ficha... — e a plataforma... | travessões, mas o item é staff-only (`TRILHA_DPP`) | fora do escopo jovem; mesmo fix de pontuação aplicável se quiser |

## Fora de escopo

Comentários de código em pt-BR usam travessão por convenção do repositório e não são texto exibido. Nenhum comportamento, regra de domínio, permissão, rota ou fluxo foi alterado.
