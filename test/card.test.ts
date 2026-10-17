import { describe, it, expect, vi, afterEach } from "vitest";
import "../src/floorplan-lights-card";
import { findFloorplan, validateConfig } from "../src/floorplan-lights-card";
import { CONFIG, makeHass, st } from "./fixtures";

type El = HTMLElement & { setConfig(c: unknown): void; hass: unknown; updateComplete: Promise<boolean> };

async function mount(config: unknown = CONFIG, over = {}, dark = false) {
  const fake = makeHass(over, dark);
  const card = document.createElement("floorplan-lights-card") as El;
  card.setConfig(config); card.hass = fake.hass;
  const events: unknown[] = [];
  card.addEventListener("hass-more-info", (e) => events.push((e as CustomEvent).detail));
  document.body.appendChild(card); await card.updateComplete;
  const root = card.shadowRoot!;
  const $ = (s: string) => root.querySelector(s) as HTMLElement | null;
  const $$ = (s: string) => Array.from(root.querySelectorAll(s)) as HTMLElement[];
  return { card, $, $$, calls: fake.calls, events };
}
const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, " ").trim();
// jsdom no trae PointerEvent: un MouseEvent con el mismo tipo llega igual a los manejadores.
const ptr = (el: Element, type: string) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true }));

afterEach(() => vi.useRealTimers());

describe("validateConfig", () => {
  it("exige plantas con id, nombre, fachada, estancias y luces", () => {
    expect(() => validateConfig({} as never)).toThrow("floors");
    expect(() => validateConfig({ floors: [{ id: "a" }] } as never)).toThrow("name");
    expect(() => validateConfig({ floors: [{ id: "a", name: "A", outline: [] }] } as never)).toThrow("outline");
    expect(validateConfig(CONFIG)).toBe(CONFIG);
  });
});

