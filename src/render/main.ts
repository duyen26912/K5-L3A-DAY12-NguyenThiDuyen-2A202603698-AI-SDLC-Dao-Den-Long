// Phần hiển thị: Three.js chỉ ĐỌC trạng thái từ core để vẽ. Mọi luật chơi nằm trong src/core.
import * as THREE from 'three';
import { createWorld, step, World, InputState, GameEvent, timeLeft } from '../core/world';
import { TUNING, DT, ISLAND_RADIUS } from '../core/config';
import { Sfx } from './sfx';
import { makeLanternModel, LanternModel, LANTERN_TOP_Y } from './lantern';

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const NIGHT = new THREE.Color('#1a1033');
const DAWNISH = new THREE.Color('#3a2a4a');
scene.background = NIGHT.clone();
scene.fog = new THREE.Fog(NIGHT.clone(), 25, 85);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);

const hemi = new THREE.HemisphereLight('#9a8be0', '#2a1a3e', 0.8);
scene.add(hemi);
const moon = new THREE.DirectionalLight('#b8a8ff', 0.6);
moon.position.set(-30, 50, -20);
moon.castShadow = true;
scene.add(moon);

// Đảo tròn + biển mây
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 3, 4, 64),
  new THREE.MeshStandardMaterial({ color: '#4f6148', roughness: 1 }),
);
island.position.y = -2;
island.receiveShadow = true;
scene.add(island);
const beach = new THREE.Mesh(new THREE.RingGeometry(ISLAND_RADIUS - 2.5, ISLAND_RADIUS, 64), new THREE.MeshStandardMaterial({ color: '#8c7a5a' }));
beach.rotation.x = -Math.PI / 2;
beach.position.y = 0.01;
scene.add(beach);
const clouds = new THREE.Mesh(new THREE.CircleGeometry(220, 48), new THREE.MeshStandardMaterial({ color: '#2b2350', roughness: 1 }));
clouds.rotation.x = -Math.PI / 2;
clouds.position.y = -3;
scene.add(clouds);
// vài bụi cây trang trí (cố định, không ảnh hưởng gameplay)
const bushMat = new THREE.MeshStandardMaterial({ color: '#2f3f2c' });
for (let i = 0; i < 40; i++) {
  const a = i * 2.39996;
  const r = 8 + ((i * 37) % 29);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.6 + (i % 3) * 0.3, 8, 6), bushMat);
  b.position.set(Math.sin(a) * r, 0.3, Math.cos(a) * r);
  b.castShadow = true;
  scene.add(b);
}

// ---------- Nhân vật Mây ----------
function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 6, 12), new THREE.MeshStandardMaterial({ color: '#c94f3d' }));
  body.position.y = 0.75;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ color: '#f1c9a0' }));
  head.position.y = 1.45;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.38, 24), new THREE.MeshStandardMaterial({ color: '#d9b56a' }));
  hat.position.y = 1.78;
  hat.castShadow = true;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
  lamp.position.set(0.55, 1.45, 0.2);
  const lampLight = new THREE.PointLight('#ffb347', 6, 9, 1.6);
  lampLight.position.copy(lamp.position);
  g.add(body, head, hat, lamp, lampLight);
  return { g, lampLight, body };
}
const player = makePlayer();
scene.add(player.g);

// ---------- Đèn Lồng Lớn ----------
interface LanternView { group: THREE.Group; model: LanternModel; bar: THREE.Mesh; flies: THREE.Mesh[] }
const lanternViews = new Map<string, LanternView>();
function makeLantern(): LanternView {
  const model = makeLanternModel(TUNING.safe_radius);
  const group = model.group;
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.15, TUNING.safe_radius, 48), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.name = 'safe';
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.14), new THREE.MeshBasicMaterial({ color: '#ffc46b' }));
  bar.position.y = LANTERN_TOP_Y + 0.4;
  group.add(ring, bar);
  const flies: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff0a0' }));
    f.visible = false;
    group.add(f);
    flies.push(f);
  }
  scene.add(group);
  return { group, model, bar, flies };
}

