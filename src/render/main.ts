// Phần hiển thị: Three.js chỉ ĐỌC trạng thái từ core để vẽ. Mọi luật chơi nằm trong src/core.
import * as THREE from 'three';
import { createWorld, step, World, InputState, GameEvent, timeLeft, neutralInput } from '../core/world';
import { TUNING, DT } from '../core/config';
import { MAPS } from '../core/maps';
import { Sfx } from './sfx';
import { makeLanternModel, LanternModel, LANTERN_TOP_Y } from './lantern';
import { buildMap, MapView } from './mapview';
import { PAL } from './palette';
import { makeMay, makeMote as makeMoteModel, makeShadeModel, makeDrifterModel, makeCharmModel, makePickupBurst } from './actors';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.Fog(PAL.fog, 30, 120);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
const hemi = new THREE.HemisphereLight('#9fb0ff', PAL.grass, 0.15);
scene.add(hemi);
const moon = new THREE.DirectionalLight('#b8c4ff', 0.6);
moon.position.set(-30, 50, -20);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
Object.assign(moon.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60 });
scene.add(moon, moon.target);

// ---------- Mô hình ----------
// Mô hình các vật gắn với luật chơi: src/render/actors.ts (hàm animate lưu trong userData)
type Anim = { group: THREE.Group; animate: (...args: any[]) => void };
const withAnim = (m: Anim) => { m.group.userData.animate = m.animate; return m.group; };
const anim = (v: THREE.Object3D, ...args: unknown[]) => (v.userData.animate as (...a: unknown[]) => void)?.(...args);
const player = makeMay();
scene.add(player.g);
// lóe sáng mỗi lần nhặt đom đóm (chỉ hiển thị)
const burst = makePickupBurst();
scene.add(burst.group);
let flashT = 0;
const makeShade = () => withAnim(makeShadeModel());
const makeDrifter = () => withAnim(makeDrifterModel());
const makeCharm = () => withAnim(makeCharmModel());
const makeMote = () => withAnim(makeMoteModel());

// lá bay báo gió (Đêm 3)
const LEAVES = 60;
const leafGeo = new THREE.PlaneGeometry(0.18, 0.1);
const leafMat = new THREE.MeshBasicMaterial({ color: '#7fa65a', side: THREE.DoubleSide, transparent: true, opacity: 0 });
const leaves = new THREE.InstancedMesh(leafGeo, leafMat, LEAVES);
scene.add(leaves);

const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffd38a', transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseT = 1;

// ---------- Cài đặt (lưu giữa các lần mở game) ----------
const SETTINGS_KEY = 'dao-den-long-settings';
const settings = { volume: 0.7, sensitivity: 0.3 };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')); } catch { /* bỏ qua */ }
const sfx = new Sfx();
sfx.setVolume(settings.volume);
const vol = $('set-vol') as HTMLInputElement;
const sens = $('set-sens') as HTMLInputElement;
const syncSettingsUI = () => {
  vol.value = String(settings.volume);
  sens.value = String(settings.sensitivity);
  $('set-vol-v').textContent = `${Math.round(settings.volume * 100)}%`;
  $('set-sens-v').textContent = settings.sensitivity.toFixed(2);
};
const saveSettings = () => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  sfx.setVolume(settings.volume);
  syncSettingsUI();
};
vol.addEventListener('input', () => { settings.volume = Number(vol.value); saveSettings(); });
sens.addEventListener('input', () => { settings.sensitivity = Number(sens.value); saveSettings(); });
syncSettingsUI();

