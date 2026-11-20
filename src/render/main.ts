// Phần hiển thị: Three.js chỉ ĐỌC trạng thái từ core để vẽ. Mọi luật chơi nằm trong src/core.
import * as THREE from 'three';
import { createBenchWorld } from '../core/bench';
import { createWorld, step, World, InputState, GameEvent, timeLeft, neutralInput, capacity, winThreshold } from '../core/world';
import { TUNING, DT } from '../core/config';
import { MAPS } from '../core/maps';
import { Sfx } from './sfx';
import { makeLanternModel, LanternModel, LANTERN_TOP_Y } from './lantern';
import { buildMap, MapView } from './mapview';
import { ShadeCrowd, MoteCrowd } from './crowds';
import { PAL } from './palette';
import { FLAME_GLOW } from './flame';
import { makeMay, makeDrifterModel, makeCharmModel, makePickupBurst, shadeTheme } from './actors';
import { ACTIONS, ACTION_LABEL, Action, Bindings, DEFAULT_BINDINGS, cloneBindings, rebind, clearSlot, parseBindings, keyMap, keyLabel } from '../core/keybinds';
import { fetchBoard, submitScore, BoardResult } from './board';

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
// ---------- Cảnh Bình Minh (chỉ hiển thị, sau khi thắng Đêm 3) ----------
// Bầu trời chuyển từ tím đêm sang cam hồng, mặt trời nhô lên trên biển mây, đèn trời bay lên.
const DAWN_S = 6; // giây để trời sáng hẳn
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, transparent: true, fog: false,
  uniforms: { top: { value: new THREE.Color('#4f63a8') }, mid: { value: new THREE.Color('#ffa27a') }, low: { value: new THREE.Color('#ffd89a') }, k: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform float k; varying vec3 vP;
    void main() { float h = vP.y; float toward = smoothstep(0.2, -1.0, vP.z) * 0.35; // phía mặt trời (−z) ấm hơn
      vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.75 + toward, h)) : mix(low, mid, smoothstep(-0.15, 0.12, h));
      gl_FragColor = vec4(c, k); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(440, 32, 16), skyMat);
sky.renderOrder = -1;
sky.visible = false;
function sunTexture(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g2 = cv.getContext('2d')!;
  const gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,252,235,1)'); gr.addColorStop(0.72, 'rgba(255,240,190,1)'); gr.addColorStop(0.8, 'rgba(255,214,150,0.6)'); gr.addColorStop(1, 'rgba(255,190,120,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), fog: false, transparent: true, depthWrite: false }));
sunDisc.scale.setScalar(58);
const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLAME_GLOW, color: '#ffb070', fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
sunHalo.scale.setScalar(190);
const sun = new THREE.Group();
sun.add(sunHalo, sunDisc);
sun.visible = false;
const SKY_LANTERNS = 36;
const skyLanterns: THREE.Sprite[] = [];
const skyLanternGroup = new THREE.Group();
for (let i = 0; i < SKY_LANTERNS; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLAME_GLOW, color: i % 3 ? '#ffb347' : '#ff7a5a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sp.scale.setScalar(0.9 + (i % 4) * 0.3);
  skyLanterns.push(sp);
  skyLanternGroup.add(sp);
}
skyLanternGroup.visible = false;
scene.add(sky, sun, skyLanternGroup);
let dawnStart = -1;
const NIGHT_FOG = new THREE.Color(PAL.fog);
const NIGHT_SKY = new THREE.Color(PAL.sky);
const DAWN_FOG = new THREE.Color('#d98d7a');
const MOON_COLOR = new THREE.Color('#b8c4ff');
const SUN_COLOR = new THREE.Color('#ffd2a0');
const lerpC = new THREE.Color();
function resetDawn() {
  dawnStart = -1;
  sky.visible = false;
  sun.visible = false;
  skyLanternGroup.visible = false;
  (scene.background as THREE.Color).copy(NIGHT_SKY);
  const f = scene.fog as THREE.Fog;
  f.color.copy(NIGHT_FOG); f.near = 30; f.far = 120;
  moon.color.copy(MOON_COLOR);
  moon.intensity = 0.6;
  hemi.color.set('#9fb0ff');
}
/** Vẽ cảnh Bình Minh; trả về true nếu đã đặt camera. */
function drawDawn(t: number): boolean {
  if (flow !== 'dawn') { if (dawnStart >= 0) resetDawn(); return false; }
  if (dawnStart < 0) dawnStart = t;
  const el = t - dawnStart;
  const k = settings.calm ? 1 : Math.min(1, el / DAWN_S);
  const e = k * k * (3 - 2 * k); // mượt
  const p = world.player;
  sky.visible = sun.visible = skyLanternGroup.visible = true;
  sky.position.set(p.pos[0], 0, p.pos[2]);
  skyMat.uniforms.k.value = e;
  (scene.background as THREE.Color).copy(NIGHT_SKY).lerp(lerpC.set('#ffb38a'), e);
  const f = scene.fog as THREE.Fog;
  f.color.copy(NIGHT_FOG).lerp(DAWN_FOG, e);
  f.near = 30 + 50 * e; f.far = 120 + 260 * e; // sương tan dần
  moon.color.copy(MOON_COLOR).lerp(SUN_COLOR, e);
  moon.intensity = 0.6 + 0.9 * e;
  hemi.color.set('#9fb0ff').lerp(lerpC.set('#ffe0c0'), e);
  hemi.intensity = Math.max(hemi.intensity, 0.35 + 0.65 * e);
  // mặt trời nhô lên từ biển mây ở hướng −z, trước mặt Mây
  const sunY = -30 + 95 * e;
  sun.position.set(p.pos[0] + 110, sunY, p.pos[2] - 380); // nhìn về −z thì phải màn hình = +x: mặt trời bên phải, không bị khung kết quả che
  (sunHalo.material as THREE.SpriteMaterial).opacity = 0.35 + 0.65 * e;
  // đèn trời bay lên quanh Mây
  for (let i = 0; i < SKY_LANTERNS; i++) {
    const sp = skyLanterns[i];
    const ph = (el * 0.06 + i / SKY_LANTERNS) % 1;
    const a = i * 2.39996;
    const r = 8 + (i % 7) * 5;
    sp.position.set(p.pos[0] + 8 + Math.cos(a) * r + Math.sin(el * 0.5 + i) * 0.6, p.pos[1] + 2 + ph * 40, p.pos[2] - 22 + Math.sin(a) * r * 0.6 - ph * 25);
    (sp.material as THREE.SpriteMaterial).opacity = Math.min(1, ph * 6, (1 - ph) * 3) * (0.5 + 0.5 * e);
  }
  // camera đứng sau lưng Mây nhìn về phía mặt trời, trôi nhẹ
  const sway = settings.calm ? 0 : Math.sin(el * 0.2) * 1.6;
  camera.position.set(p.pos[0] - 3 + sway, p.pos[1] + 2.4 + e * 0.5, p.pos[2] + 8.5);
  camera.lookAt(p.pos[0] - 9, p.pos[1] + 3.2 + e * 1.3, p.pos[2] - 30); // Mây ở nửa phải màn hình
  player.g.rotation.y = Math.PI; // Mây quay về phía mặt trời
  return true;
}

