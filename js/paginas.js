// Turning pages by hand: a click turns the page (folding from the corner when you click near one);
// a drag that starts on a page lifts it and the grabbed corner follows the pointer.
import { ndc } from './cena.js';

export function interagir({ c, livro, suporte, canvas, controls, ativo, toque, cursor, aoClicarLivro }) {
  const { THREE, camera } = c;
  const ray = new THREE.Raycaster();
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -livro.ESPESSURA / 2);
  const ponto = new THREE.Vector3();
  const malhas = livro.malhas();

  function local(e) {
    ray.setFromCamera(ndc(canvas, e), camera);
    if (!ray.ray.intersectPlane(plano, ponto)) return null;
    const p = suporte.worldToLocal(ponto.clone());
    return { lx: p.x - livro.grupo.position.x, lz: p.z };
  }
  function noLivro(e) {
    const l = local(e);
    if (!l || Math.abs(l.lz) > livro.BH / 2 + 0.6) return null;
    const a = livro.atual;
    if (l.lx > 0 && l.lx < livro.BW + 0.5 && a < livro.ESTADOS) return { lado: 1, ...l };
    if (l.lx < 0 && l.lx > -livro.BW - 0.5 && a > 0) return { lado: -1, ...l };
    return null;
  }
  const canto = (lz) => (Math.abs(lz) > livro.PH / 2 - 7 ? Math.sign(lz) : 0);
  function tocaLivro(e) {
    ray.setFromCamera(ndc(canvas, e), camera);
    return ray.intersectObjects(malhas, false).length > 0;
  }

  let ini = null;
  canvas.addEventListener('pointerdown', (e) => {
    const n = noLivro(e);
    ini = { x: e.clientX, y: e.clientY, n, id: e.pointerId };
    if (ativo() && n && controls) controls.enableRotate = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (ativo() && ini?.n && !livro.arrastando && Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > 6) {
      if (livro.pegar(ini.n.lado, ini.n.lz)) { try { canvas.setPointerCapture(ini.id); } catch {} }
    }
    if (ativo() && livro.arrastando) {
      const l = local(e);
      if (l) livro.puxar(l.lx, l.lz);
      return;
    }
    const n = noLivro(e);
    if (!ativo()) cursor(n || tocaLivro(e) ? 'Ler' : '');
    else cursor(n ? (n.lado > 0 ? 'Virar' : 'Voltar') : '');
  });
  function fim(e) {
    if (!ini) return;
    const clique = Math.hypot(e.clientX - ini.x, e.clientY - ini.y) < 6;
    if (livro.arrastando) livro.soltar();
    else if (clique) {
      if (!ativo() && (ini.n || tocaLivro(e))) aoClicarLivro?.();
      else if (ativo() && ini.n) livro.virar(ini.n.lado, canto(ini.n.lz));
    }
    if (ativo() && controls) controls.enableRotate = !toque;
    ini = null;
  }
  canvas.addEventListener('pointerup', fim);
  canvas.addEventListener('pointercancel', fim);
  canvas.addEventListener('pointerleave', () => cursor(''));
}

// Sharper textures for the spread in view (and the next turns), lighter ones elsewhere.
export function nitidez({ livro, baixa, carregarHD, total }) {
  const cache = new Map();          // page -> Promise<Texture>
  let ligado = false;
  function janela(e) {
    const s = new Set();
    for (let i = 2 * e - 3; i <= 2 * e + 2; i++) if (i >= 0 && i < total) s.add(i);
    return s;
  }
  function atualizar(e) {
    const alvo = ligado ? janela(e) : new Set();
    for (const [i, pr] of cache) {
      if (alvo.has(i)) continue;
      cache.delete(i);
      pr.then((t) => { if (t) livro.trocarTextura(i, baixa[i]); });
    }
    for (const i of alvo) {
      if (cache.has(i)) continue;
      const pr = carregarHD(i).then((t) => {
        if (cache.get(i) !== pr) { t?.dispose(); return null; }
        livro.trocarTextura(i, t);
        return t;
      }).catch(() => null);
      cache.set(i, pr);
    }
  }
  return {
    ligar(v, e) { ligado = v; atualizar(e); },
    atualizar,
  };
}