// ---------- Input ----------
const keys = new Set<string>();
const tapped = new Set<string>();
let camYaw = 0;
let dragging = false;
let lastX = 0;
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'ShiftLeft', 'ShiftRight']);
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  if (e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) return;
  keys.add(e.code);
  tapped.add(e.code);
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (flow === 'intro' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); startNight(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); dragging = false; });
renderer.domElement.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; sfx.unlock(); });
window.addEventListener('mouseup', () => (dragging = false));
window.addEventListener('mousemove', (e) => {
  if (!dragging || flow !== 'playing' || world.paused) return;
  camYaw -= (e.clientX - lastX) * settings.sensitivity;
  lastX = e.clientX;
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

const down = (...codes: string[]) => codes.some((c) => keys.has(c) || tapped.has(c));
function readInput(): InputState {
  // move [x, z] trong hệ camera; z = tiến; màn hình phải = x âm (xem README)
  const z = (down('ArrowUp', 'KeyW') ? 1 : 0) - (down('ArrowDown', 'KeyS') ? 1 : 0);
  const x = (down('ArrowLeft', 'KeyA') ? 1 : 0) - (down('ArrowRight', 'KeyD') ? 1 : 0);
  return {
    move: [x, z], camYawDeg: camYaw, jump: down('Space'), interact: down('KeyE'), pulse: down('KeyQ'),
    dash: down('ShiftLeft', 'ShiftRight'), pause: down('Escape', 'KeyP', 'PauseBtn'),
  };
}

// ---------- Chuỗi 3 Đêm ----------
type Flow = 'menu' | 'intro' | 'playing' | 'result' | 'dawn';
let flow: Flow = 'menu';
let night = 1;
let totalScore = 0;
let world: World = createWorld(1, 1);
let mapView: MapView | null = null;
let settingsReturn = 's-menu';
let lastCountdown = -1;
let hurtUntil = 0;
const seedParam = new URLSearchParams(location.search).get('seed');

const QUOTES: Record<number, string> = {
  1: 'Ông Đăng: "Sương đen nuốt ánh sáng Đảo Bến rồi, Mây ơi. Gom đom đóm, thắp lại năm ngọn đèn trước khi gà gáy nhé."',
  2: 'Ông Đăng: "Đảo Cau có hai hòn nối bằng cầu tre. Coi chừng Gió Lạc — nó thích giật đom đóm của người mang nặng."',
  3: 'Ông Đăng: "Đêm cuối ở Đảo Chuông. Gió mạnh lắm, đường lên tháp chuông phải nhờ dốc và bục nhảy. Cố lên con!"',
};

function show(id: string | null) {
  for (const s of ['s-menu', 's-intro', 's-result', 's-pause', 's-settings']) $(s).classList.toggle('show', s === id);
}

const lanternViews = new Map<string, { model: LanternModel; bar: THREE.Mesh; ring: THREE.Mesh }>();
const moteViews = new Map<string, THREE.Group>();
const shadeViews = new Map<string, THREE.Group>();
const drifterViews = new Map<string, THREE.Group>();
const charmViews = new Map<string, THREE.Group>();

function clearViews() {
  for (const m of [moteViews, shadeViews, drifterViews, charmViews]) {
    for (const v of m.values()) scene.remove(v);
    m.clear();
  }
  for (const v of lanternViews.values()) scene.remove(v.model.group);
  lanternViews.clear();
  if (mapView) scene.remove(mapView.group);
}

function loadNight(n: number) {
  night = n;
  clearViews();
  const seed = seedParam !== null ? Number(seedParam) : Math.floor(Math.random() * 1e9);
  world = createWorld(seed, n);
  mapView = buildMap(world.map);
  scene.add(mapView.group);
  for (const l of world.lanterns) {
    const model = makeLanternModel(TUNING.safe_radius);
    model.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
    const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 64), new THREE.MeshBasicMaterial({ color: PAL.lanternLit, transparent: true, opacity: 0 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.14), new THREE.MeshBasicMaterial({ color: PAL.gold }));
    bar.position.y = LANTERN_TOP_Y + 0.4;
    model.group.add(ring, bar);
    scene.add(model.group);
    lanternViews.set(l.id, { model, bar, ring });
  }
  camYaw = 0;
  lastCountdown = -1;
  keys.clear();
  tapped.clear();
  const map = MAPS[n];
  $('i-night').textContent = `Đêm ${n}`;
  $('i-name').textContent = map.name;
  $('i-quote').textContent = QUOTES[n];
  $('i-count').textContent = String(map.lanterns.length);
  $('i-time').textContent = `${map.durationS} giây`;
  flow = 'intro';
  show('s-intro');
}

function startNight() {
  sfx.unlock();
  sfx.startMusic();
  flow = 'playing';
  show(null);
  acc = 0;
}

function onEvents(evts: GameEvent[]) {
  for (const e of evts) {
    if (e.name === 'mote_picked') {
      sfx.pick();
      burst.play(new THREE.Vector3(world.player.pos[0], world.player.pos[1] + 1, world.player.pos[2]));
      flashT = 1;
    }
    if (e.name === 'deposit') sfx.deposit();
    if (e.name === 'lantern_lit') sfx.lit();
    if (e.name === 'pulse') { pulseT = 0; sfx.pulse(); }
    if (e.name === 'dash') sfx.dash();
    if (e.name === 'charm_picked') sfx.charm();
    if (e.name === 'drifter_steal') sfx.steal();
    if (e.name === 'shade_spawned') sfx.shadeSpawn();
    if (e.name === 'player_hit') { hurtUntil = performance.now() + 400; sfx.hit(); }
    if (e.name === 'paused') show('s-pause');
    if (e.name === 'resumed') show(null);
    if (e.name === 'game_over') endNight(e.data.result === 'won', String(e.data.reason));
  }
}

function endNight(won: boolean, reason: string) {
  sfx.stopMusic();
  won ? sfx.win() : sfx.lose();
  if (won) totalScore += world.score;
  if (won && night === 3) {
    flow = 'dawn';
    $('r-title').textContent = 'Bình Minh!';
    $('r-sub').innerHTML = `Ba hòn đảo đã sáng trở lại. Mặt trời lên trên biển mây.<br>Tổng điểm: <b>${totalScore}</b>`;
    setButtons([['Về menu', 'menu']]);
  } else {
    flow = 'result';
    const why = reason === 'dawn' ? 'Trời đã sáng mà đảo chưa kịp thắp hết đèn.' : reason === 'no_flames' ? 'Ngọn lửa của Mây đã tắt.' : `${MAPS[night].name} đã sáng trở lại!`;
    $('r-title').textContent = won ? `Đêm ${night} hoàn thành!` : `Đêm ${night} thất bại`;
    $('r-sub').innerHTML = `${why}<br>Điểm đêm này: <b>${won ? world.score : 0}</b> · Tổng: <b>${totalScore}</b>`;
    setButtons(won ? [[`Sang Đêm ${night + 1}`, 'next'], ['Về menu', 'menu']] : [['Chơi lại Đêm', 'restart'], ['Về menu', 'menu']]);
  }
  show('s-result');
}

function setButtons(list: [string, string][]) {
  const box = $('r-btns');
  box.innerHTML = '';
  for (const [label, act] of list) {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.act = act;
    box.appendChild(b);
  }
}

document.body.addEventListener('click', (e) => {
  const act = (e.target as HTMLElement).dataset?.act;
  if (!act) return;
  (e.target as HTMLElement).blur(); // tránh Enter/Space bấm lại nút vừa chọn
  sfx.unlock();
  if (act === 'start') { totalScore = 0; loadNight(1); }
  if (act.startsWith('night')) { totalScore = 0; loadNight(Number(act.slice(5))); }
  if (act === 'play') startNight();
  if (act === 'next') loadNight(night + 1);
  if (act === 'restart') {
    if (flow === 'playing') sfx.stopMusic();
    loadNight(night);
  }
  if (act === 'resume') tapped.add('PauseBtn');
  if (act === 'menu') { sfx.stopMusic(); flow = 'menu'; show('s-menu'); }
  if (act === 'settings') { settingsReturn = flow === 'playing' ? 's-pause' : 's-menu'; show('s-settings'); }
  if (act === 'settings-back') show(settingsReturn);
});

// ---------- Vòng lặp ----------
let acc = 0;
let last = performance.now();
// bộ đếm FPS (F3 hoặc ?fps=1) để tự đo yêu cầu ≥ 30 FPS ở 1280×720
let fpsOn = new URLSearchParams(location.search).has('fps');
let fpsFrames = 0;
let fpsT0 = performance.now();
window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') { e.preventDefault(); fpsOn = !fpsOn; }
  if (e.code === 'KeyH') $('help').classList.toggle('collapsed'); // ẩn / hiện bảng điều khiển
});
const tmp = new THREE.Vector3();
function frame(now: number) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (flow === 'playing') {
    acc += dtReal;
    while (acc >= DT && flow === 'playing') {
      const inp = readInput();
      tapped.clear();
      onEvents(step(world, inp));
      acc -= DT;
    }
  } else {
    tapped.clear();
  }
  draw(now / 1000, dtReal);
  renderer.render(scene, camera);
  fpsFrames++;
  if (now - fpsT0 >= 1000) {
    $('h-fps').style.display = fpsOn ? 'block' : 'none';
    $('h-fps').textContent = `${Math.round((fpsFrames * 1000) / (now - fpsT0))} FPS · ${window.innerWidth}×${window.innerHeight}`;
    fpsFrames = 0;
    fpsT0 = now;
  }
  requestAnimationFrame(frame);
}

