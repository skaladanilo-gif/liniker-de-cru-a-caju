// Page chrome from the portfolio (Stories bar, timecode clock, red cursor) + the two 3D scenes.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------- clock ----------
const inicio = performance.now();
const relogio = $('[data-tempo]');
setInterval(() => {
  const s = Math.floor((performance.now() - inicio) / 1000);
  relogio.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}, 1000);

// ---------- Stories bar follows the scroll ----------
const partes = ['inicio', 'sobre', 'presskit'].map((id) => ({ el: document.getElementById(id), barra: $(`[data-parte="${id}"] b`) }));
function progresso() {
  const meio = innerHeight * 0.5;
  for (const p of partes) {
    const r = p.el.getBoundingClientRect();
    p.barra.style.setProperty('--p', Math.max(0, Math.min(1, (meio - r.top) / r.height)).toFixed(3));
  }
}
addEventListener('scroll', progresso, { passive: true });
progresso();

// ---------- cursor ----------
const cursor = $('.cursor'), cursorTexto = $('.cursor-texto');
addEventListener('pointermove', (e) => {
  cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  cursor.classList.add('ativo');
}, { passive: true });
document.addEventListener('pointerleave', () => cursor.classList.remove('ativo'));
function rotular(texto) {
  cursorTexto.textContent = texto;
  cursor.classList.toggle('rotulo', !!texto);
}

function carregador(nome) {
  const box = $(`[data-carregando="${nome}"]`);
  const pct = $('[data-pct]', box);
  return {
    progresso: (v) => { pct.textContent = `${Math.round(v * 100)}%`; },
    pronto: () => box.classList.add('feito'),
    erro: () => { box.classList.remove('feito'); box.innerHTML = '<span class="tc">Erro</span> O 3D não abriu neste navegador. Tente atualizar a página.'; },
  };
}

// ---------- part 1: hardcover magazine + reader ----------
const heroi = $('#inicio'), leitor = $('[data-leitor]');
const rotuloPagina = $('[data-pagina]');
const [antes, depois] = $$('[data-virar]');
const espelhos = $('[data-espelhos]');
const nomes = ['Capa', '2–3', '4–5', '6–7', '8–9', '10–11', '12–13', '14–15', '16–17', 'Contracapa'];
espelhos.innerHTML = nomes.map((n, i) => `<li><button data-ir="${i}">${n}</button></li>`).join('');
let cb = { abrir: () => {}, fechar: () => {}, virar: () => {}, ir: () => {} };
const uiRevista = {
  ...carregador('revista'),
  cursor: rotular,
  pagina(texto, i) {
    rotuloPagina.textContent = texto;
    antes.disabled = i === 0;
    depois.disabled = i === nomes.length - 1;
    $$('[data-ir]').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.ir) === i)));
    const atual = $(`[data-ir="${i}"]`);
    atual?.scrollIntoView({ block: 'nearest', inline: 'center' });
  },
  lendo(sim) {
    heroi.classList.toggle('lendo', sim);
    document.body.classList.toggle('lendo', sim);
    leitor.hidden = !sim;
    if (sim) $('[data-fechar-leitor]').focus({ preventScroll: true });
    else $('[data-abrir-leitor]').focus({ preventScroll: true });
  },
  aoAbrir(f) { cb.abrir = f; }, aoFechar(f) { cb.fechar = f; }, aoVirar(f) { cb.virar = f; }, aoIr(f) { cb.ir = f; },
};
$('[data-abrir-leitor]').addEventListener('click', () => cb.abrir());
$('[data-fechar-leitor]').addEventListener('click', () => cb.fechar());
$$('[data-virar]').forEach((b) => b.addEventListener('click', () => cb.virar(Number(b.dataset.virar))));
espelhos.addEventListener('click', (e) => { const b = e.target.closest('[data-ir]'); if (b) cb.ir(Number(b.dataset.ir)); });

// ---------- part 2: the box ----------
const detalhe = $('[data-detalhe]');
const botaoCaixa = $('[data-abrir-caixa]');
let pk = { escolher: () => {}, voltar: () => {}, caixa: () => {} };
const uiPresskit = {
  ...carregador('presskit'),
  cursor: rotular,
  aoEscolher(f) { pk.escolher = f; }, aoVoltar(f) { pk.voltar = f; }, aoAbrirCaixa(f) { pk.caixa = f; },
  caixa(aberta) { botaoCaixa.textContent = aberta ? 'Fechar a caixa' : 'Abrir a caixa'; },
  detalhe(nome, info) {
    $$('[data-peca]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.peca === nome)));
    $('#presskit').classList.toggle('focando', !!nome);
    if (!nome) { detalhe.hidden = true; return; }
    $('[data-detalhe-nome]').textContent = info.nome;
    $('[data-detalhe-medida]').textContent = info.medida;
    $('[data-detalhe-texto]').textContent = info.texto;
    $('[data-folhear]').hidden = !info.ler;
    detalhe.hidden = false;
  },
};
$$('[data-peca]').forEach((b) => b.addEventListener('click', () => pk.escolher(b.dataset.peca)));
$('[data-voltar]').addEventListener('click', () => pk.voltar());
botaoCaixa.addEventListener('click', () => pk.caixa());
$('[data-folhear]').addEventListener('click', () => {
  pk.voltar();
  heroi.scrollIntoView();
  setTimeout(() => cb.abrir(), 60);
});

function webgl() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}
if (!webgl()) {
  uiRevista.erro();
  uiPresskit.erro();
} else {
  import('./revista.js').then((m) => m.iniciarRevista($('[data-cena="revista"]'), uiRevista)).catch((e) => { console.error(e); uiRevista.erro(); });
  const alvo = $('[data-cena="presskit"]');
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    import('./presskit.js').then((m) => m.iniciarPresskit(alvo, uiPresskit)).catch((err) => { console.error(err); uiPresskit.erro(); });
  }, { rootMargin: '700px' }).observe(alvo);
}
