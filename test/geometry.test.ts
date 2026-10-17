import { describe, it, expect } from "vitest";
import { WARM, inPoly, labelInfo, lightView, onCount, pickFloor, roomOf, snap5 } from "../src/geometry";
import { addLabel, addLight, dragFloor, removeLabel, removeLight } from "../src/edit";
import { BAJA, CONFIG, SUPERIOR, makeHass, st } from "./fixtures";

describe("geometría", () => {
  it("snap a 5 cm", () => {
    expect(snap5(1.234)).toBe(1.25);
    expect(snap5(-0.02)).toBe(-0);
  });
  it("la estancia de un punto prefiere las que tienen nombre", () => {
    expect(roomOf(BAJA, 2, 2)?.id).toBe("salon");
    expect(roomOf(BAJA, 7, 3)?.id).toBe("despacho");
    expect(roomOf(BAJA, 20, 20)).toBeNull();
  });
  it("un rótulo largo en una estancia estrecha se parte en dos líneas y encoge", () => {
    const narrow = { ...BAJA.rooms[2], poly: [[0, 0], [2.4, 0], [2.4, 3], [0, 3]] as [number, number][] };
    const L = labelInfo(BAJA, narrow)!;
    expect(L.lines).toEqual(["Zona exterior", "cubierta"]);
    expect(L.w).toBeLessThanOrEqual(2.4);
  });
  it("el rótulo usa la posición guardada y su escala", () => {
    const L = labelInfo(BAJA, { ...BAJA.rooms[0], label: [1, 1], fs: 1.5 })!;
    expect([L.x, L.y]).toEqual([1, 1]);
    const base = labelInfo(BAJA, { ...BAJA.rooms[0], label: [1, 1] })!;
    expect(L.fs).toBeCloseTo(base.fs * 1.5);
  });
  it("una estancia sin nombre no tiene rótulo", () => {
    expect(labelInfo(BAJA, { id: "x", poly: BAJA.rooms[0].poly })).toBeNull();
  });
});

describe("lightView", () => {
  it("relé encendido: blanco cálido a plena intensidad", () => {
    const { hass } = makeHass();
    const v = lightView(hass, BAJA, BAJA.lights[2], 2);
    expect(v).toMatchObject({ on: true, available: true, color: WARM, intensity: 1, room: "despacho", name: "rele_despacho" });
  });
  it("luz RGB encendida: su color real y el brillo en la intensidad", () => {
    const { hass } = makeHass({ "light.philiphue_salon": st("on", { rgb_color: [255, 0, 0], brightness: 0 }) });
    const v = lightView(hass, BAJA, BAJA.lights[1], 1);
    expect(v.color).toBe("#ff0000");
    expect(v.intensity).toBeCloseTo(0.35);
  });
  it("apagada: el color configurado y sin halo; sin entidad o no disponible", () => {
    const { hass } = makeHass({ "light.philiphue_salon": st("off") });
    expect(lightView(hass, BAJA, BAJA.lights[1], 1)).toMatchObject({ on: false, color: "#b98cff", intensity: 0 });
    expect(lightView(hass, BAJA, { entity: "", x: 1, y: 1 }, 9)).toMatchObject({ available: false, name: "Luz sin entidad" });
    const { hass: h2 } = makeHass({ "light.rele_despacho": st("unavailable") });
    expect(lightView(h2, BAJA, BAJA.lights[2], 2).available).toBe(false);
  });
  it("cuenta las encendidas de una planta y abre en la primera con luz", () => {
    const { hass } = makeHass();
    expect(onCount(hass, BAJA)).toBe(2);
    expect(onCount(hass, SUPERIOR)).toBe(0);
    expect(pickFloor(hass, CONFIG)).toBe("pb");
    expect(pickFloor(hass, { ...CONFIG, default_floor: "ps" })).toBe("ps");
  });
});

describe("edición", () => {
  it("arrastrar una luz la mueve en pasos de 5 cm sin tocar la original", () => {
    const g = dragFloor(BAJA, "light", 0, 0, 1.02, -0.49);
    expect([g.lights[0].x, g.lights[0].y]).toEqual([3.5, 1.8]);
    expect(BAJA.lights[0].x).toBe(2.5);
  });
  it("arrastrar el borde de una estancia la redimensiona manteniendo el ángulo recto y se alinea con la pared", () => {
    // borde derecho del salón (x = 4.95) hacia la pared x = 5
    const g = dragFloor(BAJA, "redge", 0, 1, 0.03, 2);
    expect(g.rooms[0].poly[1]).toEqual([5, 0.1]);
    expect(g.rooms[0].poly[2]).toEqual([5, 7.9]);
  });
  it("mover un rótulo de estancia fija su posición; los sueltos también", () => {
    expect(dragFloor(BAJA, "label", 1, 0, 0.5, 0).rooms[1].label).toBeDefined();
    expect(dragFloor(BAJA, "flabel", 0, 0, 1, 1).labels![0]).toMatchObject({ x: 5, y: -1 });
  });
  it("la estructura no cambia con ninguna edición", () => {
    const g = dragFloor(dragFloor(BAJA, "redge", 0, 1, 1, 0), "light", 0, 0, 1, 1);
    expect(g.walls).toEqual(BAJA.walls);
    expect(g.doors).toEqual(BAJA.doors);
    expect(g.outline).toEqual(BAJA.outline);
  });
  it("añadir y quitar luces y rótulos", () => {
    const a = addLight(BAJA, 3.01, 4.02, "light.wled");
    expect(a.lights.at(-1)).toEqual({ entity: "light.wled", x: 3, y: 4 });
    expect(removeLight(a, a.lights.length - 1).lights).toEqual(BAJA.lights);
    const l = addLabel(BAJA, 1, 1, "Bodega");
    expect(l.labels!.at(-1)).toMatchObject({ text: "Bodega", x: 1, y: 1 });
    expect(removeLabel(l, 1).labels).toEqual(BAJA.labels);
  });
});

describe("revisión", () => {
  it("un borde de estancia se puede mover menos de 10 cm", () => {
    const g = dragFloor(BAJA, "redge", 1, 3, 0.05, 0); // borde izquierdo del despacho (x = 5.05), lejos de otras paredes en su eje no
    expect(g.rooms[1].poly[3][0]).not.toBe(BAJA.rooms[1].poly[3][0]);
  });
  it("el rótulo de una estancia en L cae dentro de ella", () => {
    const L: [number, number][] = [[0, 0], [6, 0], [6, 1], [1, 1], [1, 6], [0, 6]];
    const info = labelInfo(BAJA, { id: "pasillo", name: "Pasillo", poly: L })!;
    expect(inPoly([info.x, info.y], L)).toBe(true);
  });
});
