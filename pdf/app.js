// Revista 3D: send a PDF and turn its pages as a magazine. Everything runs in the browser.
import * as pdfjs from 'pdfjs';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { criarCena, reduzido } from '../js/cena.js';
import { criarLivro } from '../js/livro.js';
import { interagir, nitidez } from '../js/paginas.js';

const WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const $ = (s) => document.querySelector(s);

async function prepararWorker() {
  try {
    const codigo = await fetch(WORKER).then((r) => { if (!r.ok) throw new Error(); return r.text(); });
    const url = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }));
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(url, { type: 'module' });
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
  }
}
const pronto = prepararWorker();

// ---------- choosing a file ----------
const erro = $('[data-erro]');
function falhar(msg) { erro.textContent = msg; erro.hidden = false; }
$('[data-arquivo]').addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) abrirArquivo(f); });
const zona = $('[data-soltar]');
addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('sobre'); });
addEventListener('dragleave', () => zona.classList.remove('sobre'));
addEventListener('drop', (e) => {
  e.preventDefault(); zona.classList.remove('sobre');
  const f = [...(e.dataTransfer?.files || [])].find((x) => x.type === 'application/pdf' || x.name.toLowerCase().endsWith('.pdf'));
  if (f) abrirArquivo(f); else falhar('Esse arquivo não é um PDF. Escolha um arquivo .pdf.');
});
$('[data-outro]').addEventListener('click', () => { location.href = location.pathname; });

async function abrirArquivo(arquivo) {
  erro.hidden = true;
  abrir(await arquivo.arrayBuffer(), arquivo.name.replace(/\.pdf$/i, ''));
}
const link = new URLSearchParams(location.search).get('pdf');
if (link) {
  fetch(link).then((r) => { if (!r.ok) throw new Error(); return r.arrayBuffer(); })
    .then((b) => abrir(b, decodeURIComponent(link.split('/').pop().replace(/\.pdf$/i, ''))))
    .catch(() => falhar('Não foi possível abrir o PDF desse link. Escolha o arquivo no seu computador.'));
}

// ---------- pages as textures ----------
async function desenhar(doc, n, largura) {
  const pagina = await doc.getPage(n + 1);
  const base = pagina.getViewport({ scale: 1 });
  const vp = pagina.getViewport({ scale: largura / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
  pagina.cleanup();
  return canvas;
}

async function abrir(dados, nome) {
  await pronto;
  let doc;
  try { doc = await pdfjs.getDocument({ data: new Uint8Array(dados) }).promise; }
  catch { return falhar('Não deu para ler esse PDF. Ele pode estar protegido por senha ou corrompido.'); }

  $('[data-inicio]').hidden = true;
  $('[data-leitor]').hidden = false;
  $('[data-nome]').textContent = nome;
  document.title = `${nome} · Revista 3D`;
  const total = doc.numPages;
  const largura = total <= 40 ? 1024 : total <= 80 ? 768 : 600;

  const canvas = $('.cena');
  const c = criarCena(canvas, { fov: 30 });
  const { THREE, scene, camera } = c;
  c.key.intensity = 0.9; c.fill.intensity = 0.35; c.hemi.intensity = 1.25; scene.environmentIntensity = 0.25;
  c.mesa.material.opacity = 0.22;
  const anis = c.renderer.capabilities.getMaxAnisotropy();
  const textura = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anis; return t; };

  const pct = $('[data-pct]');
  const paginas = [];
  let proporcao = 1.414;
  for (let i = 0; i < total; i++) {
    const cv = await desenhar(doc, i, largura);
    if (i === 0) proporcao = cv.height / cv.width;
    paginas.push(textura(cv));
    pct.textContent = `${Math.round(((i + 1) / total) * 100)}%`;
  }
  $('[data-carregando]').hidden = true;

  const L = 21;
  const livro = criarLivro(THREE, { paginas, largura: L, altura: L * proporcao, capaDura: false });
  const suporte = new THREE.Group();
  suporte.add(livro.grupo);
  scene.add(suporte);
  const hd = nitidez({ livro, baixa: paginas, total, carregarHD: async (i) => textura(await desenhar(doc, i, 2048)) });

  // camera: almost straight down so the text stays readable
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.enablePan = false;
  controls.rotateSpeed = 0.5; controls.maxPolarAngle = 1.1;
  controls.minAzimuthAngle = -0.7; controls.maxAzimuthAngle = 0.7;
  const toque = matchMedia('(pointer: coarse)').matches;
  controls.enableRotate = !toque;
  c.aoAjustar.add(() => {
    const precisa = Math.max((2 * livro.PW * 1.08) / camera.aspect, livro.PH * 1.3);
    const d = precisa / 2 / Math.tan((camera.fov * Math.PI) / 360);
    controls.target.set(0, 0, 0.3);
    camera.position.set(0, 0.985, 0.17).normalize().multiplyScalar(d);
    controls.minDistance = d * 0.35; controls.maxDistance = d * 1.3;
    controls.update();
  });

  interagir({ c, livro, suporte, canvas, controls, toque, ativo: () => true, cursor: (t) => { canvas.style.cursor = t ? 'pointer' : ''; } });
  const rotulo = $('[data-pagina]');
  const [antes, depois] = document.querySelectorAll('[data-virar]');
  antes.addEventListener('click', () => livro.virar(-1));
  depois.addEventListener('click', () => livro.virar(1));
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') livro.virar(1);
    if (e.key === 'ArrowLeft') livro.virar(-1);
  });
  function texto(e) {
    if (e === 0) return `1 de ${total}`;
    const a = 2 * e, b = Math.min(2 * e + 1, total);
    if (a > total) return 'Fim';
    return a === b ? `${a} de ${total}` : `${a}–${b} de ${total}`;
  }

  let ultimo = -1;
  hd.ligar(true, 0);
  c.tarefas.add((dt) => {
    const x = livro.atualizar(dt, reduzido ? 0.01 : 0.95);
    livro.grupo.position.x += (x - livro.grupo.position.x) * Math.min(1, dt * 5);
    controls.update();
    if (livro.atual !== ultimo) {
      ultimo = livro.atual;
      rotulo.textContent = texto(ultimo);
      antes.disabled = ultimo === 0;
      depois.disabled = ultimo === livro.ESTADOS;
      hd.atualizar(ultimo);
    }
  });
  c.ajustar();
}
