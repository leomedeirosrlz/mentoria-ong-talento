# Roteiro: vídeo da Liza (motion graphics, ~45s)

Tom: divertido e com impacto. Os problemas aparecem rápido, a plataforma
resolve, e a virada é o "mas não paramos por aqui". Copy original para o
vídeo: nada de frase copiada da interface.

Regras de copy: pt-BR, sem travessão, sem emoji. Dados sempre demo (nomes
fictícios, nada de jovem real).

## A Liza em dois modos

A Liza nunca sai do vídeo. Ela alterna entre dois modos:

- **Protagonista:** grande, no centro, a câmera é dela. Só em três momentos:
  abertura, virada e fechamento
- **Companheira:** pequena (~120 px), flutuando perto do que está em cena.
  Olha para o elemento que entra, reage com expressão (preocupada,
  curiosa, contente) e "aponta" com a cauda de um balãozinho. Nunca cobre
  texto nem o herói da cena

Transições entre os modos (o que segura a atenção):

- **Protagonista → companheira:** ela pula, e no ar a câmera recua de uma
  vez. Ela aterrissa pequena num canto, com squash, e o cenário novo se
  monta em volta dela
- **Companheira → protagonista:** a cena congela, tudo perde cor menos ela.
  Ela infla com mola, empurrando os elementos para fora do quadro, até
  ocupar o centro
- Entre cenas, quando continua companheira, ela "pega carona": é a última
  coisa a sair de uma cena e a primeira a chegar na seguinte, levando o
  olhar junto (é o fio contínuo do vídeo)

Expressões vêm das poses que já existem no `LizaBlob`
(`src/components/liza/liza-blob.tsx`): sonolenta, atenta, pensando,
falando, pronta, preocupada. Não redesenhar a personagem.

## Ato 1: abertura, Liza acorda (0 a 5s) · protagonista

1. Tela grafite. Liza grande no centro, **dormindo**, "zzz" subindo devagar
2. Um ping. Abre um olho, depois o outro, se espreguiça (estica na
   vertical, volta com mola)
3. Ela olha para a câmera e pula. **Transição para companheira**: a câmera
   recua e ela aterrissa no canto, onde o Ato 2 começa

## Ato 2: os problemas (5 a 13s) · companheira

Um problema por batida, tipografia grande (Mitr Bold). A Liza reage a cada
um ao lado do texto:

| Batida | Texto | Imagem | Reação da Liza |
|---|---|---|---|
| 1 | "Cadê o material do encontro de hoje?" | arquivos e PDFs se espalham e somem pelas bordas | segue os papéis com os olhos, perde de vista |
| 2 | "E agora, o que eu faço com a minha dupla?" | mentor diante de um caminho que se divide em vários | cara de pensando, inclina junto |
| 3 | "Travei. Falo com quem?" | jovem com vários pontos de interrogação girando em volta | preocupada, encolhe um pouco |

## Ato 3: a plataforma resolve (13 a 18s) · companheira

- Carimbo amarelo **"Resolvido."** varre os três problemas
- Mosaico 3x1 com as telas reais, em punch de escala, uma por batida:
  materiais organizados por encontro · "o que fazer agora" do mentor ·
  o jovem pedindo ajuda a um clique
- A Liza pula de tela em tela, contente, como quem confere cada uma

## Ato 4: a virada (18 a 22s) · companheira → protagonista

- O mosaico congela. Corte seco de som
- Texto palavra por palavra: **"Mas a gente não parou por aqui."**
- **Transição para protagonista:** tudo perde a cor, ela infla e empurra o
  mosaico para fora do quadro
- Ela pisca para a câmera: **"Prazer, Liza."**
- Subtítulo: "Sua assistente dentro da plataforma."
- **Transição para companheira:** ela se encolhe e "abre" a conversa ao
  lado, como quem puxa a cortina para o Ato 5

## Ato 5: show de gen UI (22 a 39s) · companheira

Fórmula de cada beat (~3s): a pergunta se digita num balão → a Liza fica
pensando, com um anel girando em volta dela → o bloco **sai de dentro
dela** e se monta na tela (slam de escala, peças em cascata, números
contando). A Liza segue ao lado do bloco, reagindo. Um selo pequeno
mostra o papel de quem pergunta, para não prometer ao jovem o que só a
coordenação vê.

| # | Papel | Pergunta (copy do vídeo) | Bloco e animação | Liza |
|---|---|---|---|---|
| 1 | Mentorado | "Com quem eu falo se travar?" | cartão de contato com o caminho de ajuda acendendo passo a passo | aponta com o balão |
| 2 | Mentor | "Como conduzo o encontro de amanhã?" | passo a passo em cascata, fechando com a dica e a fonte do guia oficial | lê junto, acena |
| 3 | Mentor | "Onde tá o material da Roda da Vida?" | cards de material voando de volta para o lugar, um encaixe por batida | contente, brilho nos olhos |
| 4 | Coordenação | "Quem precisa de atenção essa semana?" | três cartões de número caindo um por batida, valores contando | séria, depois aliviada |
| 5 | Coordenação | "Como andam os encontros?" | barras crescendo na batida, depois **morph** para rosca | gira junto com a rosca |
| 6 | Mentor | "Me ajuda a lembrar minha dupla?" | mensagem de WhatsApp se escrevendo sozinha, toque em Copiar vira check | pulo de "pronto" |

Ritmo: os cortes aceleram (3s, 3s, 3s, 2,5s, 2,5s, 2s). Clímax: os seis
blocos voam e formam uma parede em volta dela.

## Ato 6: fechamento (39 a 45s) · companheira → protagonista

- **Transição para protagonista:** a parede de blocos se desfaz em
  partículas lima que ela "absorve", crescendo até o centro
- Texto: **"Ela responde com os guias e os dados do programa. Sem inventar."**
- **"Pergunte pra Liza."** + logo Realiza.vc
- Piada final (meia batida): ela boceja, os olhos pesam e ela volta a
  dormir. Corte seco no "zzz" (rima com a abertura)

## Produção

- Stack: HyperFrames, igual ao `videos/lancamento/master` (mesmo
  `hyperframes@0.8.101`, gsap). Projeto novo em `videos/liza/`
- Liza como camada própria no topo da composição, com uma timeline só para
  ela (posição, escala e pose), assim ela atravessa os atos sem cortar
- Blocos de gen UI recriados no visual do app (`assistente-blocos.tsx`,
  `assistente-genui.tsx`, `assistente-cards.tsx`) com copy e dados próprios
  do vídeo
- Telas do Ato 3 reaproveitadas dos clipes do v5.2 (`videos/lancamento/clips`)
- Trilha mais rápida e brincalhona que a do v5.2, com o corte seco no
  Ato 4 e acentos de impacto (SFX ≤ .25) nos slams
- Formatos: 16:9 master + corte 9:16 para status do WhatsApp (no 9:16 a
  companheira fica no terço de cima)
- Paleta: grafite #323232, amarelo #FFD531, lima #A0C644 predominam; tons
  semânticos só dentro dos blocos

## Lançamento

Segunda onda, 3 a 5 dias depois do v5.2: é o motivo novo para voltar a quem
ainda não entrou (métrica de primeiro login em 7 dias).
