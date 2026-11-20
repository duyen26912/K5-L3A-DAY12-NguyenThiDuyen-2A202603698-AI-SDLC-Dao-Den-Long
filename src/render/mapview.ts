// Dựng hình bản đồ chuẩn của từng Đêm (chỉ hiển thị, đọc hình dạng từ src/core/maps.ts).
import * as THREE from 'three';
import { NightMap } from '../core/maps';
import { PAL } from './palette';
import { addBushes } from './bushes';
import { makePadModel } from './actors';
import { makePine, makeBlossom, makeBridge, makePalm, makeRocks } from './decor';

const grassMat = () => new THREE.MeshStandardMaterial({ color: PAL.grass, roughness: 1 });
const sandMat = () => new THREE.MeshStandardMaterial({ color: PAL.sand, roughness: 1 });
const woodMat = () => new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 0.9 });
const rockMat = () => new THREE.MeshStandardMaterial({ color: '#3b4a52', roughness: 1 });

function island(group: THREE.Group, cx: number, cz: number, r: number) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r - 1.5, r - 1.5, 0.2, 72), grassMat());
  top.position.set(cx, -0.1, cz);
  top.receiveShadow = true;
  const beach = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.18, 72), sandMat());
  beach.position.set(cx, -0.12, cz);
  beach.receiveShadow = true;
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.55, 8, 48), rockMat());
  rock.position.set(cx, -4.2, cz);
  group.add(top, beach, rock);
}

function pad(group: THREE.Group, x: number, y: number, z: number, anims: ((t: number) => void)[]) {
  const m = makePadModel(); // bán kính 1 m, đúng vị trí chuẩn
  m.group.position.set(x, y + 0.02, z);
  group.add(m.group);
  anims.push(m.animate);
}

export interface MapView { group: THREE.Group; update(t: number): void }

