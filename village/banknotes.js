/**
 * Fictional exhibition currency. One texture, material, and geometry are shared
 * by every note so a village full of bears does not multiply GPU resources.
 */
export function createBanknoteKit(THREE) {
  const paper = document.createElement('canvas');
  paper.width = 1024;
  paper.height = 512;
  const c = paper.getContext('2d');
  const ink = '#8b1f29';
  const lightInk = '#bb5155';
  const serif = 'Georgia, "Times New Roman", serif';
  const chinese = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';

  function ellipse(x, y, rx, ry, color, width = 1) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }

  function type(text, x, y, font, color = ink, align = 'center') {
    c.fillStyle = color; c.font = font; c.textAlign = align;
    c.textBaseline = 'middle'; c.fillText(text, x, y);
  }

  function rosette(x, y, rx, ry, color, petals = 24) {
    c.save(); c.translate(x, y); c.strokeStyle = color; c.lineWidth = .85;
    for (let band = 0; band < 9; band += 1) {
      c.beginPath();
      for (let step = 0; step <= 720; step += 1) {
        const a = step * Math.PI / 360;
        const wave = .76 + band * .019 + .065 * Math.cos(a * petals + band * .36);
        const px = Math.cos(a) * rx * wave;
        const py = Math.sin(a) * ry * wave;
        if (step === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath(); c.stroke();
    }
    c.restore();
  }

  function bearSilhouette() {
    c.beginPath();
    c.moveTo(299, 190);
    c.bezierCurveTo(269, 137, 219, 152, 234, 212);
    c.bezierCurveTo(201, 251, 207, 318, 254, 348);
    c.bezierCurveTo(290, 372, 350, 371, 389, 344);
    c.bezierCurveTo(431, 313, 433, 253, 401, 211);
    c.bezierCurveTo(418, 153, 366, 138, 341, 188);
    c.bezierCurveTo(328, 184, 313, 185, 299, 190);
    c.closePath();
  }

  // Pink cotton-paper field: the pale middle preserves denomination contrast
  // when the note is viewed through the red sculpture's transparent shell.
  const wash = c.createLinearGradient(0, 0, 1024, 512);
  wash.addColorStop(0, '#f5d3ad');
  wash.addColorStop(.45, '#fff0ce');
  wash.addColorStop(1, '#e5b690');
  c.fillStyle = wash; c.fillRect(0, 0, 1024, 512);
  c.fillStyle = '#fbe4bc'; c.fillRect(17, 17, 990, 478);

  // Fine wavy engraving and paper fibres are drawn deterministically.
  c.save(); c.beginPath(); c.rect(30, 30, 964, 452); c.clip();
  c.strokeStyle = '#c5756d'; c.globalAlpha = .43; c.lineWidth = .7;
  for (let row = -10; row <= 52; row += 1) {
    c.beginPath();
    for (let x = 24; x <= 1000; x += 4) {
      const y = row * 12 + Math.sin(x * .022 + row * .25) * 15;
      if (x === 24) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }
  c.globalAlpha = .3;
  for (let x = 25; x <= 1020; x += 13) {
    c.beginPath(); c.moveTo(x, 25); c.lineTo(x - 115, 487); c.stroke();
  }
  c.globalAlpha = .12;
  for (let i = 0; i < 1200; i += 1) {
    const x = (i * 277.13) % 1024;
    const y = (i * 143.39) % 512;
    c.fillStyle = i % 3 ? '#8a2831' : '#fff9dd';
    c.fillRect(x, y, 1 + i % 3, .6);
  }
  c.restore();

  // Layered ornamental border is deliberately bold at small on-screen sizes.
  c.strokeStyle = ink; c.lineWidth = 5; c.strokeRect(21, 21, 982, 470);
  c.lineWidth = 2; c.strokeRect(31, 31, 962, 450);
  c.lineWidth = 1; c.strokeRect(42, 42, 940, 428);
  for (let inset = 0; inset < 3; inset += 1) {
    c.strokeStyle = inset === 1 ? '#db8a7d' : ink;
    c.lineWidth = 1;
    const top = 49 + inset * 5;
    const bottom = 463 - inset * 5;
    for (let x = 54; x < 970; x += 13) {
      c.beginPath();
      c.moveTo(x, top); c.lineTo(x + 6.5, top + 6); c.lineTo(x + 13, top);
      c.moveTo(x, bottom); c.lineTo(x + 6.5, bottom - 6); c.lineTo(x + 13, bottom);
      c.stroke();
    }
  }
  for (let y = 66; y < 448; y += 12) {
    ellipse(51, y, 6, 7, ink, .9);
    ellipse(973, y, 6, 7, ink, .9);
  }

  // Security strip with alternating pale windows and repeated microtype.
  c.fillStyle = '#9d3644'; c.fillRect(486, 76, 18, 357);
  c.fillStyle = '#f4b5a0';
  for (let y = 80; y < 430; y += 38) c.fillRect(488, y, 14, 20);
  c.save(); c.translate(496, 253); c.rotate(-Math.PI / 2);
  type('100  IMAGE BANK  100  IMAGE BANK  100', 0, 0, `8px ${serif}`, '#75202b');
  c.restore();

  // Portrait medallion, with contour and crosshatch engraving rather than a
  // flat icon. The bear is fictional and intentionally has no human likeness.
  rosette(320, 263, 161, 178, lightInk, 32);
  ellipse(320, 263, 134, 158, ink, 3);
  ellipse(320, 263, 128, 151, ink, .9);
  c.save(); c.beginPath(); c.ellipse(320, 263, 123, 146, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#eeb09a'; c.fillRect(190, 110, 260, 310);
  c.strokeStyle = '#b7605c'; c.lineWidth = 1;
  for (let y = 119; y < 410; y += 4) {
    c.beginPath(); c.moveTo(190, y); c.quadraticCurveTo(320, y - 20, 450, y); c.stroke();
  }
  bearSilhouette(); c.fillStyle = '#f7d1ae'; c.fill();
  c.save(); bearSilhouette(); c.clip();
  c.strokeStyle = ink; c.lineWidth = .8;
  for (let y = 157; y < 374; y += 4.4) {
    c.beginPath(); c.moveTo(209, y);
    c.bezierCurveTo(259, y - 14, 352, y + 25, 428, y - 9); c.stroke();
  }
  c.globalAlpha = .48;
  for (let x = 210; x < 433; x += 6) {
    c.beginPath(); c.moveTo(x, 163); c.lineTo(x - 63, 365); c.stroke();
  }
  c.restore();
  bearSilhouette(); c.strokeStyle = ink; c.lineWidth = 4; c.stroke();
  ellipse(259, 191, 12, 18, ink, 3);
  ellipse(377, 191, 12, 18, ink, 3);
  c.fillStyle = '#edb398'; c.beginPath(); c.ellipse(321, 302, 49, 39, 0, 0, Math.PI * 2); c.fill();
  ellipse(321, 302, 49, 39, ink, 1.6);
  c.lineWidth = 2; c.strokeStyle = ink;
  for (let i = 0; i < 8; i += 1) {
    c.beginPath(); c.ellipse(321, 307, 43 - i * 3, 29 - i * 2, 0, .06, Math.PI - .06); c.stroke();
  }
  c.fillStyle = ink;
  c.beginPath(); c.ellipse(278, 259, 8, 10, -.2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(365, 259, 8, 10, .2, 0, Math.PI * 2); c.fill();
  c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath(); c.moveTo(264, 238); c.lineTo(295, 248); c.moveTo(350, 248); c.lineTo(379, 237); c.stroke();
  c.beginPath(); c.moveTo(305, 286); c.quadraticCurveTo(320, 277, 337, 286); c.quadraticCurveTo(321, 305, 305, 286); c.fill();
  c.lineWidth = 2.8;
  c.beginPath(); c.moveTo(321, 294); c.lineTo(321, 310);
  c.moveTo(299, 315); c.quadraticCurveTo(321, 305, 343, 315); c.stroke();
  c.restore();

  // Denomination rosettes and oversized numerals are the primary visual cue.
  rosette(744, 280, 179, 134, '#b55055', 28);
  rosette(744, 280, 157, 112, '#c4756b', 22);
  c.save(); c.shadowColor = '#fce2c0'; c.shadowOffsetX = 3; c.shadowOffsetY = 3;
  type('100', 746, 277, `bold 143px ${serif}`);
  c.restore();
  type('壹 佰 圓', 745, 369, `bold 27px ${chinese}`);
  type('ONE HUNDRED', 745, 400, `bold 12px ${serif}`);

  // Clear bank title, serial numbers, four corner numerals and edition marks.
  c.fillStyle = '#f8d4bb'; c.fillRect(533, 74, 393, 80);
  type('形 象 銀 行', 730, 101, `bold 41px ${chinese}`);
  type('IMAGE BANK  ·  EXHIBITION SERIES', 730, 139, `bold 12px ${serif}`);
  for (const [x, y] of [[110, 95], [916, 95], [110, 416], [916, 416]]) {
    c.fillStyle = '#f4c4ab'; c.fillRect(x - 40, y - 25, 80, 50);
    type('100', x, y, `bold 44px ${serif}`);
  }
  type('RB 00100886', 325, 83, 'bold 17px monospace');
  type('RB 00100886', 321, 436, 'bold 16px monospace');
  type('FICTIONAL EXHIBITION NOTE · NOT LEGAL TENDER', 735, 436, `9px ${serif}`);
  type('虛構展覽紙幣', 319, 390, `bold 15px ${chinese}`);
  c.fillStyle = '#bb3540'; c.fillRect(541, 379, 43, 43);
  c.strokeStyle = '#f9d0b4'; c.lineWidth = 1; c.strokeRect(545, 383, 35, 35);
  type('形象', 562, 392, `bold 11px ${chinese}`, '#f9d0b4');
  type('之印', 562, 408, `bold 11px ${chinese}`, '#f9d0b4');

  const texture = new THREE.CanvasTexture(paper);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.name = 'Fictional Image Bank 100 — engraved red paper';
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: .91,
    metalness: 0,
    transparent: true,
    opacity: 1,
    // A small self-illumination keeps engraving legible inside the red shell.
    emissiveMap: texture,
    emissive: 0xffffff,
    emissiveIntensity: .30,
  });
  material.name = 'Shared engraved banknote paper';

  // A closed, thin, gently waved sheet: a single draw call, correctly oriented
  // artwork on both sides, and a pale paper edge instead of a chunky red box.
  const segments = 16;
  const vertices = [];
  const uvs = [];
  const indices = [];
  const bend = x => .027 * Math.sin((x / .68 + .5) * Math.PI * 1.45) - .013;
  for (let side = 0; side < 2; side += 1) {
    for (let row = 0; row < 2; row += 1) {
      for (let step = 0; step <= segments; step += 1) {
        const u = step / segments;
        const x = (u - .5) * .68;
        const y = (row - .5) * .31;
        vertices.push(x, y, bend(x) + (side === 0 ? .004 : -.004));
        uvs.push(side === 0 ? u : 1 - u, row);
      }
    }
    const offset = side * (segments + 1) * 2;
    for (let step = 0; step < segments; step += 1) {
      const a = offset + step;
      const b = a + 1;
      const d = a + segments + 1;
      const e = d + 1;
      if (side === 0) indices.push(a, b, d, b, e, d);
      else indices.push(a, d, b, b, d, e);
    }
  }
  function addEdge(x1, y1, x2, y2) {
    const base = vertices.length / 3;
    vertices.push(
      x1, y1, bend(x1) + .004,
      x1, y1, bend(x1) - .004,
      x2, y2, bend(x2) + .004,
      x2, y2, bend(x2) - .004,
    );
    // These UVs sample only the unprinted outer paper margin.
    uvs.push(.005, .4, .005, .6, .009, .4, .009, .6);
    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  for (let step = 0; step < segments; step += 1) {
    const a = (step / segments - .5) * .68;
    const b = ((step + 1) / segments - .5) * .68;
    addEdge(a, .155, b, .155);
    addEdge(b, -.155, a, -.155);
  }
  addEdge(-.34, -.155, -.34, .155);
  addEdge(.34, .155, .34, -.155);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.name = 'Curved double-sided paper 0.68 × 0.31 × 0.008';

  return {
    createNote() {
      const note = new THREE.Group();
      note.name = 'Fictional 100 Image Bank note';
      const sheet = new THREE.Mesh(geometry, material);
      sheet.name = 'Engraved paper';
      sheet.castShadow = false;
      sheet.receiveShadow = false;
      note.add(sheet);
      return note;
    },
    materials: [material],
    geometries: [geometry],
    textures: [texture],
  };
}
