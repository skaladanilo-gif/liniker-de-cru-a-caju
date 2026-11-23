// Part 1: the hardcover magazine. In the hero it rests closed on the table; "Ver a revista"
// opens a full-screen reader with flat, even light and sharp pages, where the pages turn by
// click (folding from the corner you click), drag or keyboard.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { criarCena, suave, reduzido } from './cena.js';
import { criarLivro } from './livro.js';
import { interagir, nitidez } from './paginas.js';

const nome = (i) => String(i + 1).padStart(2, '0');

export async function iniciarRevista(canvas, ui) {
  const c = criarCena(canvas, { fov: 30 });
  const { THREE, scene, camera } = c;
  const toque = matchMedia('(pointer: coarse)').matches;

  // ---------- textures ----------
  let prontas = 0;
  const paginas = await Promise.all(Array.from({ length: 18 }, (_, i) =>
    c.textura(`assets/pages/p${nome(i)}.webp`).then((t) => { ui.progresso(++prontas / 18); return t; })));
  await document.fonts.ready;

  const livro = criarLivro(THREE, { paginas, capaDura: true });
  const { BW, PH } = livro;
  const suporte = new THREE.Group();
  suporte.add(livro.grupo);
  scene.add(suporte);
  const hd = nitidez({ livro, baixa: paginas, total: 18, carregarHD: (i) => c.textura(`assets/pages/hd/p${nome(i)}.webp`) });

  // ---------- camera ----------
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.rotateSpeed = 0.5;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = 1.1;
  controls.minAzimuthAngle = -0.7;
  controls.maxAzimuthAngle = 0.7;
  if (toque) canvas.style.touchAction = 'pan-y';

  let lendo = false, w = 1, h = 1;
  const pose = { pos: new THREE.Vector3(), alvo: new THREE.Vector3() };
  const de = { pos: new THREE.Vector3(), alvo: new THREE.Vector3() };
  let tPose = 1;
  function poseHeroi() {
    const precisa = w > 900 ? Math.max((BW * 1.5) / (camera.aspect * 0.55), PH * 1.2) : Math.max(BW * 1.9 / camera.aspect, PH * 1.6);
    const d = precisa / 2 / Math.tan((camera.fov * Math.PI) / 360);
    return { alvo: new THREE.Vector3(0, 0, 0), pos: new THREE.Vector3(-0.42, 0.74, 0.62).normalize().multiplyScalar(d) };
  }
  function poseLeitor() {
    // almost straight down, so the text is not foreshortened
    const precisa = Math.max((2 * BW * 1.08) / camera.aspect, PH * 1.16);
    const d = precisa / 2 / Math.tan((camera.fov * Math.PI) / 360);
    return { alvo: new THREE.Vector3(0, 0, 0.3), pos: new THREE.Vector3(0, 0.985, 0.17).normalize().multiplyScalar(d) };
  }
  function irPose(p, imediato) {
    de.pos.copy(camera.position); de.alvo.copy(controls.target);
    pose.pos.copy(p.pos); pose.alvo.copy(p.alvo);
    tPose = imediato || reduzido ? 1 : 0;
    if (tPose === 1) { camera.position.copy(p.pos); controls.target.copy(p.alvo); }
  }
  c.aoAjustar.add((W, H) => {
    w = W; h = H;
    c.desvio.alvo = lendo ? 0 : W > 900 ? W * 0.17 : 0;
    c.desvio.y = lendo ? 0 : W > 900 ? 0 : H * 0.14;
    const p = lendo ? poseLeitor() : poseHeroi();
    irPose(p, true);
    controls.minDistance = poseLeitor().pos.length() * 0.35;
    controls.maxDistance = poseLeitor().pos.length() * 1.2;
  });

  // ---------- light: dramatic in the hero, flat and even for reading ----------
  const luz = {
    heroi: { key: 2.1, fill: 0.55, hemi: 0.35, env: 0.55 },
    leitor: { key: 0.9, fill: 0.35, hemi: 1.25, env: 0.25 },
  };
  let mistura = 0;

  // ---------- reader ----------
  function abrirLeitor() {
    if (lendo) return;
    lendo = true;
    ui.lendo(true);
    c.desvio.alvo = 0; c.desvio.y = 0;
    hd.ligar(true, livro.atual);
    requestAnimationFrame(() => {
      c.ajustar();
      irPose(poseLeitor());
      controls.enabled = true;
      controls.enableRotate = !toque;
      controls.enableZoom = true;
      canvas.style.touchAction = 'none';
      if (livro.atual === 0) setTimeout(() => { if (livro.atual === 0) livro.irPara(1); }, reduzido ? 0 : 650);
    });
  }
  function fecharLeitor() {
    if (!lendo) return;
    lendo = false;
    controls.enabled = false;
    if (toque) canvas.style.touchAction = 'pan-y';
    livro.irPara(0);
    hd.ligar(false, 0);
    ui.lendo(false);
    requestAnimationFrame(() => { c.ajustar(); irPose(poseHeroi()); });
  }
  ui.aoAbrir(abrirLeitor);
  ui.aoFechar(fecharLeitor);
  ui.aoVirar((p) => { if (!lendo) abrirLeitor(); else livro.virar(p); });
  ui.aoIr((n) => livro.irPara(n));
  addEventListener('keydown', (e) => {
    if (!lendo) return;
    if (e.key === 'ArrowRight') livro.virar(1);
    if (e.key === 'ArrowLeft') livro.virar(-1);
    if (e.key === 'Escape') fecharLeitor();
  });

  // ---------- pointer ----------
  const alvoGiro = { x: 0, y: 0 }, giro = { x: 0, y: 0 };
  interagir({ c, livro, suporte, canvas, controls, toque, ativo: () => lendo, cursor: ui.cursor, aoClicarLivro: abrirLeitor });
  canvas.addEventListener('pointermove', (e) => {
    if (lendo) return;
    alvoGiro.y = (e.clientX / innerWidth - 0.5) * 0.35;
    alvoGiro.x = (e.clientY / innerHeight - 0.5) * 0.12;
  });

  // ---------- loop ----------
  let ultimo = -1;
  c.tarefas.add((dt, t) => {
    const x = livro.atualizar(dt);
    livro.grupo.position.x += (x - livro.grupo.position.x) * Math.min(1, dt * 5);
    const heroi = lendo ? 0 : 1;
    giro.x += (alvoGiro.x - giro.x) * Math.min(1, dt * 3);
    giro.y += (alvoGiro.y - giro.y) * Math.min(1, dt * 3);
    const yaw = heroi * (-0.12 + giro.y + (reduzido ? 0 : Math.sin(t * 0.5) * 0.05));
    suporte.rotation.y += (yaw - suporte.rotation.y) * Math.min(1, dt * 3);
    suporte.rotation.x += (heroi * giro.x - suporte.rotation.x) * Math.min(1, dt * 3);
    suporte.position.y += ((heroi ? 1.2 + (reduzido ? 0 : Math.sin(t * 0.8) * 0.25) : 0) - suporte.position.y) * Math.min(1, dt * 3);
    mistura += ((lendo ? 1 : 0) - mistura) * Math.min(1, dt * 3);
    const L = (k) => luz.heroi[k] + (luz.leitor[k] - luz.heroi[k]) * mistura;
    c.key.intensity = L('key'); c.fill.intensity = L('fill'); c.hemi.intensity = L('hemi'); scene.environmentIntensity = L('env');
    if (tPose < 1) {
      tPose = Math.min(1, tPose + dt / 1.1);
      const k = suave(tPose);
      camera.position.lerpVectors(de.pos, pose.pos, k);
      controls.target.lerpVectors(de.alvo, pose.alvo, k);
      camera.lookAt(controls.target);
    } else if (controls.enabled) controls.update();
    else camera.lookAt(controls.target);
    if (livro.atual !== ultimo) {
      ultimo = livro.atual;
      ui.pagina(livro.rotulo(), livro.atual);
      if (lendo) hd.atualizar(livro.atual);
    }
  });
  if (new URLSearchParams(location.search).has('teste')) window.__livro = livro;
  c.ajustar();
  ui.pronto();
  return { abrirLeitor, fecharLeitor };
}
