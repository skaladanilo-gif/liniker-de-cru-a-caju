// A magazine in 3D: paper leaves that turn with a real page curl (from the corner you click or
// drag), and optionally a hardcover with rigid boards and a cloth spine. Units: cm.
//
// Every turning piece is an "item": item k shows page 2k on its front and page 2k+1 on its back,
// so state e (0..ESTADOS) shows page 2e-1 on the left and page 2e on the right.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { suave } from './cena.js';

const OURO = '#E2B45A';
const SX = 40, SZ = 56;                       // leaf mesh resolution
const ESP = 0.034;                             // paper thickness in the stack

function lombadaTextura(THREE, titulo, subtitulo) {
  const w = 160, h = 2400;
  const cor = document.createElement('canvas'); cor.width = w; cor.height = h;
  const met = document.createElement('canvas'); met.width = w; met.height = h;
  const c = cor.getContext('2d'), m = met.getContext('2d');
  c.fillStyle = '#B8202A'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`;
    c.fillRect(Math.random() * w, Math.random() * h, 1, 2);
  }
  m.fillStyle = '#000'; m.fillRect(0, 0, w, h);
  const escrever = (ctx, fill) => {
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.rotate(Math.PI / 2);
    ctx.fillStyle = fill; ctx.strokeStyle = fill;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 62px "Funnel Display", sans-serif';
    ctx.fillText(titulo, -560, 4);
    ctx.font = '500 34px "Funnel Display", sans-serif';
    ctx.fillText(subtitulo, 330, 4);
    ctx.lineWidth = 3;
    for (const x of [-960, 820]) { ctx.beginPath(); ctx.moveTo(x, -34); ctx.lineTo(x, 34); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = fill;
    for (const y of [60, h - 60]) ctx.fillRect(18, y, w - 36, 4);
  };
  escrever(c, OURO); escrever(m, '#fff');
  const map = new THREE.CanvasTexture(cor); map.colorSpace = THREE.SRGBColorSpace;
  return { map, metal: new THREE.CanvasTexture(met) };
}

export function criarLivro(THREE, {
  paginas, largura = 21, altura = 29.7, capaDura = false,
  lombada = ['LINIKER', 'DE CRU A CAJU'], branco = null,
}) {
  const PW = largura, PH = altura;
  const BW = capaDura ? PW + 0.35 : PW, BH = capaDura ? PH + 0.6 : PH, BT = capaDura ? 0.26 : 0;
  const grupo = new THREE.Group();
  const P = paginas.slice();
  const nItens = Math.ceil(P.length / 2);
  const N = capaDura ? nItens - 2 : nItens;     // paper leaves
  const T = N * ESP;
  const ESTADOS = nItens;
  const ESPESSURA = 2 * BT + T;
  const papel = { roughness: 0.92, metalness: 0, envMapIntensity: 0.2 };

  const espelhar = (t) => {
    const c = t.clone();
    c.wrapS = THREE.RepeatWrapping; c.repeat.x = -1; c.offset.x = 1; c.needsUpdate = true;
    return c;
  };
  // page index -> materials showing it (to swap in sharper textures later)
  const usos = new Map();
  function material(i, lado, extra = {}) {
    const tex = P[i] || branco;
    const m = new THREE.MeshStandardMaterial({
      map: tex ? (lado === 'verso' ? espelhar(tex) : tex) : null, color: tex ? 0xffffff : 0xfbfaf6,
      side: lado === 'verso' ? THREE.BackSide : THREE.FrontSide, ...papel, ...extra,
    });
    if (P[i]) { if (!usos.has(i)) usos.set(i, []); usos.get(i).push({ m, verso: lado === 'verso' }); }
    return m;
  }

  // ---------- leaves ----------
  const folhas = [];
  const primeira = capaDura ? 1 : 0;
  for (let j = 0; j < N; j++) {
    const k = primeira + j;
    const geo = new THREE.PlaneGeometry(PW, PH, SX, SZ);
    geo.translate(PW / 2, 0, 0);
    geo.rotateX(-Math.PI / 2);
    const mF = new THREE.Mesh(geo, material(2 * k, 'frente'));
    const mV = new THREE.Mesh(geo, material(2 * k + 1, 'verso'));
    for (const m of [mF, mV]) { m.castShadow = true; m.receiveShadow = true; grupo.add(m); }
    const pos = geo.attributes.position;
    const x0 = new Float32Array(pos.count), z0 = new Float32Array(pos.count);
    for (let v = 0; v < pos.count; v++) { x0[v] = pos.getX(v); z0[v] = pos.getZ(v); }
    folhas.push({ tipo: 'folha', j, geo, x0, z0, u: 0, alvo: 0, canto: 0, sujo: true });
  }

  // ---------- boards ----------
  let frente = null, verso = null, lombadaMesh = null, lomGeo = null;
  const LS = 18;
  if (capaDura) {
    const borda = new THREE.MeshStandardMaterial({ color: 0xa61d26, roughness: 0.6 });
    const capa = { roughness: 0.62, envMapIntensity: 0.35 };
    function tabua(iCima, iBaixo, capaEmCima) {
      const piv = new THREE.Group();
      const bloco = new THREE.Mesh(new RoundedBoxGeometry(BW, BT, BH, 3, 0.07), borda);
      bloco.position.set(BW / 2, BT / 2, 0);
      bloco.castShadow = true; bloco.receiveShadow = true;
      piv.add(bloco);
      const geo = new THREE.PlaneGeometry(BW - 0.04, BH - 0.04);
      geo.translate(BW / 2, 0, 0);
      geo.rotateX(-Math.PI / 2);
      const cima = new THREE.Mesh(geo, material(iCima, 'frente', capaEmCima ? capa : {}));
      cima.position.y = BT + 0.004;
      const baixo = new THREE.Mesh(geo, material(iBaixo, 'verso', capaEmCima ? {} : capa));
      baixo.position.y = -0.004;
      cima.receiveShadow = baixo.receiveShadow = true;
      piv.add(cima, baixo);
      grupo.add(piv);
      return piv;
    }
    frente = { tipo: 'frente', piv: tabua(0, 1, true), u: 0, alvo: 0 };
    verso = { tipo: 'verso', piv: tabua(2 * (nItens - 1), 2 * (nItens - 1) + 1, false), u: 0, alvo: 0 };

    const ls = lombadaTextura(THREE, ...lombada);
    const matL = new THREE.MeshStandardMaterial({ map: ls.map, metalnessMap: ls.metal, metalness: 1, roughness: 0.45, side: THREE.DoubleSide, envMapIntensity: 2.2, emissiveMap: ls.metal, emissive: 0x5a3c0c, emissiveIntensity: 0.6 });
    matL.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.78, 0.24, texture2D(metalnessMap, vMetalnessMapUv).b);');
    };
    lomGeo = new THREE.BufferGeometry();
    lomGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((LS + 1) * 2 * 3), 3));
    const uvs = [], idx = [];
    for (let i = 0; i <= LS; i++) { uvs.push(i / LS, 0, i / LS, 1); if (i < LS) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    lomGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    lomGeo.setIndex(idx);
    lombadaMesh = new THREE.Mesh(lomGeo, matL);
    lombadaMesh.castShadow = true;
    grupo.add(lombadaMesh);
  }
  const itens = capaDura ? [frente, ...folhas, verso] : folhas;

  // ---------- page curl ----------
  // A leaf bends round a cylinder of radius r whose axis is the fold line {p : p·n = d}.
  // Points past the line wrap over the cylinder and lie mirrored on top: dragging a corner
  // to the pointer M makes the fold the perpendicular bisector of the corner C and M.
  function poseDe(u, canto) {
    const e = suave(u);
    const phi0 = canto * 0.55;
    const n0x = Math.cos(phi0), n0z = Math.sin(phi0);
    const d0 = PW * n0x + Math.abs(n0z) * PH / 2;
    const phi = phi0 * (1 - e);
    const d = Math.max(d0 * (1 - e), Math.abs(Math.sin(phi)) * PH / 2);
    const r = 2.4 * Math.pow(Math.sin(Math.PI * e), 0.7);
    return { nx: Math.cos(phi), nz: Math.sin(phi), d, r, f: e };
  }
  function poseArrasto(C, M) {
    let nx = C.x - M.x, nz = C.z - M.z;
    const L = Math.hypot(nx, nz);
    if (L < 1e-3) return { nx: 1, nz: 0, d: PW + 1, r: 0, f: 0 };
    nx /= L; nz /= L;
    let d = ((C.x + M.x) / 2) * nx + ((C.z + M.z) / 2) * nz;
    d = Math.max(d, Math.abs(nz) * PH / 2 + 0.05);     // the spine stays attached
    const f = Math.min(1, Math.max(0, (PW - M.x) / (2 * PW)));
    const r = 2.4 * Math.min(1, L / 5) * Math.min(1, (1 - f) * 3, f * 6 + 0.2);
    return { nx, nz, d, r, f };
  }
  const misturar = (a, b, k) => {
    const nx = a.nx + (b.nx - a.nx) * k, nz = a.nz + (b.nz - a.nz) * k, L = Math.hypot(nx, nz) || 1;
    return { nx: nx / L, nz: nz / L, d: a.d + (b.d - a.d) * k, r: a.r + (b.r - a.r) * k, f: a.f + (b.f - a.f) * k };
  };
  function dobrar(fl, pose) {
    const { nx, nz, d, r, f } = pose;
    const yR = BT + (N - 1 - fl.j + 0.5) * ESP, yL = BT + (fl.j + 0.5) * ESP;
    const base = yR + (yL - yR) * f + Math.sin(Math.PI * f) * 0.12;
    const pos = fl.geo.attributes.position;
    const PI = Math.PI;
    for (let v = 0; v < pos.count; v++) {
      const x = fl.x0[v], z = fl.z0[v];
      const s = x * nx + z * nz - d;
      let X = x, Y = 0, Z = z;
      if (s > 0) {
        const fx = x - s * nx, fz = z - s * nz;
        if (r > 1e-4 && s < PI * r) {
          const t = s / r;
          X = fx + nx * r * Math.sin(t); Z = fz + nz * r * Math.sin(t); Y = r * (1 - Math.cos(t));
        } else {
          const q = s - PI * r;
          X = fx - nx * q; Z = fz - nz * q; Y = 2 * r;
        }
      }
      pos.setXYZ(v, X, Y + base, Z);
    }
    pos.needsUpdate = true;
    fl.geo.computeVertexNormals();
    fl.geo.computeBoundingSphere();
  }

  function tabuas() {
    if (!capaDura) return;
    const pf = suave(frente.u), pv = suave(verso.u);
    frente.piv.position.set(0, BT + T + (BT - (BT + T)) * pf + Math.sin(Math.PI * pf) * 0.4, 0);
    frente.piv.rotation.z = pf * Math.PI;
    verso.piv.position.set(0, (2 * BT + T) * pv + Math.sin(Math.PI * pv) * 0.4, 0);
    verso.piv.rotation.z = pv * Math.PI;
    const A = new THREE.Vector2(0, verso.piv.position.y);
    const rz = frente.piv.rotation.z;
    const B = new THREE.Vector2(-Math.sin(rz) * BT, frente.piv.position.y + Math.cos(rz) * BT);
    const lado = pv > 0.5 ? 1 : -1;
    const dd = A.distanceTo(B);
    const C = new THREE.Vector2((A.x + B.x) / 2 + lado * dd * 0.42, (A.y + B.y) / 2);
    const pos = lomGeo.attributes.position;
    for (let i = 0; i <= LS; i++) {
      const t = i / LS, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c2 = t * t;
      const x = a * A.x + b * C.x + c2 * B.x, y = a * A.y + b * C.y + c2 * B.y;
      pos.setXYZ(2 * i, x, y, -BH / 2); pos.setXYZ(2 * i + 1, x, y, BH / 2);
    }
    pos.needsUpdate = true;
    lomGeo.computeVertexNormals(); lomGeo.computeBoundingSphere();
  }

  // ---------- state: one number decides the side of every piece ----------
  let estado = 0, arrasto = null;
  const limitar = (n) => Math.max(0, Math.min(ESTADOS, n));
  function aplicar(atraso = 0, canto = 0) {
    let k = 0;
    const ordem = itens.map((_, i) => i);
    if (itens.some((it, i) => it.alvo === 1 && i >= estado)) ordem.reverse();
    for (const i of ordem) {
      const it = itens[i];
      if (arrasto && it === arrasto.it) continue;
      const a = i < estado ? 1 : 0;
      if (it.alvo !== a) {
        it.alvo = a;
        it.espera = atraso * k++;
        if (it.tipo === 'folha' && !it.solto) it.canto = canto;
      }
    }
  }
  function virar(passo, canto = 0) {
    if (arrasto) return estado;
    estado = limitar(estado + Math.sign(passo));
    aplicar(0, canto);
    return estado;
  }
  function irPara(n) {
    if (arrasto) return;
    estado = limitar(n);
    aplicar(0.12, 0);
  }

  // drag: lado 1 lifts the right page, -1 the left one; z0 says where it was grabbed
  function pegar(lado, z0) {
    const i = lado > 0 ? estado : estado - 1;
    if (i < 0 || i >= ESTADOS) return false;
    const it = itens[i];
    const perto = Math.abs(z0) > PH / 2 - 7;
    arrasto = { it, lado, i, C: { x: PW, z: perto ? Math.sign(z0) * PH / 2 : Math.max(-PH / 2, Math.min(PH / 2, z0)) } };
    it.espera = 0; it.solto = null;
    return true;
  }
  function puxar(lx, lz) {
    if (!arrasto) return;
    const { it } = arrasto;
    if (it.tipo === 'folha') {
      it.pose = poseArrasto(arrasto.C, { x: Math.max(-PW, Math.min(PW, lx)), z: lz });
      it.sujo = true;
    } else {
      it.u = it.alvo = Math.min(1, Math.max(0, (BW - lx) / (2 * BW)));
    }
  }
  function soltar() {
    if (!arrasto) return;
    const { it, lado, i } = arrasto;
    arrasto = null;
    const f = it.tipo === 'folha' ? (it.pose?.f ?? (lado > 0 ? 0 : 1)) : it.u;
    if (lado > 0 && f > 0.3) estado = limitar(i + 1);
    if (lado < 0 && f < 0.7) estado = limitar(i);
    const alvo = i < estado ? 1 : 0;
    if (it.tipo === 'folha' && it.pose) {
      // finish from wherever the hand let go
      const fim = alvo ? poseDe(1, 0) : { nx: it.pose.nx, nz: it.pose.nz, d: PW * Math.abs(it.pose.nx) + Math.abs(it.pose.nz) * PH / 2 + 0.1, r: 0, f: 0 };
      it.solto = { de: it.pose, para: fim, k: 0 };
      it.pose = null;
    }
    it.alvo = alvo;
    aplicar(0, 0);
  }

  function atualizar(dt, duracao = 0.95) {
    for (const it of itens) {
      if (arrasto && it === arrasto.it) {
        if (it.tipo === 'folha' && it.sujo && it.pose) { dobrar(it, it.pose); it.sujo = false; }
        continue;
      }
      if (it.solto) {
        it.solto.k = Math.min(1, it.solto.k + dt / 0.55);
        dobrar(it, misturar(it.solto.de, it.solto.para, suave(it.solto.k)));
        if (it.solto.k >= 1) { it.solto = null; it.u = it.alvo; it.canto = 0; it.sujo = true; }
        continue;
      }
      if (it.espera > 0) { it.espera -= dt; continue; }
      if (it.u !== it.alvo) {
        const d = dt / duracao;
        it.u = it.alvo > it.u ? Math.min(it.alvo, it.u + d) : Math.max(it.alvo, it.u - d);
        it.sujo = true;
      }
      if (it.tipo === 'folha' && it.sujo) { dobrar(it, poseDe(it.u, it.canto)); it.sujo = false; }
    }
    tabuas();
    if (!capaDura) {
      const a = itens[0], z = itens[itens.length - 1];
      const fa = a.solto ? 0.5 : suave(a.u), fz = z.solto ? 0.5 : suave(z.u);
      return -PW / 2 * (1 - fa) + (PW / 2) * fz * (itens.length > 1 ? 1 : 0);
    }
    return -BW / 2 * (1 - suave(frente.u)) + (BW / 2) * suave(verso.u);
  }
  folhas.forEach((f) => dobrar(f, poseDe(0, 0)));
  tabuas();

  // swap a page for a sharper (or lighter) texture
  function trocarTextura(i, tex) {
    for (const { m, verso: v } of usos.get(i) || []) {
      const antiga = m.map;
      m.map = v ? espelhar(tex) : tex;
      m.needsUpdate = true;
      if (antiga && antiga !== P[i] && antiga.source !== tex.source) antiga.dispose();
    }
  }

  const rotulos = Array.from({ length: ESTADOS + 1 }, (_, e) =>
    e === 0 ? 'Capa' : e === ESTADOS ? 'Contracapa' : `Páginas ${2 * e} e ${2 * e + 1}`);

  return {
    grupo, virar, irPara, pegar, puxar, soltar, atualizar, trocarTextura,
    PW, PH, BW, BH, ESPESSURA, ESTADOS,
    get atual() { return estado; },
    get pecas() { return itens.map((it) => +it.u.toFixed(3)); },
    get arrastando() { return !!arrasto; },
    rotulo: () => rotulos[estado],
    rotulos,
    malhas: () => { const m = []; grupo.traverse((o) => o.isMesh && m.push(o)); return m; },
  };
}
