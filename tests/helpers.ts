import { simulate } from '../src/core/simulate';

export type Line = Record<string, any>;
export const run = (o: Parameters<typeof simulate>[0]): Line[] => simulate(o).map((l) => JSON.parse(l));
export const snaps = (ls: Line[]) => ls.filter((l) => l.type === 'snapshot');
export const events = (ls: Line[], name?: string) =>
  ls.filter((l) => l.type === 'event' && l.name !== 'night_start' && (!name || l.name === name));
export const last = (ls: Line[]) => ls[ls.length - 1];
export const lastSnap = (ls: Line[]) => snaps(ls).at(-1)!;
export const snapAt = (ls: Line[], tick: number) => snaps(ls).find((s) => s.tick === tick)!;

/** Scenario sạch: không đom đóm / Bóng Mực / Gió Lạc ngẫu nhiên, không gió. */
export const empty = (extra: Record<string, unknown> = {}) => ({
  random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
  motes: [], shades: [], drifters: [], charms: [], ...extra,
});
