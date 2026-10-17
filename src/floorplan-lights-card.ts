import { LitElement, html, nothing, type PropertyValues } from "lit";
import type { HomeAssistant } from "custom-card-helpers";
import type { CardConfig, FloorConfig } from "./types";
import { floorEntities, onCount, pickFloor, totalOn } from "./geometry";
import { planSvg, type Style } from "./render";
import { styles } from "./styles";
import "./editor";

export const CARD_TAG = "floorplan-lights-card";
export const CARD_VERSION = "0.1.1";
/** Mantener pulsado más de esto abre el detalle de la luz en vez de encenderla. */
const HOLD_MS = 500;

export function validateConfig(config: Partial<CardConfig> | undefined): CardConfig {
  if (config?.config_from && !config.floors) return config as CardConfig;
  const floors = config?.floors;
  if (!Array.isArray(floors) || floors.length === 0) throw new Error("floors: hace falta al menos una planta");
  floors.forEach((f, i) => {
    if (!f?.id) throw new Error(`floors[${i}].id es obligatorio`);
    if (!/^[\w-]+$/.test(f.id)) throw new Error(`floors[${i}].id: solo letras, números, _ y -`);
    if (!f.name) throw new Error(`floors[${i}].name es obligatorio`);
    if (!Array.isArray(f.outline) || f.outline.length < 3) throw new Error(`floors[${i}].outline: hace falta la fachada (al menos 3 puntos)`);
    if (!Array.isArray(f.rooms)) throw new Error(`floors[${i}].rooms: tiene que ser una lista`);
    f.rooms.forEach((r, j) => { if (!r?.id) throw new Error(`floors[${i}].rooms[${j}].id es obligatorio`); });
    if (!Array.isArray(f.lights)) throw new Error(`floors[${i}].lights: tiene que ser una lista`);
  });
  return config as CardConfig;
}

const TOGGLE_DOMAINS = new Set(["light", "switch", "fan", "input_boolean"]);

interface LovelaceCard { type?: string; floors?: FloorConfig[]; cards?: LovelaceCard[]; card?: LovelaceCard }
interface LovelaceView { path?: string; cards?: LovelaceCard[]; sections?: { cards?: LovelaceCard[] }[] }
/** Primera tarjeta de plano (con plantas) de una pestaña, buscando también dentro de pilas. */
export function findFloorplan(view: LovelaceView): FloorConfig[] | null {
  const walk = (cards: LovelaceCard[] = []): FloorConfig[] | null => {
    for (const c of cards) {
      if (c.type === `custom:${CARD_TAG}` && Array.isArray(c.floors)) return c.floors;
      const inner = walk([...(c.cards ?? []), ...(c.card ? [c.card] : [])]);
      if (inner) return inner;
    }
    return null;
  };
  return walk([...(view.cards ?? []), ...(view.sections ?? []).flatMap((s) => s.cards ?? [])]);
}

export class FloorplanLightsCard extends LitElement {
  static styles = styles;
  static properties = { hass: { attribute: false }, _config: { state: true }, _floor: { state: true }, _confirm: { state: true }, _error: { state: true } };

  declare hass?: HomeAssistant;
  declare private _config?: CardConfig;
  declare private _floor?: string;
  declare private _confirm: boolean;
  declare private _error?: string;
  private _loading = false;
  private _retryAt = 0;
  private _unsub?: () => void;
  private _watched: string[] = [];
  private _hold?: ReturnType<typeof setTimeout>;
  private _held = false;
  /** Entidad bajo el dedo al empezar el toque (no el índice: la planta podría cambiar entre medias). */
  private _down?: string;
  /** Planta sobre la que se pidió «Apagar planta». */
  private _confirmFloor?: string;

  constructor() { super(); this._confirm = false; }

  static getConfigElement(): HTMLElement { return document.createElement("floorplan-lights-card-editor"); }
  static getStubConfig(): CardConfig {
    return { floors: [{ id: "pb", name: "Planta baja", short: "Baja", level: "0", outline: [[0, 0], [8, 0], [8, 6], [0, 6]], rooms: [{ id: "salon", name: "Salón", poly: [[0.1, 0.1], [7.9, 0.1], [7.9, 5.9], [0.1, 5.9]] }], lights: [] }] };
  }

