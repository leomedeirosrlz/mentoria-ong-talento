import {
  BookOpen,
  CalendarBlank,
  CaretDown,
  HandHeart,
  VideoCamera,
} from "@phosphor-icons/react/dist/ssr";
import type {
  AvaliacaoLink,
  Encaminhamento,
  Encontro,
  Material,
  RegistroAnexo,
} from "@/lib/types";
import {
  formatDate,
  formatDateTime,
  linkSeguro,
  registroTardio,
  type PassoGuia,
} from "@/lib/ciclo";
import type { DestinoWA } from "@/components/whatsapp-rapido";
import { WhatsAppRapido } from "@/components/whatsapp-rapido";
import { AvaliacaoBadge } from "@/components/semaforo";
import { CopiarChamada } from "@/components/copiar-chamada";
import { NotaEncontro } from "@/components/nota-encontro";
import {
  AvaliacaoJovemCard,
  AvaliacaoPendenteLinha,
  EstrelaEspecialistaChip,
} from "@/components/avaliacao-jovem";
import { AgendarEncontroDialog } from "@/components/agendar-encontro-dialog";
import { EditarLinkDialog } from "@/components/editar-link-dialog";
import { NaoAconteceuButton, DesfazerNaoAconteceuButton } from "@/components/nao-aconteceu-button";
import { RegistroForm } from "@/components/registro-form";
import {
  RegistroDetails,
  RegistroInline,
  RegistroInlinePanel,
  RegistroInlineTrigger,
} from "@/components/registro-inline";
import { EditarRegistro } from "@/components/editar-registro";
import { RevelarApos } from "@/components/revelar-apos";
import { ResolverApoioButton } from "@/components/resolver-apoio-button";
import { RegistroView } from "@/components/registro-view";
import { AnexosRegistro } from "@/components/anexos-registro";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Linha de um encontro na aba Encontros: disco numerado, datas, ações da
 *  pendência e o registro (resumo + corpo sob disclosure). O id do card é
 *  `registrar-{encontro.id}` — âncora dos deep links e do RegistroInline. */
