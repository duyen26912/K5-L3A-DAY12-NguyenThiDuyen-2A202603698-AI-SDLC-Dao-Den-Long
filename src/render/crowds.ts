// Vẽ hàng loạt (InstancedMesh + Points) cho Bóng Mực và đom đóm — Ticket-04 (hiệu năng benchmark 200 Bóng Mực + 100 đom đóm).
// Hình dáng giữ như mô hình riêng lẻ trước đây (actors.ts / flame.ts) nhưng chỉ vài lần gọi vẽ cho cả đàn.
import * as THREE from 'three';
import { PAL } from './palette';
import { OUTER, SIDE, CORE, FLAME_GLOW } from './flame';
import { shadeTheme } from './actors';
import type { Shade, Mote, Vec3 } from '../core/world';

const m4 = new THREE.Matrix4();
const m4b = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const sv = new THREE.Vector3();
const col = new THREE.Color();

function glowPoints(max: number, color: string, size: number, opacity: number): THREE.Points {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  g.setDrawRange(0, 0);
  const p = new THREE.Points(g, new THREE.PointsMaterial({
    map: FLAME_GLOW, color, size, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  p.frustumCulled = false;
  return p;
}

// ---------- Bóng Mực ----------
const TENT = 8;
export class ShadeCrowd {
  private body: THREE.InstancedMesh;
  private rim: THREE.InstancedMesh;
  private eyes: THREE.InstancedMesh;
  private pupils: THREE.InstancedMesh;
  private tents: THREE.InstancedMesh;
  private aura: THREE.Points;
  private bodyMat: THREE.MeshStandardMaterial;
  private rimMat: THREE.MeshBasicMaterial;
  private pupilMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, private max = 256) {
    this.bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, emissive: PAL.shadeRim, emissiveIntensity: 0.45 });
    this.rimMat = new THREE.MeshBasicMaterial({ color: PAL.shadeRim, transparent: true, opacity: 0.65, side: THREE.BackSide, depthWrite: false });
    this.pupilMat = new THREE.MeshBasicMaterial({ color: PAL.shadeRim });
    this.body = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 18, 14), this.bodyMat, max);
    this.rim = new THREE.InstancedMesh(new THREE.SphereGeometry(0.8, 18, 14), this.rimMat, max);
    this.eyes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: '#f6ecff' }), max * 2);
    this.pupils = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), this.pupilMat, max * 2);
    const tGeo = new THREE.ConeGeometry(0.13, 0.75, 8);
    tGeo.translate(0, -0.37, 0);
    this.tents = new THREE.InstancedMesh(tGeo, this.bodyMat, max * TENT);
    this.aura = glowPoints(max, '#ffffff', 3.4, 0.85);
    for (const o of [this.body, this.rim, this.eyes, this.pupils, this.tents]) {
      o.count = 0;
      o.frustumCulled = false;
      o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    scene.add(this.body, this.rim, this.eyes, this.pupils, this.tents, this.aura);
  }

  update(shades: Shade[], t: number, player: Vec3) {
    const n = Math.min(shades.length, this.max);
    this.rimMat.color.set(shadeTheme.rim);
    this.pupilMat.color.set(shadeTheme.rim);
    this.bodyMat.emissive.set(shadeTheme.rim);
    (this.aura.material as THREE.PointsMaterial).color.set(shadeTheme.rim === PAL.shadeRim ? '#b48cff' : shadeTheme.rim);
    const auraPos = this.aura.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      const s = shades[i];
      const stunned = s.state === 'stunned';
      const bob = Math.sin(t * 3 + s.pos[0]) * 0.12;
      const yaw = Math.atan2(player[0] - s.pos[0], player[2] - s.pos[2]);
      const k = s.state === 'spawning' ? 0.4 : stunned ? 0.8 : 1 + Math.sin(t * 5 + i) * 0.04;
      const spin = stunned ? t * 3 : 0;
      v.set(s.pos[0], s.pos[1] + bob, s.pos[2]);
      // gốc của con: T · R(yaw) · S(k)
      m4b.compose(v, q.setFromEuler(e.set(0, yaw, 0)), sv.set(k, k, k));
      m4.compose(v.set(0, 0, 0), q.setFromEuler(e.set(0, spin, 0)), sv.set(1, 0.9, 1));
      this.body.setMatrixAt(i, m4.premultiply(m4b));
      this.body.setColorAt(i, col.set(stunned ? PAL.shadeStunned : PAL.shadeBody));
      m4.compose(v.set(0, 0, 0), q.identity(), sv.set(1, 0.9, 1));
      this.rim.setMatrixAt(i, m4.premultiply(m4b));
      for (let j = 0; j < 2; j++) {
        const sx = j ? 1 : -1;
        m4.compose(v.set(0.24 * sx, 0.12, 0.6), q.setFromEuler(e.set(0, 0, sx * 0.35)), sv.set(1, 0.7, 0.6));
        this.eyes.setMatrixAt(i * 2 + j, m4.premultiply(m4b));
        m4.compose(v.set(0.24 * sx, 0.11, 0.68), q.identity(), sv.set(1, 1, 1));
        this.pupils.setMatrixAt(i * 2 + j, m4.premultiply(m4b));
      }
      for (let j = 0; j < TENT; j++) {
        const a = (j / TENT) * Math.PI * 2;
        const sway = Math.sin(t * (stunned ? 2 : 5) + j + i) * (stunned ? 0.1 : 0.35);
        m4.compose(v.set(Math.cos(a) * 0.45, -0.35, Math.sin(a) * 0.45), q.setFromEuler(e.set(Math.sin(a) * sway, 0, -Math.cos(a) * sway)), sv.set(1, 1, 1));
        this.tents.setMatrixAt(i * TENT + j, m4.premultiply(m4b));
      }
      auraPos.setXYZ(i, s.pos[0], s.pos[1] + bob, s.pos[2]);
    }
    for (const o of [this.body, this.rim]) o.count = n;
    this.eyes.count = n * 2;
    this.pupils.count = n * 2;
    this.tents.count = n * TENT;
    for (const o of [this.body, this.rim, this.eyes, this.pupils, this.tents]) o.instanceMatrix.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    auraPos.needsUpdate = true;
    this.aura.geometry.setDrawRange(0, n);
  }
}

