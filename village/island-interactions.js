/** Fictional cartoon exchanges between island sculptures. No timers or outside assets. */
export function createIslandInteractions({ THREE, root, islands, materials, geometries, textures, noteKit, container, reduceMotion = false }) {
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
  const capacity = mobile ? 3 : 4;
  const layer = new THREE.Group(); layer.name = 'island-social-effects'; root.add(layer);
  const registerGeometry = geometry => (geometries.add(geometry), geometry);
  const registerMaterial = material => (materials.add(material), material);
  const meshMaterial = (color, extras = {}) => registerMaterial(new THREE.MeshStandardMaterial({ color, roughness: .65, ...extras }));
  const paperMaterial = meshMaterial(0xfff2c9, { emissive: 0x3a3020, emissiveIntensity: .3 });
  const paperEdgeMaterial = registerMaterial(new THREE.LineBasicMaterial({ color: 0x796650 }));
  const inkMaterial = meshMaterial(0x050909, { roughness: .13, metalness: .2 });
  const inkGlintMaterial = meshMaterial(0x9bafa7, { roughness: .2 });
  const heartMaterial = meshMaterial(0xff4569, { emissive: 0x9e1438, emissiveIntensity: .5, roughness: .38 });
  const kissMaterial = meshMaterial(0xf95b76, { emissive: 0x911b36, emissiveIntensity: .4 });
  const lipLineMaterial = meshMaterial(0x6b1730);
  const sparkMaterial = meshMaterial(0xffe6ab, { emissive: 0xffad68, emissiveIntensity: .8 });
  const ballGeometry = registerGeometry(new THREE.IcosahedronGeometry(.25, 1));
  const ballEdges = registerGeometry(new THREE.EdgesGeometry(ballGeometry, 12));
  const dropGeometry = registerGeometry(new THREE.SphereGeometry(1, 8, 6));
  const chipGeometry = registerGeometry(new THREE.BoxGeometry(.13, .13, .035));
  const lipLineGeometry = registerGeometry(new THREE.BoxGeometry(.59, .031, .035));
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, -.43); heartShape.bezierCurveTo(-.18, -.22, -.52, .01, -.45, .28);
  heartShape.bezierCurveTo(-.38, .56, -.10, .55, 0, .31); heartShape.bezierCurveTo(.10, .55, .38, .56, .45, .28);
  heartShape.bezierCurveTo(.52, .01, .18, -.22, 0, -.43);
  const heartGeometry = registerGeometry(new THREE.ExtrudeGeometry(heartShape, { depth: .08, bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 1, curveSegments: 6 }));
  const lipsShape = new THREE.Shape();
  lipsShape.moveTo(-.51, 0); lipsShape.bezierCurveTo(-.30, .10, -.20, .29, 0, .13);
  lipsShape.bezierCurveTo(.20, .29, .30, .10, .51, 0); lipsShape.bezierCurveTo(.20, -.28, -.20, -.28, -.51, 0);
  const lipsGeometry = registerGeometry(new THREE.ExtrudeGeometry(lipsShape, { depth: .06, bevelEnabled: true, bevelSize: .025, bevelThickness: .02, bevelSegments: 1, curveSegments: 7 }));
  const makeMesh = (geometry, material, parent) => { const mesh = new THREE.Mesh(geometry, material); parent.add(mesh); return mesh; };
  function bubbleMaterial(affection) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const c = canvas.getContext('2d'); c.clearRect(0, 0, 128, 128);
    c.beginPath(); c.ellipse(64, 53, 49, 39, 0, 0, Math.PI * 2); c.moveTo(45, 85); c.lineTo(35, 111); c.lineTo(68, 90);
    c.fillStyle = affection ? '#ffe3d9' : '#fff0ce'; c.fill(); c.lineWidth = 7; c.strokeStyle = affection ? '#d94d64' : '#68231b'; c.stroke();
    c.font = 'bold 58px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = affection ? '#e73060' : '#af241b'; c.fillText(affection ? '♥' : '!?', 64, 57);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    return registerMaterial(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  }
  const angryBubble = bubbleMaterial(false), warmBubble = bubbleMaterial(true);
  const actors = islands.map((island, index) => {
    const bear = island.bear, rig = island.rig;
    const bubble = new THREE.Sprite(angryBubble); bubble.scale.set(.96, .96, 1); bubble.visible = false; layer.add(bubble);
    return { island, bear, rig, index, bubble, baseY: bear.position.y, baseYaw: bear.rotation.y, targetYaw: bear.rotation.y,
      actionAge: 9, actionKind: 'paper', reactionAge: 9, phase: index * 1.37, neighbors: [], center: new THREE.Vector3(),
      lastTarget: -1 };
  });
  for (const actor of actors) {
    actor.neighbors = actors.filter(other => other !== actor).sort((a, b) => actor.island.group.position.distanceToSquared(a.island.group.position) - actor.island.group.position.distanceToSquared(b.island.group.position)).slice(0, 3);
  }
  // All flying objects and impact particles exist up front. Nothing is added per frame.
  const pool = [];
  for (let index = 0; index < capacity; index++) {
    const group = new THREE.Group(); layer.add(group); group.visible = false;
    const paper = new THREE.Group(); makeMesh(ballGeometry, paperMaterial, paper); paper.add(new THREE.LineSegments(ballEdges, paperEdgeMaterial)); group.add(paper);
    const money = noteKit.createNote(); money.scale.setScalar(1.85); group.add(money);
    const ink = new THREE.Group(); group.add(ink);
    for (let j = 0; j < 7; j++) {
      const drop = makeMesh(dropGeometry, inkMaterial, ink); const size = j === 0 ? .24 : .10 + (j % 3) * .035;
      drop.scale.set(size, size * 1.55, size); drop.position.set((j % 3 - 1) * .19, j === 0 ? 0 : -.09 * j, j === 0 ? 0 : -.11 * j);
      if (j === 0) { const glint = makeMesh(dropGeometry, inkGlintMaterial, ink); glint.scale.set(.045, .12, .025); glint.position.set(-.08, .08, .21); }
    }
    const heart = new THREE.Group(); group.add(heart);
    makeMesh(heartGeometry, heartMaterial, heart).scale.setScalar(.72);
    for (const side of [-1, 1]) { const tiny = makeMesh(heartGeometry, heartMaterial, heart); tiny.position.set(side * .43, .23, -.06); tiny.scale.setScalar(.29); tiny.rotation.z = side * -.3; }
    const kiss = new THREE.Group(); group.add(kiss);
    makeMesh(lipsGeometry, kissMaterial, kiss).scale.setScalar(.90); const lipLine = makeMesh(lipLineGeometry, lipLineMaterial, kiss); lipLine.position.z = .089;
    const kissHeart = makeMesh(heartGeometry, heartMaterial, kiss); kissHeart.position.set(.47, .31, 0); kissHeart.scale.setScalar(.25);
    const impact = new THREE.Group(); layer.add(impact); impact.visible = false;
    const sparks = [], spatters = [];
    for (let j = 0; j < 8; j++) {
      const spark = makeMesh(chipGeometry, sparkMaterial, impact); sparks.push(spark);
      const spatter = makeMesh(dropGeometry, inkMaterial, impact); spatter.scale.set(.16 + j % 3 * .035, .035, .11 + j % 2 * .06); spatters.push(spatter);
    }
    pool.push({ group, paper, money, ink, heart, kiss, impact, sparks, spatters, active: false, age: 0, duration: 1.8, kind: 'paper', source: null, target: null,
      start: new THREE.Vector3(), end: new THREE.Vector3(), direction: new THREE.Vector3(), arc: 2.3, hit: false });
  }
  const offset = new THREE.Vector3(), targetOffset = new THREE.Vector3();
  let socialTime = 0, nextSend = .50, sendCount = 0, sourceCursor = 0, currentMode = null, wasActive = true, disposed = false;
  const launchedKinds = new Set();
  function pointOnActor(actor, x, y, z, out) {
    actor.bear.updateMatrix(); actor.island.group.updateMatrix();
    out.set(x, y, z).applyMatrix4(actor.bear.matrix).applyMatrix4(actor.island.group.matrix);
    return out;
  }
  function resetPose(actor, blend) {
    const { bear, rig } = actor; if (!rig) return;
    bear.position.y = actor.baseY; bear.rotation.set(0, actor.baseYaw, 0); actor.targetYaw = actor.baseYaw;
    rig.leftArm.rotation.set(0, 0, -.25); rig.rightArm.rotation.set(0, 0, .34);
    rig.leftLeg.rotation.set(0, 0, 0); rig.rightLeg.rotation.set(0, 0, 0);
    rig.head.rotation.set(-.18 + .215 * blend, 0, -.055 + .080 * blend);
    actor.actionAge = 9; actor.reactionAge = 9; actor.bubble.visible = false;
  }
  function clearEffects() { for (const effect of pool) { effect.active = false; effect.group.visible = false; effect.impact.visible = false; } }
  function beginExchange(effect, affectionate) {
    if (actors.length < 2) return;
    const source = actors[sourceCursor++ % actors.length];
    const target = source.neighbors[(Math.floor(sourceCursor / actors.length) + source.index) % source.neighbors.length];
    source.lastTarget = target.index;
    pointOnActor(source, 0, 1.7, 0, offset); pointOnActor(target, 0, 1.7, 0, targetOffset);
    source.targetYaw = Math.atan2(targetOffset.x - offset.x, targetOffset.z - offset.z);
    target.targetYaw = Math.atan2(offset.x - targetOffset.x, offset.z - targetOffset.z);
    effect.kind = affectionate ? (sendCount % 2 ? 'kiss' : 'heart') : ['paper', 'money', 'ink'][sendCount % 3];
    source.actionAge = 0; source.actionKind = effect.kind;
    effect.source = source; effect.target = target; effect.age = 0; effect.hit = false; effect.active = true;
    // Release comes after the visible wind-up, when the source has turned toward its neighbor.
    effect.group.visible = false; effect.impact.visible = false;
    effect.paper.visible = effect.kind === 'paper'; effect.money.visible = effect.kind === 'money'; effect.ink.visible = effect.kind === 'ink';
    effect.heart.visible = effect.kind === 'heart'; effect.kiss.visible = effect.kind === 'kiss';
    effect.duration = 1.55 + Math.min(1, offset.distanceTo(targetOffset) * .055);
    effect.arc = 1.65 + Math.min(1.6, offset.distanceTo(targetOffset) * .13);
    sendCount++; launchedKinds.add(effect.kind);
  }
  function animateActor(actor, dt, affectionate, blend) {
    const { bear, rig, phase } = actor; if (!rig) return;
    actor.actionAge += dt; actor.reactionAge += dt;
    const idle = Math.sin(socialTime * (affectionate ? 2.3 : 3.3) + phase);
    const sway = Math.sin(socialTime * 1.8 + phase);
    const yawDelta = Math.atan2(Math.sin(actor.targetYaw - bear.rotation.y), Math.cos(actor.targetYaw - bear.rotation.y));
    bear.rotation.y += yawDelta * Math.min(1, dt * 6);
    bear.position.y = actor.baseY + Math.abs(idle) * (affectionate ? .055 : .072);
    bear.rotation.x = affectionate ? -.025 + sway * .025 : .055 + idle * .035;
    bear.rotation.z = sway * (affectionate ? .055 : .075);
    rig.head.rotation.set(-.18 + .215 * blend + idle * .025, Math.sin(socialTime * 2.1 + phase) * .08, -.055 + .080 * blend - sway * .065);
    rig.leftLeg.rotation.x = idle * .065; rig.rightLeg.rotation.x = -idle * .065;
    if (affectionate) {
      rig.leftArm.rotation.set(-.22 + idle * .15, .08, -.95 - Math.sin(socialTime * 4 + phase) * .20);
      rig.rightArm.rotation.set(-.18 - idle * .15, -.08, .97 + Math.sin(socialTime * 4 + phase + 1) * .20);
    } else {
      rig.leftArm.rotation.set(-.52 + idle * .20, -.12, -.65 - idle * .18);
      rig.rightArm.rotation.set(-.60 - idle * .22, .08, .75 + idle * .20);
    }
    if (actor.actionAge < 1.15) {
      const t = actor.actionAge;
      if (affectionate) {
        const kiss = actor.actionKind === 'kiss';
        rig.rightArm.rotation.set(kiss ? -1.35 + Math.min(1, t * 1.3) * .8 : -.6, kiss ? -.7 * Math.max(0, 1 - t * 2) : -.15, 1.20 + Math.sin(t * 6) * .25);
        rig.head.rotation.x += Math.sin(Math.min(1, t) * Math.PI) * .08;
      } else {
        const wind = Math.max(0, 1 - t / .32), release = Math.max(0, 1 - Math.abs(t - .45) / .55);
        rig.rightArm.rotation.set(-.7 - release * 1.8 + wind * 1.6, -.10, .8 + wind * .65);
        rig.leftArm.rotation.z = -.85 - release * .3; bear.rotation.x += release * .12;
      }
    }
    if (actor.reactionAge < .65) {
      const recoil = Math.sin(actor.reactionAge / .65 * Math.PI);
      bear.rotation.x -= recoil * (affectionate ? .12 : .28); rig.leftArm.rotation.z -= recoil * .5; rig.rightArm.rotation.z += recoil * .5;
      bear.position.y += recoil * .08;
    }
    actor.bubble.material = affectionate ? warmBubble : angryBubble;
    actor.bubble.visible = actor.actionAge < 1.1 || actor.reactionAge < .8 || Math.sin(socialTime * 1.25 + phase) > .91;
    pointOnActor(actor, 0, 3.95, 0, actor.center); actor.bubble.position.copy(actor.center);
    actor.bubble.scale.setScalar(.82 + Math.sin(socialTime * 5 + phase) * .045);
  }
  function animateEffect(effect, dt) {
    if (!effect.active) return;
    const previous = effect.age; effect.age += dt;
    if (effect.age < .30) return;
    if (previous < .30) {
      pointOnActor(effect.source, .8, 1.95, .20, effect.start);
      pointOnActor(effect.target, 0, 1.9, .22, effect.end);
      effect.direction.copy(effect.end).sub(effect.start); effect.group.visible = true;
    }
    const t = Math.min(1, (effect.age - .30) / effect.duration);
    if (t < 1) {
      effect.group.position.lerpVectors(effect.start, effect.end, t);
      effect.group.position.y += Math.sin(t * Math.PI) * effect.arc;
      effect.group.scale.setScalar(.92 + Math.sin(t * Math.PI) * .18);
      if (effect.kind === 'paper') effect.group.rotation.set(t * 12, t * 9, t * 6);
      else if (effect.kind === 'money') effect.group.rotation.set(-.5 + Math.sin(t * 13) * .8, t * 6, Math.sin(t * 9) * .45);
      else if (effect.kind === 'ink') effect.group.rotation.set(-.25, Math.atan2(effect.direction.x, effect.direction.z), Math.sin(t * 8) * .2);
      else effect.group.rotation.set(-.15, Math.sin(t * Math.PI * 2) * .55, Math.sin(t * 9) * .18);
    } else {
      if (!effect.hit) {
        effect.hit = true; effect.group.visible = false; effect.impact.visible = true;
        effect.impact.position.copy(effect.end); effect.target.reactionAge = 0;
        if (effect.kind === 'ink') effect.impact.position.y = effect.target.island.group.position.y + effect.target.island.group.scale.y * .24;
        for (let j = 0; j < 8; j++) { effect.sparks[j].visible = effect.kind !== 'ink'; effect.spatters[j].visible = effect.kind === 'ink'; }
      }
      const impactTime = (effect.age - .30 - effect.duration) / .72;
      if (impactTime >= 1) { effect.active = false; effect.impact.visible = false; return; }
      for (let j = 0; j < 8; j++) {
        const angle = j * Math.PI / 4, radius = .10 + impactTime * (.66 + j % 2 * .24);
        if (effect.kind === 'ink') {
          const spatter = effect.spatters[j]; spatter.position.set(Math.cos(angle) * radius, .025 + Math.sin(impactTime * Math.PI) * .12, Math.sin(angle) * radius);
          const fade = 1 - impactTime * .75; spatter.scale.set((.16 + j % 3 * .035) * fade, .035 * fade, (.11 + j % 2 * .06) * fade);
        } else {
          const spark = effect.sparks[j]; spark.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(j * 3) * .15); spark.rotation.z = angle + impactTime * 3; spark.scale.setScalar((1 - impactTime) * 1.5);
        }
      }
    }
  }
  function diagnostics() {
    let count = 0; for (const effect of pool) if (effect.active) count++;
    container.dataset.islandActivity = currentMode ? 'affection' : 'quarrel';
    container.dataset.activeProjectiles = String(count); container.dataset.socialTime = socialTime.toFixed(3);
    container.dataset.interactionsSent = String(sendCount); container.dataset.interactionKinds = [...launchedKinds].join(',');
    const first = actors[0]; container.dataset.firstBearPose = first ? `${first.bear.rotation.y.toFixed(3)},${first.rig?.rightArm.rotation.x.toFixed(3)},${first.bear.position.y.toFixed(3)}` : '';
  }
  return {
    update({ dt = 0, paused = false, mode = 'xray', blend = 0, active = true } = {}) {
      if (disposed) return;
      const affectionate = mode === 'mask' || mode === 'deep-fake' || mode === 1 || mode === true;
      if (currentMode !== affectionate) {
        currentMode = affectionate; clearEffects(); for (const actor of actors) resetPose(actor, blend); nextSend = socialTime + .45;
      }
      if (!active && wasActive) { clearEffects(); for (const actor of actors) resetPose(actor, blend); }
      if (active && !wasActive) nextSend = socialTime + .45;
      wasActive = active;
      if (reduceMotion) { clearEffects(); for (const actor of actors) resetPose(actor, blend); diagnostics(); return; }
      if (paused || !active) { diagnostics(); return; }
      const step = Math.min(Math.max(dt, 0), .05); socialTime += step;
      for (const actor of actors) animateActor(actor, step, affectionate, blend);
      for (const effect of pool) animateEffect(effect, step);
      if (socialTime >= nextSend && actors.length > 1) {
        const free = pool.find(effect => !effect.active);
        if (free) { beginExchange(free, affectionate); nextSend = socialTime + (mobile ? 1.16 : .93); }
        else nextSend = socialTime + .15;
      }
      diagnostics();
    },
    destroy() {
      if (disposed) return; disposed = true; clearEffects(); layer.removeFromParent();
      // Scene owns registered geometry, material and texture disposal.
    },
  };
}