  setConfig(config: CardConfig): void {
    this._config = validateConfig(config);
    this._error = undefined; this._retryAt = 0;
    this._watched = (config.floors ?? []).flatMap(floorEntities);
    if (this._floor && !(config.floors ?? []).some((f) => f.id === this._floor)) this._floor = undefined;
  }

  private get _urlPath(): string | null {
    const p = location.pathname.split("/")[1] || null;
    return p === "lovelace" ? null : p;
  }

  /** La planta se elige una vez (al abrir); después solo cambia cuando la elige el usuario. */
  protected willUpdate(): void {
    if (!this._floor && this.hass && this._config?.floors?.length) this._floor = pickFloor(this.hass, this._config);
  }

  /** Con `config_from`, carga las plantas de la tarjeta de esa pestaña del panel actual y las vuelve a leer si se edita. */
  protected updated(): void {
    const cfg = this._config;
    if (!cfg?.config_from || !this.hass) return;
    const conn = (this.hass as unknown as { connection?: { subscribeEvents?: (cb: (e: { data?: { url_path?: string | null } }) => void, type: string) => Promise<() => void> } }).connection;
    if (!this._unsub && conn?.subscribeEvents) {
      this._unsub = () => undefined;
      conn.subscribeEvents((e) => { if ((e.data?.url_path ?? null) === this._urlPath) this._load(true); }, "lovelace_updated")
        .then((u) => { this._unsub = u; }).catch(() => { this._unsub = undefined; });
    }
    if (!cfg.floors && !this._loading && Date.now() >= this._retryAt) this._load(false);
  }

  private _load(force: boolean): void {
    const cfg = this._config; if (!cfg?.config_from || this._loading) return;
    this._loading = true;
    (this.hass as unknown as { callWS(m: object): Promise<{ views?: LovelaceView[] }> })
      .callWS({ type: "lovelace/config", url_path: this._urlPath, ...(force ? { force: true } : {}) })
      .then((dash) => {
        if (this._config !== cfg && this._config?.config_from !== cfg.config_from) return;
        const base = this._config ?? cfg;
        const view = dash.views?.find((v) => v.path === cfg.config_from);
        const floors = view ? findFloorplan(view) : null;
        if (!floors) { this._error = `No encuentro el plano en la pestaña «${cfg.config_from}»`; return; }
        this._error = undefined;
        this._config = { ...base, floors };
        this._watched = floors.flatMap(floorEntities);
        if (this._floor && !floors.some((f) => f.id === this._floor)) this._floor = undefined;
      })
      .catch((e) => {
        console.warn("floorplan-lights-card: no se ha podido leer el plano", e);
        this._error = "No se ha podido leer el plano del panel; se reintenta solo";
        this._retryAt = Date.now() + 15_000;
      })
      .finally(() => { this._loading = false; });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsub?.(); this._unsub = undefined;
    clearTimeout(this._hold);
  }

