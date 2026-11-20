// Vật trang trí 3D tự dựng bằng hình khối Three.js (chỉ hiển thị, không va chạm, không ảnh hưởng luật chơi):
// cây thông, cây hoa anh đào, cây cau, cầu gỗ có trụ đèn (Đêm 2).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
const shadow = <T extends THREE.Object3D>(o: T): T => {
  o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return o;
};

// ---------- Cây thông: 4 tầng tán hình nón, mép rủ xuống thành răng cưa ----------
function scallopCone(r: number, h: number): THREE.ConeGeometry {
  const g = new THREE.ConeGeometry(r, h, 18, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < -h / 2 + 1e-3) {
      // vòng đáy: xen kẽ mũi lá dài/ngắn, mũi dài rủ xuống
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const tip = (Math.round((a / (Math.PI * 2)) * 18) % 2 + 2) % 2 === 0;
      const k = tip ? 1 : 0.8;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
      p.setY(i, y - (tip ? h * 0.12 : 0));
    }
  }
  g.computeVertexNormals();
  return g;
}
const PINE_GREEN = mat('#2f7a34', { flatShading: true });
const PINE_DARK = mat('#26662b', { flatShading: true });
const TRUNK = mat('#7a4a2a');

export function makePine(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.2, 10), TRUNK);
  trunk.position.y = 0.6;
  g.add(trunk);
  const tiers: [number, number, number][] = [[1.6, 1.6, 1.6], [1.3, 1.4, 2.5], [1.0, 1.25, 3.3], [0.65, 1.15, 4.0]];
  tiers.forEach(([r, h, y], i) => {
    const t = new THREE.Mesh(scallopCone(r, h), i % 2 ? PINE_DARK : PINE_GREEN);
    t.position.y = y;
    g.add(t);
  });
  g.scale.setScalar(scale);
  return shadow(g);
}

// ---------- Cây hoa anh đào: thân chia nhánh, tán hồng bo tròn, hoa 5 cánh ----------
const PINK = mat('#f2a7b3', { roughness: 0.6 });
const PETAL = mat('#f8c8d0', { roughness: 0.5 });
const PETAL_CENTER = mat('#e2556b', { roughness: 0.5 });

function makeFlower(): THREE.Group {
  const f = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6), PETAL);
    petal.scale.set(1, 1, 0.35);
    petal.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0);
    f.add(petal);
  }
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), PETAL_CENTER);
  c.position.z = 0.05;
  f.add(c);
  return f;
}

export function makeBlossom(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 1.6, 10), TRUNK);
  trunk.position.y = 0.8;
  g.add(trunk);
  for (const s of [-1, 1]) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 1.0, 8), TRUNK);
    br.position.set(s * 0.32, 1.75, 0);
    br.rotation.z = -s * 0.6;
    g.add(br);
  }
  const blobs: [number, number, number, number][] = [
    [0, 2.7, 0, 1.0], [-0.9, 2.35, 0.1, 0.8], [0.9, 2.4, 0, 0.82], [0.2, 2.3, 0.7, 0.75], [-0.2, 2.35, -0.7, 0.75], [0.1, 3.3, -0.1, 0.7],
  ];
  const tmp = new THREE.Vector3();
  blobs.forEach(([x, y, z, r], i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), PINK);
    b.position.set(x, y, z);
    g.add(b);
    // 2 bông hoa nằm trên mặt mỗi khối tán, quay ra ngoài
    for (let k = 0; k < 2; k++) {
      const a = i * 1.7 + k * 2.4;
      const n = tmp.set(Math.cos(a), 0.35 + k * 0.3, Math.sin(a)).normalize();
      const f = makeFlower();
      f.position.set(x + n.x * r, y + n.y * r, z + n.z * r);
      f.lookAt(x + n.x * r * 2, y + n.y * r * 2, z + n.z * r * 2);
      g.add(f);
    }
  });
  g.scale.setScalar(scale);
  return shadow(g);
}

// ---------- Cầu gỗ Đêm 2: bệ đá hai đầu, mặt cầu ván gỗ phẳng (Y = 0, không lan can theo ticket), 4 trụ đèn ----------
const WOOD = mat('#8a5a32');
const WOOD_DARK = mat('#6b4a2f');
const STONE = mat('#6f747c', { roughness: 0.95 });
const IRON = mat('#22262b', { metalness: 0.4, roughness: 0.5 });
const GLASS = new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ffb347', emissiveIntensity: 1.6 });