// đèn chiếu nhẹ vào mặt Mây, chỉ bật ở menu chính
const menuLight = new THREE.PointLight('#ffd9a0', 0, 9, 1.5);
scene.add(menuLight);

// ---------- Mô hình ----------
// Mô hình các vật gắn với luật chơi: src/render/actors.ts (hàm animate lưu trong userData)
type Anim = { group: THREE.Group; animate: (...args: any[]) => void };
const withAnim = (m: Anim) => { m.group.userData.animate = m.animate; return m.group; };
const anim = (v: THREE.Object3D, ...args: unknown[]) => (v.userData.animate as (...a: unknown[]) => void)?.(...args);
const player = makeMay();
scene.add(player.g);
const shadeCrowd = new ShadeCrowd(scene);
const moteCrowd = new MoteCrowd(scene);
// lóe sáng mỗi lần nhặt đom đóm (chỉ hiển thị)
const burst = makePickupBurst();
scene.add(burst.group);
let flashT = 0;
const makeDrifter = () => withAnim(makeDrifterModel());
const makeCharm = () => withAnim(makeCharmModel());

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
const KEYS_KEY = 'dao-den-long-keys';
// captions: phụ đề / chỉ báo hình ảnh; calm: giảm chuyển động; big: chữ lớn ×1.25 (Ticket-04 mục 4)
const settings = { volume: 0.7, sensitivity: 0.3, colorblind: false, captions: true, calm: false, big: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')); } catch { /* bỏ qua */ }
let bindings: Bindings = cloneBindings(DEFAULT_BINDINGS);
try { bindings = parseBindings(JSON.parse(localStorage.getItem(KEYS_KEY) ?? 'null')); } catch { /* mặc định */ }
let kmap = keyMap(bindings);
const sfx = new Sfx();
sfx.setVolume(settings.volume);
const vol = $('set-vol') as HTMLInputElement;
const sens = $('set-sens') as HTMLInputElement;
const cb = $('set-cb') as HTMLInputElement;
const checks: [HTMLInputElement, 'captions' | 'calm' | 'big'][] = [
  [$('set-caps') as HTMLInputElement, 'captions'], [$('set-calm') as HTMLInputElement, 'calm'], [$('set-big') as HTMLInputElement, 'big'],
];
const applyTheme = () => {
  // Ticket-03 chế độ mù màu: Bóng Mực #00B3FF, cảnh báo UI #FFFFFF kèm ⚠
  shadeTheme.rim = settings.colorblind ? '#00B3FF' : PAL.shadeRim;
  document.documentElement.style.setProperty('--danger', settings.colorblind ? '#FFFFFF' : PAL.uiDanger);
  document.documentElement.classList.toggle('calm', settings.calm);
  document.documentElement.classList.toggle('big', settings.big);
};
const syncSettingsUI = () => {
  cb.checked = settings.colorblind;
  for (const [el, k] of checks) el.checked = settings[k];
  applyTheme();
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
cb.addEventListener('change', () => { settings.colorblind = cb.checked; saveSettings(); });
for (const [el, k] of checks) el.addEventListener('change', () => { settings[k] = el.checked; saveSettings(); });
syncSettingsUI();

// ---------- Đổi phím ----------
let waiting: { action: Action; slot: 0 | 1 } | null = null;
function renderHelp() {
  const k = (a: Action) => (bindings[a].join() === 'ShiftLeft,ShiftRight' ? 'Shift' : bindings[a].filter(Boolean).map(keyLabel).join(' / '));
  const move = [bindings.up[0], bindings.down[0], bindings.left[0], bindings.right[0]].map(keyLabel).join(' ');
  const alt = [bindings.up[1], bindings.left[1], bindings.down[1], bindings.right[1]].filter(Boolean).map(keyLabel).join(' ');
  const rows: [string, string][] = [
    [move, alt ? `Đi (hoặc ${alt})` : 'Đi'], ['Chuột kéo', 'Xoay camera'], [k('jump'), 'Nhảy'], [k('dash'), 'Lướt'],
    [k('interact'), 'Nạp / châm dầu'], [k('pulse'), 'Tỏa sáng (3 đom đóm)'], [k('pause'), 'Tạm dừng'],
  ];
  $('cd-dash-k').textContent = k('dash');
  $('cd-pulse-k').textContent = k('pulse');
  // bảng điều khiển khi chơi + danh sách phím ở menu chính (cùng nguồn, theo phím đã đổi)
  for (const id of ['help-rows', 'm-keys']) {
    const box = $(id);
    box.innerHTML = '';
    for (const [key, what] of rows) {
      const r = document.createElement('div');
      r.className = 'row';
      const kb = document.createElement('kbd');
      kb.textContent = key;
      const sp = document.createElement('span');
      sp.textContent = what;
      r.append(kb, sp);
      box.appendChild(r);
    }
  }
}
function renderKeys(msg = '', err = false) {
  const body = $('k-rows');
  body.innerHTML = '';
  for (const a of ACTIONS) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.textContent = ACTION_LABEL[a];
    tr.appendChild(td);
    for (const s of [0, 1] as const) {
      const c = document.createElement('td');
      const b = document.createElement('button');
      const w = waiting?.action === a && waiting.slot === s;
      b.textContent = w ? 'Nhấn phím…' : keyLabel(bindings[a][s]);
      b.className = w ? 'wait' : '';
      b.dataset.kact = `${a}:${s}`;
      c.appendChild(b);
      tr.appendChild(c);
    }
    body.appendChild(tr);
  }
  $('k-msg').textContent = msg || (waiting ? 'Nhấn phím mới · Esc: hủy · Backspace/Delete: xóa ô' : '');
  $('k-msg').classList.toggle('err', err);
}
function setBindings(b: Bindings) {
  bindings = b;
  kmap = keyMap(b);
  localStorage.setItem(KEYS_KEY, JSON.stringify(b));
  renderHelp();
}
// bắt phím khi đang chờ gán (pha capture, trước mọi xử lý khác)
window.addEventListener('keydown', (e) => {
  if (!waiting) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const { action, slot } = waiting;
  waiting = null;
  if (e.code === 'Escape') { renderKeys('Đã hủy'); return; }
  if (e.code === 'Backspace' || e.code === 'Delete') { setBindings(clearSlot(bindings, action, slot)); renderKeys('Đã xóa ô'); return; }
  const r = rebind(bindings, action, slot, e.code);
  if (!r.ok) { renderKeys(`⚠ ${r.message}`, true); return; }
  setBindings(r.bindings);
  renderKeys(`Đã gán ${keyLabel(e.code)} cho "${ACTION_LABEL[action]}"`);
}, true);
renderHelp();

// ---------- Input ----------
const keys = new Set<string>();
const tapped = new Set<string>();
let camYaw = 0;
let dragging = false;
let lastX = 0;
const typing = (e: Event) => e.target instanceof HTMLInputElement && e.target.type === 'text';
window.addEventListener('keydown', (e) => {
  if (typing(e)) return; // đang gõ tên vào bảng xếp hạng
  sfx.unlock();
  if (e.repeat && kmap.get(e.code) === 'pause') return;
  keys.add(e.code);
  tapped.add(e.code);
  if (kmap.has(e.code)) e.preventDefault();
  if (flow === 'intro' && (e.code === 'Enter' || e.code === 'Space' || kmap.get(e.code) === 'jump')) { e.preventDefault(); startNight(); }
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

const act = (a: Action) => bindings[a].some((c) => c && (keys.has(c) || tapped.has(c)));
function readInput(): InputState {
  // move [x, z] trong hệ camera; z = tiến; màn hình phải = x âm (xem README)
  const z = (act('up') ? 1 : 0) - (act('down') ? 1 : 0);
  const x = (act('left') ? 1 : 0) - (act('right') ? 1 : 0);
  return {
    move: [x, z], camYawDeg: camYaw, jump: act('jump'), interact: act('interact'), pulse: act('pulse'),
    dash: act('dash'), pause: act('pause') || tapped.has('PauseBtn'),
  };
}

// ---------- Chuỗi 3 Đêm ----------
type Flow = 'menu' | 'intro' | 'playing' | 'result' | 'dawn' | 'bench';
let flow: Flow = 'menu';
let night = 1;
let totalScore = 0;
let world: World = createWorld(1, 1);
let mapView: MapView | null = null;
let settingsReturn = 's-menu';
let lastCountdown = -1;
let hurtUntil = 0;
const seedParam = new URLSearchParams(location.search).get('seed');
let currentSeed = 0;
// lượt chơi (để lưu bảng xếp hạng): tổng điểm các Đêm đã thắng, số Đêm thắng, seed Đêm đầu của lượt
let runNightsWon = 0;
let runSeed: number | null = null;
let runScores: Record<number, number> = {}; // điểm từng Đêm đã thắng trong lượt
const newRun = () => { totalScore = 0; runNightsWon = 0; runSeed = null; runScores = {}; };

const QUOTES: Record<number, string> = {
  1: 'Ông Đăng: "Sương đen nuốt ánh sáng Đảo Bến rồi, Mây ơi. Gom đom đóm, thắp lại năm ngọn đèn trước khi gà gáy nhé."',
  2: 'Ông Đăng: "Đảo Cau có hai hòn nối bằng cầu tre. Coi chừng Gió Lạc — nó thích giật đom đóm của người mang nặng."',
  3: 'Ông Đăng: "Đêm cuối ở Đảo Chuông. Gió mạnh lắm, đường lên tháp chuông phải nhờ dốc và bục nhảy. Cố lên con!"',
};

function show(id: string | null) {
  for (const s of ['s-menu', 's-intro', 's-result', 's-pause', 's-settings', 's-board', 's-keys']) $(s).classList.toggle('show', s === id);
}

const lanternViews = new Map<string, { model: LanternModel; bar: THREE.Mesh; ring: THREE.Mesh }>();
const drifterViews = new Map<string, THREE.Group>();
const charmViews = new Map<string, THREE.Group>();

function clearViews() {
  for (const m of [drifterViews, charmViews]) {
    for (const v of m.values()) scene.remove(v);
    m.clear();
  }
  for (const v of lanternViews.values()) scene.remove(v.model.group);
  lanternViews.clear();
  if (mapView) scene.remove(mapView.group);
}

function loadNight(n: number, prebuilt?: World) {
  night = n;
  clearViews();
  const seed = seedParam !== null ? Number(seedParam) : Math.floor(Math.random() * 1e9);
  world = prebuilt ?? createWorld(seed, n);
  currentSeed = seed;
  if (!prebuilt && runSeed === null) runSeed = seed;
  resetCaptions();
  $('s-result').classList.remove('dawn');
  mapView = buildMap(world.map, { decor: !prebuilt });
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
  $('i-count').textContent = `${Math.ceil(TUNING.win_ratio * map.lanterns.length - 1e-9)}/${map.lanterns.length}`;
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
      if (!settings.calm) flashT = 1; // giảm chuyển động: không lóe sáng
    }
    if (e.name === 'deposit') sfx.deposit();
    if (e.name === 'lantern_lit') sfx.lit();
    if (e.name === 'refuel') sfx.deposit();
    if (e.name === 'lantern_out') sfx.hit();
    if (e.name === 'pulse') { pulseT = 0; sfx.pulse(); }
    if (e.name === 'dash') sfx.dash();
    if (e.name === 'charm_picked') sfx.charm();
    if (e.name === 'drifter_steal') sfx.steal();
    if (e.name === 'shade_spawned') { sfx.shadeSpawn(); onShadeSpawned(String(e.data.id)); }
    if (e.name === 'player_hit') { if (!settings.calm) hurtUntil = performance.now() + 400; sfx.hit(); }
    if (e.name === 'paused') show('s-pause');
    if (e.name === 'resumed') show(null);
    if (e.name === 'game_over') endNight(e.data.result === 'won', String(e.data.reason));
  }
}

function endNight(won: boolean, reason: string) {
  sfx.stopMusic();
  won ? sfx.win() : sfx.lose();
  if (won) { totalScore += world.score; runNightsWon++; runScores[night] = world.score; }
  resetCaptions(); // không để phụ đề của Đêm vừa xong còn trên màn hình
  $('h-caps').innerHTML = '';
  const dawn = won && night === 3;
  $('s-result').classList.toggle('dawn', dawn);
  if (dawn) {
    flow = 'dawn';
    $('r-title').textContent = 'Bình Minh!';
    const rows = [1, 2, 3].map((n) => `<tr><td>Đêm ${n} · ${MAPS[n].name}</td><td class="num">${runScores[n] !== undefined ? runScores[n] : '—'}</td></tr>`).join('');
    $('r-sub').innerHTML = `<span class="r-lead">Ba hòn đảo đã sáng trở lại. Mặt trời lên trên biển mây.</span>`
      + `<table class="r-table">${rows}<tr class="tot"><td>Tổng điểm</td><td class="num">${totalScore}</td></tr></table>`
      + `<span class="r-won">Đêm thắng trong lượt: <b>${runNightsWon}/3</b></span>`;
    setButtons([['Chơi lại', 'start'], ['Về menu', 'menu']]);
  } else {
    flow = 'result';
    const why = reason === 'dawn' ? `Bình minh lên nhưng chưa đủ ${winThreshold(world)} đèn sáng.` : reason === 'dawn_survived' ? `Mây giữ được ${world.lanterns.filter((l) => l.lit).length} đèn sáng tới bình minh!` : reason === 'no_flames' ? 'Ngọn lửa của Mây đã tắt.' : `${MAPS[night].name} đã sáng trở lại!`;
    $('r-title').textContent = won ? `Đêm ${night} hoàn thành!` : `Đêm ${night} thất bại`;
    $('r-sub').innerHTML = `${why}<br>Điểm đêm này: <b>${won ? world.score : 0}</b> · Tổng: <b>${totalScore}</b>`;
    setButtons(won ? [[`Sang Đêm ${night + 1}`, 'next'], ['Về menu', 'menu']] : [['Chơi lại Đêm', 'restart'], ['Về menu', 'menu']]);
  }
  // Ticket-04: sau Bình Minh (thắng Đêm 3) hoặc sau khi thua → cho nhập tên lưu điểm
  const offer = !won || night === 3;
  $('r-save').style.display = offer ? '' : 'none';
  if (offer) {
    ($('r-save-btn') as HTMLButtonElement).disabled = false;
    ($('r-name') as HTMLInputElement).disabled = false;
    $('r-msg').textContent = `Điểm sẽ lưu: ${totalScore} · Đêm thắng: ${runNightsWon}`;
    $('r-msg').classList.remove('err');
  }
  show('s-result');
}

$('r-save').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('r-name') as HTMLInputElement;
  const btn = $('r-save-btn') as HTMLButtonElement;
  btn.disabled = true;
  const r = await submitScore({ name: input.value, score: totalScore, nights_won: runNightsWon, seed: runSeed ?? currentSeed });
  if (!r.ok) {
    $('r-msg').textContent = `⚠ ${r.error}`;
    $('r-msg').classList.add('err');
    btn.disabled = false;
    return;
  }
  localStorage.setItem('dao-den-long-last-name', input.value);
  input.disabled = true;
  input.blur();
  $('r-msg').classList.remove('err');
  $('r-msg').textContent = r.rank ? `Đã lưu! Hạng ${r.rank} trên bảng xếp hạng.` : 'Đã lưu (chưa lọt top 10).';
});
($('r-name') as HTMLInputElement).value = localStorage.getItem('dao-den-long-last-name') ?? '';

