// Bụi cỏ lá trang trí (chỉ hiển thị, không va chạm, không ảnh hưởng luật chơi):
// mỗi bụi là nhiều chùm lá nhỏ chồng lên nhau, xanh đậm ở dưới và xanh vàng ở trên,
// kèm cỏ lưa thưa ở gốc và vài bông hoa vàng nhỏ. Có 3 cỡ: nhỏ, vừa, to (dạng gò rộng).
import * as THREE from 'three';

/** RNG riêng cho trang trí, cố định để cảnh giống nhau mỗi lần mở. */
function decoRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Size = 'small' | 'medium' | 'large';
interface Bush { x: number; z: number; size: Size; rot: number }

const SHAPE: Record<Size, { w: number; d: number; h: number; clumps: number; flowers: number }> = {
  small: { w: 0.7, d: 0.7, h: 0.75, clumps: 22, flowers: 1 },
  medium: { w: 1.1, d: 1.0, h: 1.3, clumps: 42, flowers: 3 },
  large: { w: 2.3, d: 1.3, h: 1.4, clumps: 80, flowers: 2 },
};

const LEAF_DARK = new THREE.Color('#1d5e24');
const LEAF_MID = new THREE.Color('#3f9a2e');
const LEAF_TOP = new THREE.Color('#a6d43a');

export function addBushes(scene: THREE.Scene, spots: { x: number; z: number }[]): void {
  const rnd = decoRng(12345);
  const bushes: Bush[] = spots.map((s, i) => ({
    x: s.x, z: s.z, rot: rnd() * Math.PI * 2,
    size: (['small', 'medium', 'large'] as const)[i % 3],
  }));

  const totalClumps = bushes.reduce((n, b) => n + SHAPE[b.size].clumps, 0);
  const totalFlowers = bushes.reduce((n, b) => n + SHAPE[b.size].flowers, 0);
  const totalGrass = bushes.length * 14;

  // chùm lá: khối nhiều mặt, đổ bóng phẳng cho cảm giác lá xếp lớp
  const clumpGeo = new THREE.IcosahedronGeometry(0.28, 0);
  const clumpMat = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
  const clumps = new THREE.InstancedMesh(clumpGeo, clumpMat, totalClumps);
  clumps.castShadow = true;
  clumps.receiveShadow = true;

  const grassGeo = new THREE.ConeGeometry(0.035, 0.32, 3);
  grassGeo.translate(0, 0.16, 0);
  const grass = new THREE.InstancedMesh(grassGeo, new THREE.MeshStandardMaterial({ color: '#4c9a35', roughness: 1 }), totalGrass);

  const flowerGeo = new THREE.SphereGeometry(0.045, 6, 4);
  const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ color: '#ffe14d', emissive: '#6b5a00', emissiveIntensity: 0.4 }), totalFlowers);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  let ci = 0;
  let gi = 0;
  let fi = 0;

  for (const b of bushes) {
    const sh = SHAPE[b.size];
    const cos = Math.cos(b.rot);
    const sin = Math.sin(b.rot);
    const place = (lx: number, y: number, lz: number) => p.set(b.x + lx * cos + lz * sin, y, b.z - lx * sin + lz * cos);

    for (let k = 0; k < sh.clumps; k++) {
      // điểm ngẫu nhiên trong nửa ellipsoid (mái vòm), dày hơn ở lớp ngoài
      const u = rnd() * Math.PI * 2;
      const v = Math.acos(rnd()); // 0 = đỉnh, π/2 = mép dưới
      const r = 0.55 + rnd() * 0.45;
      let lx = Math.sin(v) * Math.cos(u) * r * sh.w;
      const ly = Math.cos(v) * r * sh.h;
      const lz = Math.sin(v) * Math.sin(u) * r * sh.d;
      if (b.size === 'large') lx += Math.sin(u * 2) * 0.25; // gò rộng hơi gồ ghề, hai đỉnh
      place(lx, ly + 0.12, lz);
      const s = (b.size === 'small' ? 0.8 : 1) * (0.75 + rnd() * 0.6);
      sc.set(s, s * (0.8 + rnd() * 0.3), s);
      e.set(rnd() * 3, rnd() * 3, rnd() * 3);
      q.setFromEuler(e);
      m.compose(p, q, sc);
      clumps.setMatrixAt(ci, m);
      // màu theo độ cao: gốc xanh đậm → ngọn xanh vàng, thêm chút biến thiên
      const hFrac = Math.min(1, Math.max(0, ly / sh.h));
      if (hFrac < 0.5) col.copy(LEAF_DARK).lerp(LEAF_MID, hFrac * 2);
      else col.copy(LEAF_MID).lerp(LEAF_TOP, (hFrac - 0.5) * 2);
      col.offsetHSL((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.08);
      clumps.setColorAt(ci, col);
      ci++;
    }

    for (let k = 0; k < 14; k++) {
      const a = rnd() * Math.PI * 2;
      const rr = 0.85 + rnd() * 0.35;
      place(Math.cos(a) * sh.w * rr, 0, Math.sin(a) * sh.d * rr);
      e.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6);
      q.setFromEuler(e);
      const s = 0.7 + rnd() * 0.7;
      m.compose(p, q, sc.set(1, s, 1));
      grass.setMatrixAt(gi++, m);
    }

    for (let k = 0; k < sh.flowers; k++) {
      const a = rnd() * Math.PI * 2;
      place(Math.cos(a) * sh.w * 0.95, 0.08 + rnd() * 0.15, Math.sin(a) * sh.d * 0.95);
      m.compose(p, q.identity(), sc.set(1, 1, 1));
      flowers.setMatrixAt(fi++, m);
    }
  }
  clumps.instanceMatrix.needsUpdate = true;
  if (clumps.instanceColor) clumps.instanceColor.needsUpdate = true;
  scene.add(clumps, grass, flowers);
}
