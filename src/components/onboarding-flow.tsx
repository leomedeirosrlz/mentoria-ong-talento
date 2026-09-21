"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Camera,
  ChartLineUp,
  Check,
  ClipboardText,
  FolderOpen,
  HandHeart,
  Handshake,
  MapTrifold,
  Megaphone,
  NotePencil,
  TrafficSignal,
  UserPlus,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { concluirOnboarding, salvarOnboarding } from "@/lib/actions";
import { AREAS_SUGESTOES } from "@/lib/ciclo";
import { avatarPublicUrl, AVATAR_ACCEPT, AVATAR_MAX_BYTES } from "@/lib/avatar";
import { TagInput } from "@/components/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppRole, Profile } from "@/lib/types";

/** Um form por passo — o botão do footer fixo submete via atributo `form`. */
const FORM_ID = "onboarding-passo";

type Recurso = { icon: Icon; texto: string };

/** "O que você pode fazer aqui" — os 4-5 pontos que mudam a rotina de cada papel. */
const RECURSOS: Record<AppRole, Recurso[]> = {
  coordenacao: [
    { icon: TrafficSignal, texto: "A saúde das duplas em tempo real — o semáforo mostra quem precisa de atenção." },
    { icon: HandHeart, texto: "Pedidos de apoio e demandas de especialista chegam pra você." },
    { icon: UsersThree, texto: "Formar duplas e gerenciar os cadastros da equipe e dos mentorados." },
    { icon: Megaphone, texto: "Comunicados pra equipe e pra cada trilha." },
    { icon: ChartLineUp, texto: "Exportar relatórios do ciclo." },
  ],
  supervisor: [
    { icon: UsersThree, texto: "As duplas sob sua supervisão num lugar só." },
    { icon: NotePencil, texto: "Notas de acompanhamento na ficha de cada dupla." },
    { icon: TrafficSignal, texto: "O semáforo de cada dupla — quem vai bem e quem precisa de atenção." },
    { icon: FolderOpen, texto: "Os materiais oficiais do programa." },
  ],
  mentor_dpp: [
    { icon: CalendarCheck, texto: "Agendar e registrar os encontros com a sua dupla." },
    { icon: MapTrifold, texto: "A jornada dos 16 encontros do guia, passo a passo." },
    { icon: HandHeart, texto: "Pedir apoio à coordenação quando precisar." },
    { icon: UserPlus, texto: "Solicitar um mentor especialista pro seu mentorado." },
    { icon: FolderOpen, texto: "Os materiais oficiais do programa." },
  ],
  mentor_especialista: [
    { icon: ClipboardText, texto: "Um mural de demandas que combinam com o seu perfil." },
    { icon: Handshake, texto: "Aceitar uma demanda e conduzir até 5 encontros." },
    { icon: NotePencil, texto: "Registrar cada encontro realizado." },
    { icon: FolderOpen, texto: "Os materiais oficiais do programa." },
  ],
};

/** Wizard de primeiro acesso — balão de pergunta por passo, salvando um pedaço
 *  do perfil por vez (passos 2–5 dos mentores, via salvarOnboarding). O gate
 *  mora no layout: onboarded_em null renderiza isto no lugar do shell. */
