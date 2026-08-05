/* Descobre e guarda de onde a visitante veio, pra saber qual canal gera venda.
   Sem biblioteca, sem cookie de terceiro, sem rastrear ninguém fora do site.
   Guarda no proprio navegador (localStorage) e viaja junto no lead e no pagamento. */
(function () {
  var KEY = 'hm:origem';

  var CANAIS = [
    [/l\.instagram\.com|instagram\.com|ig\.me/i, 'instagram'],
    [/l\.facebook\.com|facebook\.com|fb\.me/i, 'facebook'],
    [/chatgpt\.com|chat\.openai\.com/i, 'chatgpt'],
    [/perplexity\.ai/i, 'perplexity'],
    [/gemini\.google|bard\.google|copilot\.microsoft/i, 'ia-outra'],
    [/youtube\.com|youtu\.be/i, 'youtube'],
    [/tiktok\.com/i, 'tiktok'],
    [/linkedin\.com|lnkd\.in/i, 'linkedin'],
    [/whatsapp\.com|wa\.me/i, 'whatsapp'],
    [/t\.co$|twitter\.com|x\.com/i, 'twitter'],
    [/plataformanutra\.com\.br/i, 'nutra'],
    [/google\.|bing\.com|duckduckgo\.com|search\.yahoo/i, 'busca-organica']
  ];

  function canalDoReferrer(ref) {
    if (!ref) return null;
    var host = ref;
    try { host = new URL(ref).hostname; } catch (e) {}
    if (host.indexOf(location.hostname) !== -1) return null; // clique dentro do site
    for (var i = 0; i < CANAIS.length; i++) {
      if (CANAIS[i][0].test(host)) return CANAIS[i][1];
    }
    return host.replace(/^www\./, '').slice(0, 60);
  }

  function param(nome) {
    try {
      var v = new URLSearchParams(location.search).get(nome);
      return v ? v.slice(0, 100) : null;
    } catch (e) { return null; }
  }

  function toqueAtual() {
    var utm = param('utm_source');
    var gclid = param('gclid');
    var fbclid = param('fbclid');
    var canalRef = canalDoReferrer(document.referrer);
    var canal = utm ? utm.toLowerCase()
      : gclid ? 'google-ads'
      : fbclid ? 'meta-ads'
      : canalRef ? canalRef
      : 'direto';
    return {
      canal: canal,
      campanha: param('utm_campaign'),
      utmMedium: param('utm_medium'),
      gclid: gclid,
      fbclid: fbclid,
      referrer: (document.referrer || '').slice(0, 200) || null,
      pagina: location.pathname.slice(0, 120),
      em: new Date().toISOString(),
      identificavel: !!(utm || gclid || fbclid || canalRef)
    };
  }

  function ler() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function salvar(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  var toque = toqueAtual();
  var guardado = ler();
  var dados;
  if (!guardado) {
    dados = { primeira: toque, ultima: toque };
    salvar(dados);
  } else if (toque.identificavel) {
    dados = { primeira: guardado.primeira || toque, ultima: toque };
    salvar(dados);
  } else {
    dados = guardado;
  }

  function campos() {
    var p = dados.primeira || {}, u = dados.ultima || {};
    return {
      canal: p.canal || null,
      canalUltimo: u.canal || null,
      campanha: p.campanha || u.campanha || null,
      gclid: p.gclid || u.gclid || null,
      referrerPrimeiro: p.referrer || null,
      paginaEntrada: p.pagina || null,
      primeiraVisitaEm: p.em || null
    };
  }

  /* Etiqueta curta pra mandar pra Stripe no client_reference_id (max 200 chars,
     sem caractere estranho). Ex: "guia_instagram_reels-histamina" */
  function etiqueta(produto) {
    var c = campos();
    var partes = [produto || 'site', c.canal || 'desconhecido'];
    if (c.campanha) partes.push(c.campanha);
    return partes.join('_').replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 190);
  }

  /* Cola a etiqueta num link de pagamento da Stripe. */
  function marcarLink(url, produto) {
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 'client_reference_id=' + encodeURIComponent(etiqueta(produto));
  }

  window.HMOrigem = { campos: campos, etiqueta: etiqueta, marcarLink: marcarLink, dados: dados };
})();