// ---------- Đom đóm (ngọn lửa nhỏ) ----------
const MOTE_SCALE = 0.62;
const PARTS: [THREE.BufferGeometry, string, number, [number, number, number]][] = [
  [OUTER, '#ffb347', 0.92, [0, -0.3, 0]],
  [SIDE, '#ff9f40', 0.85, [0.16, -0.28, 0.05]],
  [CORE, PAL.moteCore, 1, [-0.03, -0.29, 0.06]],
];
export class MoteCrowd {
  private parts: THREE.InstancedMesh[];
  private halo: THREE.Points;
  private sparks: THREE.Points;

  constructor(scene: THREE.Scene, private max = 256) {
    this.parts = PARTS.map(([geo, color, opacity]) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }), max);
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
      return m;
    });
    this.halo = glowPoints(max, PAL.moteHalo, 2.6 * MOTE_SCALE, 0.9);
    this.sparks = glowPoints(max * 3, PAL.moteHalo, 0.18, 1);
    scene.add(this.halo, this.sparks);
  }

  update(motes: Mote[], t: number) {
    const n = Math.min(motes.length, this.max);
    const hp = this.halo.geometry.attributes.position as THREE.BufferAttribute;
    const sp = this.sparks.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      const m = motes[i];
      const ph = Number(m.id.slice(1)) * 0.7;
      const blink = m.kind === 'dropped' && m.ttl !== null && m.ttl < 120 && Math.floor(t * 8) % 2 ? 0.5 : 1;
      const y = m.pos[1] + 0.75 + Math.sin(t * 2.5 + ph) * 0.25;
      const flick = 1 + Math.sin(t * 13 + ph) * 0.06;
      const k = MOTE_SCALE * blink;
      m4b.compose(v.set(m.pos[0], y, m.pos[2]), q.setFromEuler(e.set(0, t * 0.8 + ph, 0)), sv.set(k, k * flick, k));
      PARTS.forEach(([, , , off], j) => {
        m4.makeTranslation(off[0], off[1], off[2]);
        this.parts[j].setMatrixAt(i, m4.premultiply(m4b));
      });
      hp.setXYZ(i, m.pos[0], y, m.pos[2]);
      for (let j = 0; j < 3; j++) {
        const kk = (t * 0.6 + j / 3 + ph) % 1;
        sp.setXYZ(i * 3 + j, m.pos[0] + Math.sin(j * 2.1 + t) * 0.28, y - 0.05 + kk * 0.9, m.pos[2] + Math.cos(j * 2.1 + t) * 0.28);
      }
    }
    for (const p of this.parts) { p.count = n; p.instanceMatrix.needsUpdate = true; }
    hp.needsUpdate = true;
    sp.needsUpdate = true;
    this.halo.geometry.setDrawRange(0, n);
    this.sparks.geometry.setDrawRange(0, n * 3);
  }
}
