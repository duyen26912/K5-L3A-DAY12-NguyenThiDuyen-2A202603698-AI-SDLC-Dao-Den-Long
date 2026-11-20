// Mô hình các vật gắn với luật chơi (chỉ hiển thị). Giữ đúng bảng màu chuẩn Ticket-02 và kích thước va chạm.
// Mỗi hàm trả về { group, animate(t, ...) } để main.ts gọi mỗi khung hình.
import * as THREE from 'three';
import { PAL } from './palette';
import { makeFlame, FLAME_GLOW } from './flame';

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const castAll = (o: THREE.Object3D) => o.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.castShadow = true; });

function glowTex(color: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const GLOW_WARM = glowTex('rgba(255,229,138,0.95)');
const GLOW_PURPLE = glowTex('rgba(140,80,255,0.95)');
const GLOW_RED = glowTex('rgba(242,193,78,0.8)');

// ---------- Mây: người giữ đèn nhỏ — nón lá, áo choàng ngà #E8E2D0, khăn đỏ #C8102E, gậy phép đầu lửa ----------
export interface PlayerModel {
  g: THREE.Group;
  body: THREE.Group;
  lampLight: THREE.PointLight;
  /** carried: số đom đóm đang mang (lửa đầu gậy to dần); flash 0…1: lóe sáng khi vừa nhặt. */
  animate(t: number, moving: boolean, airborne: boolean, carried?: number, flash?: number): void;
}

export function makeMay(): PlayerModel {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const robe = std(PAL.shirt, { roughness: 0.85 });
  const skin = std('#f6cdb4', { roughness: 0.8 });
  const hatMat = std('#e2c27a', { roughness: 0.95, side: THREE.DoubleSide });
  const leather = std('#7a4a2a', { roughness: 0.8 });
  const brass = std('#e08a2e', { roughness: 0.5, metalness: 0.2 });
  const scarfMat = std(PAL.scarf, { side: THREE.DoubleSide });

  // áo choàng hình chuông dài tới đất
  const gown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 0.95, 20), robe);
  gown.position.y = 0.5;
  body.add(gown);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.035, 6, 24), robe);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.05;
  body.add(hem);
  // đường nẹp giữa áo
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.8, 0.02), std('#cfc6b0'));
  seam.position.set(0, 0.5, 0.33);
  seam.rotation.x = -0.18;
  body.add(seam);
  // thắt lưng + khóa
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.04, 6, 24), leather);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.72;
  const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 4), brass);
  buckle.rotation.z = Math.PI / 4;
  buckle.position.set(0, 0.72, 0.3);
  body.add(belt, buckle);
  // cổ áo + khăn đỏ
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 20), scarfMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.0;
  body.add(collar);
  const tails: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.42, 1, 4), scarfMat);
    tail.geometry.translate(0, -0.21, 0);
    tail.position.set(s * 0.06, 1.0, -0.2);
    body.add(tail);
    tails.push(tail);
  }
  // tay áo + bàn tay
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.26, 0.93, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.36, 10), robe);
    sleeve.position.y = -0.16;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), skin);
    hand.position.y = -0.36;
    arm.add(sleeve, hand);
    arm.rotation.z = s * 0.35;
    body.add(arm);
    arms.push(arm);
  }
  // đầu tròn, 2 mắt bầu dục
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 22, 18), skin);
  head.scale.set(1, 0.92, 0.95);
  head.position.y = 1.32;
  body.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#1e2433' });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeMat);
    eye.scale.set(0.75, 1.5, 0.5);
    eye.position.set(s * 0.1, 1.31, 0.27);
    body.add(eye);
  }
  // nón lá: chóp nón thấp, rộng vành, có các vòng nan, quai đỏ dưới cằm
  const crown = new THREE.Group();
  crown.position.y = 1.5;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.42, 32, 1, true), hatMat);
  cone.position.y = 0.21;
  crown.add(cone);
  const ribMat = std('#c9a45a', { roughness: 0.95 });
  for (let i = 1; i <= 4; i++) {
    const k = i / 5; // vị trí dọc chóp nón (0 = vành, 1 = đỉnh)
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.78 * (1 - k), 0.012, 4, 32), ribMat);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = 0.42 * k;
    crown.add(rib);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.022, 6, 40), ribMat);
  rim.rotation.x = Math.PI / 2;
  crown.add(rim);
  body.add(crown);
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 4), std(PAL.scarf));
    strap.position.set(s * 0.2, 1.3, 0.12);
    strap.rotation.z = s * 0.45;
    body.add(strap);
  }

  // gậy phép cầm tay phải, đầu gậy có ngọn lửa + 2 hạt sáng bay
  const staff = new THREE.Group();
  staff.position.set(0.5, 0.0, 0.2);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.2, 8), leather);
  pole.position.set(0.2, 1.1, 0);
  pole.rotation.z = -0.18; // nghiêng ra ngoài để đầu đuốc nằm ngoài vành nón lá
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.05, 0.14, 8), std('#b25a26'));
  cup.position.set(0.4, 2.2, 0);
  staff.add(pole, cup);
  const fire = makeFlame(0.32, 2.4, 1.3);
  fire.group.position.set(0.4, 2.42, 0);
  staff.add(fire.group);
  const orbs: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.035 - i * 0.008, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
    staff.add(orb);
    orbs.push(orb);
  }
  body.add(staff);
  const lampLight = new THREE.PointLight(PAL.lanternLit, 6, 9, 1.6);
  lampLight.position.set(0.9, 2.42, 0.2);
  g.add(lampLight);
  castAll(body);

  return {
    g, body, lampLight,
    animate(t, moving, airborne, carried = 0, flash = 0) {
      const walk = moving && !airborne;
      const sw = walk ? Math.sin(t * 12) : 0;
      body.position.y = walk ? Math.abs(sw) * 0.05 : 0;
      body.rotation.z = sw * 0.04;
      arms[0].rotation.x = -sw * 0.5;
      arms[1].rotation.x = airborne ? -0.9 : 0.15 + sw * 0.2;
      staff.rotation.x = airborne ? -0.5 : sw * 0.15;
      crown.rotation.z = Math.sin(t * 3) * 0.03;
      crown.rotation.x = moving ? -0.08 : 0;
      tails.forEach((tl, i) => {
        tl.rotation.x = (moving ? 1.1 : 0.25) + Math.sin(t * 9 + i) * (moving ? 0.25 : 0.08);
        tl.rotation.z = Math.sin(t * 7 + i * 2) * 0.15;
      });
      // lửa đầu gậy to dần theo số đom đóm đang mang, bùng sáng khi vừa nhặt
      const grow = 0.8 + Math.min(10, carried) * 0.06;
      fire.group.scale.setScalar(0.45 * grow);
      fire.animate(t, flash);
      orbs.forEach((o, i) => {
        const k = (t * 0.7 + i * 0.5) % 1;
        o.position.set(0.4 + Math.sin(t * 3 + i) * 0.05, 2.62 + k * 0.45, 0);
        o.scale.setScalar(1 - k * 0.7);
      });
    },
  };
}

