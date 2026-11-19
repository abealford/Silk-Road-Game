// ============================================================
//  v20: THIRD-PERSON VIEW on the road (V), and the player's body
// ============================================================
// On the road, V switches between first person and a camera behind Matteo. Inside a city's walls,
// at sea and in Combat Practice the view is always first person. The choice is remembered.
(() => {
  const H = window.HOOKS;
  const KEY = 'silkroad_view_v1';
  let want3p = false; try { want3p = localStorage.getItem(KEY) === '3p'; } catch (e) { }
  let blend = 0; // 0 = first person, 1 = third person
  let avatar = null, rider = null, mount = null, mountKind = null, lastX = 0, lastZ = 0, faceYaw = 0, camD = 4.6;
  const V = new THREE.Vector3();

  function build(kind) {
    const kit = H.lifeKit; if (!kit || !kit.makePerson) return;
    if (avatar) H.scene.remove(avatar);
    avatar = new THREE.Group(); mount = null; rider = kit.makePerson('byz', 'rich', 0);
    if (kind && kind !== 'foot' && kit.AN[kind]) {
      mount = kit.makeAnimal(kind, false, 99); avatar.add(mount);
      const a = kit.AN[kind]; rider.position.y = a.leg + a.bh * (kind === 'camel' ? 1.05 : .78) - .55; rider.position.z = kind === 'camel' ? -.15 : -.05;
      for (const l of rider.userData.legs) { l.rotation.x = -1.2; }
    }
    avatar.add(rider); avatar.traverse(o => { if (o.isMesh) o.castShadow = true; });
    H.scene.add(avatar); mountKind = kind || 'foot';
  }
  function mountNow() { const S = H.J && H.J.MODE === 'journey' ? H.J.S : null; return S ? S.mount : 'foot'; }
  // third person is allowed on the road only
  function allowed3p() {
    if (window.__combatOn) return false;
    if (H.getCity && H.getCity()) return false;
    if (H.J && H.J.voy) return false;
    if (H.isMapOpen && H.isMapOpen()) return false;
    return true;
  }
  H.toggleView = () => {
    want3p = !want3p; try { localStorage.setItem(KEY, want3p ? '3p' : '1p'); } catch (e) { }
    const inCity = H.getCity && H.getCity();
    H.showToast('View', want3p ? (inCity ? 'Third person on the road. Inside the walls you stay in first person.' : 'Third person. Press V again for first person.') : 'First person. Press V for the view from behind.', 'Camera');
  };
  H.viewFrame = (dt) => {
    const p = H.player, cam = H.camera; if (!p || !cam || !H.W) return;
    const target = want3p && allowed3p() ? 1 : 0;
    blend += (target - blend) * (1 - Math.exp(-(dt || 0.016) * 6)); if (Math.abs(target - blend) < 0.002) blend = target;
    const W = H.W; const ground = W.walkHeight(p.x, p.z);
    const mk = mountNow();
    if (blend > 0.001 && (!avatar || mk !== mountKind)) build(mk);
    if (!avatar) return;
    avatar.visible = blend > 0.15;
    if (!avatar.visible) { lastX = p.x; lastZ = p.z; return; }
    // body: faces where it walks, or where you look when standing
    const mvx = p.x - lastX, mvz = p.z - lastZ, md = Math.hypot(mvx, mvz); lastX = p.x; lastZ = p.z;
    const want = md > 0.002 && md < 5 ? Math.atan2(-mvx, -mvz) : (p.moving ? faceYaw : p.yaw);
    let dy = want - faceYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); faceYaw += dy * Math.min(1, (dt || .016) * 10);
    avatar.position.set(p.x, ground + (p.jy || 0) - .02, p.z); avatar.rotation.y = faceYaw + Math.PI;
    const sp = md > 0.002 && md < 5 && dt > 0 ? md / dt : 0;
    if (H.lifeKit.animate) { if (mount) H.lifeKit.animate(mount, Math.min(4, sp * .6), dt || 0); else H.lifeKit.animate(rider, Math.min(4, sp * .55), dt || 0); }
    // camera: behind and a little above the shoulder, kept above the ground
    const eye = p.y - ground - (p.jy || 0); const mounted = mount ? 1 : 0; const pivotY = ground + (p.jy || 0) + Math.max(1.75, eye + .15 + mounted * .5); camD = mounted ? 6.4 : 4.6;
    const cp = Math.cos(p.pitch), fx = -Math.sin(p.yaw) * cp, fy = Math.sin(p.pitch), fz = -Math.cos(p.yaw) * cp;
    const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    let d = camD; let cx, cy, cz;
    for (let k = 0; k < 6; k++) { cx = p.x - fx * d + rx * .55; cy = pivotY - fy * d + .55; cz = p.z - fz * d + rz * .55; const gh = W.walkHeight(cx, cz) + .45; if (cy >= gh) break; if (k === 5) cy = gh; else d *= .75; }
    V.set(cx, cy, cz);
    cam.position.lerp(V, blend);
  };
  window.__view = { set: v => { want3p = !!v; }, state: () => ({ want3p, blend, avatar: !!(avatar && avatar.visible), mount: mountKind, allowed: allowed3p() }) };
})();