/** decor = false: tắt cây cối/bụi cây trang trí (cảnh benchmark chuẩn của Ticket-04). */
export function buildMap(map: NightMap, opts: { decor?: boolean } = {}): MapView {
  const decor = opts.decor ?? true;
  const g = new THREE.Group();
  // biển mây
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: PAL.cloudSea, roughness: 1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -12;
  g.add(sea);

  const lanternXZ = map.lanterns.map((l) => l.pos);
  const farFromLanterns = (x: number, z: number) => lanternXZ.every((p) => Math.hypot(p[0] - x, p[2] - z) > 4);

  if (map.night === 1) {
    island(g, 0, 0, 40);
  } else if (map.night === 2) {
    island(g, 0, 0, 28);
    island(g, 70, 0, 28);
    // cầu gỗ x ∈ [26, 44], z ∈ [−2, 2] (mặt cầu phẳng Y = 0, không lan can — đúng bản đồ chuẩn)
    g.add(makeBridge(26, 44, 2));
  } else {
    island(g, 0, 0, 45);
    // tầng 1: vành khăn 12–24 m ở nửa z > 0, cao 3 m
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, 0, Math.PI, false);
    shape.absarc(0, 0, 12, Math.PI, 0, true);
    const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 48 }), [grassMat(), rockMat()]);
    tier1.rotation.set(Math.PI / 2, 0, 0); // shape y > 0 → z > 0; khối đùn từ Y = 0 xuống −3 rồi nâng lên 3
    tier1.position.y = 3;
    tier1.castShadow = true;
    tier1.receiveShadow = true;
    g.add(tier1);
    // tầng 2: đĩa r = 8 cao 6 m
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), [rockMat(), grassMat(), rockMat()]);
    tier2.position.y = 3;
    tier2.castShadow = true;
    tier2.receiveShadow = true;
    g.add(tier2);
    // 2 dốc rộng 3 m: chân r = 30 (Y=0) → đỉnh r = 24 (Y=3)
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180;
      const len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, len), woodMat());
      const mid = 27;
      ramp.position.set(Math.cos(a) * mid, 1.5 - 0.15, Math.sin(a) * mid);
      ramp.lookAt(Math.cos(a) * 24, 3 - 0.15, Math.sin(a) * 24);
      ramp.castShadow = true;
      ramp.receiveShadow = true;
      g.add(ramp);
    }
    // tháp chuông r = 2, cao 8 m trên tầng 2
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 32), new THREE.MeshStandardMaterial({ color: '#8c7a62', roughness: 0.9 }));
    tower.position.y = 10;
    tower.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.2, 32), woodMat());
    roof.position.y = 15.1;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.6, roughness: 0.35 }));
    bell.position.y = 13.3;
    g.add(tower, roof, bell);
  }
  const anims: ((t: number) => void)[] = [];
  for (const p of map.pads) pad(g, p.pos[0], p.pos[1], p.pos[2], anims);

  // bụi cây trang trí trên mặt đất Y = 0, xa đèn, đường đi và bục nhảy
  const spots: { x: number; z: number }[] = [];
  for (let i = 0; spots.length < 36 && i < 400; i++) {
    const a = i * 2.39996;
    const r = 6 + ((i * 37) % 40);
    const x = Math.cos(a) * r + (map.night === 2 && i % 2 ? 70 : 0);
    const z = Math.sin(a) * r;
    const gr = map.ground(x, z);
    const edgeOk = [[2, 0], [-2, 0], [0, 2], [0, -2]].every(([dx, dz]) => map.ground(x + dx, z + dz) === 0);
    const notBridge = !(x > 24 && x < 46 && Math.abs(z) < 4);
    const notPad = map.pads.every((p) => Math.hypot(p.pos[0] - x, p.pos[2] - z) > 3);
    const notStart = Math.hypot(map.start[0] - x, map.start[2] - z) > 4;
    if (gr === 0 && edgeOk && notBridge && notPad && notStart && farFromLanterns(x, z)) spots.push({ x, z });
  }
  if (decor) addBushes(g, spots);

  // cây thông và cây hoa anh đào: gần mép đảo, tránh đèn, điểm sinh đom đóm, bục nhảy, cầu, điểm xuất phát
  const islands: [number, number, number][] = map.night === 1 ? [[0, 0, 40]] : map.night === 2 ? [[0, 0, 28], [70, 0, 28]] : [[0, 0, 45]];
  const clearOf = (x: number, z: number, pts: number[][], d: number) => pts.every((p) => Math.hypot(p[0] - x, p[2] - z) > d);
  let ti = 0;
  const trees: THREE.Group[] = [];
  for (const [cx, cz, R] of decor ? islands : []) {
    const count = Math.round(R / 3.2);
    for (let k = 0; k < count * 3 && ti < 60; k++) {
      const a = k * 2.39996 + cx;
      const r = R * (0.72 + ((k * 13) % 17) / 17 * 0.2);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const ok = map.ground(x, z) === 0
        && [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].every(([dx, dz]) => map.ground(x + dx, z + dz) === 0)
        && clearOf(x, z, lanternXZ, 6) && clearOf(x, z, map.motePoints, 2.2) && clearOf(x, z, map.pads.map((p) => p.pos), 4)
        && clearOf(x, z, map.charms, 3) && Math.hypot(map.start[0] - x, map.start[2] - z) > 6 && !(x > 22 && x < 48 && Math.abs(z) < 5);
      if (!ok) continue;
      // Đêm 2 (Đảo Cau): chủ yếu cây cau; Đêm 1 và 3: cây thông + hoa anh đào
      const tree = map.night === 2
        ? (ti % 4 === 3 ? makeBlossom(0.85) : makePalm(0.95 + (ti % 3) * 0.12))
        : ti % 3 === 2 ? makeBlossom(0.85 + (ti % 4) * 0.1) : makePine(0.8 + (ti % 5) * 0.12);
      tree.position.set(x, 0, z);
      tree.rotation.y = ti * 1.3;
      g.add(tree);
      trees.push(tree);
      ti++;
    }
  }

  // cụm đá: vòng giữa đảo (khoảng 0.4–0.62 bán kính), cùng điều kiện tránh như cây
  let ri = 0;
  for (const [cx, cz, R] of decor ? islands : []) {
    const want = Math.max(4, Math.round(R / 5));
    let placed = 0;
    for (let k = 0; k < 120 && placed < want; k++) {
      const a = k * 2.39996 + 0.9 + cx;
      const r = R * (0.4 + ((k * 7) % 11) / 11 * 0.22);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const ok = map.ground(x, z) === 0
        && [[2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]].every(([dx, dz]) => map.ground(x + dx, z + dz) === 0)
        && clearOf(x, z, lanternXZ, 6) && clearOf(x, z, map.motePoints, 2.8) && clearOf(x, z, map.pads.map((p) => p.pos), 4.5)
        && clearOf(x, z, map.charms, 3.5) && Math.hypot(map.start[0] - x, map.start[2] - z) > 7 && !(x > 22 && x < 48 && Math.abs(z) < 5)
        && trees.every((t) => Math.hypot(t.position.x - x, t.position.z - z) > 3.5);
      if (!ok) continue;
      const rock = makeRocks(1.3 + (ri % 3) * 0.3, ri);
      rock.position.set(x, 0, z);
      g.add(rock);
      ri++;
      placed++;
    }
  }

  return {
    group: g,
    update(t) {
      for (const a of anims) a(t);
    },
  };
}