// ---------- Đom đóm: ngọn lửa nhỏ lơ lửng (lõi #FFF6C2, quầng #FFE58A) + đốm tàn lửa ----------
export function makeMote(): { group: THREE.Group; animate(t: number, phase: number): void } {
  const group = new THREE.Group();
  const fire = makeFlame(0.62, 2.6, Math.random() * 6);
  group.add(fire.group);
  const sparkMat = new THREE.MeshBasicMaterial({ color: PAL.moteHalo, transparent: true });
  const sparks: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), sparkMat);
    group.add(s);
    sparks.push(s);
  }
  return {
    group,
    animate(t, ph) {
      fire.animate(t, 0);
      sparks.forEach((s, i) => {
        const k = (t * 0.6 + i / 3 + ph) % 1;
        s.position.set(Math.sin(i * 2.1 + t) * 0.28, -0.05 + k * 0.9, Math.cos(i * 2.1 + t) * 0.28);
        s.scale.setScalar(1 - k);
      });
    },
  };
}

// ---------- Lóe sáng khi nhặt: quầng sáng bung ra rồi tắt dần ----------
export function makePickupBurst(): { group: THREE.Group; readonly active: boolean; play(at: THREE.Vector3): void; update(dt: number): void } {
  const group = new THREE.Group();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLAME_GLOW, color: PAL.moteHalo, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const light = new THREE.PointLight(PAL.moteHalo, 0, 10, 1.5);
  group.add(sprite, light);
  let k = 1;
  return {
    group,
    get active() { return k < 1; },
    play(at) { group.position.copy(at); k = 0; },
    update(dt) {
      if (k >= 1) { (sprite.material as THREE.SpriteMaterial).opacity = 0; light.intensity = 0; return; }
      k = Math.min(1, k + dt / 0.6);
      sprite.scale.setScalar(1 + k * 4);
      (sprite.material as THREE.SpriteMaterial).opacity = (1 - k) * 0.95;
      light.intensity = (1 - k) * 40;
    },
  };
}