  getCardSize(): number { return this._config?.compact ? 5 : 9; }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (changed.size !== 1 || !changed.has("hass")) return true;
    if (this._config?.config_from && !this._config.floors) return true; // hay que poder reintentar la carga
    const old = changed.get("hass") as HomeAssistant | undefined;
    const dark = (h: HomeAssistant) => (h as unknown as { themes?: { darkMode?: boolean } }).themes?.darkMode;
    if (!old || !this.hass || dark(old) !== dark(this.hass)) return true;
    return this._watched.some((e) => old.states[e] !== this.hass!.states[e]);
  }

  private get _style(): Style {
    const t = this._config?.theme ?? "auto";
    if (t === "day" || t === "night") return t;
    return (this.hass as unknown as { themes?: { darkMode?: boolean } })?.themes?.darkMode ? "night" : "day";
  }

  private _current(): FloorConfig {
    const cfg = this._config!;
    const id = this._floor ?? pickFloor(this.hass!, cfg);
    return cfg.floors.find((f) => f.id === id) ?? cfg.floors[0];
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  private _toggle(entity: string): void {
    const domain = entity.split(".")[0];
    if (TOGGLE_DOMAINS.has(domain)) this.hass!.callService(domain, "toggle", { entity_id: entity });
    else this.hass!.callService("homeassistant", "toggle", { entity_id: entity });
  }

  private _floorOff(id: string | undefined): void {
    const f = this._config!.floors.find((x) => x.id === id); this._confirm = false; this._confirmFloor = undefined;
    if (!f) return;
    const on = floorEntities(f).filter((e) => this.hass!.states[e]?.state === "on");
    const byDomain = new Map<string, string[]>();
    on.forEach((e) => { const dm = TOGGLE_DOMAINS.has(e.split(".")[0]) ? e.split(".")[0] : "homeassistant"; byDomain.set(dm, [...(byDomain.get(dm) ?? []), e]); });
    byDomain.forEach((ids, dm) => this.hass!.callService(dm, "turn_off", { entity_id: ids }));
  }

  private _primary(ev: PointerEvent): boolean {
    return (ev.button === undefined || ev.button === 0) && ev.isPrimary !== false;
  }

  private _entityAt(ev: Event): string | undefined {
    const t = (ev.target as Element).closest("[data-light]") as SVGElement | null;
    return t ? this._current().lights[Number(t.dataset.light)]?.entity || undefined : undefined;
  }

  private _down_(ev: PointerEvent): void {
    if (!this._primary(ev)) return;
    const entity = this._entityAt(ev); if (!entity) return;
    this._held = false; this._down = entity;
    clearTimeout(this._hold);
    this._hold = setTimeout(() => { this._held = true; this._moreInfo(entity); }, HOLD_MS);
  }

  private _up(ev: PointerEvent): void {
    clearTimeout(this._hold);
    const entity = this._down; this._down = undefined;
    if (!this._primary(ev) || this._held || !entity || this._entityAt(ev) !== entity) return;
    this._toggle(entity);
  }

  private _cancel(): void { clearTimeout(this._hold); this._down = undefined; }

  render() {
    if (!this._config || !this.hass) return nothing;
    if (this._error && !this._config.floors) return html`<ha-card><div class="top"><div class="t">${this._error}</div></div></ha-card>`;
    if (!this._config.floors) return html`<ha-card><div class="top"><div class="t">Cargando el plano…</div></div></ha-card>`;
    const cfg = this._config; const hass = this.hass; const f = this._current();
    const total = totalOn(hass, cfg);
    const cf = cfg.floors.find((x) => x.id === this._confirmFloor) ?? f;
    const off = this._confirm
      ? html`<button class="btn yes" @click=${() => this._floorOff(cf.id)}>Sí, apagar ${cf.short ?? cf.name}</button><button class="btn" @click=${() => { this._confirm = false; this._confirmFloor = undefined; }}>No</button>`
      : html`<button class="btn danger" ?disabled=${!onCount(hass, f)} @click=${() => { this._confirm = true; this._confirmFloor = f.id; }}>Apagar planta</button>`;
    return html`<ha-card>
      <div class="top">
        <div class="t"><ha-icon icon="mdi:lightbulb-group"></ha-icon>${cfg.title ?? "Luces"} <span class="count">${total} encendidas</span></div>
        <div>${off}</div>
      </div>
      <div class="body ${cfg.compact ? "compact" : ""}">
        <div class="rail" role="group" aria-label="Planta">${cfg.floors.map((x) => { const n = onCount(hass, x);
          return html`<button class=${x.id === f.id ? "on" : ""} aria-label=${x.name} @click=${() => { this._floor = x.id; this._confirm = false; this._confirmFloor = undefined; }}>
            <b>${x.level ?? ""}</b><small>${x.short ?? x.name}</small><span class="n ${n ? "" : "z"}">${n}</span></button>`; })}</div>
        <div class="plan-box" @pointerdown=${this._down_} @pointerup=${this._up} @pointercancel=${this._cancel} @pointerleave=${this._cancel} @contextmenu=${(e: Event) => e.preventDefault()}>
          ${planSvg(f, hass, { key: `fl-${f.id}`, style: this._style, labels: !cfg.compact, dot: cfg.compact ? 0.26 : 0.2, pad: cfg.compact ? 0.35 : 0.6 })}
        </div>
      </div>
    </ha-card>`;
  }
}

if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, FloorplanLightsCard);

const w = window as unknown as { customCards?: unknown[] };
w.customCards = w.customCards || [];
w.customCards.push({ type: CARD_TAG, name: "Floorplan Lights Card", description: "El plano de la casa por plantas para ver y controlar las luces", preview: false });

/* eslint-disable no-console */
console.info(`%c FLOORPLAN-LIGHTS-CARD %c v${CARD_VERSION} `, "color:#1b1305;background:#ffc163;font-weight:700", "color:#ffc163");
