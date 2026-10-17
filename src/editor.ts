import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import type { HomeAssistant } from "custom-card-helpers";
import type { CardConfig, FloorConfig } from "./types";
import { labelInfo, roomOf } from "./geometry";
import { addLabel, addLight, dragFloor, removeLabel, removeLight, type DragType } from "./edit";
import { planSvg } from "./render";
import { styles } from "./styles";

export const EDITOR_TAG = "floorplan-lights-card-editor";
type Mode = "luces" | "estancias" | "rotulos";
type Sel = { t: "light" | "room" | "label" | "flabel"; i: number } | null;

const MODES: [Mode, string][] = [["luces", "Luces"], ["estancias", "Estancias"], ["rotulos", "Rótulos"]];
const SEL_OF: Record<DragType, Sel extends null ? never : NonNullable<Sel>["t"]> = { light: "light", redge: "room", rvtx: "room", label: "label", flabel: "flabel" };
const num = (v: string) => Math.round(parseFloat(v.replace(",", ".")) * 100) / 100;

/**
 * Editor visual (el que abre HA al editar la tarjeta). Con el plano en vivo:
 * luces (añadir, quitar, mover, X/Y, entidad, nombre, color), tamaño de las estancias y rótulos.
 * La estructura del plano (fachada, paredes, puertas) no se toca aquí: para eso está el editor web del plano.
 */
export class FloorplanLightsCardEditor extends LitElement {
  static styles = styles;
  static properties = { hass: { attribute: false }, _config: { state: true }, _floorId: { state: true }, _mode: { state: true }, _sel: { state: true }, _adding: { state: true } };

  declare hass?: HomeAssistant;
  declare _config?: CardConfig;
  declare _floorId?: string;
  declare _mode: Mode;
  declare _sel: Sel;
  declare _adding: "light" | "label" | null;

  constructor() { super(); this._mode = "luces"; this._sel = null; this._adding = null; }

  setConfig(config: CardConfig): void { this._config = config; }

  /** HA carga ha-entity-picker bajo demanda: se fuerza abriendo el editor de una tarjeta de entidades. */
  connectedCallback(): void {
    super.connectedCallback();
    if (customElements.get("ha-entity-picker")) return;
    const w = window as unknown as { loadCardHelpers?: () => Promise<{ createCardElement(c: object): { constructor: { getConfigElement?: () => Promise<unknown> } } }> };
    w.loadCardHelpers?.().then((h) => h.createCardElement({ type: "entities", entities: [] }).constructor.getConfigElement?.()).catch(() => undefined);
    customElements.whenDefined("ha-entity-picker").then(() => this.requestUpdate());
  }

