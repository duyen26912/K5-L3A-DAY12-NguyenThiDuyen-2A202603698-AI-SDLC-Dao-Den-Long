// Mọi con số gameplay có trong contract đọc trực tiếp từ game.contract.json (Test Contract v1.1).
// Các số chuẩn còn lại của Ticket-02 (không có khóa tuning riêng) khai báo ở đây.
import contract from '../../game.contract.json';

export const TUNING = contract.tuning;

/** 60 tick/giây cố định. */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const sec = (s: number) => Math.round(s * TICK_RATE);

// Di chuyển
export const JUMP_SPEED = 7;
export const GRAVITY = 20;
export const STEP_HEIGHT = 0.4; // bậc cao nhất đi lên được (dốc ~0.05 m/tick); cao hơn = vách
export const FALL_Y = -10;
export const CHARM_SPEED = 7.2;

// Ticket-02: nhặt đom đóm / bùa
export const PICKUP_HEIGHT = 1.5;
export const MOTES_START = 20;
export const MOTES_CAP = 30;
export const MOTE_SPAWN_EVERY = 240;
export const DROPPED_TTL = 480;
export const DROP_RING_MIN = 1.5;
export const DROP_RING_MAX = 2.5;

// Đèn
export const LANTERN_HEIGHT_TOL = 1.5; // chênh cao tối đa giữa chân Mây và chân đèn khi nạp
export const EVICT_TICKS = 30;

// Tỏa sáng
export const PULSE_CENTER_Y = 0.8;
export const PULSE_PUSH_TICKS = 15;

// Bóng Mực
export const SHADE_DETECT = 12;
export const SHADE_GIVE_UP = 18;
export const SHADE_HIT_HEIGHT = 1.5;
export const SHADE_HOVER = 1; // tâm Bóng Mực cao 1 m trên mặt đất
export const SHADE_FIRST_SPAWN = 300;
export const SHADE_SPAWN_MIN_DIST = 15;
export const SHADE_WANDER_SPEED = 1.5;
export const RECOIL_TICKS = 60;
export const RECOIL_DIST = 2;
export const INVULN_TICKS = sec(TUNING.invuln_s); // 90

// Rơi khỏi đảo
export const RESPAWN_WAIT = 60;

// Gió Lạc
export const DRIFTER_SPEED = 7;
export const DRIFTER_IDLE_SPEED = 2;
export const DRIFTER_MAX = 2;
export const DRIFTER_SPAWN_EVERY = 1200;
export const DRIFTER_CHASE_CARRY = 5;
export const DRIFTER_CHASE_DIST = 15;
export const DRIFTER_TOUCH = 1.2;
export const DRIFTER_STEAL_MAX = 3;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_DROP_REMOVE_TICKS = 120;
export const DRIFTER_HOVER = 1.2;

// Bùa Gió
export const CHARM_TICKS = 600;
export const CHARM_RESPAWN = 2700;

// Gió mạnh (Đêm 3)
export const WIND_EVERY = 1800;
export const WIND_TICKS = 300;
export const WIND_WARN = 120;
export const WIND_SPEED = 2;

// Thưởng khi thắng: + floor(giây còn lại) × per_second_left + per_flame_left × Ngọn Lửa
