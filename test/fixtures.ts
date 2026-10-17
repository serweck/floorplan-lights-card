import type { HomeAssistant } from "custom-card-helpers";
import type { CardConfig, FloorConfig } from "../src/types";

type Attrs = Record<string, unknown>;
export const st = (state: string, attributes: Attrs = {}) => ({ state, attributes, last_changed: "", last_updated: "" });
const R = (x1: number, y1: number, x2: number, y2: number): [number, number][] => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];

export const BAJA: FloorConfig = {
  id: "pb", name: "Planta baja", short: "Baja", level: "0",
  outline: [[0, 0], [9, 0], [9, 8], [0, 8]],
  walls: [[5, 0, 5, 8]],
  doors: [{ o: "v", at: 5, a: 3, b: 3.8 }],
  rooms: [
    { id: "salon", name: "Salón", poly: R(0.1, 0.1, 4.95, 7.9) },
    { id: "despacho", name: "Despacho", poly: R(5.05, 0.1, 8.9, 7.9) },
    { id: "cubierta", name: "Zona exterior cubierta", ext: true, poly: R(-3, -3, 9, 0) },
  ],
  labels: [{ text: "Jardín", x: 4, y: -2, fs: 0.36 }],
  lights: [
    { entity: "light.rele_salon_sofa", x: 2.5, y: 2.3 },
    { entity: "light.philiphue_salon", x: 2.5, y: 5, color: "#b98cff" },
    { entity: "light.rele_despacho", x: 7, y: 3 },
    { entity: "light.rele_exterior_porche_l1", x: 1, y: -1.5, ext: true },
  ],
};
export const SUPERIOR: FloorConfig = {
  id: "ps", name: "Planta superior", short: "Superior", level: "1",
  outline: [[0, 0], [6, 0], [6, 6], [0, 6]],
  rooms: [{ id: "hab", name: "Hab. principal", poly: R(0.1, 0.1, 5.9, 5.9) }],
  lights: [{ entity: "light.rele_habitacion_principal", x: 3, y: 3 }],
};
export const CONFIG: CardConfig = { title: "Luces", floors: [SUPERIOR, BAJA] };

export function baseStates() {
  return {
    "light.rele_salon_sofa": st("off", { friendly_name: "rele_salon_sofa" }),
    "light.philiphue_salon": st("on", { friendly_name: "PhilipHue Salon", rgb_color: [185, 140, 255], brightness: 255 }),
    "light.rele_despacho": st("on", { friendly_name: "rele_despacho" }),
    "light.rele_exterior_porche_l1": st("off"),
    "light.rele_habitacion_principal": st("off"),
  };
}

export interface FakeHass { hass: HomeAssistant; calls: { domain: string; service: string; data: Record<string, unknown> }[] }
export function makeHass(over: Record<string, ReturnType<typeof st> | undefined> = {}, darkMode = false): FakeHass {
  const states: Record<string, unknown> = { ...baseStates(), ...over };
  for (const k of Object.keys(states)) if (states[k] === undefined) delete states[k];
  const calls: FakeHass["calls"] = [];
  const hass = {
    states, themes: { darkMode },
    callService: async (domain: string, service: string, data: Record<string, unknown>) => { calls.push({ domain, service, data }); },
  } as unknown as HomeAssistant;
  return { hass, calls };
}