// ---------- Đom đóm & Bóng Mực ----------
const moteGeo = new THREE.SphereGeometry(0.2, 10, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: '#ffe27a' });
const moteViews = new Map<string, THREE.Mesh>();
const shadeViews = new Map<string, THREE.Group>();
function makeShade() {
  const g = new THREE.Group();
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshStandardMaterial({ color: '#2a0f45', emissive: '#3b0f6b', emissiveIntensity: 0.6, transparent: true, opacity: 0.92 }));
  blob.name = 'blob';
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#d9b3ff' });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
    eye.position.set(0.25 * s, 0.15, 0.65);
    g.add(eye);
  }
  g.add(blob);
  scene.add(g);
  return g;
}

// Hiệu ứng tỏa sáng
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffd38a', transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseT = 1;

// ---------- Input ----------
// Di chuyển: phím mũi tên (WASD dùng thay thế được). Xoay camera: giữ chuột và kéo.
const keys = new Set<string>(); // phím đang giữ
const tapped = new Set<string>(); // phím đã nhấn kể từ tick trước (để lần nhấn rất nhanh không bị mất)
let camYaw = 0;
let dragging = false;
let lastX = 0;
const sfx = new Sfx();
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ']);
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  tapped.add(e.code);
  sfx.unlock();
  if (e.code === 'KeyR') restart();
  if (e.code === 'KeyM') sfx.toggle();
  if (GAME_KEYS.has(e.code)) e.preventDefault(); // không cuộn trang khi bấm mũi tên/Space
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); dragging = false; });
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  lastX = e.clientX;
  sfx.unlock();
  window.focus();
});
window.addEventListener('mouseup', () => (dragging = false));
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.3; // kéo sang phải → quay nhìn sang phải
  lastX = e.clientX;
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

const down = (...codes: string[]) => codes.some((c) => keys.has(c) || tapped.has(c));

function readInput(): InputState {
  // Ánh xạ sang Test Contract: move [x, z] trong hệ camera; z = tiến. Màn hình phải = x âm (xem README).
  const z = (down('ArrowUp', 'KeyW') ? 1 : 0) - (down('ArrowDown', 'KeyS') ? 1 : 0);
  const x = (down('ArrowLeft', 'KeyA') ? 1 : 0) - (down('ArrowRight', 'KeyD') ? 1 : 0);
  return {
    move: [x, z],
    camYawDeg: camYaw,
    jump: down('Space'),
    interact: down('KeyE'),
    pulse: down('KeyQ'),
    dash: false,
  };
}

/** Input cho một tick mô phỏng; sau đó xóa các lần nhấn nhanh đã được tính. */
function consumeInput(): InputState {
  const inp = readInput();
  tapped.clear();
  return inp;
}

// ---------- Game loop ----------
const params = new URLSearchParams(location.search);
let seed = Number(params.get('seed') ?? Math.floor(Math.random() * 1e9));
let world: World;
let hurtUntil = 0;

function restart() {
  if (world) seed = Math.floor(Math.random() * 1e9);
  world = createWorld(seed, 1);
  for (const v of moteViews.values()) scene.remove(v);
  moteViews.clear();
  for (const v of shadeViews.values()) scene.remove(v);
  shadeViews.clear();
  for (const v of lanternViews.values()) scene.remove(v.group);
  lanternViews.clear();
  for (const l of world.lanterns) {
    const v = makeLantern();
    v.group.position.set(l.pos[0], 0, l.pos[2]);
    lanternViews.set(l.id, v);
  }
  (document.getElementById('h-seed') as HTMLElement).textContent = String(seed);
  (document.getElementById('overlay') as HTMLElement).style.display = 'none';
}
restart();

