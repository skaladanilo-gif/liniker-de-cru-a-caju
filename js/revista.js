// Part 1: the hardcover magazine. In the hero it rests closed on the table; "Ver a revista"
// opens a full-screen reader where the pages turn by click, drag or keyboard.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { criarCena, ndc, suave, reduzido } from './cena.js';
import { criarLivro, BW, PH, ESPESSURA, ESTADOS } from './livro.js';

export async function iniciarRevista(canvas, ui) {
  const c = criarCena(canvas, { fov: 30 });
  const { THREE, scene, camera } = c;
  const toque = matchMedia('(pointer: coarse)').matches;

  // ---------- textures ----------
  let prontas = 0;
  const total = 18;
  const conta = (t) => { ui.progresso(++prontas / total); return t; };
  const paginas = await Promise.all(Array.from({ length: 18 }, (_, i) =>
    c.textura(`assets/pages/p${String(i + 1).padStart(2, '0')}.webp`).then(conta)));
  await document.fonts.ready;

  const livro = criarLivro(THREE, { paginas });
  const suporte = new THREE.Group();          // rotates the book in the hero
  suporte.add(livro.grupo);
  scene.add(suporte);

  // ---------- camera poses ----------
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.rotateSpeed = 0.5;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = 1.15;
  controls.minAzimuthAngle = -0.8;
  controls.maxAzimuthAngle = 0.8;
  if (toque) canvas.style.touchAction = 'pan-y';

  let lendo = false, w = 1, h = 1;
  const pose = { pos: new THREE.Vector3(), alvo: new THREE.Vector3() };
  const de = { pos: new THREE.Vector3(), alvo: new THREE.Vector3() };
  let tPose = 1;
  function poseHeroi() {
    const largo = w > 900;
    const precisa = largo ? Math.max((BW * 1.5) / (camera.aspect * 0.55), PH * 1.2) : Math.max(BW * 1.9 / camera.aspect, PH * 1.6);
    const d = precisa / 2 / Math.tan((camera.fov * Math.PI) / 360);
    return { alvo: new THREE.Vector3(0, 0, 0), pos: new THREE.Vector3(-0.42, 0.74, 0.62).normalize().multiplyScalar(d) };
  }
  function poseLeitor() {
    const precisa = Math.max((2 * BW * 1.12) / camera.aspect, PH * 1.22);
    const d = precisa / 2 / Math.tan((camera.fov * Math.PI) / 360);
    return { alvo: new THREE.Vector3(0, 0, 0.6), pos: new THREE.Vector3(0, 0.94, 0.34).normalize().multiplyScalar(d) };
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
    irPose(lendo ? poseLeitor() : poseHeroi(), true);
    controls.minDistance = poseLeitor().pos.length() * 0.45;
    controls.maxDistance = poseLeitor().pos.length() * 1.25;
  });

  // ---------- reader ----------
  function abrirLeitor() {
    if (lendo) return;
    lendo = true;
    ui.lendo(true);
    c.desvio.alvo = 0; c.desvio.y = 0;
    requestAnimationFrame(() => {
      c.ajustar();
      irPose(poseLeitor());
      controls.enabled = true;
      controls.enableRotate = !toque;
      canvas.style.touchAction = 'none';
      controls.enableZoom = true;
      if (livro.atual === 0) setTimeout(() => { livro.irPara(1); }, reduzido ? 0 : 650);
    });
  }
  function fecharLeitor() {
    if (!lendo) return;
    lendo = false;
    controls.enabled = false;
    if (toque) canvas.style.touchAction = 'pan-y';
    livro.irPara(0);
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
  const ray = new THREE.Raycaster();
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ESPESSURA / 2);
  const ponto = new THREE.Vector3();
  function noLivro(e) {
    ray.setFromCamera(ndc(canvas, e), camera);
    if (!ray.ray.intersectPlane(plano, ponto)) return null;
    const local = suporte.worldToLocal(ponto.clone());
    const lx = local.x - livro.grupo.position.x;
    if (Math.abs(local.z) > PH / 2 + 0.6) return null;
    const a = livro.atual;
    if (lx > 0 && lx < BW + 0.5 && a < ESTADOS) return { lado: 1, lx };
    if (lx < 0 && lx > -BW - 0.5 && a > 0) return { lado: -1, lx };
    return null;
  }
  let toqueIni = null;
  canvas.addEventListener('pointerdown', (e) => {
    const n = noLivro(e);
    toqueIni = { x: e.clientX, y: e.clientY, n };
    if (lendo && n && !toque) {
      livro.pegar(n.lado);
      controls.enableRotate = false;
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (lendo && livro.arrastando) {
      ray.setFromCamera(ndc(canvas, e), camera);
      if (ray.ray.intersectPlane(plano, ponto)) livro.puxar(suporte.worldToLocal(ponto.clone()).x - livro.grupo.position.x);
      return;
    }
    const n = noLivro(e);
    if (!lendo) { ui.cursor(n || hoverLivro(e) ? 'Ler' : ''); alvoGiro.y = (e.clientX / innerWidth - 0.5) * 0.35; alvoGiro.x = (e.clientY / innerHeight - 0.5) * 0.12; }
    else ui.cursor(n ? (n.lado > 0 ? 'Virar' : 'Voltar') : '');
  });
  canvas.addEventListener('pointerup', (e) => {
    const clique = toqueIni && Math.hypot(e.clientX - toqueIni.x, e.clientY - toqueIni.y) < 6;
    if (lendo && livro.arrastando) {
      if (clique) { livro.soltar(); livro.irPara(livro.atual + toqueIni.n.lado); }
      else livro.soltar();
      controls.enableRotate = !toque;
    } else if (clique) {
      if (!lendo && (toqueIni.n || hoverLivro(e))) abrirLeitor();
      else if (lendo && toqueIni.n) livro.virar(toqueIni.n.lado);
    }
    toqueIni = null;
  });
  canvas.addEventListener('pointerleave', () => ui.cursor(''));
  const malhas = livro.malhas();
  function hoverLivro(e) {
    ray.setFromCamera(ndc(canvas, e), camera);
    return ray.intersectObjects(malhas, false).length > 0;
  }

  // ---------- loop ----------
  const alvoGiro = { x: 0, y: 0 }, giro = { x: 0, y: 0 };
  let ultimo = -1;
  c.tarefas.add((dt, t) => {
    const x = livro.atualizar(dt);
    livro.grupo.position.x += (x - livro.grupo.position.x) * Math.min(1, dt * 5);
    // hero: the closed book turned three quarters, following the pointer a little
    const heroi = lendo ? 0 : 1;
    giro.x += (alvoGiro.x - giro.x) * Math.min(1, dt * 3);
    giro.y += (alvoGiro.y - giro.y) * Math.min(1, dt * 3);
    const yaw = heroi * (-0.12 + giro.y + (reduzido ? 0 : Math.sin(t * 0.5) * 0.05));
    suporte.rotation.y += (yaw - suporte.rotation.y) * Math.min(1, dt * 3);
    suporte.rotation.x += (heroi * giro.x - suporte.rotation.x) * Math.min(1, dt * 3);
    suporte.position.y += ((heroi ? 1.2 + (reduzido ? 0 : Math.sin(t * 0.8) * 0.25) : 0) - suporte.position.y) * Math.min(1, dt * 3);
    if (tPose < 1) {
      tPose = Math.min(1, tPose + dt / 1.1);
      const k = suave(tPose);
      camera.position.lerpVectors(de.pos, pose.pos, k);
      controls.target.lerpVectors(de.alvo, pose.alvo, k);
      camera.lookAt(controls.target);
    } else if (controls.enabled) controls.update();
    else camera.lookAt(controls.target);
    if (livro.atual !== ultimo) { ultimo = livro.atual; ui.pagina(livro.rotulo(), livro.atual); }
  });
  c.ajustar();
  ui.pronto();
  return { abrirLeitor, fecharLeitor };
}
