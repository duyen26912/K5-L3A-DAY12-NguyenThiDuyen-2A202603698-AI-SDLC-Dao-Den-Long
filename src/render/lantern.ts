// Mô hình Đèn Lồng Lớn (chỉ hiển thị), tự dựng bằng hình khối Three.js theo dáng cột đèn:
// chân đế loe, thân cột dài có các vòng đai, đầu đèn kính loe lên trên chia ô, mái chóp có quả cầu trên đỉnh.
// Ánh sáng theo tiến độ nạp: chưa nạp → tắt; nạp dở → sáng nhẹ; đủ → sáng mạnh + vùng sáng quanh đèn.
import * as THREE from 'three';
import { makeFlame } from './flame';

export interface LanternModel {
  group: THREE.Group;
  /** frac = deposited / lantern_cost (0…1), lit = đèn đã thắp. */
  /** fuel 0…100 (đèn sáng). Đèn tắt: xẹp 20% + vết rách; fuel < 30: nhấp nháy 1 Hz (phân biệt không cần màu). */
  update(frac: number, lit: boolean, t: number, fuel?: number): void;
}

/** Chiều cao để đặt thanh tiến độ phía trên đèn. */
export const LANTERN_TOP_Y = 5.9;

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

/** Khối 4 cạnh (hình chóp cụt vuông) xoay 45° để mặt phẳng hướng theo trục X/Z. */
function squareFrustum(rTop: number, rBottom: number, h: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 4, 1), mat);
  m.rotation.y = Math.PI / 4;
  return m;
}

