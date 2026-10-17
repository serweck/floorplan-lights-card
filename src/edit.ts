import type { FloorConfig, Pt } from "./types";
import { labelInfo, snap5 } from "./geometry";

/** Lo que se puede arrastrar en el editor visual. La estructura (paredes, puertas, fachada) no está aquí a propósito. */
export type DragType = "light" | "redge" | "rvtx" | "label" | "flabel";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const allPoints = (f: FloorConfig): Pt[] => [
  ...f.rooms.flatMap((r) => r.poly),
  ...f.outline,
  ...(f.walls ?? []).flatMap(([a, b, c, d]) => [[a, b], [c, d]] as Pt[]),
];
/** 5 cm, y si hay una pared o esquina a menos de 10 cm en ese eje, se alinea con ella. */
function snapAxis(v: number, axis: 0 | 1, pts: Pt[]): number {
  let best: number | null = null, bd = 0.1;
  for (const p of pts) { const d = Math.abs(p[axis] - v); if (d < bd) { bd = d; best = p[axis]; } }
  return best ?? snap5(v);
}
const flat = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Planta nueva a partir de la original (la del principio del arrastre) desplazada dx, dy en metros. */
export function dragFloor(o: FloorConfig, type: DragType, i: number, j: number, dx: number, dy: number): FloorConfig {
  const f = clone(o);
  // Al mover una estancia, sus propios puntos no cuentan para alinear (si no, un ajuste pequeño volvería a su sitio).
  const pts = type === "redge" || type === "rvtx" ? allPoints({ ...o, rooms: o.rooms.filter((_, k) => k !== i) }) : allPoints(o);
  const sx = (v: number) => snapAxis(v, 0, pts), sy = (v: number) => snapAxis(v, 1, pts);
  if (type === "light") { f.lights[i].x = snap5(o.lights[i].x + dx); f.lights[i].y = snap5(o.lights[i].y + dy); }
  else if (type === "rvtx") { const [x, y] = o.rooms[i].poly[j]; f.rooms[i].poly[j] = [sx(x + dx), sy(y + dy)]; }
  else if (type === "redge") {
    const poly = o.rooms[i].poly, n = poly.length, p = poly[j], q = poly[(j + 1) % n];
    if (flat(p[1], q[1])) { const ny = sy(p[1] + dy); f.rooms[i].poly[j] = [p[0], ny]; f.rooms[i].poly[(j + 1) % n] = [q[0], ny]; }
    else if (flat(p[0], q[0])) { const nx = sx(p[0] + dx); f.rooms[i].poly[j] = [nx, p[1]]; f.rooms[i].poly[(j + 1) % n] = [nx, q[1]]; }
    else { f.rooms[i].poly[j] = [snap5(p[0] + dx), snap5(p[1] + dy)]; f.rooms[i].poly[(j + 1) % n] = [snap5(q[0] + dx), snap5(q[1] + dy)]; }
  }
  else if (type === "label") { const L = labelInfo(o, o.rooms[i])!; f.rooms[i].label = [snap5(L.x + dx), snap5(L.y + dy)]; }
  else if (type === "flabel") { const L = o.labels![i]; f.labels![i] = { ...L, x: snap5(L.x + dx), y: snap5(L.y + dy) }; }
  return f;
}

export function addLight(f: FloorConfig, x: number, y: number, entity = ""): FloorConfig {
  const g = clone(f); g.lights.push({ entity, x: snap5(x), y: snap5(y) }); return g;
}
export function removeLight(f: FloorConfig, i: number): FloorConfig {
  const g = clone(f); g.lights.splice(i, 1); return g;
}
export function addLabel(f: FloorConfig, x: number, y: number, text = "Rótulo"): FloorConfig {
  const g = clone(f); (g.labels ??= []).push({ text, x: snap5(x), y: snap5(y), fs: 0.36 }); return g;
}
export function removeLabel(f: FloorConfig, i: number): FloorConfig {
  const g = clone(f); g.labels!.splice(i, 1); return g;
}