// ---------- Bóng Mực: khối mực có viền tím, mắt sáng, xúc tu đung đưa ----------
export function makeShadeModel(): { group: THREE.Group; animate(t: number, stunned: boolean, spawning: boolean): void } {
  const group = new THREE.Group();
  const bodyMat = std(PAL.shadeBody, { roughness: 0.3, emissive: PAL.shadeRim, emissiveIntensity: 0.45 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 16), bodyMat);
  head.scale.set(1, 0.9, 1);
  head.name = 'blob';
  const rim = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 16), new THREE.MeshBasicMaterial({ color: PAL.shadeRim, transparent: true, opacity: 0.65, side: THREE.BackSide }));
  rim.scale.set(1, 0.9, 1);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_PURPLE, transparent: true, depthWrite: false, opacity: 0.6 }));
  aura.scale.setScalar(3.4);
  group.add(aura, head, rim);
  // xúc tu
  const tentacles: THREE.Mesh[] = [];
  const tGeo = new THREE.ConeGeometry(0.13, 0.75, 8);
  tGeo.translate(0, -0.37, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tt = new THREE.Mesh(tGeo, bodyMat);
    tt.position.set(Math.cos(a) * 0.45, -0.35, Math.sin(a) * 0.45);
    group.add(tt);
    tentacles.push(tt);
  }
  // mắt sáng + con ngươi
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#f6ecff' });
  const pupilMat = new THREE.MeshBasicMaterial({ color: PAL.shadeRim });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), eyeMat);
    eye.scale.set(1, 0.7, 0.6);
    eye.position.set(0.24 * s, 0.12, 0.6);
    eye.rotation.z = s * 0.35;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), pupilMat);
    pupil.position.set(0.24 * s, 0.11, 0.68);
    group.add(eye, pupil);
  }
  return {
    group,
    animate(t, stunned, spawning) {
      bodyMat.color.set(stunned ? PAL.shadeStunned : PAL.shadeBody);
      tentacles.forEach((tt, i) => {
        const a = (i / 8) * Math.PI * 2;
        const sway = Math.sin(t * (stunned ? 2 : 5) + i) * (stunned ? 0.1 : 0.35);
        tt.rotation.set(Math.sin(a) * sway, 0, -Math.cos(a) * sway);
      });
      const s = spawning ? 0.4 : stunned ? 0.8 : 1 + Math.sin(t * 5) * 0.04;
      group.scale.setScalar(s);
      (aura.material as THREE.SpriteMaterial).opacity = stunned ? 0.35 : 0.85 + Math.sin(t * 4) * 0.1;
      bodyMat.emissiveIntensity = stunned ? 0.2 : 0.45 + Math.sin(t * 4) * 0.1;
      if (stunned) head.rotation.y = t * 3;
    },
  };
}

const moteCoreMat = new THREE.MeshBasicMaterial({ color: PAL.moteCore });