export function makeLanternModel(safeRadius: number): LanternModel {
  const group = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: '#2f3432', roughness: 0.55, metalness: 0.35 });
  const ironDark = new THREE.MeshStandardMaterial({ color: '#232726', roughness: 0.6, metalness: 0.3 });
  const add = (m: THREE.Mesh, y: number) => { m.position.y = y; m.castShadow = true; group.add(m); return m; };

  // ---- chân đế ----
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.45, 24), ironDark), 0.22);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.6, 0.12, 24), iron), 0.5);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 1.1, 24), iron), 1.1); // phần loe
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.16, 20), ironDark), 1.72); // vòng đai dưới

  // ---- thân cột ----
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 2.0, 16), iron), 2.8);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 20), ironDark), 3.85); // vòng đai trên
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.12, 0.35, 20), iron), 4.1); // cổ loe đỡ đầu đèn

  // ---- đầu đèn ----
  const HEAD_Y = 4.95; // tâm phần kính
  const GLASS_H = 1.1;
  add(squareFrustum(0.55, 0.55, 0.12, ironDark), HEAD_Y - GLASS_H / 2 - 0.06); // khay đáy
  const glassMat = new THREE.MeshStandardMaterial({ color: '#5B5F6E', emissive: '#FFB347', emissiveIntensity: 0, roughness: 0.3, transparent: true, opacity: 0.85, depthWrite: false });
  const glass = add(squareFrustum(0.6, 0.42, GLASS_H, glassMat), HEAD_Y);
  glass.castShadow = false;
  // khung: 4 trụ góc + 2 song cửa mỗi mặt (đi theo độ loe của kính)
  const barGeo = new THREE.BoxGeometry(0.05, GLASS_H + 0.02, 0.05);
  const tilt = Math.atan2(0.6 - 0.42, GLASS_H); // độ nghiêng mặt kính
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    for (const u of [-1, -1 / 3, 1 / 3, 1]) {
      const bar = new THREE.Mesh(barGeo, ironDark);
      const half = (0.42 + 0.6) / 2 / Math.SQRT2 + 0.012; // nửa cạnh trung bình (xoay 45°)
      // toạ độ trên mặt phẳng phía trước (z+), rồi xoay quanh trục Y
      const lx = u * half;
      const lz = half;
      bar.position.set(lx * Math.cos(a) + lz * Math.sin(a), HEAD_Y, -lx * Math.sin(a) + lz * Math.cos(a));
      bar.rotation.y = a;
      bar.rotateX(tilt);
      bar.rotateZ(-tilt * u * 0.9);
      group.add(bar);
    }
  }
  add(squareFrustum(0.66, 0.62, 0.16, ironDark), HEAD_Y + GLASS_H / 2 + 0.08); // đai trên kính
  add(squareFrustum(0.86, 0.86, 0.08, iron), HEAD_Y + GLASS_H / 2 + 0.2); // vành mái
  add(squareFrustum(0.12, 0.78, 0.55, iron), HEAD_Y + GLASS_H / 2 + 0.5); // mái chóp
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.12, 16), ironDark), HEAD_Y + GLASS_H / 2 + 0.82);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), iron), HEAD_Y + GLASS_H / 2 + 0.98); // quả cầu đỉnh

  // vết rách trên giấy/kính khi đèn tắt (Ticket-03: phân biệt đèn tắt không cần màu)
  const tearMat = new THREE.MeshBasicMaterial({ color: '#d8d2c0' }); // vết rách lộ giấy sáng màu trên kính tối
  const tears: THREE.Mesh[] = [];
  for (const z of [0.31, -0.31]) {
    for (const [dx, dy, rot, len] of [[-0.08, 0.15, 0.7, 0.42], [0.1, -0.12, -0.5, 0.34]] as const) {
      const tear = new THREE.Mesh(new THREE.BoxGeometry(0.06, len, 0.01), tearMat);
      tear.position.set(dx, HEAD_Y + dy, z);
      tear.rotation.z = rot;
      group.add(tear);
      tears.push(tear);
    }
  }

  // ngọn lửa bên trong kính (cùng kiểu với đom đóm): hiện khi đèn có ánh sáng
  const fire = makeFlame(0.9, 1.8, 0.7);
  fire.group.position.y = HEAD_Y - 0.12;
  fire.group.visible = false;
  group.add(fire.group);

  // ánh đèn
  const light = new THREE.PointLight('#FFB347', 0, 20, 1.3);
  light.position.y = HEAD_Y;
  group.add(light);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = HEAD_Y;
  group.add(halo);
  // vùng sáng trên mặt đất (bán kính = vùng an toàn), chỉ khi đèn đã thắp
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(safeRadius, 48),
    new THREE.MeshBasicMaterial({ map: GLOW, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.02;
  group.add(pool);

  return {
    group,
    update(frac, lit, t, fuel = 100) {
      // sắp hết dầu: nhấp nháy chậm 1 Hz (nửa giây sáng, nửa giây mờ)
      const low = lit && fuel < 30;
      const blink = low && (t % 1) > 0.5 ? 0.3 : 1;
      const flick = (1 + Math.sin(t * 11) * 0.04 + Math.sin(t * 6.7) * 0.03) * blink;
      group.scale.y = lit || frac > 0 ? 1 : 0.8; // đèn tắt bị xẹp 20%
      for (const tr of tears) tr.visible = !lit;
      const haloMat = halo.material as THREE.SpriteMaterial;
      const poolMat = pool.material as THREE.MeshBasicMaterial;
      if (lit) {
        // đủ: kính vàng cam rực, sáng mạnh + vùng sáng
        glassMat.color.set('#FFB347');
        glassMat.emissiveIntensity = 0.55 * flick;
        glassMat.opacity = 0.4; // kính trong để thấy lửa
        fire.group.visible = true;
        fire.group.scale.setScalar(0.9);
        fire.animate(t);
        light.intensity = 34 * flick;
        light.distance = 22;
        haloMat.opacity = 0.75 * flick;
        halo.scale.setScalar(5);
        poolMat.opacity = 0.55;
      } else if (frac > 0) {
        // nạp dở: kính ấm lên, sáng nhẹ theo tiến độ
        glassMat.color.set('#6a5530');
        glassMat.emissiveIntensity = (0.1 + frac * 0.2) * flick;
        glassMat.opacity = 0.55;
        fire.group.visible = true; // lửa nhỏ, lớn dần theo tiến độ nạp
        fire.group.scale.setScalar(0.35 + frac * 0.45);
        fire.animate(t);
        light.intensity = 3 + frac * 7;
        light.distance = 8;
        haloMat.opacity = 0.15 + frac * 0.2;
        halo.scale.setScalar(2.4);
        poolMat.opacity = 0;
      } else {
        // chưa nạp: tắt hẳn, kính tối
        glassMat.color.set('#5B5F6E');
        glassMat.emissiveIntensity = 0;
        glassMat.opacity = 0.85;
        fire.group.visible = false;
        light.intensity = 0;
        haloMat.opacity = 0;
        poolMat.opacity = 0;
      }
    },
  };
}
