// Hardcover edition of the magazine: rigid boards, rounded spine with gold foil, endpapers,
// and 9 paper leaves that bend while they turn. Units: cm.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { suave } from './cena.js';

export const PW = 21, PH = 29.7;                 // page (A4)
export const BW = 21.35, BH = 30.3, BT = 0.26;   // boards: overhang on the fore edge, head and foot
const N = 7, ESP = 0.034, SEG = 44;
export const T = N * ESP;                        // text block
export const ESPESSURA = 2 * BT + T;
export const ESTADOS = N + 2;                    // front board, 7 leaves, back board

export const ROTULOS = ['Capa', ...Array.from({ length: 8 }, (_, i) => `Páginas ${2 * i + 2} e ${2 * i + 3}`), 'Contracapa'];

const OURO = '#E2B45A';

function lombadaTextura(THREE) {
  // red cloth with the title in gold foil; u runs across the spine, v along its height
  const w = 160, h = 2400;
  const cor = document.createElement('canvas'); cor.width = w; cor.height = h;
  const met = document.createElement('canvas'); met.width = w; met.height = h;
  const c = cor.getContext('2d'), m = met.getContext('2d');
  c.fillStyle = '#B8202A'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { // cloth grain
    c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`;
    c.fillRect(Math.random() * w, Math.random() * h, 1, 2);
  }
  m.fillStyle = '#000'; m.fillRect(0, 0, w, h);
  const escrever = (ctx, fill) => {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = fill; ctx.strokeStyle = fill;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 62px "Funnel Display", sans-serif';
    ctx.fillText('LINIKER', -560, 4);
    ctx.font = '500 34px "Funnel Display", sans-serif';
    ctx.fillText('DE CRU A CAJU', 330, 4);
    ctx.lineWidth = 3;
    for (const x of [-960, 820]) { ctx.beginPath(); ctx.moveTo(x, -34); ctx.lineTo(x, 34); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = fill;
    for (const y of [60, h - 60]) ctx.fillRect(18, y, w - 36, 4);
  };
  escrever(c, OURO);
  escrever(m, '#fff');
  const map = new THREE.CanvasTexture(cor); map.colorSpace = THREE.SRGBColorSpace;
  const metal = new THREE.CanvasTexture(met);
  return { map, metal };
}

export function criarLivro(THREE, tex, { anisotropia = 8 } = {}) {
  const grupo = new THREE.Group();
  const P = tex.paginas;                           // 18 page textures
  const papel = { roughness: 0.66, metalness: 0, envMapIntensity: 0.6 };

  const espelhar = (t) => {
    const c = t.clone();
    c.wrapS = THREE.RepeatWrapping; c.repeat.x = -1; c.offset.x = 1; c.needsUpdate = true;
    return c;
  };

  // ---------- leaves: p3/p4 ... p15/p16. p2 is printed inside the front board, p17 inside the back board ----------
  const pares = [];
  for (let p = 2; p < 16; p += 2) pares.push([P[p], P[p + 1]]);
  function faces(geo, frente, verso, alvo, sombra = true) {
    const mF = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: frente, side: THREE.FrontSide, ...papel }));
    const mV = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: espelhar(verso), side: THREE.BackSide, ...papel }));
    for (const m of [mF, mV]) { m.castShadow = sombra; m.receiveShadow = true; alvo.add(m); }
    return [mF, mV];
  }
  const folhas = pares.map(([f, v], j) => {
    const geo = new THREE.PlaneGeometry(PW, PH, SEG, 1);
    geo.translate(PW / 2, 0, 0);
    geo.rotateX(-Math.PI / 2);
    faces(geo, f, v, grupo);
    const s = Float32Array.from({ length: geo.attributes.position.count }, (_, k) => geo.attributes.position.getX(k));
    return { tipo: 'folha', j, geo, s, u: 0, alvo: 0, sentido: 1, sujo: true };
  });

  // ---------- boards ----------
  // thickness from a rounded block; the printed pages sit on both faces as planes,
  // with the same orientation rules as the leaves (front faces up at rest, back is mirrored)
  const borda = new THREE.MeshStandardMaterial({ color: 0xa61d26, roughness: 0.55 });
  const laminado = { roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.5, envMapIntensity: 0.8 };
  function tabua(texCima, texBaixo, capaEmCima) {
    const piv = new THREE.Group();
    const bloco = new THREE.Mesh(new RoundedBoxGeometry(BW, BT, BH, 3, 0.07), borda);
    bloco.position.set(BW / 2, BT / 2, 0);
    bloco.castShadow = true; bloco.receiveShadow = true;
    piv.add(bloco);
    const geo = new THREE.PlaneGeometry(BW - 0.04, BH - 0.04);
    geo.translate(BW / 2, 0, 0);
    geo.rotateX(-Math.PI / 2);
    const cima = new THREE.Mesh(geo, capaEmCima
      ? new THREE.MeshPhysicalMaterial({ map: texCima, side: THREE.FrontSide, ...laminado })
      : new THREE.MeshStandardMaterial({ map: texCima, side: THREE.FrontSide, ...papel }));
    cima.position.y = BT + 0.004;
    const baixo = new THREE.Mesh(geo, capaEmCima
      ? new THREE.MeshStandardMaterial({ map: espelhar(texBaixo), side: THREE.BackSide, ...papel })
      : new THREE.MeshPhysicalMaterial({ map: espelhar(texBaixo), side: THREE.BackSide, ...laminado }));
    baixo.position.y = -0.004;
    cima.receiveShadow = baixo.receiveShadow = true;
    piv.add(cima, baixo);
    grupo.add(piv);
    return piv;
  }
  const frente = { tipo: 'frente', piv: tabua(P[0], P[1], true), u: 0, alvo: 0, sentido: 1 };    // cover outside, page 2 inside
  const verso = { tipo: 'verso', piv: tabua(P[16], P[17], false), u: 0, alvo: 0, sentido: 1 };   // page 17 inside, back cover outside

  // ---------- spine ----------
  const ls = lombadaTextura(THREE);
  const matLombada = new THREE.MeshStandardMaterial({ map: ls.map, metalnessMap: ls.metal, metalness: 1, roughness: 0.45, side: THREE.DoubleSide, envMapIntensity: 2.2, emissiveMap: ls.metal, emissive: 0x5a3c0c, emissiveIntensity: 0.6 });
  matLombada.onBeforeCompile = (sh) => {     // cloth stays matte, foil gets polished
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.78, 0.24, texture2D(metalnessMap, vMetalnessMapUv).b);');
  };
  const LS = 18;
  const lomGeo = new THREE.BufferGeometry();
  lomGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((LS + 1) * 2 * 3), 3));
  const uvs = [], idx = [];
  for (let i = 0; i <= LS; i++) { uvs.push(i / LS, 0, i / LS, 1); if (i < LS) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  lomGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  lomGeo.setIndex(idx);
  const lombada = new THREE.Mesh(lomGeo, matLombada);
  lombada.castShadow = true;
  grupo.add(lombada);

  const itens = [frente, ...folhas, verso];
  let atual = 0;

  // ---------- deformation ----------
  const pts = new Float32Array((SEG + 1) * 2);
  function folha(f) {
    const p = suave(f.u);
    const teta = p * Math.PI;
    const curva = 0.95 * Math.sin(Math.PI * p) * f.sentido;
    const yR = BT + (N - 1 - f.j + 0.5) * ESP, yL = BT + (f.j + 0.5) * ESP;
    const base = yR + (yL - yR) * p + Math.sin(Math.PI * p) * 0.3;
    const ds = PW / SEG;
    let x = 0, y = 0;
    for (let k = 1; k <= SEG; k++) {
      const phi = teta - curva * Math.pow((k - 0.5) / SEG, 1.7);
      x += Math.cos(phi) * ds; y += Math.sin(phi) * ds;
      pts[2 * k] = x; pts[2 * k + 1] = y;
    }
    pts[0] = 0; pts[1] = 0;
    const pos = f.geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const k = Math.round(f.s[v] / ds);
      pos.setX(v, pts[2 * k]);
      pos.setY(v, pts[2 * k + 1] + base);
    }
    pos.needsUpdate = true;
    f.geo.computeVertexNormals();
    f.geo.computeBoundingSphere();
  }
  function tabuas() {
    const pf = suave(frente.u), pv = suave(verso.u);
    frente.piv.position.set(0, BT + T + (BT - (BT + T)) * pf + Math.sin(Math.PI * pf) * 0.4, 0);
    frente.piv.rotation.z = pf * Math.PI;
    verso.piv.position.set(0, (2 * BT + T) * pv + Math.sin(Math.PI * pv) * 0.4, 0);
    verso.piv.rotation.z = pv * Math.PI;
    // spine: from the back board's outer hinge corner round to the front board's outer corner
    const A = new THREE.Vector2(0, verso.piv.position.y);
    const rz = frente.piv.rotation.z;
    const B = new THREE.Vector2(-Math.sin(rz) * BT, frente.piv.position.y + Math.cos(rz) * BT);
    const lado = pv > 0.5 ? 1 : -1;
    const d = A.distanceTo(B);
    const C = new THREE.Vector2((A.x + B.x) / 2 + lado * d * 0.42, (A.y + B.y) / 2);
    const pos = lomGeo.attributes.position;
    for (let i = 0; i <= LS; i++) {
      const t = i / LS, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c2 = t * t;
      const x = a * A.x + b * C.x + c2 * B.x, y = a * A.y + b * C.y + c2 * B.y;
      pos.setXYZ(2 * i, x, y, -BH / 2);
      pos.setXYZ(2 * i + 1, x, y, BH / 2);
    }
    pos.needsUpdate = true;
    lomGeo.computeVertexNormals();
    lomGeo.computeBoundingSphere();
  }

  function virar(passo) {
    if (passo > 0 && atual < ESTADOS) { const it = itens[atual]; it.alvo = 1; it.sentido = 1; atual++; }
    else if (passo < 0 && atual > 0) { atual--; const it = itens[atual]; it.alvo = 0; it.sentido = -1; }
    return atual;
  }
  let fila = [];
  function irPara(n) {
    fila = [];
    const dirc = Math.sign(n - atual);
    for (let k = atual; k !== n; k += dirc) fila.push(dirc);
  }
  let espera = 0;

  // dragging a page by hand
  let arrasto = null;
  function pegar(lado) {
    const i = lado > 0 ? atual : atual - 1;
    if (i < 0 || i >= ESTADOS) return false;
    arrasto = { it: itens[i], lado };
    arrasto.it.sentido = lado;
    return true;
  }
  function puxar(lx) {   // lx: pointer x relative to the spine, in cm
    if (!arrasto) return;
    arrasto.it.u = Math.min(1, Math.max(0, (BW - lx) / (2 * BW)));
    arrasto.it.alvo = arrasto.it.u;
    arrasto.it.sujo = true;
  }
  function soltar() {
    if (!arrasto) return;
    const { it, lado } = arrasto;
    if (lado > 0) { if (it.u > 0.3) { it.alvo = 1; atual++; } else it.alvo = 0; }
    else { if (it.u < 0.7) { it.alvo = 0; atual--; } else it.alvo = 1; }
    arrasto = null;
  }

  function atualizar(dt, duracao = 0.9) {
    if (fila.length) {
      espera -= dt;
      if (espera <= 0) { virar(fila.shift()); espera = 0.14; }
    }
    for (const it of itens) {
      if (arrasto && it === arrasto.it) { if (it.tipo === 'folha') folha(it); continue; }
      if (it.u !== it.alvo) {
        const d = dt / duracao;
        it.u = it.alvo > it.u ? Math.min(it.alvo, it.u + d) : Math.max(it.alvo, it.u - d);
        it.sujo = true;
      }
      if (it.tipo === 'folha' && it.sujo) { folha(it); it.sujo = false; }
    }
    tabuas();
    // keep what is visible centred: closed shows the right half, the back cover the left
    return -BW / 2 * (1 - suave(frente.u)) + (BW / 2) * suave(verso.u);
  }
  folhas.forEach(folha);
  tabuas();

  return {
    grupo, virar, irPara, pegar, puxar, soltar, atualizar,
    get atual() { return atual; },
    get arrastando() { return !!arrasto; },
    rotulo: () => ROTULOS[atual],
    malhas: () => { const m = []; grupo.traverse((o) => o.isMesh && m.push(o)); return m; },
  };
}
