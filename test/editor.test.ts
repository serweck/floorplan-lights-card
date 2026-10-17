import { describe, it, expect } from "vitest";
import "../src/floorplan-lights-card";
import type { FloorplanLightsCardEditor } from "../src/editor";
import type { CardConfig } from "../src/types";
import { CONFIG, makeHass } from "./fixtures";

async function mount() {
  const ed = document.createElement("floorplan-lights-card-editor") as FloorplanLightsCardEditor;
  ed.setConfig(CONFIG); ed.hass = makeHass().hass;
  const changes: CardConfig[] = [];
  ed.addEventListener("config-changed", (e) => changes.push((e as CustomEvent).detail.config));
  document.body.appendChild(ed); await ed.updateComplete;
  const root = ed.shadowRoot!;
  const $$ = (s: string) => Array.from(root.querySelectorAll(s)) as HTMLElement[];
  const btn = (label: string) => $$("button").find((b) => b.textContent?.trim() === label)!;
  return { ed, $$, btn, changes };
}
const down = (ed: FloorplanLightsCardEditor, target: Element, at: [number, number]) => {
  ed._toLocal = () => at;
  target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true }));
};

describe("editor visual", () => {
  it("muestra las plantas y los modos; en Luces las luces se arrastran", async () => {
    const { $$ } = await mount();
    expect($$(".seg button").map((b) => b.textContent?.trim())).toEqual(["Planta superior", "Planta baja", "Luces", "Estancias", "Rótulos"]);
    expect($$('[data-drag="light"]')).toHaveLength(1);
  });

  it("añadir una luz en el punto tocado y elegir su entidad", async () => {
    const { ed, $$, btn, changes } = await mount();
    btn("Planta baja").click(); await ed.updateComplete;
    btn("Añadir luz").click(); await ed.updateComplete;
    down(ed, ed.shadowRoot!.querySelector("svg.plan")!, [3.02, 4.01]); await ed.updateComplete;
    const pb = changes.at(-1)!.floors.find((f) => f.id === "pb")!;
    expect(pb.lights.at(-1)).toEqual({ entity: "", x: 3, y: 4 });
    const sel = $$("select")[0] as HTMLSelectElement;
    sel.value = "light.rele_despacho"; sel.dispatchEvent(new Event("change")); await ed.updateComplete;
    expect(changes.at(-1)!.floors.find((f) => f.id === "pb")!.lights.at(-1)!.entity).toBe("light.rele_despacho");
  });

  it("quitar una luz seleccionada", async () => {
    const { ed, btn, changes } = await mount();
    btn("Planta baja").click(); await ed.updateComplete;
    ed._sel = { t: "light", i: 0 }; await ed.updateComplete;
    btn("Quitar luz").click(); await ed.updateComplete;
    expect(changes.at(-1)!.floors.find((f) => f.id === "pb")!.lights.map((l) => l.entity)).not.toContain("light.rele_salon_sofa");
  });

  it("rótulos: añadir uno suelto y cambiar su tamaño; la estructura no cambia", async () => {
    const { ed, btn, changes } = await mount();
    btn("Planta baja").click(); btn("Rótulos").click(); await ed.updateComplete;
    btn("Añadir rótulo").click(); await ed.updateComplete;
    down(ed, ed.shadowRoot!.querySelector("svg.plan")!, [1, 1]); await ed.updateComplete;
    btn("A+").click(); await ed.updateComplete;
    const pb = changes.at(-1)!.floors.find((f) => f.id === "pb")!;
    expect(pb.labels!.at(-1)).toMatchObject({ text: "Rótulo", x: 1, y: 1, fs: 0.4 });
    const orig = CONFIG.floors.find((f) => f.id === "pb")!;
    expect([pb.walls, pb.doors, pb.outline]).toEqual([orig.walls, orig.doors, orig.outline]);
  });

  it("estancias: los bordes se pueden arrastrar", async () => {
    const { ed, $$, btn } = await mount();
    btn("Estancias").click(); await ed.updateComplete;
    expect($$('[data-drag="redge"]').length).toBeGreaterThan(0);
    expect($$('[data-drag="rvtx"]').length).toBeGreaterThan(0);
  });
});