function bridgePost(): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.5, 0.45), WOOD);
  post.position.y = 0.75;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.6), STONE);
  cap.position.y = 1.65;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), IRON);
  base.position.y = 1.86;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.18, 0.42, 4), GLASS);
  glass.rotation.y = Math.PI / 4;
  glass.position.y = 2.1;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.2, 4), IRON);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.42;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), IRON);
  knob.position.y = 2.56;
  g.add(post, cap, base, glass, roof, knob);
  return g;
}

export function makeBridge(x0: number, x1: number, halfW: number): THREE.Group {
  const g = new THREE.Group();
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  // ván ngang
  const plankGeo = new THREE.BoxGeometry(0.42, 0.14, halfW * 2);
  for (let x = x0 + 0.25; x < x1; x += 0.47) {
    const p = new THREE.Mesh(plankGeo, Math.round(x * 2) % 2 ? WOOD : WOOD_DARK);
    p.position.set(x, -0.07, 0);
    g.add(p);
  }
  // dầm dọc hai bên (sát mặt cầu, không phải lan can) + dầm đỡ bên dưới
  for (const s of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.18), WOOD_DARK);
    edge.position.set(cx, -0.12, s * (halfW - 0.05));
    const under = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.3), WOOD_DARK);
    under.position.set(cx, -0.38, s * (halfW - 0.5));
    g.add(edge, under);
  }
  // bệ đá hai đầu (trên đất đảo, mặt bệ thấp hơn mặt cầu)
  for (const xe of [x0, x1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, halfW * 2 + 1.6), STONE);
    pier.position.set(xe, -0.78, 0);
    g.add(pier);
  }
  // 4 trụ đèn ở bốn góc, đứng trên đất đảo ngoài lối đi
  for (const xe of [x0 + 0.3, x1 - 0.3]) {
    for (const s of [-1, 1]) {
      const post = bridgePost();
      post.position.set(xe, 0, s * (halfW + 0.35));
      g.add(post);
    }
  }
  return shadow(g);
}

// ---------- Cây cau: gò cát, thân đốt cong nhẹ, tán 7 lá rủ ----------
const SAND = mat('#d9bf86');
const PALM_TRUNK = mat('#9a6534');
const PALM_RING = mat('#7d4f28');
const PALM_LEAF = mat('#5aa83f', { side: THREE.DoubleSide, roughness: 0.6 });

/** Một tàu lá: dải cong từ gốc ra ngọn, rộng giữa, rủ xuống. */
function frond(len: number, width: number): THREE.BufferGeometry {
  const seg = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const x = u * len;
    const y = Math.sin(u * Math.PI * 0.55) * len * 0.28 - u * u * len * 0.55; // vươn lên rồi rủ xuống
    const w = Math.sin(Math.PI * Math.min(1, u * 1.1)) * width * (1 - u * 0.3);
    const fold = w * 0.35; // gân giữa gập chữ V
    pos.push(x, y + fold, -w, x, y, 0, x, y + fold, w);
    if (i < seg) {
      const b = i * 3;
      idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function makePalm(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), SAND);
  mound.scale.y = 0.22;
  g.add(mound);
  // thân: 6 đốt, nghiêng dần
  let x = 0;
  let y = 0.1;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const r0 = 0.26 - i * 0.02;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r0 - 0.03, r0, 0.62, 10), PALM_TRUNK);
    seg.position.set(x, y + 0.31, 0);
    seg.rotation.z = -0.05 * i;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r0 - 0.02, 0.035, 6, 14), PALM_RING);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y + 0.6, 0);
    g.add(seg, ring);
    x += Math.sin(0.05 * i) * 0.62;
    y += 0.6;
  }
  const crown = new THREE.Group();
  crown.position.set(x, y + 0.05, 0);
  const geo = frond(2.4, 0.42);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(geo, PALM_LEAF);
    leaf.rotation.y = (i / 7) * Math.PI * 2;
    leaf.rotation.z = 0.15;
    crown.add(leaf);
  }
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), PALM_LEAF);
  crown.add(top);
  g.add(crown);
  g.scale.setScalar(scale);
  return shadow(g);
}
