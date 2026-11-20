// Mọi con số gameplay đọc trực tiếp từ game.contract.json để số khai báo
// luôn trùng với số game đang dùng (Test Contract v1.0, mục A).
import contract from '../../game.contract.json';

export const TUNING = contract.tuning;

/** 60 tick/giây cố định. */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

// Hằng số không có trong tuning của contract (giả định của bài, xem docs/notes/assumptions.md).
export const ISLAND_RADIUS = 40; // đảo tròn, người chơi không ra khỏi được (fall_enabled = false)
export const LANTERN_RING_RADIUS = 25; // 5 đèn xếp đều trên vòng tròn bán kính 25 m
export const JUMP_SPEED = 7; // m/s
export const GRAVITY = 20; // m/s^2
export const SHADE_HEIGHT = 1; // tâm Bóng Mực lơ lửng cao 1 m
export const INITIAL_MOTES = 24;
export const MAX_MOTES = 24;
export const MOTE_SPAWN_EVERY_TICKS = 3 * TICK_RATE;
export const MOTE_MIN_R = 4;
export const MOTE_MAX_R = 38;
export const INITIAL_SHADES = 2;
export const MAX_SHADES = 5;
export const SHADE_SPAWN_EVERY_TICKS = 45 * TICK_RATE;
export const SHADE_SPAWN_R = 36;
export const DROP_DISTANCE = 3; // đom đóm rơi ra cách người chơi 3 m (> pickup_radius)