export function EncontroRow({
  passo,
  encontro,
  tentativasFalhas = 0,
  duplaId,
  souMentor,
  podeEditar,
  podeMarcar,
  ativa,
  souCoord,
  autorId,
  podeAnexar,
  podeRemoverAnexos,
  anexos,
  materiais,
  combinadosPendentes,
  nota,
  registroAberto,
  apoioDestinos,
  linkAvaliacao,
  estrelaJovem,
  piso,
  ehEsp,
  urlBase,
  jovemNome,
  jovemWhatsapp,
  jornadaViva,
}: {
  /** Passo do guia da trilha (data sugerida no DPP; sem data no especialista). */
  passo: PassoGuia;
  encontro: Encontro | null;
  /** Tentativas furadas que miraram este passo antes da exibida — a linha
   *  conta o caminho ("1 tentativa anterior não aconteceu"), trilha esp. */
  tentativasFalhas?: number;
  duplaId: string;
  /** O visitante é o mentor da dupla — o "entrar na chamada" é gesto dele;
   *  coord/sup (e qualquer outro) copiam o link. Distinto de podeEditar:
   *  dupla pausada não edita mas o mentor dela ainda entra na call. */
  souMentor: boolean;
  podeEditar: boolean;
  podeMarcar: boolean;
  /** Dupla ativa — badge "sem registro" só aparece quando alguém ainda pode agir. */
  ativa: boolean;
  souCoord: boolean;
  autorId: string;
  podeAnexar: boolean;
  podeRemoverAnexos: boolean;
  anexos: RegistroAnexo[];
  materiais: Material[];
  combinadosPendentes: Encaminhamento[];
  /** Anotação/plano do mentor pra esse nº do ciclo — null = sem nota. */
  nota: string | null;
  /** Encontro atual ou pendente de registro — nasce com o registro expandido;
   *  os demais viram linha-resumo sob disclosure (o deep link `#registrar-{id}` abre). */
  registroAberto: boolean;
  /** Destinos do nudge do pedido de apoio (só o mentor — o pedido é dele).
   *  Vazio pro próprio mentor: WhatsAppRapido some sozinho. */
  apoioDestinos: DestinoWA[];
  /** Link tokenizado deste encontro (0071) — só a coordenação recebe a
   *  lista (policy coord-only); pros demais chega null. */
  linkAvaliacao: AvaliacaoLink | null;
  /** Estrela que o jovem deu nesta sessão de especialista — da view
   *  definer (só o número); null pra qualquer outro papel. */
  estrelaJovem: number | null;
  /** YYYY-MM-DD do início da dupla — piso de data do dialog de remarcar. */
  piso?: string;
  /** Trilha especialista — o remarcar da linha se lê "sessão de especialista". */
  ehEsp: boolean;
  /** Origem pública (NEXT_PUBLIC_SITE_URL) — monta o /avaliar/<token>. */
  urlBase: string;
  jovemNome: string;
  jovemWhatsapp: string | null;
  /** Dupla viva (ativa|pausada) — destrava as ações de link da pendência
   *  de avaliação; fechada deixa só o aviso como fato. */
  jornadaViva: boolean;
}) {
  const feito = encontro?.status === "realizado";
  const naoAconteceu = encontro?.status === "nao_aconteceu";
  // agendado/remarcado com horário marcado = compromisso firmado — o disco
  // ganha o tom da trilha; "a combinar" segue neutro (é só o passo do guia)
  const marcado =
    (encontro?.status === "agendado" || encontro?.status === "remarcado") &&
    !!encontro.data_hora;
  const reg = encontro?.registro;
  // realizado sem registro — a dupla deve o follow-up; marca a linha em warn
  // suave. Em dupla pausada/encerrada ninguém pode registrar: a badge e a
  // lavagem viram ruído de algo sem saída e são suprimidas
  const registroPendente = feito && !reg && ativa;
  // realizado_em ≠ data_hora: aconteceu em data diferente da agendada/registrada
  const diverge =
    feito && encontro?.realizado_em != null && encontro.realizado_em !== encontro.data_hora;
  // material do encontro: com destino (arquivo oficial ou url) vira chip; sem, só o título muted
  const material = materiais.find((m) => m.path || m.url) ?? materiais[0] ?? null;
  const materialHref = material?.path
    ? `/api/material/${material.id}`
    : linkSeguro(material?.url);
  // a chamada é a ação nº1 na janela do encontro (15 min antes a 2h depois do
  // início) — vira CTA primário; fora da janela fica chip de apoio comum
  const msAteInicio = encontro?.data_hora
    ? new Date(encontro.data_hora).getTime() - new Date().getTime()
    : null;
  const chamadaAgora =
    encontro?.status === "agendado" &&
    msAteInicio != null &&
    msAteInicio <= 15 * 60000 &&
    msAteInicio >= -2 * 3600000;
  // registro feito mais de 3 dias depois do encontro → "registro tardio"
  const tardio = reg != null && registroTardio(reg, encontro);
  // CTA e form de registro: realizado libera na hora; pros demais status
  // (agendado vencido, não-aconteceu) só depois do horário — RevelarApos cobre
  // a aba que ficou aberta atravessando o encontro, sem depender de re-render
  const liberadoNoHorario = (node: React.ReactNode) =>
    encontro?.status === "realizado"
      ? node
      : encontro?.data_hora
        ? <RevelarApos from={encontro.data_hora}>{node}</RevelarApos>
        : null;
  const podeRegistrar = !!(encontro && !reg && podeEditar);
  // remarcar e trocar o link são gestos do encontro agendado — mentor de
  // dupla ativa; a coord (e o sup) copia o link, nunca edita
  const podeRemarcar = encontro?.status === "agendado" && podeEditar;
  // ≤3 ações por linha: status à esquerda, primária da pendência, o resto ghost
  const temAcoes =
    registroPendente ||
    podeRegistrar ||
    podeRemarcar ||
    (encontro?.status === "agendado" && podeMarcar && !!encontro.data_hora) ||
    (naoAconteceu && podeMarcar) ||
    !!reg?.precisa_apoio;
  // linha 1 (data + situação): a 1ª cláusula é a data do guia, nua — o
  // "sugerido" mora uma vez no rótulo da seção, não em cada linha. Depois de
  // realizado sem divergência a data oficial é ruído e a linha abre direto
  // no "realizado {data}" (§4). Join com " · " evita separador órfão
  const linha1 = [
    !(feito && !diverge) && passo.data && formatDate(passo.data),
    encontro?.data_hora &&
      `${feito && !diverge ? "realizado" : "agendado"} ${formatDateTime(encontro.data_hora)}`,
    naoAconteceu && "não aconteceu",
  ]
    .filter(Boolean)
    .join(" · ");
  // linha 2 (secundários — só quando existe): contexto que não é o estado do
  // encontro — divergência de data, origem externa, motivo da remarcação,
  // material sem destino e o foco do passo (trilha especialista)
  const linha2 = [
    diverge && `de fato em ${formatDate(encontro?.realizado_em)}`,
    encontro?.origem === "externo" && "marcado fora da plataforma",
    encontro?.motivo_reagendamento && `remarcado: ${encontro.motivo_reagendamento}`,
    tentativasFalhas > 0 &&
      `${tentativasFalhas === 1 ? "1 tentativa anterior não aconteceu" : `${tentativasFalhas} tentativas anteriores não aconteceram`}`,
    !materialHref &&
      material &&
      `${material.titulo}${materiais.length > 1 ? ` +${materiais.length - 1}` : ""}`,
    passo.foco,
  ]
    .filter(Boolean)
    .join(" · ");
  // resumo do registro na linha colapsada: tema (com ferramenta) é a leitura
  // mais rápida; atividades ou reflexões cobrem registro sem tema
  const regPreview = reg
    ? (reg.tema
        ? `${reg.tema}${reg.ferramenta ? ` · ${reg.ferramenta}` : ""}`
        : null) ??
      (reg.atividades.length > 0 ? reg.atividades.join(", ") : null) ??
      reg.reflexoes
    : null;

  const card = (
    <div
      id={encontro ? `registrar-${encontro.id}` : undefined}
      className={cn(
        // border-transparent: a borda fica reservada pro estado; quem desenha
        // a aresta no estado normal é o anel do shadow-border
        "scroll-mt-20 overflow-hidden rounded-xl border border-transparent bg-card shadow-[var(--shadow-border)]",
        reg?.precisa_apoio
          ? "border-[var(--danger)]/50"
          : registroPendente && "border-[var(--warn)]/50"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5",
          registroPendente && "bg-[var(--warn)]/5"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span
            className={cn(
              // disco do nº do encontro — lime cheio = aconteceu; lime de
              // contorno = compromisso firmado (agendado/remarcado); muted =
              // passo do guia ainda sem data; riscado = não aconteceu
              "grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold tabular-nums",
              feito
                ? "bg-[var(--brand-lime)] text-[var(--brand-ink)]"
                : naoAconteceu
                  ? "bg-muted text-muted-foreground/60 line-through"
                  : marcado
                    ? "bg-[var(--brand-lime)]/20 text-foreground ring-1 ring-[var(--brand-lime)]/60"
                    : "bg-muted text-muted-foreground"
            )}
          >
            {passo.numero}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium line-clamp-2">{passo.titulo}</p>
            <p className="text-xs text-muted-foreground">
              {linha1 || "Data a combinar"}
            </p>
            {linha2 && (
              <p className="mt-0.5 text-xs text-muted-foreground/75 line-clamp-2">
                {linha2}
              </p>
            )}
            {/* o lápis do link entra no gate mesmo sem link/material: um
                agendado SEM link é justamente quem precisa do "adicionar" —
                colado ao entrar/copiar quando eles existem */}
            {(linkSeguro(encontro?.link) || materialHref || podeRemarcar) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {linkSeguro(encontro?.link) &&
                  // entrar é da dupla (e pode virar CTA primário na janela do
                  // encontro); quem monitora copia pra repassar — nunca primário
                  (souMentor ? (
                    <a
                      href={linkSeguro(encontro?.link)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({
                        variant: chamadaAgora ? "default" : "outline",
                        size: "sm",
                      })}
                    >
                      <VideoCamera />
                      Entrar na chamada
                    </a>
                  ) : (
                    <CopiarChamada url={linkSeguro(encontro?.link)!} />
                  ))}
                {podeRemarcar && encontro && (
                  <EditarLinkDialog
                    encontroId={encontro.id}
                    linkAtual={encontro.link}
                  />
                )}
                {materialHref && (
                  <a
                    href={materialHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <BookOpen />
                    Material{materiais.length > 1 ? ` +${materiais.length - 1}` : ""}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
        {temAcoes && (
          // ml-auto ancora as ações à direita do bloco de título mesmo quando o
          // wrap joga o grupo pra linha de baixo no mobile
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {registroPendente && (
              <Badge variant="outline" className="border-[var(--warn)] text-[var(--warn-text)] shrink-0">
                registro pendente
              </Badge>
            )}
            {encontro && !reg && podeEditar &&
              liberadoNoHorario(
                <RegistroInlineTrigger encontroId={encontro.id} primario={!naoAconteceu} />
              )}
            {/* remarcar mora na linha do próprio encontro — vale pro agendado
                futuro E pro já passado (limbo): a action move a fonte passada
                pra um alvo futuro; nº = a tentativa na trilha esp */}
            {podeRemarcar && encontro && (
              <AgendarEncontroDialog
                duplaId={duplaId}
                numero={encontro.numero}
                atual={encontro}
                piso={piso}
                jovemNome={jovemNome}
                rotulo={ehEsp ? "sessão de especialista" : undefined}
                trigger={
                  <Button variant="outline" size="sm">
                    <CalendarBlank size={16} />
                    Remarcar
                  </Button>
                }
              />
            )}
            {/* o botão só vale depois do horário — RevelarApos faz ele aparecer
                pra quem ficou com a aba aberta atravessando o encontro */}
            {encontro?.status === "agendado" && podeMarcar && encontro.data_hora && (
              <RevelarApos from={encontro.data_hora}>
                <NaoAconteceuButton encontroId={encontro.id} duplaId={duplaId} />
              </RevelarApos>
            )}
            {naoAconteceu && podeMarcar && (
              <DesfazerNaoAconteceuButton encontroId={encontro.id} duplaId={duplaId} />
            )}
            {reg?.precisa_apoio && souCoord && (
              <ResolverApoioButton registroId={reg.id} duplaId={duplaId} />
            )}
            {reg?.precisa_apoio && !souCoord && (
              <Badge variant="outline" className="border-[var(--danger)] text-[var(--danger)] shrink-0">
                <HandHeart size={13} /> apoio solicitado
              </Badge>
            )}
            {/* o pedido partiu do mentor — a resposta de coord/sup é chamar
                ele direto, junto do resolver/badge */}
            {reg?.precisa_apoio && (
              <WhatsAppRapido duplaId={duplaId} destinos={apoioDestinos} />
            )}
          </div>
        )}
      </div>

      {/* anotações/plano do encontro — o mentor prepara aqui; pra quem não
          edita (coord/sup, dupla inativa) a nota existente vira leitura */}
      {(podeEditar || nota) && (
        <div className="border-t border-border/60 px-4 py-3">
          <NotaEncontro
            duplaId={duplaId}
            numero={passo.numero}
            nota={nota}
            somenteLeitura={!podeEditar}
          />
        </div>
      )}

      {/* registro salvo = histórico: linha-resumo (apoio, avaliação, tema) +
          disclosure pro corpo completo. Só o encontro atual e os pendentes
          nascem abertos; o deep link #registrar-{id} continua abrindo o bloco */}
      {reg && encontro && (
        <RegistroDetails
          encontroId={encontro.id}
          aberto={registroAberto}
          className="border-t border-border/60 bg-muted/50 shadow-[var(--shadow-inset)]"
          summary={
            <>
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground">
                Registro
              </span>
              {reg.precisa_apoio && (
                <HandHeart
                  size={13}
                  aria-label="Apoio solicitado"
                  className="shrink-0 text-[var(--danger)]"
                />
              )}
              {reg.avaliacao && <AvaliacaoBadge avaliacao={reg.avaliacao} />}
              {regPreview && (
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {regPreview}
                </span>
              )}
              <CaretDown
                size={13}
                aria-hidden
                className="ml-auto shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
              />
            </>
          }
        >
          <div className="space-y-2 px-4 pb-3.5 pt-1 text-sm">
            <RegistroView
              reg={reg}
              tardio={tardio}
              anexos={
                <AnexosRegistro
                  registroId={reg.id}
                  duplaId={duplaId}
                  autorId={autorId}
                  podeAnexar={podeAnexar}
                  podeRemover={podeRemoverAnexos}
                  anexos={anexos}
                />
              }
            />
            {podeEditar && (
              <div className="pt-1">
                <EditarRegistro
                  encontroId={encontro.id}
                  duplaId={duplaId}
                  evento={passo}
                  registro={reg}
                />
              </div>
            )}
          </div>
        </RegistroDetails>
      )}

      {/* avaliação estrela do jovem (0071) — canal paralelo ao registro do
          mentor: coord/sup leem a linha que a RLS entregou, o mentor DPP só
          a que o jovem liberou ("meu mentor pode ler esta"), e na trilha
          especialista só sobra a estrela da view definer */}
      {feito && encontro?.avaliacao_jovem && (
        <AvaliacaoJovemCard
          avaliacao={encontro.avaliacao_jovem}
          duplaId={duplaId}
          souCoord={souCoord}
          liberadaProMentor={souMentor}
        />
      )}
      {/* pendência do jovem — fato operacional pra coord/sup (o mentor não
          vê: saber que "a do encontro 4 não chegou" o convida a cobrar, e
          a pressão corrói o anonimato que a média protege) */}
      {feito &&
        !encontro?.avaliacao_jovem &&
        !souMentor &&
        estrelaJovem == null && (
          <AvaliacaoPendenteLinha
            link={linkAvaliacao}
            urlBase={urlBase}
            jovemNome={jovemNome}
            jovemWhatsapp={jovemWhatsapp}
            numero={passo.numero}
            souCoord={souCoord}
            duplaId={duplaId}
            jornadaViva={jornadaViva}
          />
        )}
      {/* especialista: só a estrela — a view definer é o recorte inteiro */}
      {feito && estrelaJovem != null && (
        <div className="border-t border-border/60 px-4 py-2.5">
          <EstrelaEspecialistaChip estrelas={estrelaJovem} />
        </div>
      )}

      {encontro && !reg && podeEditar &&
        liberadoNoHorario(
          <RegistroInlinePanel
            encontroId={encontro.id}
            className={cn(
              // região inset do card — poço afundado na superfície, mesma
              // gramática do bloco de reg acima; em registro pendente, a
              // lavagem warn da linha continua aqui
              "border-t border-border/60 px-4 py-4 shadow-[var(--shadow-inset)]",
              registroPendente ? "bg-[var(--warn)]/5" : "bg-muted/50"
            )}
          >
            <RegistroForm
              encontroId={encontro.id}
              duplaId={duplaId}
              evento={passo}
              combinadosPendentes={combinadosPendentes}
              // telemetria (REALIZA-217): o encontro "externo" nasceu no
              // fluxo retroativo — a sessão do form é catch-up, não novo
              origem={encontro.origem === "externo" ? "retroativo" : "novo"}
            />
          </RegistroInlinePanel>
        )}
    </div>
  );

  // um form de registro aberto por vez: o provider lê o hash #registrar-{id}
  // (mesma âncora do CTA da linha e dos deep-links) e fecha os irmãos
  return encontro && !reg && podeEditar ? (
    <RegistroInline encontroId={encontro.id}>{card}</RegistroInline>
  ) : (
    card
  );
}