function syncMap<T extends { id: string }>(items: T[], views: Map<string, THREE.Group>, make: () => THREE.Group, place: (v: THREE.Group, it: T) => void) {
  const alive = new Set<string>();
  for (const it of items) {
    alive.add(it.id);
    let v = views.get(it.id);
    if (!v) { v = make(); scene.add(v); views.set(it.id, v); }
    place(v, it);
  }
  for (const [id, v] of views) if (!alive.has(id)) { scene.remove(v); views.delete(id); }
}

function draw(t: number, dtReal: number) {
  const p = world.player;
  player.g.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.g.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  player.body.visible = !(p.invulnTicks > 0 && Math.floor(t * 12) % 2 === 0);
  flashT = Math.max(0, flashT - dtReal / 0.5);
  burst.update(dtReal);
  player.animate(t, Math.hypot(p.vel[0], p.vel[2]) > 0.1, !p.grounded, p.carried, flashT);
  player.g.visible = p.respawnTicks === 0;
  player.lampLight.intensity = 3 + p.carried * 0.6 + flashT * 14;

  // camera góc nhìn thứ ba
  const th = (camYaw * Math.PI) / 180;
  const fx = Math.sin(th);
  const fz = Math.cos(th);
  const cy = Math.max(p.pos[1], -4);
  tmp.set(p.pos[0] - fx * 9, cy + 5.5, p.pos[2] - fz * 9);
  camera.position.lerp(tmp, flow === 'playing' ? 0.2 : 1);
  camera.lookAt(p.pos[0], cy + 1.4, p.pos[2]);
  moon.position.set(p.pos[0] - 30, 50, p.pos[2] - 20);
  moon.target.position.set(p.pos[0], 0, p.pos[2]);

  let litCount = 0;
  for (const l of world.lanterns) {
    const v = lanternViews.get(l.id);
    if (!v) continue;
    const frac = l.deposited / TUNING.lantern_cost;
    v.model.update(frac, l.lit, t + l.pos[0]);
    v.bar.scale.x = Math.max(0.001, frac);
    v.bar.visible = !l.lit;
    v.bar.lookAt(camera.position.x, v.bar.getWorldPosition(tmp).y, camera.position.z);
    (v.ring.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.35 : 0;
    if (l.lit) litCount++;
  }
  // ánh sáng môi trường tăng theo tiến độ: 0.15 + 0.55 × (đèn sáng / tổng đèn)
  hemi.intensity = 0.15 + 0.55 * (litCount / world.lanterns.length);
  mapView?.update(t);

  syncMap(world.motes, moteViews, makeMote, (v, m) => {
    const ph = Number(m.id.slice(1)) * 0.7;
    v.position.set(m.pos[0], m.pos[1] + 0.75 + Math.sin(t * 2.5 + ph) * 0.25, m.pos[2]);
    v.scale.setScalar(m.kind === 'dropped' && m.ttl !== null && m.ttl < 120 && Math.floor(t * 8) % 2 ? 0.5 : 1);
    anim(v, t, ph);
  });
  syncMap(world.shades, shadeViews, makeShade, (v, s) => {
    v.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.pos[0]) * 0.12, s.pos[2]);
    v.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    anim(v, t, s.state === 'stunned', s.state === 'spawning');
  });
  syncMap(world.drifters, drifterViews, makeDrifter, (v, d) => {
    v.visible = d.state !== 'removed';
    const prev = (v.userData.prev as THREE.Vector3 | undefined) ?? new THREE.Vector3(d.pos[0] - 0.01, d.pos[1], d.pos[2]);
    v.position.set(d.pos[0], d.pos[1], d.pos[2]);
    if (prev.distanceToSquared(v.position) > 1e-6) v.lookAt(2 * v.position.x - prev.x, v.position.y, 2 * v.position.z - prev.z); // quay theo hướng bay
    v.userData.prev = v.position.clone();
    anim(v, t, d.state === 'flee', d.stolen);
  });
  syncMap(world.charms, charmViews, makeCharm, (v, c) => {
    v.visible = c.available;
    v.position.set(c.pos[0], c.pos[1] + 1 + Math.sin(t * 2) * 0.2, c.pos[2]);
    anim(v, t);
  });

  // lá bay khi sắp có gió / đang có gió
  const windOn = world.wind.active || world.wind.warn;
  leafMat.opacity = windOn ? 0.9 : Math.max(0, leafMat.opacity - dtReal);
  if (leafMat.opacity > 0) {
    const a = (world.wind.dirDeg * Math.PI) / 180;
    const m = new THREE.Matrix4();
    for (let i = 0; i < LEAVES; i++) {
      const k = (t * (world.wind.active ? 0.5 : 0.15) + i * 0.137) % 1;
      const side = ((i * 7.31) % 1) * 2 - 1;
      const x = p.pos[0] + (k * 30 - 15) * Math.cos(a) - side * 10 * Math.sin(a);
      const z = p.pos[2] + (k * 30 - 15) * Math.sin(a) + side * 10 * Math.cos(a);
      m.makeRotationY(t * 3 + i);
      m.setPosition(x, p.pos[1] + 0.5 + ((i * 3.7) % 4) + Math.sin(t * 4 + i) * 0.3, z);
      leaves.setMatrixAt(i, m);
    }
    leaves.instanceMatrix.needsUpdate = true;
  }

  if (pulseT < 1) {
    pulseT += 1 / 30;
    pulseRing.position.set(p.pos[0], p.pos[1] + 0.1, p.pos[2]);
    pulseRing.scale.setScalar(TUNING.pulse_radius * pulseT);
    (pulseRing.material as THREE.MeshBasicMaterial).opacity = 1 - pulseT;
  } else (pulseRing.material as THREE.MeshBasicMaterial).opacity = 0;

  updateHud(litCount);
}

