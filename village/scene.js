import * as THREE from './vendor/three.module.js';
import { createBanknoteKit } from './banknotes.js';
import { createIslandInteractions } from './island-interactions.js';

/** A small, self-contained WebGL exhibition. All sculptures are fictional satire. */
export function createVillage(container, { onSelect = () => {}, onReady = () => {}, onHeroClick = () => {}, onDistrictChange = () => {}, district = {}, enterFromSky = false, zones = [] } = {}) {
  const defaultZones = [
    { id: 'legislature-hypocrite-152732', name: '真小人島', region: 'rhetoric' },
    { id: 'assistant-law-blind-167396', name: '法盲鼓掌島', region: 'rhetoric' },
    { id: 'official-2024-fifth-column-false-issue-153786', name: '第五縱隊島', region: 'security' },
    { id: 'cross-strait-tourism-risk-168490', name: '觀光風險島', region: 'security' },
    { id: 'read-first-166377', name: '先識字島', region: 'parliament' },
    { id: 'presidential-impeachment-floor-167204', name: '不要台灣好島', region: 'parliament' },
    { id: 'temu-defense-bill-167234', name: '拼多多軍購島', region: 'defense' },
    { id: 'military-bill-election-motive-167795', name: '為了選舉島', region: 'defense' },
    { id: 'adult-preferences-political-inference-20240628', name: '看片讀心島', region: 'media' },
    { id: 'ai-corridor-retort-20261013', name: '廊什麼帶島', region: 'media' },
    { id: 'cannabis-legalisation-facebook-20140820', name: '合法化轉彎島', region: 'accountability' },
    { id: 'community-drug-support-2014', name: '提供吸毒者毒品島', region: 'accountability' },
  ];
  const topics = (zones.length ? zones : defaultZones).map((zone,index) => {
    const original = defaultZones.find(item => item.id === zone.id);
    return { ...zone, title: zone.name || zone.title || original?.name || `第${index+1}島`, region: zone.region || original?.region || ['rhetoric','security','parliament','defense','media','accountability'][index%6], number: String(zone.globalNumber ?? index+1).padStart(2,'0') };
  });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 720px)').matches;
  const buttons = [];
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  } catch (_) {
    return fallback();
  }
  const canvas = renderer.domElement;
  canvas.className = 'village-canvas';
  canvas.setAttribute('aria-label', `可拖曳旋轉的假面紅熊村 3D 諷刺展場，共 ${topics.length} 座發言島。也可使用各主題按鈕閱讀。`);
  canvas.setAttribute('role', 'img');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
  container.appendChild(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setClearColor(0x111512, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, .1, 120);
  const raycaster = new THREE.Raycaster();
  const cursor = new THREE.Vector2();
  const clock = new THREE.Clock();
  const root = new THREE.Group();
  scene.add(root);
  const pickables = [];
  const islands = [];
  const bears = [];
  const motionObjects = [];
  const connections = new THREE.Group();
  connections.visible = false;
  root.add(connections);
  const materials = new Set();
  const geometries = new Set();
  const textures = new Set();
  const noteKit=createBanknoteKit(THREE);
  noteKit.materials.forEach(m=>materials.add(m));noteKit.geometries.forEach(g=>geometries.add(g));noteKit.textures.forEach(t=>textures.add(t));

  const colors = { red: 0xc83a27, hot: 0xf25c38, dark: 0x161d1b, floor: 0x626c5b, edge: 0x9b9b7f, cream: 0xdcd7bd, ink: 0x1c211e, gold: 0xa99763 };
  const mat = (color, options = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .08, ...options }); materials.add(m); return m; };
  const standard = {
    red: mat(colors.red), hot: mat(colors.hot, { roughness: .55 }), ink: mat(colors.ink),
    edge: mat(colors.edge, { metalness: .26 }), cream: mat(colors.cream),
    floor: mat(colors.floor), dark: mat(colors.dark), gold: mat(colors.gold, { metalness: .45 }),
    paper: mat(0xc8c3a6), black: mat(0x080e0d), pole: mat(0x58635a, { metalness: .65, roughness: .48 }),
    screen: mat(0x0e1714, { roughness: .35 }), glass: mat(0x426359, { roughness: .35, metalness: .15 }),
  };
  const geo = g => { geometries.add(g); return g; };
  const boxGeo = geo(new THREE.BoxGeometry(1, 1, 1));
  const sphereGeo = geo(new THREE.SphereGeometry(1, 14, 10));
  const cylinderGeo = geo(new THREE.CylinderGeometry(1, 1, 1, 12));
  const hexGeo = geo(new THREE.CylinderGeometry(1, 1, 1, 6));
  const lowSphereGeo = geo(new THREE.IcosahedronGeometry(1, 1));

  function mesh(g, material, parent, x = 0, y = 0, z = 0, scale) {
    const m = new THREE.Mesh(g, material);
    m.position.set(x, y, z);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(parent, material, x, y, z, sx, sy, sz) { return mesh(boxGeo, material, parent, x, y, z, [sx, sy, sz]); }
  function sphere(parent, material, x, y, z, sx, sy = sx, sz = sx) { return mesh(sphereGeo, material, parent, x, y, z, [sx, sy, sz]); }
  function cyl(parent, material, x, y, z, radius, height, sides = 12) { return mesh(sides === 6 ? hexGeo : cylinderGeo, material, parent, x, y, z, [radius, height, radius]); }
  function tube(parent, points, radius, material, tubular = 12) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(geo(new THREE.TubeGeometry(curve, tubular, radius, 5, false)), material, parent);
  }
  function ring(parent, radius, tubeRadius, material, y = 0, segments = 60) {
    const m = mesh(geo(new THREE.TorusGeometry(radius, tubeRadius, 5, segments)), material, parent, 0, y, 0);
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  function line(parent, points, color, opacity = 1) {
    const geometry = geo(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))));
    const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }); materials.add(material);
    const result = new THREE.Line(geometry, material); parent.add(result); return result;
  }
  function canvasMaterial(width, height, draw) {
    const surface = document.createElement('canvas'); surface.width = width; surface.height = height;
    const context = surface.getContext('2d'); draw(context, width, height);
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .9, side: THREE.DoubleSide }); materials.add(material);
    return material;
  }
  function plaque(parent, text, subtitle, x, y, z, width = 1.35, height = .56, dark = true) {
    const material = canvasMaterial(512, 192, (c, w, h) => {
      c.fillStyle = dark ? '#1c2520' : '#d4cfb8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#d54b32'; c.fillRect(0, 0, 14, h);
      c.fillStyle = dark ? '#ddd7bd' : '#263027'; c.font = 'bold 49px sans-serif'; c.fillText(text, 37, 83);
      c.fillStyle = dark ? '#a6af9a' : '#57614f'; c.font = '22px monospace'; c.fillText(subtitle, 39, 137);
    });
    return box(parent, material, x, y, z, width, height, .045);
  }

  // Warm museum lighting, with a large, soft key and a discreet red rim.
  const ambient=new THREE.HemisphereLight(0xe5e6cb, 0x263f35, 2.25);scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffedcc, 4.8);
  key.position.set(-9, 18, 10); key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  key.shadow.camera.left = -15; key.shadow.camera.right = 15;
  key.shadow.camera.top = 15; key.shadow.camera.bottom = -15;
  key.shadow.camera.near = 1; key.shadow.camera.far = 45;
  key.shadow.normalBias = .035; key.shadow.bias = -.0002; key.shadow.radius = 3;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdc5032, 1.35); rim.position.set(6, 5, -12); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9cc5b1, 1.25); fill.position.set(8, 8, 5); scene.add(fill);

  const ground = mesh(geo(new THREE.CircleGeometry(16, 100)), mat(0x202b24, { roughness: 1 }), root, 0, -1.4, 0);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  const grid = new THREE.GridHelper(30, 40, 0x4b5744, 0x35412f); grid.position.y = -1.385;
  grid.material.transparent = true; grid.material.opacity = .25; materials.add(grid.material); geometries.add(grid.geometry); root.add(grid);
  ring(root, 11.1, .018, mat(0x63705d, { transparent: true, opacity: .45 }), -1.36, 100);
  ring(root, 11.4, .012, mat(0x63705d, { transparent: true, opacity: .2 }), -1.36, 100);
  for (let i = 0; i < 60; i++) {
    const a = i * Math.PI / 30;
    const r = 11.1;
    line(root, [[Math.cos(a)*r, -1.35, Math.sin(a)*r], [Math.cos(a)*(r + (i % 5 ? .1 : .24)), -1.35, Math.sin(a)*(r + (i % 5 ? .1 : .24))]], 0x788169, i % 5 ? .4 : .7);
  }

  function makePlatform(parent, radius, hero = false) {
    const lower = cyl(parent, standard.dark, 0, -.35, 0, radius * .94, .65, 6);
    lower.rotation.y = Math.PI / 6;
    const bevel = mesh(geo(new THREE.CylinderGeometry(radius, radius*.94, .18, 6)), standard.edge, parent, 0, .02, 0); bevel.rotation.y = Math.PI/6;
    const top = cyl(parent, standard.floor, 0, .14, 0, radius, .12, 6); top.rotation.y = Math.PI / 6;
    const rim = new THREE.LineSegments(geo(new THREE.EdgesGeometry(top.geometry)), new THREE.LineBasicMaterial({ color: 0xa9ab8e, transparent: true, opacity: .75 }));
    materials.add(rim.material); rim.scale.copy(top.scale); rim.position.copy(top.position); rim.rotation.copy(top.rotation); parent.add(rim);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const block = box(parent, i % 2 === 0 ? standard.red : standard.dark, Math.sin(a)*radius*.78, -.31, Math.cos(a)*radius*.78, .2, .51, .16); block.rotation.y = a;
      const bolt = cyl(parent, standard.gold, Math.sin(a)*radius*.81, .215, Math.cos(a)*radius*.81, .04, .025);
      bolt.castShadow = false;
    }
    const underside = cyl(parent, standard.black, 0, -.73, 0, radius*.55, .16, 6); underside.rotation.y = Math.PI/6;
    if (hero) ring(parent, radius*.82, .025, standard.red, .23, 70);
    return top;
  }

  function makeBear(parent, scale = 1, variation = 0) {
    const g = new THREE.Group(); parent.add(g); g.scale.setScalar(scale);
    const shell = mat(0xe9c8b9, { transparent: true, opacity: .22, roughness: .27, metalness: .08, depthWrite: false });
    const limbShell = mat(0xc78d7c, { transparent: true, opacity: .62, roughness: .48, depthWrite: false });
    const innerMat = mat(0xa9231b, { roughness: .5, transparent: true });
    const bloodMat = mat(0xff2318, { emissive:0xd51108, emissiveIntensity:.65, metalness: .02, roughness: .24, transparent: true, opacity:.9, depthWrite:false });
    const faceMat = mat(0x1a201c, { roughness: 1 });
    const coldInk = mat(0x241511, { roughness:1, transparent:true, depthWrite:false });
    const eyeWhite = mat(0xffdfb0, { roughness:.8, transparent:true, depthWrite:false });
    const warmInk = mat(0x673e26, { roughness:1, transparent:true, opacity:0, depthWrite:false });
    const blushMat = mat(0xee966e, { roughness:1, transparent:true, opacity:0, depthWrite:false });
    const internals = new THREE.Group(); g.add(internals);
    // Fictional printed banknotes float above a red liquid reservoir.
    const pool = sphere(internals, bloodMat, 0, 1.12, -.10, .63, .56, .32);
    pool.rotation.z = -.08;
    const notes=[];
    for (let j = 0; j < 3; j++) {
      const note=noteKit.createNote();internals.add(note);
      note.position.set(j===1?-.035:.025,1.12+j*.32-(j===2?.02:0),.265);note.scale.setScalar([1.12,1.23,1.08][j]);
      note.rotation.set(-.045,(j-1)*.10,(j-1)*.065);
      notes.push({object:note,y:note.position.y,angle:note.rotation.z});
    }
    const heart = mesh(lowSphereGeo, innerMat, internals, -.03, 1.98, .08, [.22, .26, .19]); heart.rotation.z = .35;
    const veins = tube(internals, [[0,2,0],[-.18,1.71,.18],[.25,1.52,.16],[.08,1.1,.2]], .035, bloodMat);
    sphere(g, shell, 0, 1.37, 0, .77, .89, .53);
    // A raised chin and smaller ears make the transparent persona deliberately
    // aloof. All face geometry shares this pivot, including the spectacles.
    const head=new THREE.Group();g.add(head);head.position.y=2.36;head.rotation.set(-.18,0,-.055);
    const headShape=new THREE.Group();head.add(headShape);headShape.position.y=-2.36;
    sphere(headShape, shell, 0, 2.48, 0, .73, .68, .54);
    sphere(headShape, limbShell, -.55, 3.02, -.02, .22, .23, .18);
    sphere(headShape, limbShell, .55, 3.02, -.02, .22, .23, .18);
    sphere(headShape, standard.red, -.56, 3.03, .14, .105, .115, .03);
    sphere(headShape, standard.red, .56, 3.03, .14, .105, .115, .03);
    const leftArm=new THREE.Group();g.add(leftArm);leftArm.position.set(-.76,1.95,0);leftArm.rotation.z=-.25;
    sphere(leftArm,limbShell,0,-.47,0,.22,.63,.22);
    const rightArm=new THREE.Group();g.add(rightArm);rightArm.position.set(.76,1.95,.03);rightArm.rotation.z=.34;
    sphere(rightArm,limbShell,0,-.39,0,.22,.62,.22);
    const leftLeg=new THREE.Group();g.add(leftLeg);leftLeg.position.set(-.36,.89,.01);
    const rightLeg=new THREE.Group();g.add(rightLeg);rightLeg.position.set(.36,.89,.01);
    for(const leg of [leftLeg,rightLeg]){
      sphere(leg,limbShell,0,-.43,0,.26,.48,.29);
      sphere(leg,standard.dark,0,-.71,.14,.29,.18,.41);
    }
    const muzzle = sphere(headShape, limbShell, 0, 2.24, .47, .36, .23, .17);
    mesh(lowSphereGeo, faceMat, headShape, 0, 2.34, .635, [.11,.065,.055]);
    const face = new THREE.Group(); headShape.add(face);
    for (const side of [-1, 1]) {
      const lens = mesh(geo(new THREE.TorusGeometry(.205, .024, 6, 18)), faceMat, face, side*.27, 2.57, .537, [1.1,.72,1]);
      lens.rotation.y = side*.10;
      box(face, faceMat, side*.52, 2.60, .42, .12, .037, .31).rotation.y = side*.2;
    }
    box(face, faceMat, 0, 2.59, .57, .12, .035, .035);
    const coldFace=new THREE.Group(),warmFace=new THREE.Group();face.add(coldFace,warmFace);
    const brows = [];
    for (const side of [-1, 1]) {
      const x=side*.27;
      sphere(coldFace,eyeWhite,x,2.552,.575,.157,.045,.019);
      sphere(coldFace,coldInk,x-.014,2.542,.597,.043,.030,.016);
      const lid=box(coldFace,coldInk,x,2.596,.598,.32,.060,.028);lid.rotation.z=side===-1?-.12:.08;
      const brow=box(coldFace,coldInk,x,side===-1?2.77:2.85,.514,.40,.12,.065);
      brow.rotation.z=side===-1?-.32:.13;brows.push(brow);
      tube(coldFace,[[x-side*.12,2.49,.58],[x,2.478,.596],[x+side*.12,2.50,.57]],.012,coldInk,8);
      // In mask mode, raised cheeks and smiling eye arcs replace the stare.
      tube(warmFace,[[x-.12,2.535,.579],[x,2.605,.594],[x+.12,2.535,.579]],.024,warmInk,12);
      tube(warmFace,[[x-.15,2.79,.515],[x,2.835,.53],[x+.15,2.79,.515]],.029,warmInk,12);
      sphere(warmFace,blushMat,side*.39,2.31,.543,.105,.063,.027);
    }
    const sour = tube(coldFace, [[-.22,2.135,.594],[-.10,2.12,.638],[.045,2.125,.65],[.19,2.205,.609]], .029, coldInk, 18);
    tube(coldFace,[[.18,2.20,.615],[.235,2.25,.58],[.22,2.28,.57]],.018,coldInk,8);
    tube(coldFace,[[-.34,2.30,.53],[-.30,2.22,.56],[-.245,2.19,.585]],.015,coldInk,8);
    const smile = tube(warmFace, [[-.235,2.225,.589],[-.14,2.105,.64],[0,2.06,.658],[.14,2.105,.64],[.235,2.225,.589]], .026, warmInk, 20);
    warmFace.visible = false;
    const lapel = box(g, standard.red, .28, 1.87, .4, .18, .32, .055); lapel.rotation.z = -.2;
    const collar = tube(g, [[-.38,1.97,.30],[0,1.86,.48],[.38,1.97,.30]], .035, standard.dark);
    bears.push({ g, shell, limbShell, innerMat, bloodMat, internals, head, coldFace, warmFace, coldInk, eyeWhite, warmInk, blushMat, brows, sour, smile, heart, leftArm, rightArm, leftLeg, rightLeg, notes, pool });
    return g;
  }

  // Each island is its own miniature, readable from the main camera.
  function podium(parent, x, z) {
    cyl(parent, standard.dark, x, .27, z, .42, .15);
    const p = box(parent, standard.ink, x, .83, z, .64, 1.02, .46); p.rotation.y = -.12;
    box(p, standard.red, 0, .0, .51, .13, .7, .035);
    box(parent, standard.paper, x, 1.36, z, .79, .07, .57).rotation.z = -.06;
    tube(parent, [[x+.14,1.4,z],[x+.16,1.72,z],[x+.02,1.85,z+.1]], .021, standard.pole);
    const mic = sphere(parent, standard.dark, x, 1.85, z+.13, .08,.07,.16); mic.rotation.x = -.2;
  }
  function books(parent, x, z, amount = 4) {
    for (let j = 0; j < amount; j++) {
      const book = new THREE.Group(); parent.add(book); book.position.set(x, .27 + j*.14, z); book.rotation.y = Math.sin(j*8)*.16;
      box(book, j%2 ? standard.red : standard.dark, 0, 0, 0, .74,.13,.48);
      box(book, standard.paper, .02,.004,.015,.67,.085,.45);
      box(book, j%2 ? standard.red : standard.dark, -.35,.004,0,.05,.14,.48);
    }
  }
  function screen(parent, x, y, z, width = 1, pattern = 0) {
    const g = new THREE.Group(); parent.add(g); g.position.set(x, y, z);
    box(g, standard.ink,0,0,0,width,.66,.10);
    box(g, standard.glass,0,0,.058,width-.09,.57,.008);
    for (let j=0;j<4;j++) box(g,j === 0 ? standard.red : standard.edge,-width*.07,j*.105-.15,.072,width*(.45 + Math.sin(j+pattern)*.19),.028,.009);
    cyl(g,standard.pole,0,-.59,0,.045,.53);
    box(g,standard.dark,0,-.88,0,.44,.05,.3);
    return g;
  }
  function makeProps(parent, topic) {
    if (topic.region === 'rhetoric') {
      podium(parent, -.77, .6); books(parent,.72,.76,4);
      const board = plaque(parent, '說法製造', 'WORDS / WORDS / WORDS', .82, 1.16, -.7, 1.15, .52); board.rotation.y = -.22;
      box(parent,standard.pole,.82,.65,-.7,.045,.9,.045);
      for (let j=0;j<3;j++) {
        const paper = box(parent,standard.paper,-.7+j*.33,.23,1.15,.32,.02,.45); paper.rotation.y=j*.4;
        box(paper,standard.red,0,.7,0,.55,.09,.65);
      }
    } else if (topic.region === 'security') {
      const radar = new THREE.Group(); parent.add(radar); radar.position.set(.92,1.33,-.50); radar.rotation.set(-.23,-.35,0);
      const dish = mesh(geo(new THREE.CylinderGeometry(.69,.52,.10,24)),standard.dark,radar); dish.rotation.x=Math.PI/2;
      for (const radius of [.23,.46,.67]) {
        const r=mesh(geo(new THREE.TorusGeometry(radius,.012,4,32)),standard.edge,radar,0,0,.08);
      }
      line(radar,[[-.64,0,.08],[.64,0,.08]],0xb2b698); line(radar,[[0,-.64,.08],[0,.64,.08]],0xb2b698);
      const sweep = box(radar,standard.red,.0,.31,.10,.032,.62,.022); sweep.geometry.translate(0,0,0);
      const rotating = new THREE.Group(); radar.add(rotating); rotating.add(sweep); motionObjects.push({object:rotating,axis:'z',speed:.5});
      cyl(parent,standard.pole,.92,.65,-.5,.09,.9);
      cyl(parent,standard.dark,.92,.28,-.5,.42,.15);
      screen(parent,-.95,.95,.8,.85,1);
      box(parent,standard.dark,.65,.45,.86,.55,.45,.58);
      box(parent,standard.red,.65,.7,.86,.56,.045,.59);
    } else if (topic.region === 'parliament') {
      podium(parent,.91,.77);
      for(let j=0;j<3;j++) {
        const bench=box(parent,j%2?standard.ink:standard.red,-.85,.51,-.7+j*.55,.75,.35,.37);
        box(parent,standard.dark,-.85,.76,-.84+j*.55,.75,.34,.11);
        box(parent,standard.pole,-1.1,.32,-.7+j*.55,.06,.25,.28);
        box(parent,standard.pole,-.6,.32,-.7+j*.55,.06,.25,.28);
      }
      const flag = new THREE.Group(); parent.add(flag); flag.position.set(.92,.2,-.95);
      cyl(flag,standard.pole,0,.95,0,.025,1.9);
      box(flag,standard.cream,.28,1.61,0,.53,.5,.025);
      box(flag,standard.red,.29,1.61,.02,.12,.37,.01);
    } else if(topic.region === 'defense') {
      const shield = new THREE.Group(); parent.add(shield); shield.position.set(-.95,.94,.63); shield.rotation.y=-.18;
      const shape=new THREE.Shape(); shape.moveTo(-.38,.48);shape.lineTo(.38,.48);shape.lineTo(.37,-.15);shape.lineTo(0,-.49);shape.lineTo(-.37,-.15);shape.closePath();
      mesh(geo(new THREE.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:true,bevelThickness:.04,bevelSize:.04,bevelSegments:1})),standard.dark,shield);
      box(shield,standard.red,0,.05,.15,.08,.54,.04);box(shield,standard.red,0,.16,.15,.36,.07,.04);
      for(let j=0;j<3;j++) {
        const crate=box(parent,j===2?standard.red:standard.edge,.8,.4+j*.32,.55,.65,.31,.55);
        box(parent,standard.dark,.63,.4+j*.32,.835,.07,.24,.012);box(parent,standard.dark,.98,.4+j*.32,.835,.07,.24,.012);
      }
      const abacus = new THREE.Group();parent.add(abacus);abacus.position.set(.92,.71,-.77);abacus.rotation.y=-.2;
      box(abacus,standard.dark,-.46,0,0,.06,.85,.13);box(abacus,standard.dark,.46,0,0,.06,.85,.13);
      box(abacus,standard.dark,0,.44,0,.98,.07,.13);box(abacus,standard.dark,0,-.44,0,.98,.07,.13);
      for(let j=0;j<4;j++) {
        box(abacus,standard.gold,0,-.28+j*.19,0,.87,.02,.02);
        for(let k=0;k<3;k++) sphere(abacus,j%2?standard.red:standard.cream,-.29+k*.14+(j%2)*.19,-.28+j*.19,0,.065,.075,.07);
      }
    } else if(topic.region === 'media') {
      screen(parent,-.97,1.15,.50,.9,2).rotation.y=.15;
      screen(parent,.91,1.35,-.65,1.2,3).rotation.y=-.25;
      const cameraProp=new THREE.Group();parent.add(cameraProp);cameraProp.position.set(.9,1.01,.90);cameraProp.rotation.y=-.4;
      box(cameraProp,standard.dark,0,0,0,.51,.34,.36);
      const lens=cyl(cameraProp,standard.ink,0,0,.28,.13,.24);lens.rotation.x=Math.PI/2;
      const glass=cyl(cameraProp,standard.red,0,0,.41,.10,.015);glass.rotation.x=Math.PI/2;
      box(cameraProp,standard.pole,0,-.47,0,.04,.75,.04);
      for(let j=0;j<3;j++){const a=j*Math.PI*2/3;tube(cameraProp,[[0,-.4,0],[Math.cos(a)*.25,-.8,Math.sin(a)*.25]],.017,standard.pole,2);}
      cyl(parent,standard.dark,-.89,.3,-.7,.26,.17);
      cyl(parent,standard.pole,-.89,1.05,-.7,.025,1.5);
      sphere(parent,standard.red,-.89,1.82,-.7,.07);
      line(parent,[[-1.2,1.7,-.7],[-.89,1.55,-.7],[-.58,1.7,-.7]],0xb7bca2);
    } else {
      const scale = new THREE.Group();parent.add(scale);scale.position.set(.89,.23,.56);scale.rotation.y=-.15;
      cyl(scale,standard.dark,0,.05,0,.37,.1);cyl(scale,standard.gold,0,.76,0,.045,1.5);
      sphere(scale,standard.red,0,1.55,0,.09);
      const beam=box(scale,standard.gold,0,1.4,0,1.45,.05,.05);beam.rotation.z=-.15;
      for(const side of [-1,1]) {
        const yy=1.4-side*.108;
        line(scale,[[side*.65,yy,0],[side*.65,.73-side*.108,0]],0xbab28e);
        line(scale,[[side*.65,.94-side*.108,0],[side*.90,.69-side*.108,0]],0xbab28e);
        line(scale,[[side*.65,.94-side*.108,0],[side*.40,.69-side*.108,0]],0xbab28e);
        cyl(scale,side===1?standard.red:standard.edge,side*.65,.67-side*.108,0,.30,.045);
      }
      books(parent,-.92,.64,5);
      const file=box(parent,standard.paper,-.89,.94,-.6,.69,1.1,.13);file.rotation.z=.12;
      for(let j=0;j<5;j++)box(file,j===1?standard.red:standard.edge,0,.28-j*.13,.52,.65,.035,.02);
      box(parent,standard.dark,-.89,.29,-.6,.91,.16,.46);
    }
  }

  const main = new THREE.Group(); root.add(main); makePlatform(main,2.2,true);
  const mainBear=makeBear(root,2.05,1);
  const heroRig=bears.at(-1);
  mainBear.traverse(o=>{if(o.isMesh){o.userData.islandId='__hero__';o.castShadow=false;pickables.push(o);}});
  const heroShadowMat=new THREE.MeshBasicMaterial({color:0x111710,transparent:true,opacity:.25,depthWrite:false});materials.add(heroShadowMat);
  const heroShadow=mesh(geo(new THREE.CircleGeometry(1.35,28)),heroShadowMat,root);heroShadow.rotation.x=-Math.PI/2;heroShadow.castShadow=false;heroShadow.receiveShadow=false;
  const displayNote=noteKit.createNote();displayNote.traverse(o=>{if(o.isMesh){o.material=o.material.clone();materials.add(o.material);}});main.add(displayNote);displayNote.position.set(.2,1.68,.1);displayNote.scale.setScalar(3.35);displayNote.rotation.set(-.1,.35,-.08);
  const displayFrame=box(main,standard.red,.2,1.68,-.02,2.65,1.34,.08);displayFrame.rotation.y=.35;
  cyl(main,standard.pole,.2,.79,-.05,.07,1.15);
  plaque(main,'形象銀行','100 / FICTIONAL EXHIBITION NOTE',.2,.46,.65,1.8,.4);
  const heroLabel=document.createElement('button');heroLabel.type='button';heroLabel.className='scene-label hero-label';heroLabel.textContent='巡遊紅熊 · 點擊跟隨';heroLabel.setAttribute('aria-label','追蹤巡遊中的巨大紅熊');heroLabel.addEventListener('click',()=>select('__hero__'));container.appendChild(heroLabel);buttons.push(heroLabel);
  const halo=ring(main,1.9,.012,standard.hot,.25);
  const centralPlaque=plaque(main,'假面紅熊村','RED BEAR / SATIRICAL EXHIBITION',0,.38,1.8,1.83,.53);centralPlaque.rotation.x=-.20;
  const banner=new THREE.Group();main.add(banner);banner.position.set(-1.49,.22,-1.05);banner.rotation.y=.25;
  cyl(banner,standard.pole,0,2.23,0,.035,4.46);
  const bannerMat=canvasMaterial(256,1024,(c,w,h)=>{
    c.fillStyle='#bd3c28';c.fillRect(0,0,w,h);c.fillStyle='#e3d9bb';
    c.font='bold 48px sans-serif';['假','面','紅','熊','村'].forEach((t,i)=>c.fillText(t,48,120+i*116));
    c.fillStyle='#422e21';c.font='24px monospace';c.save();c.translate(178,120);c.rotate(Math.PI/2);c.fillText('OPEN THE SURFACE.',0,0);c.restore();
    c.fillStyle='#e3d9bb';c.font='bold 65px monospace';c.fillText(String(topics.length).padStart(2,'0'),43,891);c.fillStyle='#e3d9bb';c.fillRect(43,941,143,5);
  });
  box(banner,bannerMat,.36,3.33,0,.72,2.75,.035);
  sphere(banner,standard.gold,0,4.5,0,.07);
  for(let j=0;j<3;j++){const beam=box(main,standard.dark,1.7,.54+j*.22,-.93,.35,.12,.44);beam.rotation.y=.2;}

  const selectionMat=mat(0xec6b42,{emissive:0xd54525,emissiveIntensity:.6,transparent:true,opacity:0,depthWrite:false});
  for (const [index,topic] of topics.entries()) {
    const group=new THREE.Group();root.add(group);
    const isOuter = topics.length > 8 && index % 2 === 1;
    const ringCount = topics.length > 8 ? Math.ceil(topics.length/2) : topics.length;
    const ringIndex = topics.length > 8 ? Math.floor(index/2) : index;
    const a = ringIndex * Math.PI * 2 / ringCount + (isOuter ? Math.PI / ringCount : 0) + Math.PI / 6;
    const radius = topics.length > 8 ? (isOuter ? 8.9 : 5.2) : 6.2;
    const baseScale = topics.length > 8 ? (isOuter ? .91 : .80) : 1;
    group.position.set(Math.cos(a)*radius,0,Math.sin(a)*radius*.91);
    group.scale.setScalar(baseScale);
    makePlatform(group,1.93);
    const bear=makeBear(group,.67,index),rig=bears.at(-1);bear.position.set(-.07,.22,-.24);bear.rotation.y=.23+(index-2)*.045;
    makeProps(group,topic);
    const numberMaterial=canvasMaterial(256,128,(c,w,h)=>{
      c.fillStyle='#222b24';c.fillRect(0,0,w,h);c.fillStyle='#dfd8bb';c.font='bold 70px monospace';c.fillText(topic.number,19,86);c.fillStyle='#d14c32';c.fillRect(150,30,75,9);c.fillStyle='#929c84';c.fillRect(150,50,55,5);
    });
    const number=box(group,numberMaterial,0,-.19,1.68,.74,.35,.025);
    const mark=ring(group,1.79,.035,selectionMat.clone(),.25,6);materials.add(mark.material);mark.rotation.z=Math.PI/6;
    const anchor=new THREE.Object3D();anchor.position.set(0,.45,1.8);group.add(anchor);
    group.traverse(o=>{if(o.isMesh){o.userData.islandId=topic.id;pickables.push(o);}});
    const label=document.createElement('button');label.type='button';label.className='scene-label';label.dataset.id=topic.id;
    label.setAttribute('aria-label',`閱讀${topic.number} ${topic.title}`);
    label.title=`${topic.number} ${topic.title}`;
    const labelNumber=document.createElement('span');labelNumber.className='scene-label-number';labelNumber.textContent=topic.number;
    const labelTitle=document.createElement('span');labelTitle.className='scene-label-title';labelTitle.textContent=topic.title;
    const labelArrow=document.createElement('span');labelArrow.className='scene-label-arrow';labelArrow.setAttribute('aria-hidden','true');labelArrow.textContent='↗';
    labelNumber.style.cssText='font:9px monospace;opacity:.7;margin-right:5px;';labelArrow.style.cssText='margin-left:4px;opacity:.6;';
    label.append(labelNumber,labelTitle,labelArrow);
    label.style.cssText='position:absolute;left:0;top:0;transform:translate(-50%,-50%);z-index:2;white-space:nowrap;';
    label.addEventListener('click',()=>select(topic.id));container.appendChild(label);buttons.push(label);
    const record={...topic,group,anchor,label,labelTitle,labelArrow,mark,bear,rig,baseY:0,index,baseScale};islands.push(record);
  }

  const islandInteractions=createIslandInteractions({THREE,root,islands,materials,geometries,textures,noteKit,container,reduceMotion});

  // Permanent village streets are visual infrastructure, separate from issue links.
  const roadMaterial=mat(0x343b35,{roughness:.95});
  const laneMaterial=mat(0xd6cbb0,{roughness:1});
  const curbMaterial=mat(0xa78a70,{roughness:.9});
  const lampMaterial=mat(0xffdb99,{emissive:0xffb94f,emissiveIntensity:.6,roughness:.4});
  const roadGroup=new THREE.Group();root.add(roadGroup);
  let roadCount=0;
  function lamp(x,z){
    cyl(roadGroup,standard.dark,x,-.1,z,.14,.55);
    cyl(roadGroup,standard.pole,x,.54,z,.038,1.12);
    sphere(roadGroup,lampMaterial,x,1.16,z,.12,.17,.12);
    cyl(roadGroup,standard.dark,x,1.34,z,.15,.04);
  }
  function bridge(from,to,fromRadius=0,toRadius=0){
    const delta=new THREE.Vector3().subVectors(to,from);delta.y=0;const distance=delta.length();
    if(distance<fromRadius+toRadius+.15)return;
    const direction=delta.normalize(),a=from.clone().addScaledVector(direction,fromRadius),b=to.clone().addScaledVector(direction,-toRadius);
    const length=a.distanceTo(b),center=a.clone().add(b).multiplyScalar(.5),yaw=Math.atan2(direction.x,direction.z);
    const segment=new THREE.Group();roadGroup.add(segment);segment.position.set(center.x,.12,center.z);segment.rotation.y=yaw;
    box(segment,roadMaterial,0,0,0,.82,.18,length);
    for(const side of [-1,1]){
      box(segment,curbMaterial,side*.43,.08,0,.07,.13,length);
      for(let k=-length/2+.2;k<length/2;k+=.75)box(segment,standard.pole,side*.44,.30,k,.035,.42,.035);
      box(segment,standard.edge,side*.44,.49,0,.035,.035,length);
    }
    for(let k=-length/2+.24;k<length/2;k+=.65)box(segment,laneMaterial,0,.102,k,.045,.012,.26);
    for(let k=-length/2+.45;k<length/2;k+=2.4){box(segment,standard.dark,0,-.74,k,.27,1.35,.27);box(segment,standard.edge,0,-1.38,k,.53,.12,.53);}
    if(length>1.5){const side=new THREE.Vector3(direction.z,0,-direction.x);const pos=center.clone().addScaledVector(side,.7);lamp(pos.x,pos.z);}
    roadCount++;
  }
  const nodes=[{position:new THREE.Vector3(),radius:2.05},...islands.map(i=>({position:i.group.position.clone(),radius:1.71*i.baseScale}))];
  // Minimum spanning network guarantees that every island has a road to the village.
  const reached=new Set([0]),roadPairs=new Set();
  while(reached.size<nodes.length){
    let best=null;
    for(const a of reached)for(let b=1;b<nodes.length;b++){if(reached.has(b))continue;const distance=nodes[a].position.distanceTo(nodes[b].position);if(!best||distance<best.distance)best={a,b,distance};}
    if(!best)break;
    bridge(nodes[best.a].position,nodes[best.b].position,nodes[best.a].radius,nodes[best.b].radius);roadPairs.add([best.a,best.b].sort((a,b)=>a-b).join(':'));reached.add(best.b);
  }
  const ordered=nodes.slice(1).map((node,i)=>({...node,index:i+1})).sort((a,b)=>Math.atan2(a.position.z,a.position.x)-Math.atan2(b.position.z,b.position.x));
  if(ordered.length>2)for(let i=0;i<ordered.length;i++){
    const a=ordered[i],b=ordered[(i+1)%ordered.length],id=[a.index,b.index].sort((a,b)=>a-b).join(':');
    if(!roadPairs.has(id)&&a.position.distanceTo(b.position)<9){bridge(a.position,b.position,a.radius,b.radius);roadPairs.add(id);}
  }
  const patrolRadius=11.8;
  const ringRoad=mesh(geo(new THREE.RingGeometry(patrolRadius-.58,patrolRadius+.58,128)),roadMaterial,roadGroup,0,.205,0);ringRoad.rotation.x=-Math.PI/2;
  ring(roadGroup,patrolRadius-.59,.045,curbMaterial,.23,128);ring(roadGroup,patrolRadius+.59,.045,curbMaterial,.23,128);
  for(let i=0;i<96;i++){const angle=i*Math.PI*2/96;const dash=box(roadGroup,laneMaterial,Math.cos(angle)*patrolRadius,.216,Math.sin(angle)*patrolRadius,.31,.012,.045);dash.rotation.y=Math.PI/2-angle;}
  for(let i=0;i<12;i++){const angle=i*Math.PI/6;cyl(roadGroup,standard.dark,Math.cos(angle)*patrolRadius,-.57,Math.sin(angle)*patrolRadius,.18,1.53);lamp(Math.cos(angle)*(patrolRadius+.82),Math.sin(angle)*(patrolRadius+.82));}
  const outside=nodes.slice(1).filter(n=>n.position.length()>7 || topics.length<=8);
  for(const node of outside){const direction=node.position.clone().normalize();bridge(node.position,direction.multiplyScalar(patrolRadius),node.radius,.02);}
  container.dataset.roadCount=String(roadCount);container.dataset.connectedIslands=String(reached.size-1);

  // Two visible causeways continue into adjacent districts in the village loop.
  if(district.count>1){
    for(const side of [-1,1]){
      const number=side<0?district.previous:district.next;
      bridge(new THREE.Vector3(side*patrolRadius,0,0),new THREE.Vector3(side*23,0,0),.22,0);
      const gate=new THREE.Group();root.add(gate);gate.position.set(side*14.25,.23,0);gate.rotation.y=.38;
      for(const s of [-1,1])cyl(gate,standard.red,s*.78,.85,0,.07,1.7);
      box(gate,standard.dark,0,1.7,0,1.8,.12,.13);
      const sign=plaque(gate,`${side<0?'← ':''}第 ${String(number).padStart(2,'0')} 區${side>0?' →':''}`,'CONNECTED DISTRICT',0,1.31,.08,1.7,.62);
      gate.traverse(o=>{if(o.isMesh){o.userData.islandId=side<0?'__district_prev__':'__district_next__';pickables.push(o);}});
      for(let j=0;j<3;j++){
        const chevron=new THREE.Group();roadGroup.add(chevron);chevron.position.set(side*(16+j*1.7),.24,0);
        for(const s of [-1,1]){const stroke=box(chevron,laneMaterial,0,0,s*.12,.32,.018,.06);stroke.rotation.y=side*s*.65;}
      }
    }
  }
  container.dataset.districtRoads=String(district.count>1?2:0);
  container.dataset.roadCount=String(roadCount);

  // Patrol follows the same bridge graph, visiting a shuffled bag of every island.
  const patrolNodes=nodes.map(n=>n.position.clone());
  const patrolEdges=nodes.map(()=>[]);
  function patrolLink(a,b,points){
    const path=points||[patrolNodes[a].clone(),patrolNodes[b].clone()];
    const length=path.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(path[i]),0);
    const cost=length*(a===0||b===0?4:1);
    patrolEdges[a].push({to:b,path,cost});patrolEdges[b].push({to:a,path:[...path].reverse(),cost});
  }
  for(const pair of roadPairs){const [a,b]=pair.split(':').map(Number);patrolLink(a,b);}
  const patrolRing=[];
  for(const node of outside){
    const index=nodes.indexOf(node),angle=Math.atan2(node.position.z,node.position.x),ringIndex=patrolNodes.length;
    patrolNodes.push(new THREE.Vector3(Math.cos(angle)*patrolRadius,0,Math.sin(angle)*patrolRadius));patrolEdges.push([]);
    patrolLink(index,ringIndex);patrolRing.push({index:ringIndex,angle});
  }
  patrolRing.sort((a,b)=>a.angle-b.angle);
  if(patrolRing.length>1)for(let i=0;i<patrolRing.length;i++){
    const a=patrolRing[i],b=patrolRing[(i+1)%patrolRing.length];let end=b.angle;if(end<=a.angle)end+=Math.PI*2;
    const steps=Math.ceil((end-a.angle)/.12),path=[];
    for(let j=0;j<=steps;j++){const angle=a.angle+(end-a.angle)*j/steps;path.push(new THREE.Vector3(Math.cos(angle)*patrolRadius,0,Math.sin(angle)*patrolRadius));}
    patrolLink(a.index,b.index,path);
  }
  let patrolNode=patrolRing.length?patrolRing.reduce((a,b)=>Math.abs(b.angle-.67)<Math.abs(a.angle-.67)?b:a).index:1;
  const patrolPosition=patrolNodes[patrolNode].clone();
  let patrolPath=[],patrolBag=[],patrolTarget=1,patrolWait=0,patrolYaw=-.67,patrolBaseYaw=patrolYaw;
  const visitedIslands=new Set();
  function planPatrol(){
    if(!patrolBag.length){patrolBag=islands.map((_,i)=>i+1);for(let i=patrolBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[patrolBag[i],patrolBag[j]]=[patrolBag[j],patrolBag[i]];}}
    patrolTarget=patrolBag.pop();
    if(patrolTarget===patrolNode&&patrolBag.length)patrolTarget=patrolBag.pop();
    const dist=patrolNodes.map(()=>Infinity),previous=new Map(),done=new Set();dist[patrolNode]=0;
    while(done.size<patrolNodes.length){
      let here=-1;for(let i=0;i<dist.length;i++)if(!done.has(i)&&(here<0||dist[i]<dist[here]))here=i;
      if(here<0||!Number.isFinite(dist[here])||here===patrolTarget)break;done.add(here);
      for(const edge of patrolEdges[here])if(dist[here]+edge.cost<dist[edge.to]){dist[edge.to]=dist[here]+edge.cost;previous.set(edge.to,{from:here,edge});}
    }
    const route=[];let at=patrolTarget;while(previous.has(at)){const item=previous.get(at);route.unshift(item.edge);at=item.from;}
    patrolPath=route.flatMap(edge=>edge.path.slice(1).map(p=>p.clone()));
    container.dataset.patrolTarget=islands[patrolTarget-1]?.title||'環村道路';
  }
  planPatrol();

  // Shared, reusable dust particles and a ground shockwave for district arrivals.
  const dust=[];
  for(let i=0;i<14;i++){
    const material=mat(i%3===0?0xb85639:0xa3957d,{transparent:true,opacity:0,depthWrite:false,roughness:1});
    const puff=mesh(lowSphereGeo,material,root);puff.visible=false;puff.castShadow=false;puff.receiveShadow=false;
    dust.push({puff,angle:i*Math.PI*2/14,offset:.15+(i%4)*.11});
  }
  const shockMaterial=mat(0xe98a4e,{emissive:0xb9461f,emissiveIntensity:.7,transparent:true,opacity:0,depthWrite:false});
  const shock=ring(root,1,.045,shockMaterial,.26,48);shock.visible=false;shock.castShadow=false;
  const dustOrigin=new THREE.Vector3();let dustAge=10;
  function burstDust(){if(reduceMotion)return;dustOrigin.copy(patrolPosition);dustAge=0;}

  // Same-region arcs link island to island; roads remain visible when this layer is off.
  const relationshipPairs=[];
  for(let a=0;a<islands.length;a++)for(let b=a+1;b<islands.length;b++){
    if(islands[a].region!==islands[b].region)continue;
    const p1=islands[a].group.position.clone(),p2=islands[b].group.position.clone();p1.y=.52;p2.y=.52;
    const mid=p1.clone().add(p2).multiplyScalar(.5);mid.y=2.2+p1.distanceTo(p2)*.13;
    const curve=new THREE.QuadraticBezierCurve3(p1,mid,p2);
    const arc=tube(connections,curve.getPoints(20).map(v=>v.toArray()),.018,mat(0xed8b58,{emissive:0x8c3b16,emissiveIntensity:.45,transparent:true,opacity:.78}),30);arc.castShadow=false;
    for(const p of [p1,p2])sphere(connections,standard.hot,p.x,p.y,p.z,.09);
    relationshipPairs.push([islands[a].id,islands[b].id]);
  }
  container.dataset.relationshipCount=String(relationshipPairs.length);

  // A few carefully placed plinth fragments make the diagram feel inhabited.
  for(let i=0;i<14;i++) {
    const a=i*2.39996,r=10.5+(i%3)*.21;
    const fragment=mesh(lowSphereGeo,i%4===0?standard.red:standard.dark,root,Math.cos(a)*r,-.95,Math.sin(a)*r,[.13+(i%3)*.06,.20,.16]);
    fragment.rotation.set(i*.7,i*.5,i*.2);
  }

  let width=1,height=1,frame=0,disposed=false,paused=false,birdView=false,selectedId=null,hoveredId=null;
  let targetMode=0,modeBlend=0,following=false;
  let azimuth=.38,targetAzimuth=.38,polar=.90,targetPolar=.90;
  function defaultZoom(){return container.clientWidth<600?.88:.92;}
  let zoomRatio=defaultZoom(),targetZoom=zoomRatio;
  const targetPoint=new THREE.Vector3(0,1.45,0),lookPoint=targetPoint.clone();
  const tempPosition=new THREE.Vector3();
  const projected=new THREE.Vector3();
  const points=new Map();
  let gestureStart=null,dragged=false,pinchDistance=0,pointerDownTime=0;
  let lastMode=-1;
  let flightPhase=enterFromSky&&!reduceMotion?'falling':'patrol',flightTime=0,departurePromise=null,resolveDeparture=null,resolveSettled=null;
  const settledPromise=flightPhase==='falling'?new Promise(resolve=>{resolveSettled=resolve;}):Promise.resolve();

  function select(id) { if(id==='__district_prev__'||id==='__district_next__'){onDistrictChange(id==='__district_prev__'?-1:1);return;}if(id==='__hero__'){onHeroClick();return;}onSelect(id); }
  function resize() {
    if(disposed)return;
    width=Math.max(1,container.clientWidth);height=Math.max(1,container.clientHeight);
    renderer.setSize(width,height,false);updateCamera();
  }
  function updateCamera() {
    const aspect=width/height;
    // Start closer on phones; full orbit, zoom and island focus remain available.
    const extent=28.6;
    const viewHeight=(aspect<.8?extent/aspect:aspect<1.25?(extent+.2)/aspect:extent*.81)*zoomRatio;
    camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;
    camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();
    const radius=31;
    camera.position.set(lookPoint.x+Math.sin(azimuth)*Math.sin(polar)*radius,lookPoint.y+Math.cos(polar)*radius,lookPoint.z+Math.cos(azimuth)*Math.sin(polar)*radius);
    camera.lookAt(lookPoint);
    camera.updateMatrixWorld();
  }
  function hit(clientX,clientY) {
    const bounds=canvas.getBoundingClientRect();
    cursor.set((clientX-bounds.left)/bounds.width*2-1,-(clientY-bounds.top)/bounds.height*2+1);
    raycaster.setFromCamera(cursor,camera);
    const found=raycaster.intersectObjects(pickables,false);
    return found.length?found[0].object.userData.islandId:null;
  }
  function pointerDown(event) {
    if(event.button !== undefined && event.button !== 0)return;
    points.set(event.pointerId,{x:event.clientX,y:event.clientY});
    canvas.setPointerCapture(event.pointerId);
    pointerDownTime=performance.now();
    if(points.size===1){gestureStart={x:event.clientX,y:event.clientY,azimuth:targetAzimuth,polar:targetPolar};dragged=false;canvas.style.cursor='grabbing';}
    else if(points.size===2){const a=[...points.values()];pinchDistance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);dragged=true;}
  }
  function pointerMove(event) {
    if(!points.has(event.pointerId)) {
      if(event.pointerType !== 'touch') {hoveredId=hit(event.clientX,event.clientY);canvas.style.cursor=hoveredId?'pointer':'grab';}
      return;
    }
    points.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(points.size===2){const a=[...points.values()];const next=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinchDistance>0)targetZoom=THREE.MathUtils.clamp(targetZoom*pinchDistance/Math.max(1,next),.36,1.65);pinchDistance=next;dragged=true;return;}
    if(gestureStart){const dx=event.clientX-gestureStart.x,dy=event.clientY-gestureStart.y;if(Math.hypot(dx,dy)>6)dragged=true;
      targetAzimuth=gestureStart.azimuth-dx*.006;
      targetPolar=THREE.MathUtils.clamp(gestureStart.polar-dy*.004,.23,1.24);birdView=false;
    }
  }
  function pointerUp(event) {
    if(!points.has(event.pointerId))return;
    if(points.size===1 && !dragged && performance.now()-pointerDownTime<900){const id=hit(event.clientX,event.clientY);if(id)select(id);}
    points.delete(event.pointerId);
    if(points.size===1){const p=[...points.values()][0];gestureStart={x:p.x,y:p.y,azimuth:targetAzimuth,polar:targetPolar};dragged=true;}
    else if(!points.size)gestureStart=null;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor='grab';
  }
  function pointerCancel(event){points.delete(event.pointerId);gestureStart=null;dragged=true;canvas.style.cursor='grab';}
  function wheel(event){event.preventDefault();targetZoom=THREE.MathUtils.clamp(targetZoom*Math.exp(event.deltaY*.001),.36,1.65);}
  const events=[['pointerdown',pointerDown],['pointermove',pointerMove],['pointerup',pointerUp],['pointercancel',pointerCancel],['wheel',wheel]];
  events.forEach(([name,fn])=>canvas.addEventListener(name,fn,{passive:name!=='wheel'}));
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);resize();
  canvas.style.cursor='grab';

  const xrayColor=new THREE.Color(0xe9c8b9),maskColor=new THREE.Color(0xf0dbad);
  const limbXray=new THREE.Color(0xc78d7c),limbMask=new THREE.Color(0xe5c994);
  let elapsed=0;
  const lighting={
    dawn:{sky:0xffc8a2,key:0xffbc80,intensity:3.2,ambient:1.45,fill:1.0,ground:0x383a30,bg:'#252a25',lamp:1.3},
    day:{sky:0xeaf3ed,key:0xfff5d9,intensity:4.4,ambient:2.4,fill:1.45,ground:0x3f503d,bg:'#29372f',lamp:.15},
    dusk:{sky:0xe7cfb1,key:0xffc797,intensity:3.9,ambient:1.75,fill:1.05,ground:0x2d392f,bg:'#202420',lamp:1.1},
    night:{sky:0x9eb7d5,key:0xb2c9ed,intensity:1.4,ambient:.75,fill:.55,ground:0x16251f,bg:'#141d1a',lamp:3.2}
  };
  function setLighting(time){
    const l=lighting[time]||lighting.dusk;ambient.color.set(l.sky);ambient.intensity=l.ambient;key.color.set(l.key);key.intensity=l.intensity;fill.intensity=l.fill;ground.material.color.set(l.ground);lampMaterial.emissiveIntensity=l.lamp;container.style.backgroundColor=l.bg;container.dataset.timeOfDay=time;renderer.shadowMap.needsUpdate=true;
  }
  setLighting('dusk');

  function animate(){
    if(disposed)return;
    frame=requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),.05);if(!paused)elapsed+=dt;
    const ease=reduceMotion?1:1-Math.exp(-dt*7);
    azimuth=THREE.MathUtils.lerp(azimuth,targetAzimuth,ease);polar=THREE.MathUtils.lerp(polar,targetPolar,ease);
    zoomRatio=THREE.MathUtils.lerp(zoomRatio,targetZoom,ease);lookPoint.lerp(targetPoint,ease);
    modeBlend=THREE.MathUtils.lerp(modeBlend,targetMode,reduceMotion?1:1-Math.exp(-dt*4));
    if(Math.abs(modeBlend-lastMode)>.0005){
      noteKit.materials.forEach(m=>{m.opacity=1-modeBlend;m.depthWrite=false;});
      for(const b of bears){
        b.shell.color.copy(xrayColor).lerp(maskColor,modeBlend);b.shell.opacity=.22+.78*modeBlend;
        b.limbShell.color.copy(limbXray).lerp(limbMask,modeBlend);b.limbShell.opacity=.62+.38*modeBlend;
        b.innerMat.opacity=1-modeBlend;b.bloodMat.opacity=.9*(1-modeBlend);b.internals.visible=modeBlend<.99;
        b.head.rotation.x=-.18+.215*modeBlend;b.head.rotation.z=-.055+.080*modeBlend;
        b.coldInk.opacity=1-modeBlend;b.eyeWhite.opacity=1-modeBlend;
        b.warmInk.opacity=modeBlend;b.blushMat.opacity=.82*modeBlend;
        b.coldFace.visible=modeBlend<.995;b.warmFace.visible=modeBlend>.005;
      }
      container.dataset.view=modeBlend>.5?'mask':'xray';lastMode=modeBlend;
    }
    for(const island of islands){
      const active=island.id===selectedId,hover=island.id===hoveredId;
      island.group.position.y=0;
      const scale=island.baseScale;
      if(Math.abs(island.group.scale.x-scale)>.001)renderer.shadowMap.needsUpdate=true;
      island.group.scale.lerp(tempPosition.set(scale,scale,scale),ease);
      island.mark.material.opacity=THREE.MathUtils.lerp(island.mark.material.opacity,active?.9:hover?.45:0,ease);
    }
    if(!reduceMotion&&!paused){for(const object of motionObjects)object.object.rotation[object.axis]+=dt*object.speed;}
    // Walk along actual bridges, pause on islands, then inspect the next random stop.
    if(flightPhase==='patrol'&&!paused&&!reduceMotion){
      if(patrolWait>0){patrolWait-=dt;patrolYaw=patrolBaseYaw+Math.sin((2.4-patrolWait)*3.3)*.28;if(patrolWait<=0)planPatrol();}
      else if(patrolPath.length){
        let travel=dt*1.75;
        while(travel>0&&patrolPath.length){
          const waypoint=patrolPath[0],delta=waypoint.clone().sub(patrolPosition),distance=delta.length();
          if(distance>.001){const desired=Math.atan2(delta.x,delta.z);patrolYaw+=Math.atan2(Math.sin(desired-patrolYaw),Math.cos(desired-patrolYaw))*Math.min(1,dt*7);}
          if(distance<=travel){patrolPosition.copy(waypoint);patrolPath.shift();travel-=distance;}else{patrolPosition.addScaledVector(delta,travel/distance);travel=0;}
        }
        if(!patrolPath.length){patrolNode=patrolTarget;visitedIslands.add(patrolNode);patrolWait=2.4;patrolBaseYaw=patrolYaw;}
      }else planPatrol();
    }
    if(flightPhase==='takeoff'||flightPhase==='falling'||flightPhase==='impact')flightTime+=dt;
    if(flightPhase==='takeoff'&&flightTime>=.95){flightPhase='departed';resolveDeparture?.();resolveDeparture=null;}
    if(flightPhase==='falling'&&flightTime>=1.05){flightPhase='impact';flightTime=0;burstDust();}
    if(flightPhase==='impact'&&flightTime>=.65){flightPhase='patrol';flightTime=0;resolveSettled?.();resolveSettled=null;}
    const stride=Math.sin(elapsed*4.2),moving=!reduceMotion&&flightPhase==='patrol'&&patrolWait<=0&&patrolPath.length>0;
    mainBear.position.copy(patrolPosition);mainBear.position.y=.22+(moving?Math.abs(stride)*.075:0);
    mainBear.rotation.set(0,patrolYaw,moving?Math.sin(elapsed*2.1)*.028:0);mainBear.scale.setScalar(2.05);
    heroRig.leftLeg.rotation.x=moving?stride*.36:0;heroRig.rightLeg.rotation.x=moving?-stride*.36:0;
    heroRig.leftArm.rotation.set(moving?-stride*.32:0,0,-.25);heroRig.rightArm.rotation.set(moving?stride*.32:0,0,.34);
    if(flightPhase==='takeoff'||flightPhase==='departed'){
      const t=Math.min(1,flightTime/.95);mainBear.position.y+=22*t*t;mainBear.rotation.x=-.13;
      heroRig.leftArm.rotation.set(-.7,0,-.95);heroRig.rightArm.rotation.set(-.7,0,.95);heroRig.leftLeg.rotation.x=-.45;heroRig.rightLeg.rotation.x=-.45;
    }else if(flightPhase==='falling'){
      const t=Math.min(1,flightTime/1.05);mainBear.position.y+=24*(1-t*t);mainBear.rotation.x=.10;
      heroRig.leftArm.rotation.set(-.3,0,-1.05);heroRig.rightArm.rotation.set(-.3,0,1.05);heroRig.leftLeg.rotation.x=.2;heroRig.rightLeg.rotation.x=.2;
    }else if(flightPhase==='impact'){
      const compression=Math.sin(Math.min(1,flightTime/.42)*Math.PI)*.14;mainBear.scale.y=2.05*(1-compression);mainBear.rotation.x=-compression*.5;
      heroRig.leftArm.rotation.z=-.65;heroRig.rightArm.rotation.z=.65;
    }
    heroShadow.position.set(patrolPosition.x,.219,patrolPosition.z);heroShadow.scale.setScalar(Math.max(.28,1-mainBear.position.y*.025));heroShadowMat.opacity=Math.max(.07,.25-mainBear.position.y*.006);
    if(dustAge<1.8){
      dustAge+=dt;const t=dustAge/1.8;
      for(const {puff,angle,offset} of dust){const radius=.6+t*(3.6+offset);puff.visible=true;puff.position.set(dustOrigin.x+Math.cos(angle)*radius,.24+Math.sin(t*Math.PI)*(.8+offset),dustOrigin.z+Math.sin(angle)*radius);puff.scale.setScalar((.38+t*.95)*(1+offset));puff.material.opacity=Math.max(0,(1-t)*.52);}
      shock.visible=t<.6;shock.position.set(dustOrigin.x,.26,dustOrigin.z);shock.scale.setScalar(.7+t*6);shockMaterial.opacity=Math.max(0,.7-t*1.5);
    }else{dust.forEach(({puff})=>puff.visible=false);shock.visible=false;}
    const shake=flightPhase==='impact'&&!reduceMotion?Math.max(0,1-flightTime/.55)*.22:0;
    root.position.set(Math.sin(flightTime*83)*shake,0,Math.cos(flightTime*71)*shake);
    islandInteractions.update({dt,paused,mode:targetMode===1?'mask':'xray',blend:modeBlend,active:flightPhase==='patrol'});
    for(const b of bears)for(let j=0;j<b.notes.length;j++){const note=b.notes[j];note.object.position.y=note.y+(reduceMotion?0:Math.sin(elapsed*1.3+j)*.018);note.object.rotation.z=note.angle+(reduceMotion?0:Math.sin(elapsed*.7+j)*.025);}
    if(following){targetPoint.copy(mainBear.position);targetPoint.y=3.1;targetZoom=width<600?.46:.44;targetAzimuth=patrolYaw+.3;}
    container.dataset.walking=String(Boolean(moving&&!paused));container.dataset.following=String(following);container.dataset.heroPosition=`${mainBear.position.x.toFixed(3)},${mainBear.position.z.toFixed(3)}`;
    container.dataset.heroHeight=mainBear.position.y.toFixed(3);container.dataset.patrolState=flightPhase==='patrol'?(patrolWait>0?'watching':'walking'):flightPhase;container.dataset.visitedIslands=String(visitedIslands.size);
    updateCamera();
    root.updateMatrixWorld();
    projected.copy(mainBear.position);projected.y+=6.8;projected.project(camera);
    const hx=(projected.x*.5+.5)*width,hy=(-projected.y*.5+.5)*height;
    heroLabel.style.left=`${Math.round(THREE.MathUtils.clamp(hx,85,width-85))}px`;heroLabel.style.top=`${Math.round(THREE.MathUtils.clamp(hy,18,height-18))}px`;
    heroLabel.style.visibility=hx>-35&&hx<width+35&&hy>-30&&hy<height+20?'visible':'hidden';heroLabel.setAttribute('aria-pressed',String(following));heroLabel.textContent=flightPhase==='takeoff'?'紅熊升空 · 前往下一區':flightPhase==='falling'?'紅熊降臨':flightPhase==='impact'?'巡查開始':following?'巡查紅熊 · 停止跟隨':patrolWait>0?'紅熊監看中 · 點擊跟隨':'巡查紅熊 · 點擊跟隨';

    const labelPositions=[];
    for(const island of islands){
      island.anchor.getWorldPosition(projected);projected.project(camera);
      const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height+20;
      const inside=projected.z>-1&&projected.z<1&&x>15&&x<width-15&&y>10&&y<height-10;
      island.label.style.visibility=inside?'visible':'hidden';
      island.label.classList.toggle('is-compact',width<600);
      const shortName=island.shortName||island.title.replace(/島$/,'');
      const nameLimit=island.id===selectedId?7:4;
      island.labelTitle.textContent=width<600?shortName.slice(0,nameLimit)+(shortName.length>nameLimit?'…':''):island.title;
      island.labelArrow.style.display=width<600?'none':'';
      if(inside)labelPositions.push({island,x,y,desiredY:y,w:island.label.offsetWidth||100,h:island.label.offsetHeight||28});
    }
    // DOM labels remain readable after rotating or narrowing the exhibition.
    labelPositions.sort((a,b)=>a.desiredY-b.desiredY);
    for(let pass=0;pass<4;pass++)for(let i=0;i<labelPositions.length;i++){
      const a=labelPositions[i];a.x=THREE.MathUtils.clamp(a.x,a.w/2+6,width-a.w/2-6);
      for(let j=0;j<i;j++){
        const b=labelPositions[j];if(Math.abs(a.x-b.x)<(a.w+b.w)/2+5&&Math.abs(a.y-b.y)<(a.h+b.h)/2+5)a.y=b.y+(a.h+b.h)/2+5;
      }
      a.y=THREE.MathUtils.clamp(a.y,a.h/2+6,height-a.h/2-6);
    }
    for(const item of labelPositions){item.island.label.style.left=`${Math.round(item.x)}px`;item.island.label.style.top=`${Math.round(item.y)}px`;}
    renderer.render(scene,camera);
  }
  animate();
  requestAnimationFrame(()=>{if(!disposed)onReady({webgl:true});});

  return {
    depart(){
      if(disposed||reduceMotion||flightPhase==='departed')return Promise.resolve();
      if(departurePromise)return departurePromise;
      following=false;flightPhase='takeoff';flightTime=0;burstDust();
      departurePromise=new Promise(resolve=>{resolveDeparture=resolve;});return departurePromise;
    },
    whenSettled(){return settledPromise;},
    setMode(mode){targetMode=mode==='mask'?1:0;},
    focus(id){
      following=false;
      selectedId=islands.some(i=>i.id===id)?id:null;
      islands.forEach(i=>{i.label.classList.toggle('is-selected',i.id===selectedId);i.label.setAttribute('aria-pressed',String(i.id===selectedId));});
      if(selectedId){const island=islands.find(i=>i.id===selectedId);targetPoint.copy(island.group.position);targetPoint.y=1;targetZoom=width<600?.36:.4;}
      else {targetPoint.set(0,1.05,0);targetZoom=defaultZoom();}
    },
    setBirdView(enabled){birdView=Boolean(enabled);targetPolar=birdView?.24:.90;},
    setConnections(enabled){connections.visible=Boolean(enabled);},
    setPaused(enabled){paused=Boolean(enabled);},
    setTimeOfDay(time){setLighting(time);},
    setFollowing(enabled){const wasFollowing=following;following=Boolean(enabled);if(following){selectedId=null;targetAzimuth=mainBear.rotation.y+.3;}else if(wasFollowing){targetPoint.set(0,1.45,0);targetZoom=defaultZoom();}},
    zoom(delta){targetZoom=THREE.MathUtils.clamp(targetZoom*Math.exp(-delta*.15),.36,1.65);},
    reset(){following=false;selectedId=null;targetPoint.set(0,1.05,0);targetAzimuth=.38;targetPolar=.9;targetZoom=defaultZoom();birdView=false;islands.forEach(i=>{i.label.classList.remove('is-selected');i.label.setAttribute('aria-pressed','false');});},
    destroy(){
      if(disposed)return;disposed=true;islandInteractions.destroy();resolveDeparture?.();resolveSettled?.();cancelAnimationFrame(frame);resizeObserver.disconnect();
      events.forEach(([name,fn])=>canvas.removeEventListener(name,fn));
      delete container.dataset.heroPosition;delete container.dataset.walking;buttons.forEach(b=>b.remove());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();canvas.remove();
    },
  };

  function fallback(){
    container.classList.add('scene-fallback');
    const panel=document.createElement('div');panel.className='scene-fallback-panel';
    panel.style.cssText='position:absolute;inset:8%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:16px;text-align:center;';
    panel.innerHTML=`<div style="font-size:70px;color:#d65338">◉</div><p style="color:#ded7bd;font-size:17px">以文字走進紅熊村</p><p style="max-width:300px;font-size:13px;line-height:1.8;color:#a1ab97">此裝置暫時無法顯示 3D 展場。${topics.length} 個發言島與完整資料仍可直接閱讀。</p>`;
    const list=document.createElement('div');list.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:10px;';panel.appendChild(list);
    topics.forEach(topic=>{const button=document.createElement('button');button.type='button';button.className='scene-label fallback-label';button.textContent=`${topic.number} ${topic.title}`;button.dataset.id=topic.id;button.addEventListener('click',()=>onSelect(topic.id));list.appendChild(button);});
    container.appendChild(panel);queueMicrotask(()=>onReady({webgl:false}));
    return{depart(){return Promise.resolve();},whenSettled(){return Promise.resolve();},setMode(mode){container.dataset.view=mode;},focus(id){panel.querySelectorAll('button').forEach(b=>b.classList.toggle('is-selected',b.dataset.id===id));},setBirdView(){},setConnections(){},setPaused(){},setTimeOfDay(){},setFollowing(){},zoom(){},reset(){},destroy(){panel.remove();}};
  }
}