// ---------- Gió Lạc: dải lụa xám xanh uốn sóng, có nút thắt, mang đom đóm đã cướp ----------
export function makeDrifterModel(): { group: THREE.Group; animate(t: number, fleeing: boolean, loot: number): void } {
  const group = new THREE.Group();
  const silk = new THREE.MeshStandardMaterial({ color: PAL.drifter, emissive: PAL.drifter, emissiveIntensity: 0.25, transparent: true, opacity: 0.88, side: THREE.DoubleSide, roughness: 0.4 });
  const ribbons: { mesh: THREE.Mesh; base: Float32Array; ph: number }[] = [];
  for (let i = 0; i < 2; i++) {
    const geo = new THREE.PlaneGeometry(2.6 - i * 0.5, 0.32, 28, 1);
    geo.translate(-(2.6 - i * 0.5) / 2, 0, 0); // đầu dải ở gốc, đuôi về phía sau
    const mesh = new THREE.Mesh(geo, silk);
    mesh.rotation.y = -Math.PI / 2; // đuôi dải lụa về phía sau (−Z cục bộ)
    mesh.position.y = i * 0.15;
    group.add(mesh);
    ribbons.push({ mesh, base: (geo.attributes.position.array as Float32Array).slice(), ph: i * 1.7 });
  }
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.14, 0.05, 32, 6), silk);
  group.add(knot);
  const lootGroup = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), moteCoreMat);
    m.position.set(Math.cos(i * 2.1) * 0.25, 0.25, Math.sin(i * 2.1) * 0.25);
    lootGroup.add(m);
  }
  group.add(lootGroup);
  return {
    group,
    animate(t, fleeing, loot) {
      for (const r of ribbons) {
        const pos = r.mesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = r.base[i * 3];
          const amp = Math.min(1, -x / 1.2) * (fleeing ? 0.35 : 0.22);
          pos.setY(i, r.base[i * 3 + 1] + Math.sin(x * 3 + t * (fleeing ? 14 : 7) + r.ph) * amp);
          pos.setZ(i, Math.cos(x * 2 + t * 5 + r.ph) * amp * 0.8);
        }
        pos.needsUpdate = true;
      }
      knot.rotation.z = t * 4;
      lootGroup.visible = loot > 0;
      lootGroup.rotation.y = t * 3;
    },
  };
}

// ---------- Bùa Gió: lá bùa đỏ viền vàng, ký hiệu gió vàng, tua rua, quầng sáng ----------
export function makeCharmModel(): { group: THREE.Group; animate(t: number): void } {
  const group = new THREE.Group();
  const gold = std(PAL.gold, { metalness: 0.5, roughness: 0.35, emissive: PAL.gold, emissiveIntensity: 0.35 });
  const red = std(PAL.scarf, { emissive: PAL.scarf, emissiveIntensity: 0.3 });
  const card = new THREE.Group();
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.04), gold);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.06), red);
  card.add(border, face);
  // ký hiệu gió: 3 vòng xoắn vàng hai mặt
  for (const z of [0.035, -0.035]) {
    for (let i = 0; i < 3; i++) {
      const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.1 + i * 0.03, 0.012, 6, 20, Math.PI * 1.4), gold);
      swirl.position.set(0, 0.2 - i * 0.2, z);
      swirl.rotation.z = i * 1.2;
      card.add(swirl);
    }
  }
  // tua rua đỏ dưới đáy
  const tasselCord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 6), gold);
  tasselCord.position.y = -0.57;
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), red);
  tassel.position.y = -0.78;
  card.add(tasselCord, tassel);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_RED, transparent: true, depthWrite: false, opacity: 0.6, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.8);
  group.add(halo, card);
  return {
    group,
    animate(t) {
      card.rotation.y = t * 1.5;
      card.rotation.z = Math.sin(t * 2) * 0.08;
      tassel.rotation.z = Math.sin(t * 3) * 0.3;
      (halo.material as THREE.SpriteMaterial).opacity = 0.45 + Math.sin(t * 3) * 0.15;
    },
  };
}

// ---------- Bục nhảy (bán kính 1 m): trống gỗ, vòng vàng, mặt lá sen, mũi tên sáng nhịp nhàng ----------
export function makePadModel(): { group: THREE.Group; animate(t: number): void } {
  const group = new THREE.Group();
  const wood = std('#7a5232');
  const gold = std(PAL.gold, { metalness: 0.4, roughness: 0.4, emissive: PAL.gold, emissiveIntensity: 0.3 });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.05, 0.22, 32), wood);
  drum.position.y = 0.0;
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.04, 6, 40), gold);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.06;
  const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.82, 32, 0.25, Math.PI * 2 - 0.5), std('#3f8f4a', { side: THREE.DoubleSide }));
  leaf.rotation.x = -Math.PI / 2;
  leaf.position.y = 0.115;
  group.add(drum, band, leaf);
  const arrows: THREE.Mesh[] = [];
  const arrowMat = new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true });
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.22, 4), arrowMat.clone());
    a.rotation.y = Math.PI / 4;
    a.position.y = 0.35 + i * 0.3;
    group.add(a);
    arrows.push(a);
  }
  castAll(group);
  return {
    group,
    animate(t) {
      arrows.forEach((a, i) => {
        const k = (t * 1.2 + i / 3) % 1;
        a.position.y = 0.25 + k * 0.9;
        (a.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI);
      });
    },
  };
}