const moteCells: HTMLElement[] = [];
for (let i = 0; i < TUNING.carry_capacity; i++) {
  const s = document.createElement('span');
  $('h-motes').appendChild(s);
  moteCells.push(s);
}

function updateHud(litCount: number) {
  const p = world.player;
  const playing = flow === 'playing';
  for (const id of ['h-flames', 'h-timer', 'h-right', 'h-motes', 'h-cds', 'h-hint', 'help', 'h-charm', 'h-wind']) $(id).style.visibility = playing ? 'visible' : 'hidden';
  $('h-flames').textContent = '🔥'.repeat(Math.max(0, p.flames)) + '·'.repeat(Math.max(0, TUNING.flames - p.flames));
  const tl = Math.max(0, timeLeft(world));
  const secs = Math.ceil(tl - 1e-9);
  $('h-timer').textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  $('h-timer').classList.toggle('danger', tl <= 30);
  if (playing && !world.paused && secs <= 10 && secs > 0 && secs !== lastCountdown) { lastCountdown = secs; sfx.countdown(); }
  $('h-lit').textContent = `${litCount}/${world.lanterns.length}`;
  $('h-score').textContent = String(totalScore + world.score);
  moteCells.forEach((c, i) => c.classList.toggle('on', i < p.carried));
  const setCd = (id: string, left: number, total: number, ready: boolean) => {
    ($(id).querySelector('.fill') as HTMLElement).style.height = `${Math.min(100, (left / total) * 100)}%`;
    $(id).style.opacity = ready ? '1' : '0.6';
  };
  setCd('cd-dash', p.charmTicks > 0 ? 0 : p.dashCd, 90, p.dashCd === 0 || p.charmTicks > 0);
  setCd('cd-pulse', p.pulseCd, 180, p.pulseCd === 0 && p.carried >= TUNING.pulse_cost);
  $('h-charm').textContent = p.charmTicks > 0 ? `Bùa Gió ${(p.charmTicks / 60).toFixed(1)}s` : '';
  $('h-wind').textContent = world.wind.active ? '🍃 Gió mạnh!' : world.wind.warn ? '🍃 Gió sắp nổi…' : '';
  if (world.wind.warn && playing && Math.floor(world.simTick) % 120 === 0) sfx.windWarn();

  // nhắc nạp đèn + mũi tên tới đèn chưa sáng gần nhất khi nó ở ngoài màn hình
  const unlit = world.lanterns.filter((l) => !l.lit);
  const target = unlit.sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
  let hint = '';
  const arrow = $('h-arrow');
  arrow.style.display = 'none';
  if (target && playing) {
    const d = Math.hypot(target.pos[0] - p.pos[0], target.pos[2] - p.pos[2]);
    if (d <= TUNING.interact_radius + 0.5 && Math.abs(target.pos[1] - p.pos[1]) <= 1.5) hint = `E — Nạp ánh sáng (${target.deposited}/${TUNING.lantern_cost})`;
    const v = new THREE.Vector3(target.pos[0], target.pos[1] + 2, target.pos[2]).project(camera);
    const behind = v.z > 1;
    if (behind || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) {
      let x = behind ? -v.x : v.x;
      let y = behind ? -v.y : v.y;
      const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
      x = (x / m) * 0.9;
      y = (y / m) * 0.85;
      arrow.style.display = 'block';
      arrow.style.left = `${((x + 1) / 2) * window.innerWidth - 17}px`;
      arrow.style.top = `${((1 - y) / 2) * window.innerHeight - 17}px`;
      arrow.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
    }
  }
  $('h-hint').textContent = hint;
  $('hurt').style.boxShadow = performance.now() < hurtUntil ? 'inset 0 0 120px 40px rgba(255, 90, 95, 0.5)' : 'none';
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
// cho phép kiểm tra trong trình duyệt (debug / bằng chứng)
Object.assign(window as unknown as Record<string, unknown>, { __game: () => world, __flow: () => flow, __neutral: neutralInput, __fx: () => ({ flash: flashT, burst: burst.active }) });
loadNight(1);
flow = 'menu';
show('s-menu');
requestAnimationFrame(frame);
