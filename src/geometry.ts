import type { HomeAssistant } from "custom-card-helpers";
import type { CardConfig, FloorConfig, LabelInfo, LightConfig, LightView, Pt, RoomConfig } from "./types";

export const WARM = "#ffc163";
const DEAD = new Set(["unavailable", "unknown"]);
/** Ancho medio de un carácter respecto al tamaño de letra (para que el rótulo quepa). */
const CHAR_W = 0.56;

export const snap5 = (v: number): number => Math.round(v * 20) / 20;

export function bbox(pts: Pt[]): [number, number, number, number] {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function centroid(poly: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    const c = x1 * y2 - x2 * y1;
    a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
  }
  return a ? [cx / (3 * a), cy / (3 * a)] : poly[0];
}

export function inPoly([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Un punto dentro de la estancia: el centroide si cae dentro; si no (estancias en L), el centro del tramo más largo
 * de la línea horizontal que pasa por el centro de su caja. */
export function insidePoint(poly: Pt[]): Pt {
  const c = centroid(poly);
  if (inPoly(c, poly)) return c;
  const [x1, y1, x2, y2] = bbox(poly);
  for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    const y = y1 + (y2 - y1) * fy; const xs: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
      if ((ay > y) !== (by > y)) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    let best: [number, number] | null = null;
    for (let k = 0; k + 1 < xs.length; k += 2) if (!best || xs[k + 1] - xs[k] > best[1] - best[0]) best = [xs[k], xs[k + 1]];
    if (best) return [(best[0] + best[1]) / 2, y];
  }
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

/** Estancia de un punto: primero las que tienen nombre (las de servicio sin nombre quedan detrás). */
export function roomOf(floor: FloorConfig, x: number, y: number): RoomConfig | null {
  return floor.rooms.find((r) => r.name && inPoly([x, y], r.poly)) ?? floor.rooms.find((r) => inPoly([x, y], r.poly)) ?? null;
}

export function floorBounds(floor: FloorConfig): [number, number, number, number] {
  const pts: Pt[] = [
    ...floor.rooms.flatMap((r) => r.poly),
    ...floor.outline,
    ...(floor.walls ?? []).flatMap(([a, b, c, d]) => [[a, b], [c, d]] as Pt[]),
    ...floor.lights.map((l) => [l.x, l.y] as Pt),
  ];
  return bbox(pts);
}

/** Rótulo de una estancia: su posición y un tamaño que quepa en ella, en una o dos líneas. */
export function labelInfo(floor: FloorConfig, room: RoomConfig): LabelInfo | null {
  if (!room.name) return null;
  const [x1, y1, x2, y2] = bbox(room.poly);
  const w = Math.max(0.6, x2 - x1 - 0.35), h = y2 - y1;
  const pos: Pt = room.label ? [room.label[0], room.label[1]] : insidePoint(room.poly);
  if (!room.label && floor.lights.some((l) => inPoly([l.x, l.y], room.poly) && Math.abs(l.x - pos[0]) < 1.3 && Math.abs(l.y - pos[1]) < 0.6)) pos[1] -= 0.75;
  let fs = Math.min(0.44, Math.max(0.24, h * 0.16));
  let lines = [room.name];
  if (room.name.length * CHAR_W * fs > w && room.name.includes(" ")) {
    const words = room.name.split(" ");
    let best: { a: string; b: string; m: number } | null = null;
    for (let k = 1; k < words.length; k++) {
      const a = words.slice(0, k).join(" "), b = words.slice(k).join(" ");
      const m = Math.max(a.length, b.length);
      if (!best || m < best.m) best = { a, b, m };
    }
    lines = [best!.a, best!.b];
  }
  const longest = Math.max(...lines.map((l) => l.length));
  fs = Math.max(0.2, Math.min(fs, w / (longest * CHAR_W))) * (room.fs ?? 1);
  return { x: pos[0], y: pos[1], fs, lines, w: longest * CHAR_W * fs, h: lines.length * fs * 1.15 };
}

const hex = (rgb: number[]) => "#" + rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");

/** Estado de una luz para dibujarla: encendida, disponible, color real (rgb_color) o el configurado, e intensidad. */
export function lightView(hass: HomeAssistant, floor: FloorConfig, light: LightConfig, index: number): LightView {
  const st = light.entity ? hass.states[light.entity] : undefined;
  const on = st?.state === "on";
  const rgb = st?.attributes?.rgb_color as number[] | undefined;
  const bri = st?.attributes?.brightness as number | undefined;
  const room = roomOf(floor, light.x, light.y);
  return {
    index,
    light,
    name: light.name || (st?.attributes?.friendly_name as string) || light.entity || "Luz sin entidad",
    on,
    available: !!st && !DEAD.has(st.state),
    color: on && Array.isArray(rgb) && rgb.length === 3 ? hex(rgb) : light.color || WARM,
    intensity: on ? (typeof bri === "number" ? 0.35 + 0.65 * (bri / 255) : 1) : 0,
    room: room?.id ?? null,
  };
}

export const floorEntities = (floor: FloorConfig): string[] => [...new Set(floor.lights.map((l) => l.entity).filter(Boolean))];

export function onCount(hass: HomeAssistant, floor: FloorConfig): number {
  return floorEntities(floor).filter((e) => hass.states[e]?.state === "on").length;
}

/** Encendidas en toda la casa, contando una sola vez las luces que salen en varias plantas (la escalera). */
export function totalOn(hass: HomeAssistant, cfg: CardConfig): number {
  return [...new Set(cfg.floors.flatMap(floorEntities))].filter((e) => hass.states[e]?.state === "on").length;
}

/** Planta al abrir: la indicada, si no la primera con luz encendida, si no la primera. */
export function pickFloor(hass: HomeAssistant, cfg: CardConfig): string {
  if (cfg.default_floor && cfg.floors.some((f) => f.id === cfg.default_floor)) return cfg.default_floor;
  return (cfg.floors.find((f) => onCount(hass, f) > 0) ?? cfg.floors[0]).id;
}
