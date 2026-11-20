// Ngọn lửa hoạt hình dùng chung (đom đóm, đầu gậy của Mây, lửa trong Đèn Lồng Lớn):
// giọt lửa tròn đáy, đỉnh uốn cong, thêm một lưỡi lửa phụ bên cạnh, lõi sáng, quầng sáng.
import * as THREE from 'three';
import { PAL } from './palette';

/** Giọt lửa: đáy tròn, đỉnh nhọn hơi lệch (xoay quanh trục Y). */
function flameGeo(h: number, r: number, lean = 0.18): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const v = i / n; // 0 = đáy, 1 = đỉnh
    // đáy tròn (nửa dưới hình cầu) rồi thu nhỏ dần lên đỉnh
    const rr = v < 0.38 ? Math.sin((v / 0.38) * Math.PI / 2) * r : r * Math.pow(1 - (v - 0.38) / 0.62, 1.35);
    pts.push(new THREE.Vector2(Math.max(0.0001, rr), v * h));
  }
  const g = new THREE.LatheGeometry(pts, 24);
  // uốn đỉnh lửa sang một bên
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / h;
    p.setX(i, p.getX(i) + Math.pow(Math.max(0, y - 0.35), 2) * lean * h);
  }
  g.computeVertexNormals();
  return g;
}

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,229,138,0.95)');
  grad.addColorStop(0.35, 'rgba(255,190,90,0.45)');
  grad.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const FLAME_GLOW = glowTexture();

const OUTER = flameGeo(1, 0.36, 0.22);
const SIDE = flameGeo(0.62, 0.2, -0.3);
const CORE = flameGeo(0.6, 0.24, 0.1);

export interface Flame {
  group: THREE.Group;
  halo: THREE.Sprite;
  /** flicker theo thời gian; boost (0…1) làm lửa bùng to và sáng hơn (lóe sáng). */
  animate(t: number, boost?: number): void;
}

/**
 * Ngọn lửa cao `height` m. Màu: lõi #FFF6C2 và quầng #FFE58A (bảng màu chuẩn của đom đóm),
 * lớp ngoài vàng cam ấm.
 */
export function makeFlame(height = 1, haloSize = 2.2, phase = 0): Flame {
  const group = new THREE.Group();
  const outerMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.92, depthWrite: false });
  const sideMat = new THREE.MeshBasicMaterial({ color: '#ff9f40', transparent: true, opacity: 0.85, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: PAL.moteCore });
  const outer = new THREE.Mesh(OUTER, outerMat);
  const side = new THREE.Mesh(SIDE, sideMat);
  side.position.set(0.16, 0.02, 0.05);
  const core = new THREE.Mesh(CORE, coreMat);
  core.position.set(-0.03, 0.01, 0.06);
  const inner = new THREE.Group();
  inner.add(outer, side, core);
  inner.position.y = -0.3; // gốc tọa độ ở gần tâm phần tròn của lửa
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLAME_GLOW, color: PAL.moteHalo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(haloSize);
  group.add(halo, inner);
  group.scale.setScalar(height);
  return {
    group,
    halo,
    animate(t, boost = 0) {
      const f = 1 + Math.sin(t * 13 + phase) * 0.06 + Math.sin(t * 7.7 + phase * 2) * 0.05;
      inner.scale.set(1 + boost * 0.4, f * (1 + boost * 0.6), 1 + boost * 0.4);
      side.rotation.z = Math.sin(t * 9 + phase) * 0.15;
      inner.rotation.z = Math.sin(t * 5 + phase) * 0.05;
      halo.scale.setScalar(haloSize * (0.9 + 0.1 * Math.sin(t * 4 + phase) + boost * 1.4));
      (halo.material as THREE.SpriteMaterial).opacity = 0.75 + boost * 0.25;
    },
  };
}