export function OnboardingFlow({ me }: { me: Profile }) {
  const router = useRouter();
  const ehMentor = me.role === "mentor_dpp" || me.role === "mentor_especialista";
  // coord/supervisor: boas-vindas + recursos (2 passos); mentores seguem pros
  // passos de perfil opcionais + fechamento (7)
  const total = ehMentor ? 7 : 2;
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // campos controlados — voltar um passo não pode perder o que foi digitado
  // (o step remonta no key={step} e o FormData é montado na hora de salvar)
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(
    me.avatar_path ? avatarPublicUrl(me.avatar_path) : null
  );
  const [bio, setBio] = useState(me.bio ?? "");
  const [areas, setAreas] = useState<string[]>(me.areas ?? []);
  const [linkedin, setLinkedin] = useState(me.linkedin ?? "");
  const [voluntariado, setVoluntariado] = useState(me.voluntariado ?? "");

  const fileRef = useRef<HTMLInputElement>(null);
  const objUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (objUrl.current) URL.revokeObjectURL(objUrl.current);
    },
    []
  );

  // foco no título do balão a cada passo — o botão que disparou a navegação
  // segue montado (footer fixo), então sem isso o foco não acompanharia a
  // "pergunta" nova (mesmo padrão das etapas do importar-csv)
  useEffect(() => {
    tituloRef.current?.focus();
  }, [step]);

  const primeiroNome = me.nome.trim().split(/\s+/)[0] || me.nome;
  const ultimo = step === total - 1;
  // passos de perfil dos mentores são opcionais — ganham o ghost "Agora não"
  const passoComCampos = ehMentor && step >= 2 && step <= 5;

  function avancar() {
    setStep((s) => Math.min(s + 1, total - 1));
  }

  function salvarPasso(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // o input file perde a seleção quando o passo remonta — o state é a fonte
    if (foto) fd.set("foto", foto);
    start(async () => {
      try {
        const res = await salvarOnboarding(fd);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        if (res.aviso) toast.warning(res.aviso);
        avancar();
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  function concluir() {
    start(async () => {
      try {
        const res = await concluirOnboarding();
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        // o layout relê getMe — onboarded_em setado devolve o shell do app
        router.refresh();
      } catch {
        toast.error("Sem conexão — tente de novo.");
      }
    });
  }

  function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    // limpa o input: escolher o mesmo arquivo de novo dispara onChange outra vez
    e.target.value = "";
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      toast.error("A foto não entrou — use PNG, JPG ou WebP.");
      return;
    }
    if (f.size > AVATAR_MAX_BYTES) {
      toast.error("Imagem grande demais — use uma de até 2 MB.");
      return;
    }
    if (objUrl.current) URL.revokeObjectURL(objUrl.current);
    objUrl.current = URL.createObjectURL(f);
    setFoto(f);
    setFotoUrl(objUrl.current);
  }

  const titulo = (() => {
    switch (step) {
      case 0:
        return `Bem-vindo(a) ao Realiza.vc, ${primeiroNome}!`;
      case 1:
        return "O que você pode fazer aqui";
      case 2:
        return "Uma foto ajuda a dupla a te reconhecer";
      case 3:
        return "Conte sua trajetória em poucas linhas";
      case 4:
        return "No que você pode ajudar?";
      case 5:
        return "Pra fechar: LinkedIn e voluntariado";
      default:
        return `Tudo certo, ${primeiroNome}!`;
    }
  })();

  const hint = (() => {
    switch (step) {
      case 0:
        return "A plataforma do Programa de Mentoria Social — a jornada da sua dupla, os registros e os materiais oficiais num lugar só.";
      case 1:
        return "O essencial da sua rotina no programa cabe nesta tela.";
      case 2:
        return "PNG, JPG ou WebP até 2 MB — aparece no seu perfil e nas duplas.";
      case 3:
        return "Formação, trabalho, o que te trouxe ao programa — aparece no seu perfil pra equipe e pros mentorados.";
      case 4:
        return "Toque pra selecionar ou digite uma nova — dá pra mudar depois no seu perfil.";
      case 5:
        return "Os dois são opcionais — ajudam a equipe e os mentorados a te conhecerem melhor.";
      default:
        return "Seu perfil já está visível pra equipe — dá pra completar ou mudar tudo depois em Perfil.";
    }
  })();

  const corpo = (() => {
    switch (step) {
      case 1:
        return (
          <ul className="space-y-2">
            {RECURSOS[me.role ?? "mentor_dpp"].map((r) => (
              <li
                key={r.texto}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-lime)] text-[var(--brand-ink)]">
                  <r.icon size={18} weight="fill" aria-hidden />
                </span>
                <span className="text-sm leading-snug">{r.texto}</span>
              </li>
            ))}
          </ul>
        );
      case 2:
        return (
          <div className="flex flex-col items-center gap-3 py-1">
            <span className="grid size-24 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground ring-1 ring-border">
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera size={26} aria-hidden />
              )}
            </span>
            {/* fora da tab order — o botão é o controle (ref.click), igual ao
                FotoField dos cadastros */}
            <input
              ref={fileRef}
              type="file"
              accept={AVATAR_ACCEPT}
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={escolherFoto}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={15} aria-hidden />
              {fotoUrl ? "Trocar foto" : "Escolher foto"}
            </Button>
          </div>
        );
      case 3:
        return (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="ob-bio">Biografia</Label>
              <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                {bio.length}/1.000
              </span>
            </div>
            <Textarea
              id="ob-bio"
              name="bio"
              rows={5}
              maxLength={1000}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Formação, trabalho, o que te trouxe ao programa."
            />
          </div>
        );
      case 4:
        return (
          <div className="space-y-2">
            <Label>Áreas de atuação</Label>
            <TagInput
              name="areas"
              sugestoes={AREAS_SUGESTOES}
              value={areas}
              onChange={setAreas}
              inputLabel="Digite uma área e pressione Enter"
            />
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ob-linkedin">LinkedIn</Label>
              <Input
                id="ob-linkedin"
                name="linkedin"
                type="url"
                inputMode="url"
                autoComplete="url"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="ob-voluntariado">Experiência com voluntariado</Label>
                <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                  {voluntariado.length}/300
                </span>
              </div>
              <Input
                id="ob-voluntariado"
                name="voluntariado"
                maxLength={300}
                value={voluntariado}
                onChange={(e) => setVoluntariado(e.target.value)}
                placeholder="ex.: 2 anos como voluntário no Projeto X"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* header fixo: voltar circular + progresso + contador */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-3 px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0 || pending}
            aria-label="Voltar um passo"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 md:size-9"
          >
            <ArrowLeft size={17} aria-hidden />
          </button>
          <div
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-label={`Passo ${step + 1} de ${total}`}
            className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-[var(--brand-lime)] transition-all duration-500"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {step + 1}/{total}
          </span>
        </div>
      </header>

      {/* coluna central — pb/pt compensam header e footer fixos */}
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col justify-center px-4 pb-32 pt-20 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-realiza.png" alt="Realiza.vc" className="mb-6 h-5 w-auto self-start" />
        <div key={step} className="animate-rise">
          <div className="rounded-3xl rounded-bl-md border border-border bg-card px-5 py-4">
            <h1
              ref={tituloRef}
              tabIndex={-1}
              className="text-xl font-semibold leading-snug outline-none"
            >
              {titulo}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hint}</p>
          </div>
          {passoComCampos ? (
            <form id={FORM_ID} onSubmit={salvarPasso} className="mt-5">
              {corpo}
            </form>
          ) : (
            corpo && <div className="mt-5">{corpo}</div>
          )}
        </div>
      </main>

      {/* footer fixo: "Agora não" nos passos opcionais + primário */}
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6">
          {passoComCampos && (
            <Button
              type="button"
              variant="ghost"
              onClick={avancar}
              disabled={pending}
              className="shrink-0"
            >
              Agora não
            </Button>
          )}
          <Button
            type={passoComCampos ? "submit" : "button"}
            form={passoComCampos ? FORM_ID : undefined}
            onClick={passoComCampos ? undefined : ultimo ? concluir : avancar}
            disabled={pending}
            className="h-11 flex-1 font-semibold"
          >
            {pending
              ? ultimo
                ? "Entrando…"
                : "Salvando…"
              : ultimo
                ? "Começar"
                : "Continuar"}
            {!pending && (ultimo ? <Check weight="bold" aria-hidden /> : <ArrowRight aria-hidden />)}
          </Button>
        </div>
      </footer>
    </div>
  );
}
