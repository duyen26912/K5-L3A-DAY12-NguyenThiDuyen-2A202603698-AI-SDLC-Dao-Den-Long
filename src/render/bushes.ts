// Bụi cây trang trí (chỉ hiển thị, không va chạm, không ảnh hưởng luật chơi), dáng hoạt hình mềm:
// nhiều khối tròn xanh chồng thành tán, lá nhỏ thò ra trên mặt tán, thân nâu phân nhánh ở dưới,
// vài lá phẳng quanh gốc. Có 3 cỡ: nhỏ, vừa, to.
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

// Khuôn tán ở cỡ 1 (cao ~2 m): [x, y, z, bán kính]
const BALLS: [number, number, number, number][] = [
  [0, 1.45, 0, 0.55],
  [-0.55, 1.15, 0.1, 0.45], [0.55, 1.2, 0, 0.45], [0.1, 1.15, -0.5, 0.45], [0.2, 1.1, 0.45, 0.42],
  [-0.75, 0.78, 0.2, 0.4], [0.75, 0.78, 0.15, 0.4], [-0.25, 0.82, 0.6, 0.45], [0.38, 0.76, 0.6, 0.42],
  [0, 0.82, -0.62, 0.42], [-0.6, 0.76, -0.42, 0.38], [0.6, 0.76, -0.42, 0.38],
];
// điểm cuối các nhánh thân (gốc ở (0, 0, 0))
const BRANCHES: [number, number, number][] = [
  [-0.45, 0.6, 0.25], [0.45, 0.6, 0.2], [0, 0.65, 0.4], [-0.3, 0.6, -0.35], [0.35, 0.6, -0.3],
];
const LEAVES_PER_BALL = 2;
const BASE_LEAVES = 7;

const SIZE_SCALE = [0.55, 0.85, 1.2]; // nhỏ, vừa, to
const LOW = new THREE.Color('#3a962e');
const HIGH = new THREE.Color('#93d24e');

export function addBushes(scene: THREE.Object3D, spots: { x: number; z: number }[]): void {
  const rnd = decoRng(4242);
  const n = spots.length;

  const ballMat = new THREE.MeshStandardMaterial({ roughness: 0.65, emissive: '#0d2a08', emissiveIntensity: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#58b53a', roughness: 0.6, emissive: '#0d2a08' });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5a38', roughness: 0.9 });

  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), ballMat, n * BALLS.length);
  const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), leafMat, n * (BALLS.length * LEAVES_PER_BALL + BASE_LEAVES));
  const branchGeo = new THREE.CylinderGeometry(0.6, 1, 1, 6);
  branchGeo.translate(0, 0.5, 0); // gốc nhánh ở đáy
  const branches = new THREE.InstancedMesh(branchGeo, trunkMat, n * BRANCHES.length);
  balls.castShadow = true;
  balls.receiveShadow = true;
  branches.castShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  let bi = 0;
  let li = 0;
  let ri = 0;

  spots.forEach((spot, idx) => {
    const k = SIZE_SCALE[idx % 3] * (0.9 + rnd() * 0.2);
    const rot = rnd() * Math.PI * 2;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const world = (lx: number, ly: number, lz: number) =>
      p.set(spot.x + (lx * cos + lz * sin) * k, ly * k, spot.z + (-lx * sin + lz * cos) * k);

    // thân nâu phân nhánh
    for (const [ex, ey, ez] of BRANCHES) {
      dir.set(ex * cos + ez * sin, ey, -ex * sin + ez * cos).normalize();
      q.setFromUnitVectors(UP, dir);
      const len = Math.hypot(ex, ey, ez) * k * 1.05;
      m.compose(p.set(spot.x, 0, spot.z), q, s.set(0.06 * k, len, 0.06 * k));
      branches.setMatrixAt(ri++, m);
    }

    // tán: các khối tròn, càng cao càng sáng
    for (const [x, y, z, r] of BALLS) {
      const rr = r * (0.92 + rnd() * 0.16);
      m.compose(world(x, y, z), q.identity(), s.setScalar(rr * k));
      balls.setMatrixAt(bi, m);
      col.copy(LOW).lerp(HIGH, Math.min(1, Math.max(0, (y - 0.7) / 0.85)));
      col.offsetHSL((rnd() - 0.5) * 0.02, 0, (rnd() - 0.5) * 0.05);
      balls.setColorAt(bi++, col);

      // lá nhỏ thò ra trên mặt khối, hướng ra ngoài
      for (let j = 0; j < LEAVES_PER_BALL; j++) {
        const u = rnd() * Math.PI * 2;
        const v = rnd() * 1.2; // phần trên của khối
        const nx = Math.sin(v) * Math.cos(u);
        const ny = Math.cos(v);
        const nz = Math.sin(v) * Math.sin(u);
        world(x + nx * rr * 1.02, y + ny * rr * 1.02, z + nz * rr * 1.02);
        dir.set(nx * cos + nz * sin, ny, -nx * sin + nz * cos).normalize();
        q.setFromUnitVectors(UP, dir);
        m.compose(p, q, s.set(0.07 * k, 0.15 * k, 0.035 * k));
        leaves.setMatrixAt(li++, m);
      }
    }

    // lá phẳng quanh gốc
    for (let j = 0; j < BASE_LEAVES; j++) {
      const a = (j / BASE_LEAVES) * Math.PI * 2 + rnd() * 0.5;
      const rad = 0.55 + rnd() * 0.25;
      world(Math.cos(a) * rad, 0.05, Math.sin(a) * rad);
      q.setFromAxisAngle(UP, -a + rot);
      m.compose(p, q, s.set(0.28 * k, 0.05 * k, 0.14 * k));
      leaves.setMatrixAt(li++, m);
    }
  });

  balls.instanceMatrix.needsUpdate = true;
  if (balls.instanceColor) balls.instanceColor.needsUpdate = true;
  scene.add(balls, leaves, branches);
}
