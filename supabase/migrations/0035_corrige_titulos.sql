-- 0035: títulos/fases/instrumentos de ciclo_eventos alinhados ao guia DPP
-- ("os 16 encontros", passo a passo da metodologia). O seed original invertia
-- 8↔9 (a revisão de meio de percurso é o 9º; o 8º é "monitoramento e
-- responsabilidade", que já inclui a transferência gradual da condução), o 10º
-- misturava a "rede de apoio" (tema do 11º) e 12–16 usavam títulos livres
-- ("Roda da Vida: explicação e leitura" etc.) em vez dos títulos do guia
-- ("Aplicação e leitura da Roda da Vida", "Metas das áreas prioritárias",
-- "Desdobramento e plano de continuidade", "Reflexão e reconhecimento",
-- "Encerramento e celebração").
--
-- Idempotente e conservador: cada UPDATE casa numero + título antigo —
-- re-rodar é no-op e uma row cujo título já divergir (dado real editado) não
-- é tocada. Datas NÃO mudam aqui: há encontros reais vinculados às rows e o
-- calendário oficial em produção é decisão separada.

begin;

update public.ciclo_eventos
  set titulo = 'Monitoramento e responsabilidade',
      instrumentos = '{PDM,Escuta Ativa}'
  where tipo = 'encontro' and numero = 8
    and titulo = 'Revisão de meio de percurso';

update public.ciclo_eventos
  set titulo = 'Revisão de meio de percurso',
      instrumentos = '{PDM,Escuta Ativa}'
  where tipo = 'encontro' and numero = 9
    and titulo = 'Transferência gradual da condução';

update public.ciclo_eventos
  set titulo = 'O mentor como espelho',
      fase = 'Aprofundar o vínculo e o aprendizado',
      instrumentos = '{Papel de modelo,Escuta Ativa}'
  where tipo = 'encontro' and numero = 10
    and titulo = 'Trajetória do mentor e rede de apoio';

update public.ciclo_eventos
  set titulo = 'Rede de apoio e novos espaços',
      fase = 'Aprofundar o vínculo e o aprendizado',
      instrumentos = '{Papel de modelo,Escuta Ativa}'
  where tipo = 'encontro' and numero = 11
    and titulo = 'Ampliação de espaços e repertório';

update public.ciclo_eventos
  set titulo = 'Aplicação e leitura da Roda da Vida'
  where tipo = 'encontro' and numero = 12
    and titulo = 'Roda da Vida: explicação e leitura';

update public.ciclo_eventos
  set titulo = 'Metas das áreas prioritárias'
  where tipo = 'encontro' and numero = 13
    and titulo = 'Roda da Vida: discussão por quadrante';

update public.ciclo_eventos
  set titulo = 'Desdobramento e plano de continuidade'
  where tipo = 'encontro' and numero = 14
    and titulo = 'Roda da Vida: mapa de metas e submetas';

update public.ciclo_eventos
  set titulo = 'Reflexão e reconhecimento',
      instrumentos = '{PDM,Roda da Vida}'
  where tipo = 'encontro' and numero = 15
    and titulo = 'Revisão do percurso';

update public.ciclo_eventos
  set titulo = 'Encerramento e celebração',
      instrumentos = '{Avaliação 360º,Autoavaliação do mentor}'
  where tipo = 'encontro' and numero = 16
    and titulo = 'Celebração e encerramento simbólico';

commit;
