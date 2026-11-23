// Shared 3D setup: renderer, studio light, table, visibility-driven render loop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function criarCena(canvas, { fov = 32 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(fov, 1, 1, 600);

  // warm key light that casts the shadows, cool fill from the other side
  const key = new THREE.DirectionalLight(0xfff1e0, 2.1);
  key.position.set(-28, 60, 30);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -60; key.shadow.camera.right = 60;
  key.shadow.camera.top = 60; key.shadow.camera.bottom = -60;
  key.shadow.camera.near = 10; key.shadow.camera.far = 160;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;
  key.shadow.radius = 6;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb8c4ff, 0.55);
  fill.position.set(40, 30, -20);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xdfe4ff, 0x14183a, 0.35));

  // a moving light that catches the spot varnish
  const brilho = new THREE.PointLight(0xffffff, 0, 90, 1.6);
  brilho.position.set(0, 30, 20);
  scene.add(brilho);

  // table: only the shadow shows over the page background
  const mesa = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.42, color: 0x05060f }));
  mesa.rotation.x = -Math.PI / 2;
  mesa.receiveShadow = true;
  scene.add(mesa);

  let visivel = false, raf = 0, antes = performance.now();
  const tarefas = new Set();
  function quadro(t) {
    raf = 0;
    const dt = Math.min(0.05, (t - antes) / 1000);
    antes = t;
    for (const f of tarefas) f(dt, t / 1000);
    renderer.render(scene, camera);
    if (visivel) raf = requestAnimationFrame(quadro);
  }
  function ajustar() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const f of aoAjustar) f(w, h);
  }
  const aoAjustar = new Set();
  new ResizeObserver(ajustar).observe(canvas);
  new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting;
    if (visivel && !raf) { antes = performance.now(); raf = requestAnimationFrame(quadro); }
  }, { rootMargin: '120px' }).observe(canvas);

  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  function textura(url, { cor = true } = {}) {
    return new Promise((ok, erro) => loader.load(url, (t) => {
      t.colorSpace = cor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = maxAniso;
      ok(t);
    }, undefined, erro));
  }

  // shift the picture sideways (px) so the 3D sits beside the text panel
  const desvio = { alvo: 0, atual: 0, y: 0 };
  tarefas.add((dt) => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    desvio.atual += (desvio.alvo - desvio.atual) * Math.min(1, dt * 5);
    if (Math.abs(desvio.atual) < 0.5 && desvio.alvo === 0 && !desvio.y) camera.clearViewOffset();
    else camera.setViewOffset(w, h, -desvio.atual, -desvio.y, w, h);
  });

  return { THREE, renderer, scene, camera, key, brilho, mesa, tarefas, aoAjustar, ajustar, textura, desvio };
}

// pointer helper: tells a click from a drag
export function cliques(el, aoClicar, aoMover) {
  let x0 = 0, y0 = 0, t0 = 0;
  el.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); });
  el.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - x0, e.clientY - y0) < 6 && performance.now() - t0 < 600) aoClicar(e);
  });
  if (aoMover) el.addEventListener('pointermove', aoMover);
}

export function ndc(el, e) {
  const r = el.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
}

export const suave = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