function renderBoard(b: BoardResult) {
  const body = $('b-rows');
  body.innerHTML = '';
  $('b-src').textContent = b.entries.length === 0 ? 'Chưa có ai. Hãy là người đầu tiên!'
    : b.source === 'disk' ? 'Top 10 · lưu trên đĩa của máy này' : 'Top 10 · lưu trong trình duyệt (không có server)';
  b.entries.forEach((x, i) => {
    const tr = document.createElement('tr');
    const when = new Date(x.achieved_at);
    const cells = [String(i + 1), x.name, String(x.score), `${x.nights_won}/3`, Number.isNaN(when.getTime()) ? x.achieved_at : when.toLocaleString('vi-VN'), String(x.seed)];
    cells.forEach((c, j) => {
      const td = document.createElement('td');
      td.textContent = c;
      if (j !== 1 && j !== 4) td.className = 'num';
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
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
  const kact = (e.target as HTMLElement).dataset?.kact;
  if (kact) {
    const [a, s] = kact.split(':');
    waiting = { action: a as Action, slot: Number(s) as 0 | 1 };
    (e.target as HTMLElement).blur();
    renderKeys();
    return;
  }
  const act = (e.target as HTMLElement).dataset?.act;
  if (!act) return;
  (e.target as HTMLElement).blur(); // tránh Enter/Space bấm lại nút vừa chọn
  sfx.unlock();
  if (act === 'start') { newRun(); loadNight(1); }
  if (act.startsWith('night')) { newRun(); loadNight(Number(act.slice(5))); }
  if (act === 'board') { show('s-board'); $('b-src').textContent = 'Đang tải…'; $('b-rows').innerHTML = ''; fetchBoard().then(renderBoard); }
  if (act === 'board-back') show('s-menu');
  if (act === 'keys') { waiting = null; renderKeys(); show('s-keys'); }
  if (act === 'keys-back') { waiting = null; show('s-settings'); }
  if (act === 'keys-reset') { waiting = null; setBindings(cloneBindings(DEFAULT_BINDINGS)); renderKeys('Đã khôi phục phím mặc định'); }
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
// ---------- Benchmark (Ticket-04 mục 1): ?bench=1&seed=42&duration=30 ----------
const benchParams = new URLSearchParams(location.search);
const BENCH = benchParams.has('bench');
const BENCH_WARMUP_MS = 3000;
const benchDuration = Number(benchParams.get('duration') ?? 30) * 1000;
const bench = { t0: -1, mStart: -1, prev: 0, dts: [] as number[], done: false, heapPeak: 0 };
function benchFrame(now: number) {
  if (bench.t0 < 0) {
    bench.t0 = now;
    (window as unknown as Record<string, unknown>).__benchFirstFrame = Date.now(); // khung hình đầu tiên của cảnh bench
  }
  const el = now - bench.t0;
  // camera bay vòng tròn bán kính 30 m, cao 15 m, nhìn vào (0,0,0), bắt đầu ở góc 0° = (30,15,0), 15 s một vòng
  const a = (2 * Math.PI * el) / 15000;
  camera.position.set(30 * Math.cos(a), 15, 30 * Math.sin(a));
  camera.lookAt(0, 0, 0);
  if (bench.done || el < BENCH_WARMUP_MS) return;
  if (bench.mStart < 0) { bench.mStart = now; bench.prev = now; return; }
  bench.dts.push(now - bench.prev);
  bench.prev = now;
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  if (mem) bench.heapPeak = Math.max(bench.heapPeak, mem.usedJSHeapSize);
  if (now - bench.mStart >= benchDuration) {
    bench.done = true;
    const d = bench.dts;
    const n = d.length;
    const sum = d.reduce((x, y) => x + y, 0);
    const desc = [...d].sort((x, y) => y - x);
    const k = Math.max(1, Math.ceil(0.01 * n));
    const worst = desc.slice(0, k).reduce((x, y) => x + y, 0) / k;
    const asc = [...d].sort((x, y) => x - y);
    const p95 = asc[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown GPU';
    const r2 = (x: number) => Math.round(x * 100) / 100;
    (window as unknown as Record<string, unknown>).__benchResult = {
      avg_fps: r2((1000 * n) / sum), p1_low_fps: r2(1000 / worst), frame_ms_p95: r2(p95), frames: n,
      renderer: `three.js r${THREE.REVISION} WebGL2 (${gpu})`,
      js_heap_peak_mb: bench.heapPeak ? r2(bench.heapPeak / 1048576) : null,
      shades: world.shades.length, motes: world.motes.length,
      slowest_ms: d.map((x, i) => [Math.round(x * 10) / 10, i]).sort((x, y) => y[0] - x[0]).slice(0, 12),
    };
  }
}

function frame(now: number) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (flow === 'bench') {
    acc += dtReal;
    while (acc >= DT) { step(world, neutralInput()); acc -= DT; } // không có input người chơi
  } else if (flow === 'playing') {
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
  if (flow === 'bench') benchFrame(now);
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

  const menuView = flow === 'menu' && $('s-menu').classList.contains('show');
  if (menuView) {
    // menu chính: camera đứng trước mặt Mây (góc 3/4), lệch khung nhìn để Mây nằm bên phải màn hình
    const face = player.g.rotation.y;
    const a = face + 0.45 + Math.sin(t * 0.25) * 0.08;
    camera.position.set(p.pos[0] + Math.sin(a) * 5.2, p.pos[1] + 2.1, p.pos[2] + Math.cos(a) * 5.2);
    camera.lookAt(p.pos[0], p.pos[1] + 1.35, p.pos[2]);
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.setViewOffset(w, h, -w * 0.3, 0, w, h);
    // Mây quay mặt về phía camera (hơi nghiêng 3/4)
    player.g.rotation.y = Math.atan2(camera.position.x - p.pos[0], camera.position.z - p.pos[2]) - 0.35;
    player.lampLight.intensity = 7; // đuốc sáng hơn để nhân vật nổi bật ở menu
    menuLight.position.set(camera.position.x, p.pos[1] + 2.4, camera.position.z);
    menuLight.intensity = 6;
  } else {
    if (camera.view?.enabled) camera.clearViewOffset();
    menuLight.intensity = 0;
  }
  const dawnCam = drawDawn(t); // luôn gọi để tự dọn cảnh bình minh khi rời màn hình
  if (!menuView && !dawnCam) {
    // camera góc nhìn thứ ba
    const th = (camYaw * Math.PI) / 180;
    const fx = Math.sin(th);
    const fz = Math.cos(th);
    const cy = Math.max(p.pos[1], -4);
    tmp.set(p.pos[0] - fx * 9, cy + 5.5, p.pos[2] - fz * 9);
    camera.position.lerp(tmp, flow === 'playing' ? 0.2 : 1);
    camera.lookAt(p.pos[0], cy + 1.4, p.pos[2]);
  }
  moon.position.set(p.pos[0] - 30, 50, p.pos[2] - 20);
  if (dawnCam) moon.position.set(p.pos[0] + 10, 35, p.pos[2] - 70); // nắng sớm từ phía mặt trời
  moon.target.position.set(p.pos[0], 0, p.pos[2]);

  let litCount = 0;
  for (const l of world.lanterns) {
    const v = lanternViews.get(l.id);
    if (!v) continue;
    const frac = l.deposited / TUNING.lantern_cost;
    const fuel = l.fuelU / 60;
    v.model.update(frac, l.lit, t + l.pos[0], fuel);
    // thanh tiến độ: chưa sáng = số đom đóm đã nạp; đang sáng = thanh dầu (nhấp nháy 1 Hz khi < 30)
    const cost = l.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
    const barFrac = l.lit ? fuel / TUNING.fuel_max : l.deposited / cost;
    v.bar.scale.x = Math.max(0.001, barFrac);
    v.bar.visible = l.lit ? !(fuel < TUNING.low_fuel_threshold && t % 1 > 0.5 && !settings.calm) : l.deposited > 0;
    (v.bar.material as THREE.MeshBasicMaterial).color.set(l.lit ? (fuel < TUNING.low_fuel_threshold ? (settings.colorblind ? '#ffffff' : PAL.uiDanger) : PAL.lanternLit) : PAL.gold);
    v.bar.lookAt(camera.position.x, v.bar.getWorldPosition(tmp).y, camera.position.z);
    (v.ring.material as THREE.MeshBasicMaterial).opacity = l.lit && fuel >= TUNING.low_fuel_threshold ? 0.35 : 0; // fuel < 30: mất vùng an toàn
    if (l.lit) litCount++;
  }
  // ánh sáng môi trường tăng theo tiến độ: 0.15 + 0.55 × (đèn sáng / tổng đèn)
  hemi.intensity = 0.15 + 0.55 * (litCount / world.lanterns.length);
  if (flow === 'dawn' && dawnStart >= 0) hemi.intensity = Math.max(hemi.intensity, 0.35 + 0.65 * Math.min(1, settings.calm ? 1 : (t - dawnStart) / DAWN_S));
  mapView?.update(t);

  // vẽ hàng loạt (InstancedMesh) — Ticket-04 hiệu năng
  moteCrowd.update(world.motes, t);
  shadeCrowd.update(flow === 'dawn' ? [] : world.shades, t, p.pos); // bình minh: sương đen tan, Bóng Mực biến mất
  syncMap(world.drifters, drifterViews, makeDrifter, (v, d) => {
    v.visible = d.state !== 'removed' && flow !== 'dawn';
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

  if (flow !== 'bench') updateHud(litCount); // bench: HUD ẩn, không ghi DOM mỗi khung
}

const moteCells: HTMLElement[] = [];
for (let i = 0; i < TUNING.capacity_max; i++) {
  const s = document.createElement('span');
  $('h-motes').appendChild(s);
  moteCells.push(s);
}

// ---------- Phụ đề / chỉ báo hình ảnh (Ticket-04 mục 4) ----------
// Bóng Mực xuất hiện (+ mũi tên chỉ hướng ở mép màn hình), gió sắp thổi, 10 s cuối, đèn có fuel < 30.
const caps: { el: HTMLElement; until: number }[] = [];
let shadeArrow: { id: string; until: number } | null = null;
let prevWarn = false;
let saidLast10 = false;
const lowFuel = new Set<string>();
function caption(text: string, danger = false, ms = 4000) {
  if (!settings.captions || flow !== 'playing') return;
  const el = document.createElement('div');
  el.textContent = text;
  if (danger) el.className = 'danger';
  $('h-caps').appendChild(el);
  caps.push({ el, until: performance.now() + ms });
  while (caps.length > 4) caps.shift()!.el.remove();
}
function resetCaptions() {
  for (const c of caps) c.el.remove();
  caps.length = 0;
  shadeArrow = null;
  prevWarn = false;
  saidLast10 = false;
  lowFuel.clear();
}
function onShadeSpawned(id: string) {
  caption(settings.colorblind ? '⚠ Bóng Mực xuất hiện!' : '👁 Bóng Mực xuất hiện!', true);
  shadeArrow = { id, until: performance.now() + 4000 };
}
/** Đặt mũi tên: vật ngoài màn hình → ở mép, chỉ về phía vật; trong màn hình → phía trên vật, chỉ xuống. */
function placeArrow(el: HTMLElement, x: number, y: number, z: number, onScreenToo: boolean) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  const behind = v.z > 1;
  const off = behind || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
  if (!off && !onScreenToo) { el.style.display = 'none'; return; }
  let ax: number;
  let ay: number;
  let rot: number;
  if (off) {
    let px = behind ? -v.x : v.x;
    let py = behind ? -v.y : v.y;
    const m = Math.max(Math.abs(px), Math.abs(py)) || 1;
    px = (px / m) * 0.9;
    py = (py / m) * 0.85;
    ax = px; ay = py; rot = Math.atan2(px, py);
  } else {
    ax = v.x; ay = Math.min(0.9, v.y + 0.12); rot = Math.PI;
  }
  const half = el.offsetWidth / 2 || 17;
  el.style.display = 'block';
  el.style.left = `${((ax + 1) / 2) * window.innerWidth - half}px`;
  el.style.top = `${((1 - ay) / 2) * window.innerHeight - half}px`;
  el.style.transform = `rotate(${rot}rad)`;
}
function updateCaptions(secs: number, playing: boolean) {
  const now = performance.now();
  while (caps.length && caps[0].until < now) caps.shift()!.el.remove();
  const arrow = $('h-shade-arrow');
  if (!playing) { arrow.style.display = 'none'; return; }
  if (world.wind.warn && !prevWarn) caption('🍃 Gió sắp thổi — chuẩn bị bám chắc!');
  prevWarn = world.wind.warn;
  if (secs <= 10 && secs > 0 && !saidLast10) { saidLast10 = true; caption('⏳ 10 giây cuối!', true); }
  for (const l of world.lanterns) {
    const low = l.lit && l.fuelU < TUNING.low_fuel_threshold * 60;
    if (low && !lowFuel.has(l.id)) caption(`🏮 Đèn ${l.id} sắp cạn dầu (dưới ${TUNING.low_fuel_threshold}) — châm dầu!`, true, 5000);
    if (low) lowFuel.add(l.id); else lowFuel.delete(l.id);
  }
  const s = shadeArrow && now < shadeArrow.until && settings.captions ? world.shades.find((x) => x.id === shadeArrow!.id) : undefined;
  if (s) placeArrow(arrow, s.pos[0], s.pos[1] + 1.2, s.pos[2], true);
  else arrow.style.display = 'none';
}

// ---------- Nút kỹ năng tròn: hồi chiêu quét theo chiều kim đồng hồ + số giây ----------
const skReady: Record<string, boolean> = {};
function setCd(id: string, leftTicks: number, totalTicks: number, hasRes: boolean) {
  const el = $(id);
  const cooling = leftTicks > 0;
  el.style.setProperty('--cd', String(cooling ? Math.min(100, (leftTicks / totalTicks) * 100) : 0));
  el.classList.toggle('cooling', cooling);
  el.classList.toggle('empty', !cooling && !hasRes);
  const t = el.querySelector('.sk-t') as HTMLElement;
  t.textContent = cooling ? (leftTicks / 60).toFixed(1) : !hasRes ? `cần ${TUNING.pulse_cost}` : '';
  const ready = !cooling && hasRes;
  if (ready && skReady[id] === false) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } // vừa hồi xong
  skReady[id] = ready;
}

// ---------- Bản đồ nhỏ (bắc ở trên = hướng +z, giống góc nhìn camera lúc bắt đầu Đêm) ----------
const mmCtx = ($('h-map') as HTMLCanvasElement).getContext('2d')!;
function drawMinimap() {
  const c = mmCtx;
  const S = 240;
  const isl: [number, number, number][] = night === 1 ? [[0, 0, 40]] : night === 2 ? [[0, 0, 28], [70, 0, 28]] : [[0, 0, 45]];
  const minX = Math.min(...isl.map((i) => i[0] - i[2])), maxX = Math.max(...isl.map((i) => i[0] + i[2]));
  const minZ = Math.min(...isl.map((i) => i[1] - i[2])), maxZ = Math.max(...isl.map((i) => i[1] + i[2]));
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const sc = (S - 24) / Math.max(maxX - minX, maxZ - minZ);
  const X = (x: number) => S / 2 - (x - cx) * sc; // màn hình phải = x âm (như camera)
  const Z = (z: number) => S / 2 - (z - cz) * sc;
  c.clearRect(0, 0, S, S);
  c.save();
  c.beginPath(); c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#0b1230'; c.fillRect(0, 0, S, S);
  // đảo: bãi cát + cỏ
  for (const [x, z, r] of isl) {
    c.fillStyle = '#7d6a4a'; c.beginPath(); c.arc(X(x), Z(z), r * sc, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2d5a3c'; c.beginPath(); c.arc(X(x), Z(z), (r - 1.5) * sc, 0, Math.PI * 2); c.fill();
  }
  if (night === 2) { c.fillStyle = '#8a6a44'; c.fillRect(X(44), Z(2), 18 * sc, 4 * sc); } // cầu tre
  if (night === 3) {
    c.fillStyle = '#3d7050'; c.beginPath(); c.arc(X(0), Z(0), 24 * sc, Math.PI, 0); c.arc(X(0), Z(0), 12 * sc, 0, Math.PI, true); c.fill(); // tầng 1 (z > 0 ở trên)
    c.fillStyle = '#4c8762'; c.beginPath(); c.arc(X(0), Z(0), 8 * sc, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c9b48a'; c.beginPath(); c.arc(X(0), Z(0), 2.2 * sc, 0, Math.PI * 2); c.fill();
  }
  for (const pd of world.map.pads) { c.fillStyle = '#5fd0a0'; c.beginPath(); c.arc(X(pd.pos[0]), Z(pd.pos[2]), 3, 0, Math.PI * 2); c.fill(); }
  // đom đóm
  c.fillStyle = '#FFE58A';
  for (const m of world.motes) c.fillRect(X(m.pos[0]) - 1.5, Z(m.pos[2]) - 1.5, 3, 3);
  // Bùa Gió, Gió Lạc
  c.fillStyle = PAL.scarf;
  for (const ch of world.charms) if (ch.available) { c.save(); c.translate(X(ch.pos[0]), Z(ch.pos[2])); c.rotate(Math.PI / 4); c.fillRect(-3.5, -3.5, 7, 7); c.restore(); }
  c.fillStyle = '#cfe3ff';
  for (const d of world.drifters) if (d.state !== 'removed') { c.beginPath(); c.arc(X(d.pos[0]), Z(d.pos[2]), 3.5, 0, Math.PI * 2); c.fill(); }
  // Đèn Lồng Lớn: sáng = vàng, dầu < 30 = cảnh báo, tắt = xám
  for (const l of world.lanterns) {
    const low = l.lit && l.fuelU < TUNING.low_fuel_threshold * 60;
    const col = !l.lit ? '#8a8a8a' : low ? (settings.colorblind ? '#FFFFFF' : PAL.uiDanger) : '#FFD27A';
    if (l.lit) { c.fillStyle = 'rgba(255, 210, 122, 0.25)'; c.beginPath(); c.arc(X(l.pos[0]), Z(l.pos[2]), TUNING.safe_radius * sc, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(X(l.pos[0]), Z(l.pos[2]), 6, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  // Bóng Mực
  c.fillStyle = settings.colorblind ? '#00B3FF' : '#ff4d6d';
  for (const sh of world.shades) { c.beginPath(); c.arc(X(sh.pos[0]), Z(sh.pos[2]), sh.state === 'stunned' ? 3 : 4.5, 0, Math.PI * 2); c.fill(); }
  // Mây: hình nón tầm nhìn + mũi tên theo hướng camera
  const p = world.player;
  const th = (camYaw * Math.PI) / 180;
  const ang = Math.atan2(-Math.cos(th), -Math.sin(th)); // hướng (sin th, cos th) trong thế giới → góc trên canvas
  const px = X(p.pos[0]), pz = Z(p.pos[2]);
  const grad = c.createRadialGradient(px, pz, 0, px, pz, 46);
  grad.addColorStop(0, 'rgba(255, 246, 194, 0.45)'); grad.addColorStop(1, 'rgba(255, 246, 194, 0)');
  c.fillStyle = grad; c.beginPath(); c.moveTo(px, pz); c.arc(px, pz, 46, ang - 0.55, ang + 0.55); c.closePath(); c.fill();
  c.save(); c.translate(px, pz); c.rotate(ang + Math.PI / 2);
  c.fillStyle = '#FFF6C2'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, -9); c.lineTo(6.5, 7); c.lineTo(0, 3.5); c.lineTo(-6.5, 7); c.closePath(); c.fill(); c.stroke();
  c.restore();
  c.restore();
}

function updateHud(litCount: number) {
  const p = world.player;
  const playing = flow === 'playing';
  for (const id of ['h-flames', 'h-timer', 'h-right', 'h-motes', 'h-cds', 'h-hint', 'help', 'h-charm', 'h-wind', 'h-map']) $(id).style.visibility = playing ? 'visible' : 'hidden';
  $('h-flames').textContent = '🔥'.repeat(Math.max(0, p.flames)) + '·'.repeat(Math.max(0, TUNING.flames - p.flames));
  const tl = Math.max(0, timeLeft(world));
  const secs = Math.ceil(tl - 1e-9);
  $('h-timer').textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  $('h-timer').classList.toggle('danger', tl <= 30);
  if (tl <= 30 && settings.colorblind) $('h-timer').textContent = `⚠ ${$('h-timer').textContent}`; // mù màu: cảnh báo kèm biểu tượng
  if (playing && !world.paused && secs <= 10 && secs > 0 && secs !== lastCountdown) { lastCountdown = secs; sfx.countdown(); }
  updateCaptions(secs, playing);
  $('h-lit').textContent = `${litCount}/${world.lanterns.length}`;
  $('h-score').textContent = String(totalScore + world.score);
  const cap = capacity(world);
  moteCells.forEach((c, i) => { c.classList.toggle('on', i < p.carried); c.style.display = i < cap ? '' : 'none'; });
  $('h-cap').textContent = `${p.carried} / ${cap}`;
  $('h-cap').style.visibility = playing ? 'visible' : 'hidden';
  setCd('cd-dash', p.charmTicks > 0 ? 0 : p.dashCd, 90, true);
  setCd('cd-pulse', p.pulseCd, 180, p.carried >= TUNING.pulse_cost);
  if (playing) drawMinimap();
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
    if (d <= TUNING.interact_radius + 0.5 && Math.abs(target.pos[1] - p.pos[1]) <= 1.5) hint = `E — Nạp ánh sáng (${target.deposited}/${target.everLit ? TUNING.relight_cost : TUNING.lantern_cost})`;
    const refill = world.lanterns.find((l) => l.lit && l.fuelU < TUNING.fuel_max * 60 && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= TUNING.interact_radius + 0.5 && Math.abs(l.pos[1] - p.pos[1]) <= 1.5);
    if (refill && p.carried > 0) hint = `E — Châm dầu (${Math.floor(refill.fuelU / 60)}/${TUNING.fuel_max})`;
    placeArrow(arrow, target.pos[0], target.pos[1] + 2, target.pos[2], false);
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
if (BENCH) {
  // cảnh benchmark chuẩn: không menu, không HUD, không trang trí sáng tạo
  document.body.classList.add('bench');
  loadNight(1, createBenchWorld(Number(benchParams.get('seed') ?? 42)));
  flow = 'bench';
  show(null);
  // dựng sẵn mọi đối tượng rồi biên dịch shader trước khi đo (tránh khựng lần đầu vật thể lọt vào khung nhìn)
  draw(0, 0);
  for (const l of lanternViews.values()) l.model.update(1, true, 0, 100);
  renderer.setPixelRatio(1); // cảnh chuẩn: vẽ đúng 1280×720 điểm ảnh, không phụ thuộc tỉ lệ màn hình của máy
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.compile(scene, camera);
} else {
  loadNight(1);
  flow = 'menu';
  show('s-menu');
}
requestAnimationFrame(frame);