function onEvents(evts: GameEvent[]) {
  for (const e of evts) {
    if (e.name === 'mote_picked') sfx.pick();
    if (e.name === 'deposit') sfx.deposit();
    if (e.name === 'lantern_lit') sfx.lit();
    if (e.name === 'pulse') { pulseT = 0; sfx.pulse(); }
    if (e.name === 'player_hit') { hurtUntil = performance.now() + 400; sfx.hit(); }
    if (e.name === 'game_over') {
      const won = e.data.result === 'won';
      won ? sfx.win() : sfx.lose();
      const reason = e.data.reason === 'dawn' ? 'Trời đã sáng mà đảo chưa kịp thắp hết đèn.' : e.data.reason === 'no_flames' ? 'Ngọn lửa của Mây đã tắt.' : 'Đảo Bến đã sáng trở lại!';
      (document.getElementById('o-title') as HTMLElement).textContent = won ? 'Chiến thắng!' : 'Thua rồi…';
      (document.getElementById('o-sub') as HTMLElement).textContent = `${reason} Điểm: ${world.score}`;
      (document.getElementById('overlay') as HTMLElement).style.display = 'flex';
    }
  }
}

let acc = 0;
let last = performance.now();
function frame(now: number) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dtReal;
  while (acc >= DT) {
    onEvents(step(world, consumeInput()));
    acc -= DT;
  }
  draw(now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

const tmp = new THREE.Vector3();
function draw(t: number) {
  const p = world.player;
  player.g.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const mv = readInput().move;
  if (mv[0] !== 0 || mv[1] !== 0) {
    const th = (camYaw * Math.PI) / 180;
    const dx = mv[0] * Math.cos(th) + mv[1] * Math.sin(th);
    const dz = -mv[0] * Math.sin(th) + mv[1] * Math.cos(th);
    player.g.rotation.y = Math.atan2(dx, dz);
  }
  const blink = p.invulnTicks > 0 && Math.floor(t * 12) % 2 === 0;
  player.body.visible = !blink;
  player.lampLight.intensity = 3 + p.carried * 1.2;

  // camera góc nhìn thứ ba, phía sau theo hướng yaw
  const th = (camYaw * Math.PI) / 180;
  const fx = Math.sin(th);
  const fz = Math.cos(th);
  tmp.set(p.pos[0] - fx * 9, p.pos[1] + 5.5, p.pos[2] - fz * 9);
  camera.position.lerp(tmp, 0.2);
  camera.lookAt(p.pos[0], p.pos[1] + 1.4, p.pos[2]);

  // đèn
  let litCount = 0;
  for (const l of world.lanterns) {
    const v = lanternViews.get(l.id)!;
    const frac = l.deposited / TUNING.lantern_cost;
    v.model.update(frac, l.lit, t + l.pos[0]);
    v.bar.scale.x = Math.max(0.001, frac);
    v.bar.visible = !l.lit;
    v.bar.lookAt(camera.position.x, v.bar.getWorldPosition(tmp).y, camera.position.z);
    const ring = v.group.getObjectByName('safe') as THREE.Mesh;
    (ring.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.35 : 0;
    if (l.lit) litCount++;
    // Sáng tạo (chỉ hiển thị): đom đóm bay quanh đèn đã thắp
    v.flies.forEach((f, i) => {
      f.visible = l.lit;
      if (!l.lit) return;
      const a = t * (0.8 + i * 0.13) + i;
      f.position.set(Math.sin(a) * (1.2 + (i % 3) * 0.4), 2.6 + Math.sin(t * 2 + i) * 0.8, Math.cos(a) * (1.2 + (i % 3) * 0.4));
    });
  }
  // Đảo sáng dần lên khi thắp đèn
  const k = litCount / world.lanterns.length;
  hemi.intensity = 0.8 + k * 1.0;
  (scene.background as THREE.Color).copy(NIGHT).lerp(DAWNISH, k);
  scene.fog!.color.copy(scene.background as THREE.Color);

  // đom đóm
  const alive = new Set<string>();
  for (const m of world.motes) {
    alive.add(m.id);
    let v = moteViews.get(m.id);
    if (!v) {
      v = new THREE.Mesh(moteGeo, moteMat);
      scene.add(v);
      moteViews.set(m.id, v);
    }
    const ph = (m.id.length * 7 + Number(m.id.slice(1))) * 0.7;
    v.position.set(m.pos[0], 0.7 + Math.sin(t * 2.5 + ph) * 0.25, m.pos[2]);
    v.scale.setScalar(0.8 + Math.sin(t * 6 + ph) * 0.25);
  }
  for (const [id, v] of moteViews) if (!alive.has(id)) { scene.remove(v); moteViews.delete(id); }

  // Bóng Mực
  const aliveS = new Set<string>();
  for (const s of world.shades) {
    aliveS.add(s.id);
    let v = shadeViews.get(s.id);
    if (!v) { v = makeShade(); shadeViews.set(s.id, v); }
    v.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.pos[0]) * 0.12, s.pos[2]);
    v.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    const blob = v.getObjectByName('blob') as THREE.Mesh;
    const bm = blob.material as THREE.MeshStandardMaterial;
    bm.emissive.set(s.state === 'stunned' ? '#8a6bc9' : '#3b0f6b');
    v.scale.setScalar(s.state === 'stunned' ? 0.75 : 1 + Math.sin(t * 5) * 0.05);
  }
  for (const [id, v] of shadeViews) if (!aliveS.has(id)) { scene.remove(v); shadeViews.delete(id); }

  // vòng tỏa sáng
  if (pulseT < 1) {
    pulseT += 1 / 30;
    pulseRing.position.set(p.pos[0], 0.1, p.pos[2]);
    pulseRing.scale.setScalar(TUNING.pulse_radius * pulseT);
    (pulseRing.material as THREE.MeshBasicMaterial).opacity = 1 - pulseT;
  } else (pulseRing.material as THREE.MeshBasicMaterial).opacity = 0;

  updateHud(litCount);
}

