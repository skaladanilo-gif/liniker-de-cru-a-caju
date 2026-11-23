// Gold hot stamp foil: flat decals with a metallic finish and a glint that sweeps on hover.
export const OURO = 0xe6bd62;

export function materialOuro(THREE, mascara, u) {
  const m = new THREE.MeshStandardMaterial({
    color: OURO, emissive: 0x6b4a12, emissiveIntensity: 0.55, metalness: 1, roughness: 0.3, alphaMap: mascara, transparent: true, alphaTest: 0.35,
    envMapIntensity: 3.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBrilho = u.brilho;
    sh.uniforms.uFaixa = u.faixa;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uBrilho;\nuniform float uFaixa;')
      .replace('#include <opaque_fragment>', `
        float dg = (vAlphaMapUv.x + (1.0 - vAlphaMapUv.y)) * 0.5;
        float fx = exp(-pow((dg - uFaixa) * 6.0, 2.0));
        outgoingLight += vec3(1.0, 0.86, 0.55) * fx * (0.25 + uBrilho * 1.4);
        #include <opaque_fragment>`);
  };
  return m;
}

// masks drawn on a canvas (white = foil)
export function mascara(THREE, desenhar, w = 512, h = 512) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  desenhar(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

export function sol(g, cx, cy, r, raios = 8, rot = Math.PI / 8) {
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < raios; i++) {
    const a = rot + (i * Math.PI * 2) / raios;
    const ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
    const r0 = r * 1.4, r1 = r * 2.2, w0 = r * 0.28, w1 = r * 0.5;
    g.beginPath();
    g.moveTo(cx + ux * r0 + px * w0 / 2, cy + uy * r0 + py * w0 / 2);
    g.lineTo(cx + ux * r1 + px * w1 / 2, cy + uy * r1 + py * w1 / 2);
    g.lineTo(cx + ux * r1 - px * w1 / 2, cy + uy * r1 - py * w1 / 2);
    g.lineTo(cx + ux * r0 - px * w0 / 2, cy + uy * r0 - py * w0 / 2);
    g.closePath(); g.fill();
  }
}

// seal for the box lid: ring, sun, "Nº 01" and the words around it
export function selo(g, w, h) {
  const cx = w / 2, cy = h / 2, R = w * 0.46;
  g.lineWidth = w * 0.034;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  g.lineWidth = w * 0.016;
  g.beginPath(); g.arc(cx, cy, R * 0.72, 0, Math.PI * 2); g.stroke();
  sol(g, cx, cy - h * 0.1, w * 0.075);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 ${w * 0.15}px "Funnel Display", sans-serif`;
  g.fillText('Nº 01', cx, cy + h * 0.13);
  // text around the ring
  const frase = 'PRESSKIT  •  DE CRU A CAJU  •  2026  •  ';
  g.font = `700 ${w * 0.062}px "Funnel Display", sans-serif`;
  const rr = R * 0.86, passo = (Math.PI * 2) / frase.length;
  for (let i = 0; i < frase.length; i++) {
    const a = -Math.PI / 2 + i * passo;
    g.save();
    g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    g.rotate(a + Math.PI / 2);
    g.fillText(frase[i], 0, 0);
    g.restore();
  }
}
