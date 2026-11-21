/** Navega pra âncora `#registrar-{id}` pelo history.pushState — nunca por
 *  `<a href>` nativo nem `location.hash =`: a navegação de fragmento do
 *  browser não passa pelo patch do Next, então o canonicalUrl do router
 *  ficava sem o hash e o refresh pós-server-action reescrevia a URL sem
 *  ele — o painel recém-aberto fechava sozinho na corrida do
 *  salvarRegistro. Pelo pushState o router aprende o fragmento e os
 *  writes posteriores do HistoryUpdater o preservam.
 *  pushState não dispara hashchange — o `realiza:hash` acorda quem assina
 *  o hash (RegistroInline/RegistroDetails; mesmo contrato dos router.push
 *  pra âncora feitos na agenda e no retroativo). */
export function abrirAncoraRegistro(encontroId: string) {
  window.history.pushState(null, "", `#registrar-${encontroId}`);
  window.dispatchEvent(new Event("realiza:hash"));
}
