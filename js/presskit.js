// Part 2: the presskit as a real gift box. The lid lifts off, the tissue paper opens and the
// pieces (hardcover magazine, bookmark, fan) come out to be looked at. Units: cm.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { criarCena, cliques, ndc, suave, reduzido } from './cena.js';
import { criarLivro } from './livro.js';
import { materialOuro, mascara, sol, selo } from './ouro.js';

const CX = 25, CZ = 33, CY = 7, E = 0.3;          // tray
const TX = 25.5, TZ = 33.5, TY = 4.6;             // lid

const INFO = {
  revista: { nome: 'Revista em capa dura', medida: '21 × 29,7 cm, 18 páginas', texto: 'Capa dura com lombada em tecido vermelho e título em hot stamping dourado. As 18 páginas da revista, da capa à contracapa.', ler: true },
  marcador: { nome: 'Marcador de página', medida: '5 × 20 cm', texto: 'Os cinco discos em ordem, de Cru a Caju. O nome leva verniz localizado e o sol do topo é hot stamping dourado.' },
  leque: { nome: 'Leque', medida: '24 × 21 cm', texto: 'Para a última noite em Salvador. Os raios alternam verniz e papel, e um aro dourado em hot stamping contorna o sol.' },
};

export async function iniciarPresskit(canvas, ui) {
  const c = criarCena(canvas, { fov: 30 });
  const { THREE, scene, camera, brilho } = c;
  const toque = matchMedia('(pointer: coarse)').matches;
  scene.environmentIntensity = 0.45;
  c.key.intensity = 2.0;
  brilho.intensity = 60;

  // ---------- textures ----------
  const kit2 = ['tampa', 'tampa_rough', 'tampa_dentro', 'tampa_lado_longo', 'tampa_lado_curto', 'caixa_lado_longo', 'caixa_lado_curto', 'miolo', 'seda'];
  const kit = ['marcador', 'marcador_rough', 'leque', 'leque_rough'];
  const total = kit2.length + kit.length + 18;
  let n = 0;
  const T = {};
  const um = (k, url, cor) => c.textura(url, { cor }).then((t) => { T[k] = t; ui.progresso(++n / total); });
  await Promise.all([
    ...kit2.map((k) => um(k, `assets/kit2/${k}.webp`, !k.endsWith('rough'))),
    ...kit.map((k) => um(k, `assets/kit/${k}.webp`, !k.endsWith('rough'))),
    ...Array.from({ length: 18 }, (_, i) => um(`p${i}`, `assets/pages/p${String(i + 1).padStart(2, '0')}.webp`, true)),
  ]);
  const fan = await fetch('assets/kit/fan.json').then((r) => r.json());
  await document.fonts.ready;
  for (const k of ['miolo', 'seda']) { T[k].wrapS = T[k].wrapT = THREE.RepeatWrapping; }

  // ---------- materials ----------
  const vernizes = {};
  const uniforms = (nome) => (vernizes[nome] ||= { brilho: { value: 0 }, faixa: { value: -0.5 }, t: Math.random() });
  function impresso(map, rough, nome) {
    const m = new THREE.MeshStandardMaterial({ map, roughnessMap: rough || null, roughness: rough ? 1 : 0.72, metalness: 0, envMapIntensity: 1.1 });
    if (!rough) return m;
    const u = uniforms(nome);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uBrilho = u.brilho; sh.uniforms.uFaixa = u.faixa;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uBrilho;\nuniform float uFaixa;')
        .replace('#include <opaque_fragment>', `
          float mascara = 1.0 - smoothstep(0.25, 0.55, texture2D(roughnessMap, vRoughnessMapUv).g);
          float diag = (vRoughnessMapUv.x + (1.0 - vRoughnessMapUv.y)) * 0.5;
          float faixa = exp(-pow((diag - uFaixa) * 9.0, 2.0));
          outgoingLight = mix(outgoingLight, outgoingLight * 1.25 + vec3(0.32, 0.3, 0.27), mascara * (0.12 + faixa * 0.88) * uBrilho);
          #include <opaque_fragment>`);
    };
    return m;
  }
  const liso = (cor, r = 0.85) => new THREE.MeshStandardMaterial({ color: cor, roughness: r });
  const miolo = T.miolo.clone(); miolo.repeat.set(3, 3.6); miolo.needsUpdate = true;
  const matMiolo = new THREE.MeshStandardMaterial({ map: miolo, roughness: 0.9 });
  const matMioloParede = new THREE.MeshStandardMaterial({ map: (() => { const t = T.miolo.clone(); t.repeat.set(3.6, 0.8); t.needsUpdate = true; return t; })(), roughness: 0.9 });
  const creme = liso(0xfbf3e2), vermelho = liso(0xc4232c, 0.7);
  const papelao = liso(0xe9dcc4);

  function bloco(w, h, d, faces, padrao = papelao) {
    const ordem = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ordem.map((k) => faces[k] || padrao));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  const pecas = {};
  const clicaveis = [];
  function registrar(nome, obj) {
    uniforms(nome);
    obj.traverse((o) => { if (o.isMesh) { o.userData.peca = nome; clicaveis.push(o); } });
    pecas[nome] = { obj, nome };
  }

  // ---------- tray ----------
  const caixa = new THREE.Group();
  scene.add(caixa);
  const bandeja = new THREE.Group();
  caixa.add(bandeja);
  const ladoL = impresso(T.caixa_lado_longo), ladoC = impresso(T.caixa_lado_curto);
  const fundo = bloco(CX, E, CZ, { py: matMiolo });
  fundo.position.y = E / 2;
  const pFrente = bloco(CX, CY, E, { pz: ladoC, nz: matMioloParede, py: creme });
  pFrente.position.set(0, CY / 2, CZ / 2 - E / 2);
  const pFundo = bloco(CX, CY, E, { nz: ladoC, pz: matMioloParede, py: creme });
  pFundo.position.set(0, CY / 2, -CZ / 2 + E / 2);
  const pEsq = bloco(E, CY, CZ - 2 * E, { nx: ladoL, px: matMioloParede, py: creme });
  pEsq.position.set(-CX / 2 + E / 2, CY / 2, 0);
  const pDir = bloco(E, CY, CZ - 2 * E, { px: ladoL, nx: matMioloParede, py: creme });
  pDir.position.set(CX / 2 - E / 2, CY / 2, 0);
  bandeja.add(fundo, pFrente, pFundo, pEsq, pDir);
  registrar('caixa', bandeja);

  // ---------- lid ----------
  const tampa = new THREE.Group();
  const topo = bloco(TX, E, TZ, { py: impresso(T.tampa, T.tampa_rough, 'tampa'), ny: impresso(T.tampa_dentro) });
  topo.position.y = -E / 2;
  const sL = impresso(T.tampa_lado_longo), sC = impresso(T.tampa_lado_curto);
  const s1 = bloco(TX, TY, E, { pz: sC, nz: vermelho, ny: vermelho }); s1.position.set(0, -TY / 2, TZ / 2 - E / 2);
  const s2 = bloco(TX, TY, E, { nz: sC, pz: vermelho, ny: vermelho }); s2.position.set(0, -TY / 2, -TZ / 2 + E / 2);
  const s3 = bloco(E, TY, TZ - 2 * E, { nx: sL, px: vermelho, ny: vermelho }); s3.position.set(-TX / 2 + E / 2, -TY / 2, 0);
  const s4 = bloco(E, TY, TZ - 2 * E, { px: sL, nx: vermelho, ny: vermelho }); s4.position.set(TX / 2 - E / 2, -TY / 2, 0);
  tampa.add(topo, s1, s2, s3, s4);
  // hot stamp seal
  const seloM = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 6.6), materialOuro(THREE, mascara(THREE, selo, 1024, 1024), uniforms('tampa')));
  seloM.rotation.x = -Math.PI / 2;
  seloM.position.set(-7.6, 0.012, 8.6);
  tampa.add(seloM);
  caixa.add(tampa);
  registrar('tampa', tampa);
  const tampaFechada = { pos: new THREE.Vector3(0, CY + E, 0), rot: 0 };
  const tampaAberta = { pos: new THREE.Vector3(CX / 2 + TX / 2 + 4, TY, -3), rot: -0.22 };

  // ---------- contents ----------
  const paginas = Array.from({ length: 18 }, (_, i) => T[`p${i}`]);
  const livro = criarLivro(THREE, { paginas, capaDura: true });
  const { BW, ESPESSURA } = livro;
  livro.atualizar(0);
  livro.grupo.position.x = -BW / 2;
  const revista = new THREE.Group();
  revista.add(livro.grupo);
  revista.position.set(0.2, E, 0);
  caixa.add(revista);
  registrar('revista', revista);

  const marcador = new THREE.Group();
  const mMesh = bloco(5, 0.04, 20, { py: impresso(T.marcador, T.marcador_rough, 'marcador'), ny: creme }, creme);
  marcador.add(mMesh);
  const solM = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), materialOuro(THREE, mascara(THREE, (g, w, h) => sol(g, w / 2, h / 2, w * 0.2), 256, 256), uniforms('marcador')));
  solM.rotation.x = -Math.PI / 2;
  solM.position.set(0, 0.022, -10 + 0.935);
  marcador.add(solM);
  marcador.position.set(-1.5, E + ESPESSURA + 0.03, 11.2);
  marcador.rotation.y = Math.PI / 2 - 0.1;
  caixa.add(marcador);
  registrar('marcador', marcador);

  // fan: shape from the die line, gold ring round the sun, short wooden handle
  const forma = new THREE.Shape(fan.outline.map(([x, y]) => new THREE.Vector2(x - 12, 10.5 - y)));
  const espessura = 0.08;
  const lamina = new THREE.ExtrudeGeometry(forma, { depth: espessura, bevelEnabled: false, curveSegments: 1 });
  const faceG = new THREE.ShapeGeometry(forma, 1);
  for (const g of [lamina, faceG]) {
    const uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + 12) / 24, (p.getY(i) + 10.5) / 21);
  }
  const leque = new THREE.Group();
  const lequeIn = new THREE.Group();
  const corpo = new THREE.Mesh(lamina, [creme, papelao]);
  const face = new THREE.Mesh(faceG, impresso(T.leque, T.leque_rough, 'leque'));
  face.position.z = espessura + 0.004;
  const aro = new THREE.Mesh(new THREE.RingGeometry(3.86, 4.12, 128), materialOuro(THREE, mascara(THREE, (g, w, h) => g.fillRect(0, 0, w, h), 8, 8), uniforms('leque')));
  aro.position.set(0, 10.5 - 8.03, espessura + 0.012);
  const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 21.5, 20), new THREE.MeshStandardMaterial({ color: 0xc8935a, roughness: 0.5 }));
  cabo.position.set(0, -8.75, -0.45);
  for (const m of [corpo, face, aro, cabo]) { m.castShadow = true; m.receiveShadow = true; lequeIn.add(m); }
  lequeIn.rotation.x = -Math.PI / 2;
  leque.add(lequeIn);
  leque.position.set(0, E + ESPESSURA + 1.0, -4.4);
  caixa.add(leque);
  registrar('leque', leque);

  // ---------- tissue paper ----------
  const seda = T.seda.clone(); seda.repeat.set(1.2, 2.8); seda.needsUpdate = true;
  const matSeda = new THREE.MeshStandardMaterial({ map: seda, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.94 });
  function folhaSeda(lado) {
    const g = new THREE.PlaneGeometry(14.2, CZ - 1.2, 20, 30);
    g.rotateX(-Math.PI / 2);
    g.translate(7.1, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, Math.sin(z * 0.9 + lado) * 0.08 + Math.sin(x * 1.7 + z * 0.4) * 0.05 + Math.sin(z * 2.3) * 0.03 * (x / 14));
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, matSeda);
    m.castShadow = true; m.receiveShadow = true;
    const piv = new THREE.Group();
    piv.add(m);
    piv.position.set(lado * (CX / 2 - E), CY - 0.15 + (lado > 0 ? 0.06 : 0), 0);
    piv.scale.x = -lado;                   // both extend towards the middle
    caixa.add(piv);
    return piv;
  }
  const sedas = [folhaSeda(-1), folhaSeda(1)];

  // ---------- camera ----------
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.enablePan = false; controls.enableZoom = false;
  controls.rotateSpeed = 0.5; controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.2;
  if (toque) { controls.enableRotate = false; canvas.style.touchAction = 'pan-y'; }
  let w = 1, h = 1, painel = 0;
  function poseCaixa(aberta) {
    const largura = aberta ? 74 : 44, prof = aberta ? 46 : 40;
    const frac = (w - painel) / w;
    const precisa = Math.max(largura / (camera.aspect * frac), prof);
    const d = precisa / 2 / Math.tan((camera.fov * Math.PI) / 360) * (w > 720 ? 1 : 1.05);
    const dir = aberta ? new THREE.Vector3(0.12, 1, 0.62) : new THREE.Vector3(0.62, 0.72, 0.95);
    return { alvo: aberta ? new THREE.Vector3(9, 1, 1.5) : new THREE.Vector3(0, 3, 0), pos: dir.normalize().multiplyScalar(d) };
  }
  const de = { pos: new THREE.Vector3(), alvo: new THREE.Vector3() }, para = { pos: new THREE.Vector3(), alvo: new THREE.Vector3() };
  let tCam = 1;
  function irPose(p, imediato) {
    de.pos.copy(camera.position); de.alvo.copy(controls.target);
    para.pos.copy(p.pos).add(p.alvo); para.alvo.copy(p.alvo);
    tCam = imediato || reduzido ? 1 : 0;
    if (tCam === 1) { camera.position.copy(para.pos); controls.target.copy(para.alvo); }
  }
  let abrir = 0, aberta = 0;          // lid + tissue, 0..1 (0..0.6 lid, 0.6..1 tissue)
  c.aoAjustar.add((W, H) => {
    w = W; h = H;
    painel = W > 900 ? Math.min(440, W * 0.3) : 0;
    c.desvio.alvo = foco ? 0 : painel / 2;
    c.desvio.y = W > 720 ? 0 : foco ? -H * 0.12 : H * 0.18;
    irPose(poseCaixa(abrir > 0), true);
  });

  // ---------- open / close ----------
  function abrirCaixa(v = 1) {
    if (abrir === v) return;
    abrir = v;
    ui.caixa(!!v);
    irPose(poseCaixa(!!v));
  }
  ui.aoAbrirCaixa(() => { if (foco) devolver(); abrirCaixa(abrir ? 0 : 1); });

  // ---------- inspection ----------
  let foco = null, t = 0, giro = { x: 0, y: 0 }, arrasto = null, pecaAtual = null;
  const tamanho = { revista: 36, marcador: 23, leque: 33 };
  const casa = {};
  for (const k of ['revista', 'marcador', 'leque']) casa[k] = { pos: pecas[k].obj.position.clone(), quat: pecas[k].obj.quaternion.clone() };
  function poseFoco(nome) {
    const frac = Math.min(0.52, 0.3 * camera.aspect);
    const ajuste = tamanho[nome] / (2 * Math.tan((camera.fov * Math.PI) / 360) * frac);
    const d = Math.min(ajuste, camera.position.distanceTo(controls.target) * 0.62);
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    const alvoMundo = camera.position.clone().addScaledVector(fwd, d);
    const q = camera.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + giro.x, giro.y, 0, 'YXZ')));
    // to box space
    const inv = caixa.quaternion.clone().invert();
    return { pos: caixa.worldToLocal(alvoMundo), quat: inv.multiply(q) };
  }
  function focar(nome) {
    if (!INFO[nome]) return;
    if (foco === nome) return devolver();
    if (abrir === 0) abrirCaixa(1);
    if (foco) soltar(foco);
    foco = nome; t = 0; giro = { x: 0, y: 0 };
    const pc = pecas[nome];
    pc.de = { pos: pc.obj.position.clone(), quat: pc.obj.quaternion.clone() };
    pc.voltando = null;
    controls.enabled = false;
    c.desvio.alvo = 0;
    if (w <= 720) c.desvio.y = -h * 0.12;
    ui.detalhe(nome, INFO[nome]);
  }
  function soltar(nome) {
    const pc = pecas[nome];
    pc.voltando = { de: { pos: pc.obj.position.clone(), quat: pc.obj.quaternion.clone() }, t: 0 };
  }
  function devolver() {
    if (!foco) return;
    soltar(foco); foco = null;
    controls.enabled = true;
    c.desvio.alvo = painel / 2;
    if (w <= 720) c.desvio.y = h * 0.18;
    ui.detalhe(null);
  }
  ui.aoEscolher((nome) => (nome === 'caixa' ? abrirCaixa(abrir ? 0 : 1) : focar(nome)));
  ui.aoVoltar(devolver);

  // ---------- pointer ----------
  const ray = new THREE.Raycaster();
  const mesa = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const tmp = new THREE.Vector3();
  function acertar(e) {
    ray.setFromCamera(ndc(canvas, e), camera);
    for (const hit of ray.intersectObjects(clicaveis, false)) {
      const p = hit.object.userData.peca;
      if (p === 'tampa' || p === 'caixa') return abrir ? (p === 'tampa' ? 'tampa' : null) : 'caixa';
      if (!abrir) return 'caixa';
      if (aberta < 0.95) return null;
      return p;
    }
    return null;
  }
  cliques(canvas, (e) => {
    const nome = acertar(e);
    if (foco) { if (nome !== foco) devolver(); return; }
    if (nome === 'caixa') return abrirCaixa(1);
    if (nome === 'tampa') return abrirCaixa(0);
    if (nome) focar(nome);
  }, (e) => {
    ray.setFromCamera(ndc(canvas, e), camera);
    if (ray.ray.intersectPlane(mesa, tmp)) brilho.position.set(tmp.x, 24, tmp.z + 14);
    if (arrasto) {
      giro.y += (e.clientX - arrasto.x) * 0.008;
      giro.x = Math.max(-1.4, Math.min(1.4, giro.x + (e.clientY - arrasto.y) * 0.008));
      arrasto = { x: e.clientX, y: e.clientY };
      return;
    }
    const nome = acertar(e);
    pecaAtual = nome;
    ui.cursor(foco ? (nome === foco ? 'Girar' : 'Soltar') : nome === 'caixa' ? 'Abrir' : nome === 'tampa' ? 'Fechar' : nome ? 'Pegar' : '');
  });
  canvas.addEventListener('pointerdown', (e) => { if (foco && acertar(e) === foco) { arrasto = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointerup', () => { arrasto = null; });
  canvas.addEventListener('pointerleave', () => { ui.cursor(''); pecaAtual = null; });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && foco) devolver(); });

  // ---------- loop ----------
  const bez = (a, b, c2, k) => a * (1 - k) * (1 - k) + 2 * b * (1 - k) * k + c2 * k * k;
  c.tarefas.add((dt, s) => {
    // lid then tissue
    const v = reduzido ? 1 : dt / 1.9;
    aberta = abrir > aberta ? Math.min(abrir, aberta + v) : Math.max(abrir, aberta - v);
    const kT = suave(Math.min(1, aberta / 0.6));
    const P0 = tampaFechada.pos, P2 = tampaAberta.pos;
    tampa.position.set(bez(P0.x, P0.x + 6, P2.x, kT), bez(P0.y, P0.y + 20, P2.y, kT), bez(P0.z, P0.z - 4, P2.z, kT));
    tampa.rotation.set(Math.sin(kT * Math.PI) * 0.35, tampaAberta.rot * kT, -Math.sin(kT * Math.PI) * 0.25);
    const kS = suave(Math.max(0, (aberta - 0.55) / 0.45));
    sedas.forEach((sd, i) => {
      const fechado = -0.06, aberto = 2.55;
      sd.rotation.z = (i === 0 ? 1 : -1) * (fechado + (aberto - fechado) * kS);
    });
    // hover sheen / foil glint
    for (const [nome, u] of Object.entries(vernizes)) {
      const alvo = pecaAtual === nome || foco === nome || (nome === 'tampa' && pecaAtual === 'caixa');
      u.brilho.value += ((alvo ? 1 : 0) - u.brilho.value) * Math.min(1, dt * 6);
      u.t = reduzido ? 0.5 : (u.t + dt / (alvo ? 1.5 : 4.5)) % 1;
      u.faixa.value = -0.3 + u.t * 1.6;
    }
    // focused piece
    if (foco) {
      const pc = pecas[foco];
      t = Math.min(1, t + (reduzido ? 1 : dt / 0.85));
      if (!arrasto && t >= 1 && !reduzido) giro.y += dt * 0.12;
      const k = suave(t), alvo = poseFoco(foco);
      pc.obj.position.lerpVectors(pc.de.pos, alvo.pos, k);
      pc.obj.quaternion.slerpQuaternions(pc.de.quat, alvo.quat, k);
    }
    for (const [nome, pc] of Object.entries(pecas)) {
      if (!pc.voltando) continue;
      pc.voltando.t = Math.min(1, pc.voltando.t + (reduzido ? 1 : dt / 0.75));
      const k = suave(pc.voltando.t);
      pc.obj.position.lerpVectors(pc.voltando.de.pos, casa[nome].pos, k);
      pc.obj.quaternion.slerpQuaternions(pc.voltando.de.quat, casa[nome].quat, k);
      if (k >= 1) pc.voltando = null;
    }
    // camera
    if (tCam < 1) {
      tCam = Math.min(1, tCam + dt / 1.4);
      const k = suave(tCam);
      camera.position.lerpVectors(de.pos, para.pos, k);
      controls.target.lerpVectors(de.alvo, para.alvo, k);
      camera.lookAt(controls.target);
    } else if (!foco) controls.update();
  });
  c.ajustar();
  ui.pronto();
  return { focar, devolver, abrirCaixa };
}
