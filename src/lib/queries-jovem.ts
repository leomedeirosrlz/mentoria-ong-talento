import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { demoRole } from "./demo/mode";
import {
  demoJovemAssinaturas,
  demoJovemContatos,
  demoJovemDuplas,
  demoJovemEncaminhamentos,
  demoJovemEncontros,
  demoJovemPerfil,
} from "./demo/queries";
import type {
  EncontroStatus,
  JovemAssinatura,
  JovemContato,
  JovemDupla,
  JovemEncaminhamento,
  JovemPerfil,
} from "./types";

// Leituras do shell /jovem (REALIZA-108). Contrato do D2: tudo que é dado
// de domínio do próprio jovem vem das views definer `jovem_*` (0067/0070) —
// NUNCA de duplas/mentorados/profiles base (o papel não tem SELECT nelas e
// a projeção da view é a fronteira do que ele pode ver). As únicas tabelas
// lidas direto são as de policy aberta pra ele: encontros (branch
// exists(jovem_duplas) da 0068), materiais/comunicados audiencia='todos' e
// notificacoes (self). O ramo demo delega às demoJovem* — que projetam as
// mesmas colunas das views sobre o dataset em memória.

/** Ficha do próprio jovem (view jovem_perfil) — null quando o vínculo
 *  profiles↔mentorados ainda não foi feito pela coordenação. */
export const getJovemPerfil = cache(async (): Promise<JovemPerfil | null> => {
  const demo = await demoRole();
  if (demo) return demoJovemPerfil(demo);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jovem_perfil")
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("getJovemPerfil:", error);
    return null;
  }
  return data;
});

/** Duplas do jovem (view jovem_duplas) — normalmente 0-1 ativa; o histórico
 *  (concluida/encerrada) também vem, pra agenda e home saberem distinguir. */
export const getJovemDuplas = cache(async (): Promise<JovemDupla[]> => {
  const demo = await demoRole();
  if (demo) return demoJovemDuplas(demo);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jovem_duplas")
    .select("*")
    .order("iniciada_em", { ascending: false });
  if (error) {
    console.error("getJovemDuplas:", error);
    return [];
  }
  return data ?? [];
});

/** Adultos alcançáveis (view jovem_contatos): mentor + supervisor das
 *  próprias duplas e a coordenação — os mesmos destinos que a policy de
 *  pedido_apoio valida (0069). */
export const getJovemContatos = cache(async (): Promise<JovemContato[]> => {
  const demo = await demoRole();
  if (demo) return demoJovemContatos(demo);
  const supabase = await createClient();
  const { data, error } = await supabase.from("jovem_contatos").select("*");
  if (error) {
    console.error("getJovemContatos:", error);
    return [];
  }
  return data ?? [];
});

/** Combinados do jovem (view jovem_encaminhamentos) — o que ele se
 *  comprometeu a fazer entre um encontro e outro. Escrita só via RPC
 *  marcar_combinado; aqui é leitura ordenada (pendente com prazo primeiro). */
export const getJovemEncaminhamentos = cache(
  async (): Promise<JovemEncaminhamento[]> => {
    const demo = await demoRole();
    if (demo) return demoJovemEncaminhamentos(demo);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jovem_encaminhamentos")
      .select("*")
      .order("status", { ascending: true })
      .order("prazo", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getJovemEncaminhamentos:", error);
      return [];
    }
    return data ?? [];
  }
);

/** Documentos do jovem pra assinar/encaminhar (view jovem_assinaturas) —
 *  token exposto só pra montar o link /assinar/[token]; nunca renderizado. */
export const getJovemAssinaturas = cache(
  async (): Promise<JovemAssinatura[]> => {
    const demo = await demoRole();
    if (demo) return demoJovemAssinaturas(demo);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jovem_assinaturas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("getJovemAssinaturas:", error);
      return [];
    }
    return data ?? [];
  }
);

/** Encontro do jovem — projeção explícita (D2: nada de `*`, os registros e
 *  notas do mentor ficam fora). `link` e `motivo_reagendamento` são as
 *  colunas "operacionais" que o jovem precisa pra entrar na chamada e saber
 *  por que a data mudou. */
export type JovemEncontro = {
  id: string;
  dupla_id: string;
  numero: number;
  data_hora: string | null;
  realizado_em: string | null;
  duracao_min: number | null;
  status: EncontroStatus;
  link: string | null;
  motivo_reagendamento: string | null;
};

const JOVEM_ENCONTRO_COLS =
  "id, dupla_id, numero, data_hora, realizado_em, duracao_min, status, link, motivo_reagendamento";

/** Todos os encontros das duplas do jovem — a RLS (0068) já escopa às duplas
 *  dele via exists(jovem_duplas). Ordenação cronológica pra home e agenda. */
export const getJovemEncontros = cache(async (): Promise<JovemEncontro[]> => {
  const demo = await demoRole();
  if (demo) return demoJovemEncontros(demo);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("encontros")
    .select(JOVEM_ENCONTRO_COLS)
    .order("data_hora", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("getJovemEncontros:", error);
    return [];
  }
  return (data ?? []) as JovemEncontro[];
});