function updateHud(litCount: number) {
  const p = world.player;
  const set = (id: string, v: string) => ((document.getElementById(id) as HTMLElement).textContent = v);
  set('h-lit', `${litCount}/${world.lanterns.length}`);
  set('h-flames', '♥'.repeat(Math.max(0, p.flames)) + '♡'.repeat(Math.max(0, TUNING.flames - p.flames)));
  set('h-carried', `${p.carried}/${TUNING.carry_capacity}`);
  set('h-time', Math.max(0, timeLeft(world)).toFixed(0));
  set('h-score', String(world.score));
  set('h-pulse', p.pulseCooldownTicks > 0 ? `${(p.pulseCooldownTicks / 60).toFixed(1)}s` : p.carried >= TUNING.pulse_cost ? 'sẵn sàng (Q)' : `cần ${TUNING.pulse_cost} đom đóm`);

  // la bàn tới đèn chưa thắp gần nhất (sáng tạo, chỉ hiển thị)
  const target = world.lanterns.filter((l) => !l.lit)
    .sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
  const compass = document.getElementById('compass') as HTMLElement;
  let hint = '';
  if (target && world.state === 'playing') {
    compass.style.display = 'block';
    const ang = Math.atan2(target.pos[0] - p.pos[0], target.pos[2] - p.pos[2]);
    const rel = ang - (camYaw * Math.PI) / 180;
    compass.style.transform = `translateX(-50%) rotate(${-rel}rad)`;
    const d = Math.hypot(target.pos[0] - p.pos[0], target.pos[2] - p.pos[2]);
    if (d <= TUNING.interact_radius) hint = p.carried > 0 ? `Nhấn E để nạp ánh sáng vào ${target.id} (${target.deposited}/${TUNING.lantern_cost})` : `${target.id} cần ${TUNING.lantern_cost - target.deposited} đom đóm nữa`;
    else if (p.carried >= TUNING.carry_capacity) hint = 'Đã mang đầy đom đóm, mang về đèn!';
  } else compass.style.display = 'none';
  set('hint', hint);
  (document.getElementById('hurt') as HTMLElement).style.boxShadow = performance.now() < hurtUntil
    ? 'inset 0 0 120px 40px rgba(120, 40, 200, 0.55)' : 'inset 0 0 120px 40px rgba(120, 40, 200, 0)';
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
// cho phép kiểm tra trong trình duyệt (debug/bằng chứng)
(window as unknown as { __game: () => World }).__game = () => world;
requestAnimationFrame(frame);