describe("tarjeta", () => {
  it("abre en la planta con luz, cuenta las encendidas y pinta sus luces", async () => {
    const { $, $$ } = await mount();
    expect(text($(".count"))).toBe("2 encendidas");
    expect($$(".rail button").map((b) => ["b", "small", ".n"].map((s) => text(b.querySelector(s))).join(" "))).toEqual(["1 Superior 0", "0 Baja 2"]);
    expect($(".rail button.on")?.getAttribute("aria-label")).toBe("Planta baja");
    expect($$("[data-light]")).toHaveLength(4);
    expect(text($("svg.plan"))).toContain("Salón");
  });

  it("tocar una luz la conmuta; mantener abre el detalle", async () => {
    vi.useFakeTimers();
    const { $$, calls, events } = await mount();
    const sofa = $$("[data-light]")[0];
    ptr(sofa, "pointerdown"); ptr(sofa, "pointerup");
    expect(calls).toEqual([{ domain: "light", service: "toggle", data: { entity_id: "light.rele_salon_sofa" } }]);
    ptr(sofa, "pointerdown"); vi.advanceTimersByTime(600); ptr(sofa, "pointerup");
    expect(events).toEqual([{ entityId: "light.rele_salon_sofa" }]);
    expect(calls).toHaveLength(1);
  });

  it("cambiar de planta con el ascensor", async () => {
    const { card, $, $$ } = await mount();
    $$(".rail button")[0].click(); await card.updateComplete;
    expect($(".rail button.on")?.getAttribute("aria-label")).toBe("Planta superior");
    expect($$("[data-light]")).toHaveLength(1);
  });

  it("apagar planta pide confirmación y apaga solo las encendidas", async () => {
    const { card, $, calls } = await mount();
    $(".btn.danger")!.click(); await card.updateComplete;
    expect(calls).toHaveLength(0);
    $(".btn.yes")!.click(); await card.updateComplete;
    expect(calls).toEqual([{ domain: "light", service: "turn_off", data: { entity_id: ["light.philiphue_salon", "light.rele_despacho"] } }]);
  });

  it("una luz RGB brilla con su color y el modo noche sigue al tema", async () => {
    const { $, $$ } = await mount(CONFIG, {}, true);
    expect($("svg.plan")?.getAttribute("style")).toContain("#090d14");
    expect($$("circle").some((c) => c.getAttribute("fill") === "#b98cff")).toBe(true);
  });

  it("compacta: sin rótulos", async () => {
    const { $ } = await mount({ ...CONFIG, compact: true });
    expect($(".body.compact")).not.toBeNull();
    expect(text($("svg.plan"))).not.toContain("Salón");
  });

  it("solo repinta si cambia alguna de sus luces", async () => {
    const { card } = await mount();
    const spy = vi.spyOn(card as unknown as { render(): unknown }, "render");
    const h = (card as unknown as { hass: { states: Record<string, unknown> } }).hass;
    card.hass = { ...h, states: { ...h.states, "sensor.otro": st("1") } }; await card.updateComplete;
    expect(spy).not.toHaveBeenCalled();
    card.hass = { ...h, states: { ...h.states, "light.rele_salon_sofa": st("on") } }; await card.updateComplete;
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("config_from", () => {
  it("encuentra el plano en una pestaña, también dentro de pilas", () => {
    const view = { path: "luces", sections: [{ cards: [{ type: "heading" }, { type: "vertical-stack", cards: [{ type: "custom:floorplan-lights-card", floors: CONFIG.floors }] }] }] };
    expect(findFloorplan(view)).toBe(CONFIG.floors);
    expect(findFloorplan({ path: "x", cards: [] })).toBeNull();
  });

  it("la tarjeta compacta carga las plantas de la pestaña indicada", async () => {
    const fake = makeHass();
    const ws: unknown[] = [];
    (fake.hass as unknown as { callWS: unknown }).callWS = async (m: unknown) => { ws.push(m); return { views: [{ path: "luces", sections: [{ cards: [{ type: "custom:floorplan-lights-card", floors: CONFIG.floors }] }] }] }; };
    const card = document.createElement("floorplan-lights-card") as El;
    card.setConfig({ compact: true, config_from: "luces" }); card.hass = fake.hass;
    document.body.appendChild(card); await card.updateComplete;
    await new Promise((r) => setTimeout(r, 0)); await card.updateComplete;
    expect(ws).toHaveLength(1);
    expect(card.shadowRoot!.querySelectorAll("[data-light]")).toHaveLength(4);
  });
});

describe("revisión", () => {
  const STAIR = "light.rele_escalera_superior";
  const withStair = { ...CONFIG, floors: CONFIG.floors.map((f) => ({ ...f, lights: [...f.lights, { entity: STAIR, x: 1, y: 1 }, ...(f.id === "pb" ? [{ entity: STAIR, x: 2, y: 2 }] : [])] })) };

  it("una luz en varias plantas cuenta una vez en el total y en cada planta", async () => {
    const { $, $$ } = await mount(withStair, { [STAIR]: st("on") });
    expect(text($(".count"))).toBe("3 encendidas");
    expect($$(".rail .n").map((n) => text(n))).toEqual(["1", "3"]);
  });

  it("la planta no salta cuando se apaga su última luz, y «Apagar planta» recuerda su planta", async () => {
    const { card, $ } = await mount();
    expect($(".rail button.on")?.getAttribute("aria-label")).toBe("Planta baja");
    $(".btn.danger")!.click(); await card.updateComplete;
    const h = (card as unknown as { hass: { states: Record<string, unknown> } }).hass;
    card.hass = { ...h, states: { ...h.states, "light.rele_despacho": st("off"), "light.philiphue_salon": st("off"), "light.rele_habitacion_principal": st("on") } };
    await card.updateComplete;
    expect($(".rail button.on")?.getAttribute("aria-label")).toBe("Planta baja");
    expect(text($(".btn.yes"))).toBe("Sí, apagar Baja");
  });

  it("el clic derecho no enciende ni apaga", async () => {
    const { $$, calls } = await mount();
    const sofa = $$("[data-light]")[0];
    sofa.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, composed: true, button: 2 }));
    sofa.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, composed: true, button: 2 }));
    expect(calls).toHaveLength(0);
  });

  it("ids de planta y de estancia válidos", () => {
    expect(() => validateConfig({ floors: [{ ...CONFIG.floors[0], id: "planta baja" }] })).toThrow("id");
    expect(() => validateConfig({ floors: [{ ...CONFIG.floors[0], rooms: [{ name: "x", poly: [] }] }] } as never)).toThrow("rooms[0].id");
  });

  it("config_from: tras un fallo de red se reintenta y no pisa una configuración nueva", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const fake = makeHass(); let fail = true; const ws: unknown[] = [];
    (fake.hass as unknown as { callWS: unknown }).callWS = async (m: unknown) => { ws.push(m); if (fail) throw new Error("caído");
      return { views: [{ path: "luces", cards: [{ type: "custom:floorplan-lights-card", floors: CONFIG.floors }] }] }; };
    const card = document.createElement("floorplan-lights-card") as El;
    card.setConfig({ compact: true, config_from: "luces" }); card.hass = fake.hass;
    document.body.appendChild(card); await card.updateComplete; await new Promise((r) => setTimeout(r, 0)); await card.updateComplete;
    expect(card.shadowRoot!.textContent).toContain("se reintenta solo");
    fail = false; vi.setSystemTime(Date.now() + 20_000);
    card.hass = { ...(fake.hass as object), states: { ...fake.hass.states } }; await card.updateComplete;
    await new Promise((r) => setTimeout(r, 0)); await card.updateComplete;
    expect(ws).toHaveLength(2);
    expect(card.shadowRoot!.querySelectorAll("[data-light]")).toHaveLength(4);
  });
});