  /** Solo se repinta si cambia algo del editor o alguna de las luces del plano (no con cada sensor de la casa). */
  protected shouldUpdate(changed: PropertyValues): boolean {
    if (changed.size !== 1 || !changed.has("hass")) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this.hass || !this._config?.floors) return true;
    return this._config.floors.some((f) => f.lights.some((l) => l.entity && old.states[l.entity] !== this.hass!.states[l.entity]));
  }

  private get _floor(): FloorConfig | undefined {
    const c = this._config; if (!c?.floors?.length) return undefined;
    return c.floors.find((f) => f.id === this._floorId) ?? c.floors[0];
  }

  /** Cambia la planta actual y avisa a HA (que guarda al pulsar «Guardar»). */
  _setFloor(f: FloorConfig, fire = true): void {
    const cfg = this._config!;
    this._config = { ...cfg, floors: cfg.floors.map((x) => (x.id === f.id ? f : x)) };
    if (fire) this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  /** Punto del plano (metros) bajo el puntero. */
  _toLocal(ev: PointerEvent): [number, number] | null {
    const svgEl = this.renderRoot.querySelector("svg.plan") as SVGSVGElement | null;
    const m = svgEl?.getScreenCTM?.(); if (!svgEl || !m) return null;
    const pt = svgEl.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const q = pt.matrixTransform(m.inverse()); return [q.x, q.y];
  }

  _onDown(ev: PointerEvent): void {
    const f = this._floor; if (!f) return;
    const P = this._toLocal(ev); if (!P) return;
    if (this._adding === "light") { ev.preventDefault(); const g = addLight(f, P[0], P[1]); this._setFloor(g); this._sel = { t: "light", i: g.lights.length - 1 }; this._adding = null; return; }
    if (this._adding === "label") { ev.preventDefault(); const g = addLabel(f, P[0], P[1]); this._setFloor(g); this._sel = { t: "flabel", i: (g.labels ?? []).length - 1 }; this._adding = null; return; }
    const t = (ev.target as Element).closest("[data-drag]") as SVGElement | null;
    if (!t) { this._sel = null; return; }
    ev.preventDefault();
    const type = t.dataset.drag as DragType, i = Number(t.dataset.i), j = Number(t.dataset.j ?? 0);
    const orig = f; let moved = false;
    const svgEl = t.ownerSVGElement ?? (t as unknown as SVGSVGElement);
    svgEl.setPointerCapture?.(ev.pointerId);
    const move = (e: PointerEvent) => {
      const Q = this._toLocal(e); if (!Q) return;
      const dx = Q[0] - P[0], dy = Q[1] - P[1];
      if (!moved && Math.hypot(dx, dy) < 0.06) return;
      moved = true; this._setFloor(dragFloor(orig, type, i, j, dx, dy), false);
    };
    const up = () => {
      svgEl.removeEventListener("pointermove", move as EventListener); svgEl.removeEventListener("pointerup", up); svgEl.removeEventListener("pointercancel", up);
      if (moved) this._setFloor(this._floor!, true);
      this._sel = { t: SEL_OF[type], i };
    };
    svgEl.addEventListener("pointermove", move as EventListener); svgEl.addEventListener("pointerup", up); svgEl.addEventListener("pointercancel", up);
  }

  /** Aplica un cambio a la planta actual a partir de una copia. */
  _edit(fn: (f: FloorConfig) => void): void {
    const g: FloorConfig = JSON.parse(JSON.stringify(this._floor)); fn(g); this._setFloor(g);
  }

  private _entityField(value: string, onPick: (v: string) => void): TemplateResult {
    if (customElements.get("ha-entity-picker")) {
      return html`<ha-entity-picker .hass=${this.hass} .value=${value} .includeDomains=${["light", "switch", "fan", "input_boolean"]} allow-custom-entity
        @value-changed=${(e: CustomEvent) => onPick(e.detail.value || "")}></ha-entity-picker>`;
    }
    const opts = Object.keys(this.hass?.states ?? {}).filter((e) => /^(light|switch|fan|input_boolean)\./.test(e)).sort();
    return html`<select aria-label="Entidad" @change=${(e: Event) => onPick((e.target as HTMLSelectElement).value)}>
      <option value="" ?selected=${!value}>Elige la entidad…</option>
      ${opts.map((e) => html`<option value=${e} ?selected=${e === value}>${(this.hass!.states[e].attributes.friendly_name as string) || e}</option>`)}
    </select>`;
  }

  private _xy(x: number, y: number, set: (k: 0 | 1, v: number) => void): TemplateResult {
    const field = (k: 0 | 1, v: number) => html`<label>${k ? "Y" : "X"} <input type="number" step="0.05" .value=${v.toFixed(2)}
      @change=${(e: Event) => { const n = num((e.target as HTMLInputElement).value); if (Number.isFinite(n)) set(k, n); }}></label>`;
    return html`${field(0, x)}${field(1, y)}`;
  }

  private _panel(f: FloorConfig): TemplateResult | typeof nothing {
    const s = this._sel; if (!s) return nothing;
    if (s.t === "light" && f.lights[s.i]) {
      const l = f.lights[s.i]; const room = roomOf(f, l.x, l.y);
      return html`<div class="panel">
        <div class="row">${this._entityField(l.entity, (v) => this._edit((g) => { g.lights[s.i].entity = v; }))}</div>
        <div class="row">
          <input type="text" placeholder="Nombre (opcional)" .value=${l.name ?? ""} @change=${(e: Event) => this._edit((g) => { const v = (e.target as HTMLInputElement).value.trim(); if (v) g.lights[s.i].name = v; else delete g.lights[s.i].name; })}>
          ${this._xy(l.x, l.y, (k, v) => this._edit((g) => { if (k) g.lights[s.i].y = v; else g.lights[s.i].x = v; }))}
          <label>Color <input type="color" .value=${l.color ?? "#ffc163"} @change=${(e: Event) => this._edit((g) => { g.lights[s.i].color = (e.target as HTMLInputElement).value; })}></label>
          <label><input type="checkbox" .checked=${!!l.ext} @change=${(e: Event) => this._edit((g) => { if ((e.target as HTMLInputElement).checked) g.lights[s.i].ext = true; else delete g.lights[s.i].ext; })}> exterior</label>
        </div>
        <div class="row"><span class="hint">En ${room?.name || "ninguna estancia"}</span><button class="btn danger" @click=${() => { this._setFloor(removeLight(f, s.i)); this._sel = null; }}>Quitar luz</button></div>
      </div>`;
    }
    if (s.t === "room" && f.rooms[s.i]) {
      const r = f.rooms[s.i];
      return html`<div class="panel"><div class="row">
        <input type="text" placeholder="Sin nombre" .value=${r.name ?? ""} @change=${(e: Event) => this._edit((g) => { g.rooms[s.i].name = (e.target as HTMLInputElement).value.trim(); })}>
        <label><input type="checkbox" .checked=${!!r.ext} @change=${(e: Event) => this._edit((g) => { if ((e.target as HTMLInputElement).checked) g.rooms[s.i].ext = true; else delete g.rooms[s.i].ext; })}> exterior</label>
      </div></div>`;
    }
    if (s.t === "label" && f.rooms[s.i]) {
      const r = f.rooms[s.i]; const L = labelInfo(f, r);
      return html`<div class="panel"><div class="row">
        <input type="text" .value=${r.name ?? ""} aria-label="Nombre" @change=${(e: Event) => this._edit((g) => { g.rooms[s.i].name = (e.target as HTMLInputElement).value.trim(); })}>
        <button class="btn" aria-label="Más pequeño" @click=${() => this._edit((g) => { g.rooms[s.i].fs = Math.max(0.5, Math.round(((g.rooms[s.i].fs ?? 1) - 0.1) * 10) / 10); })}>A−</button>
        <button class="btn" aria-label="Más grande" @click=${() => this._edit((g) => { g.rooms[s.i].fs = Math.min(2, Math.round(((g.rooms[s.i].fs ?? 1) + 0.1) * 10) / 10); })}>A+</button>
        ${L ? this._xy(L.x, L.y, (k, v) => this._edit((g) => { const p: [number, number] = [L.x, L.y]; p[k] = v; g.rooms[s.i].label = p; })) : nothing}
        <button class="btn" @click=${() => this._edit((g) => { delete g.rooms[s.i].label; delete g.rooms[s.i].fs; })}>Colocar solo</button>
      </div></div>`;
    }
    if (s.t === "flabel" && f.labels?.[s.i]) {
      const L = f.labels[s.i];
      return html`<div class="panel"><div class="row">
        <input type="text" .value=${L.text} aria-label="Texto" @change=${(e: Event) => this._edit((g) => { const v = (e.target as HTMLInputElement).value.trim(); if (v) g.labels![s.i].text = v; })}>
        <button class="btn" aria-label="Más pequeño" @click=${() => this._edit((g) => { g.labels![s.i].fs = Math.max(0.16, Math.round(((g.labels![s.i].fs ?? 0.36) - 0.04) * 100) / 100); })}>A−</button>
        <button class="btn" aria-label="Más grande" @click=${() => this._edit((g) => { g.labels![s.i].fs = Math.min(1.2, Math.round(((g.labels![s.i].fs ?? 0.36) + 0.04) * 100) / 100); })}>A+</button>
        ${this._xy(L.x, L.y, (k, v) => this._edit((g) => { if (k) g.labels![s.i].y = v; else g.labels![s.i].x = v; }))}
        <button class="btn danger" @click=${() => { this._setFloor(removeLabel(f, s.i)); this._sel = null; }}>Quitar rótulo</button>
      </div></div>`;
    }
    return nothing;
  }

  render() {
    const f = this._floor;
    if (this._config?.config_from && !this._config.floors) return html`<p class="hint">Esta tarjeta usa el plano de la pestaña «${this._config.config_from}». Edítalo allí.</p>`;
    if (!this._config || !this.hass || !f) return html`<p class="hint">Configura primero las plantas en YAML (las genera el repo Paneles).</p>`;
    const hints: Record<Mode, string> = {
      luces: "Arrastra una luz o tócala para elegir su entidad, nombre, posición X/Y o color.",
      estancias: "Arrastra un borde azul para cambiar el tamaño de una estancia o una esquina para deformarla. Tócala para renombrarla.",
      rotulos: "Arrastra un nombre (naranja: de estancia; azul: rótulo suelto). Tócalo para cambiar texto, tamaño o posición.",
    };
    return html`<div class="ed">
      <div class="row"><span class="seg" role="group" aria-label="Planta">${this._config.floors.map((x) => html`<button class=${x.id === f.id ? "on" : ""} @click=${() => { this._floorId = x.id; this._sel = null; this._adding = null; }}>${x.name}</button>`)}</span></div>
      <div class="row">
        <span class="seg" role="group" aria-label="Qué editar">${MODES.map(([k, n]) => html`<button class=${this._mode === k ? "on" : ""} @click=${() => { this._mode = k; this._sel = null; this._adding = null; }}>${n}</button>`)}</span>
        ${this._mode === "luces" ? html`<button class="btn ${this._adding === "light" ? "on" : ""}" @click=${() => (this._adding = this._adding === "light" ? null : "light")}>${this._adding === "light" ? "Toca donde va…" : "Añadir luz"}</button>` : nothing}
        ${this._mode === "rotulos" ? html`<button class="btn ${this._adding === "label" ? "on" : ""}" @click=${() => (this._adding = this._adding === "label" ? null : "label")}>${this._adding === "label" ? "Toca donde va…" : "Añadir rótulo"}</button>` : nothing}
      </div>
      <span class="hint">${hints[this._mode]}</span>
      ${this._panel(f)}
      <div class="plan-box" @pointerdown=${this._onDown}>${planSvg(f, this.hass, { key: `fle-${f.id}`, style: "day", edit: { mode: this._mode, sel: this._sel } })}</div>
      <span class="hint">La estructura (fachada, paredes y puertas) es fija. Para cambiarla, usa el editor web del plano.</span>
    </div>`;
  }
}

if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, FloorplanLightsCardEditor);
