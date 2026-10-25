import type { ReactNode } from "react";
import {
  emLimbo,
  eventoDaSemana,
  eventosDoCronograma,
} from "@/lib/ciclo";
import type { MotivoAcompanhar } from "@/lib/agenda-coordenacao";
import type { CicloEvento, Dupla } from "@/lib/types";
import { partesTurma } from "@/lib/ciclo";
import { msgsContato } from "@/lib/whatsapp-msgs";
import { cn } from "@/lib/utils";

// ============================================================
// Peças compartilhadas das visões de equipe da agenda (WP5) —
// tag/pill no idioma do mock v6, helpers de data de São Paulo e o
// texto do lembrete (D5) por caso. Server-safe de propósito: quem
// precisa de interação (LembreteButton, SupervisaoDialog) já é
// boundary próprio.
// ============================================================

// ---------- tag / pill ----------

const TOM_TAG = {
  ok: "bg-[var(--ok)]/10 text-[var(--ok-text)]",
  warn: "bg-[var(--warn)]/12 text-[var(--warn-text)]",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-[var(--info-bg)] text-[var(--info-text)]",
  muted: "bg-muted text-muted-foreground",
} as const;

export type TomTag = keyof typeof TOM_TAG;

/** Chip de classificação da linha (semáforo, "hoje", "oficial") — mesmo
 *  papel do Tag interno da Minha agenda, compartilhado pras visões novas. */
export function Tag({
  tom,
  children,
}: {
  tom?: TomTag | null;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TOM_TAG[tom ?? "muted"]
      )}
    >
      {children}
    </span>
  );
}

/** Pill de turma — nome forte ("Turma 1") + ano em menor peso. Recebe o
 *  valor cru ("T1 · 2026/2027"); `partesTurma` separa nome/ano (texto
 *  livre renderiza inteiro). */
export function PillTurma({ turma }: { turma: string }) {
  const { nome, ano } = partesTurma(turma);
  return (
    // só "Turma 1" na tela: o ciclo não distingue nada dentro da agenda e
    // dobrava o pill; fica no title pra quem precisar
    <span
      title={ano ? `${nome} · ${ano}` : undefined}
      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground/80"
    >
      {nome}
    </span>
  );
}

// ---------- datas (YYYY-MM-DD, âncora no meio-dia) ----------

export const parseDia = (iso: string) => new Date(`${iso}T12:00:00`);

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
/** "ter" — dia da semana curto no fuso de São Paulo. */
export const dowCurto = (iso: string) => DOW[parseDia(iso).getDay()];

const fmtMesLongo = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "America/Sao_Paulo",
});
/** "outubro" — mês por extenso, minúsculo. */
export const mesLongo = (iso: string) => fmtMesLongo.format(parseDia(iso));

/** Semana ISO do ano (1–53) — o "Semana 41" dos subheaders de equipe. O
 *  cálculo roda em UTC puro pra independência total do fuso do servidor. */
export function semanaIso(iso: string): number {
  const t = new Date(`${iso}T12:00:00Z`);
  const dow = (t.getUTCDay() + 6) % 7; // segunda = 0
  t.setUTCDate(t.getUTCDate() - dow + 3); // quinta da semana corrente
  const primeiro = new Date(Date.UTC(t.getUTCFullYear(), 0, 4, 12));
  const d1 = (primeiro.getUTCDay() + 6) % 7;
  primeiro.setUTCDate(primeiro.getUTCDate() - d1 + 3);
  return 1 + Math.round((t.getTime() - primeiro.getTime()) / 604_800_000);
}

// ---------- lembrete (D5) ----------

/** Título + corpo do lembrete pro caso da dupla — o MESMO texto alimenta a
 *  notificação in-app e o wa.me (o aviso é um só, por dois canais). Destino
 *  sempre "mentor": a operação da mentoria é dever dele; a fala pro jovem
 *  (check-in gentil) é o fluxo próprio do mentor DPP no Por mentorado. */
export function lembreteDaDupla(
  d: Dupla,
  caso: MotivoAcompanhar | null,
  eventos: CicloEvento[],
  autorNome: string | undefined,
  agora = new Date()
): { titulo: string; corpo: string } {
  const mentorNome = (d.mentor?.nome ?? "").split(" ")[0];
  const mentoradoNome = (
    d.mentorado?.nome_social ||
    d.mentorado?.nome ||
    ""
  ).split(" ")[0];
  // trilha de especialista: calendário livre — não existe "encontro oficial
  // da semana" pra carregar no texto. O `caso` que o server resolveu manda:
  // sessão realizada sem registro cobra o follow-up (antes o ramo só olhava
  // o limbo e ela saía com texto de "marcar a sessão" — a ação errada);
  // agendado vencido pergunta "rolou?"; sem pendência, "marcar a próxima".
  // O nº oficial do cronograma DPP seria informação falsa aqui.
  if (d.trilha === "especialista") {
    if (caso === "registro_pendente") {
      return {
        titulo: "Lembrete: registro pendente",
        corpo: `Oi ${mentorNome}, tudo bem? A sessão de ${mentoradoNome} já aconteceu, mas ainda falta o registro. Completa quando puder, leva poucos minutos.`,
      };
    }
    const pendEsp = [...d.encontros]
      .sort((a, b) => a.numero - b.numero)
      .find((e) => !e.registro && emLimbo(e, agora.getTime()));
    return {
      titulo: pendEsp
        ? "Lembrete: sessão por confirmar"
        : "Lembrete: marcar a sessão",
      corpo: pendEsp
        ? `Oi ${mentorNome}, tudo bem? A sessão de ${mentoradoNome} estava agendada e já passou. Rolou? Se rolou, dá pra registrar como foi; se não, vale remarcar.`
        : `Oi ${mentorNome}! Passando pra lembrar de marcar a próxima sessão de ${mentoradoNome} na trilha de especialista. Qualquer coisa me chama :)`,
    };
  }
  const vigente = eventoDaSemana(
    eventosDoCronograma(eventos, d.cronograma_id),
    agora
  );
  const numLimbo = [...d.encontros]
    .sort((a, b) => a.numero - b.numero)
    .find((e) => emLimbo(e, agora.getTime()))?.numero;
  const extraVigente =
    vigente?.numero != null ? `${vigente.numero}º` : undefined;
  const info = { mentorNome, mentoradoNome, autorNome };

  if (caso === "registro_pendente") {
    return {
      titulo: "Lembrete: registro pendente",
      corpo: msgsContato("registro_pendente", info).mentor ?? "",
    };
  }
  if (caso === "limbo") {
    return {
      titulo: "Lembrete: encontro por confirmar",
      corpo:
        msgsContato("limbo", {
          ...info,
          extra: numLimbo != null ? `${numLimbo}º` : extraVigente,
        }).mentor ?? "",
    };
  }
  if (caso === "atraso") {
    return {
      titulo: "Lembrete: encontros em atraso",
      corpo:
        msgsContato(
          { mentorNome, mentoradoNome },
          {
            casoMentor:
              "Os encontros estão atrasados. Posso ajudar a replanejar?",
          }
        ).mentor ?? "",
    };
  }
  // sem_data (e qualquer caso não mapeado): o lembrete padrão é "marcar o
  // encontro da semana" — a mensagem carrega o nº oficial pra orientar
  return {
    titulo: "Lembrete: marcar o encontro",
    corpo:
      msgsContato("sem_encontro", { ...info, extra: extraVigente }).mentor ??
      "",
  };
}
