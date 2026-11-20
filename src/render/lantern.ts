// Mô hình Đèn Lồng Lớn (chỉ hiển thị), tự dựng bằng hình khối Three.js:
// đế gỗ vàng cam bo tròn, 4 trụ khung tối, kính trong, mái tối bo tròn có quai tròn, ngọn lửa bên trong.
// Ánh sáng theo tiến độ nạp: chưa nạp → tắt; nạp dở → sáng nhẹ; đủ → sáng mạnh + vùng sáng quanh đèn.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface LanternModel {
  group: THREE.Group;
  /** frac = deposited / lantern_cost (0…1), lit = đèn đã thắp. */
  update(frac: number, lit: boolean, t: number): void;
}

function teardrop(height: number, radius: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const v = i / 16;
    const r = radius * Math.sin(Math.PI * Math.min(1, v * 1.15)) * (1 - v * 0.85);
    pts.push(new THREE.Vector2(Math.max(0.0001, r), v * height));
  }
  return new THREE.LatheGeometry(pts, 20);
}

function radialTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,200,120,0.9)');
  grad.addColorStop(0.5, 'rgba(255,170,80,0.35)');
  grad.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const GLOW = radialTexture();

export function makeLanternModel(safeRadius: number): LanternModel {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: '#2c313c', roughness: 0.55, metalness: 0.2 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#3b414d', roughness: 0.5, metalness: 0.15 });
  const baseMat = new THREE.MeshStandardMaterial({ color: '#c98b3c', roughness: 0.6 });

  const body = new THREE.Group();
  body.scale.setScalar(1.25); // Đèn Lồng Lớn cao khoảng 4.3 m
  group.add(body);

  // đế gỗ
  const base = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.36, 1.5, 4, 0.12), baseMat);
  base.position.y = 0.18;
  body.add(base);
  const baseInner = new THREE.Mesh(new RoundedBoxGeometry(1.14, 0.06, 1.14, 2, 0.02), frameMat);
  baseInner.position.y = 0.39;
  body.add(baseInner);

  // 4 trụ khung
  const pillarGeo = new THREE.CylinderGeometry(0.075, 0.075, 1.75, 8);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, frameMat);
      p.position.set(sx * 0.6, 1.27, sz * 0.6);
      body.add(p);
    }
  }
  // thanh ngang trên / dưới
  for (const y of [0.43, 2.12]) {
    for (const [w, d, x, z] of [[1.28, 0.08, 0, 0.6], [1.28, 0.08, 0, -0.6], [0.08, 1.28, 0.6, 0], [0.08, 1.28, -0.6, 0]] as const) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), frameMat);
      bar.position.set(x, y, z);
      body.add(bar);
    }
  }

  // kính
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#f2d6b0', transparent: true, opacity: 0.25, roughness: 0.15,
    emissive: '#ff9a3c', emissiveIntensity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.14, 1.66, 1.14), glassMat);
  glass.position.y = 1.27;
  body.add(glass);

  // mái + chóp + quai tròn
  const roof = new THREE.Mesh(new RoundedBoxGeometry(1.75, 0.42, 1.75, 4, 0.16), roofMat);
  roof.position.y = 2.35;
  body.add(roof);
  const roofTop = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.24, 1.2, 4, 0.1), roofMat);
  roofTop.position.y = 2.62;
  body.add(roofTop);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.26, 20), roofMat);
  knob.position.y = 2.86;
  body.add(knob);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.11, 12, 28), roofMat);
  handle.position.y = 3.3;
  body.add(handle);

  // ngọn lửa hai lớp
  const flame = new THREE.Group();
  const outerMat = new THREE.MeshBasicMaterial({ color: '#ff8a1e', transparent: true, opacity: 0.95 });
  const innerMat = new THREE.MeshBasicMaterial({ color: '#ffe36a' });
  const outer = new THREE.Mesh(teardrop(0.95, 0.36), outerMat);
  const inner = new THREE.Mesh(teardrop(0.55, 0.2), innerMat);
  inner.position.y = 0.04;
  flame.add(outer, inner);
  flame.position.y = 0.55;
  body.add(flame);

  // ánh đèn
  const light = new THREE.PointLight('#ffa040', 0, 20, 1.3);
  light.position.y = 1.6;
  group.add(light);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 1.6;
  group.add(halo);
  // vùng sáng trên mặt đất (bán kính = vùng an toàn), chỉ khi đèn đã thắp
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(safeRadius, 48),
    new THREE.MeshBasicMaterial({ map: GLOW, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.02;
  group.add(pool);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== glass && o !== pool && !flame.children.includes(o)) o.castShadow = true;
  });

  return {
    group,
    update(frac, lit, t) {
      const flick = 1 + Math.sin(t * 13) * 0.05 + Math.sin(t * 7.3) * 0.04;
      const haloMat = halo.material as THREE.SpriteMaterial;
      const poolMat = pool.material as THREE.MeshBasicMaterial;
      if (lit) {
        // đủ: sáng mạnh + vùng sáng
        flame.visible = true;
        flame.scale.set(1, flick, 1);
        light.intensity = 32 * flick;
        light.distance = 22;
        glassMat.emissiveIntensity = 0.6 * flick;
        glassMat.opacity = 0.35;
        haloMat.opacity = 0.7 * flick;
        halo.scale.setScalar(5.5);
        poolMat.opacity = 0.55;
      } else if (frac > 0) {
        // nạp dở: lửa nhỏ, sáng nhẹ theo tiến độ
        flame.visible = true;
        const s = 0.35 + frac * 0.4;
        flame.scale.set(s, s * flick, s);
        light.intensity = 3 + frac * 7;
        light.distance = 8;
        glassMat.emissiveIntensity = 0.15 + frac * 0.15;
        glassMat.opacity = 0.28;
        haloMat.opacity = 0.15 + frac * 0.2;
        halo.scale.setScalar(2.5);
        poolMat.opacity = 0;
      } else {
        // chưa nạp: tắt hẳn
        flame.visible = false;
        light.intensity = 0;
        glassMat.emissiveIntensity = 0;
        glassMat.opacity = 0.22;
        haloMat.opacity = 0;
        poolMat.opacity = 0;
      }
    },
  };
}
