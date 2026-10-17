/** Punto en metros: x hacia la derecha, y hacia abajo. */
export type Pt = [number, number];
export type Seg = [number, number, number, number];

/** Hueco en una pared horizontal (`h`, en y = at) o vertical (`v`, en x = at), de a hasta b. */
export interface DoorConfig {
  o: "h" | "v";
  at: number;
  a: number;
  b: number;
  /** "" puerta, glass cristalera, open abertura, window ventana, garage garaje, main principal. */
  k?: string;
}

export interface RoomConfig {
  id: string;
  name?: string;
  poly: Pt[];
  /** Exterior: se dibuja rayada. */
  ext?: boolean;
  /** Centro del rótulo; sin él, el centro de la estancia. */
  label?: Pt;
  /** Escala del rótulo (1 = automático). */
  fs?: number;
}

export interface LabelConfig {
  text: string;
  x: number;
  y: number;
  fs?: number;
}

export interface LightConfig {
  entity: string;
  name?: string;
  x: number;
  y: number;
  /** Luz de exterior: se dibuja como rombo. */
  ext?: boolean;
  /** Color del halo si la luz no informa del suyo. */
  color?: string;
}

export interface FloorConfig {
  id: string;
  name: string;
  short?: string;
  level?: string;
  // Estructura fija (el editor visual no la toca).
  outline: Pt[];
  walls?: Seg[];
  doors?: DoorConfig[];
  dashed?: Seg[];
  railing?: Seg[];
  // Lo que se ajusta desde HA.
  rooms: RoomConfig[];
  labels?: LabelConfig[];
  lights: LightConfig[];
}

export interface CardConfig {
  type?: string;
  title?: string;
  compact?: boolean;
  theme?: "auto" | "day" | "night";
  default_floor?: string;
  /** Usar el plano de la tarjeta de otra pestaña del mismo panel (su `path`), para no duplicarlo. */
  config_from?: string;
  floors: FloorConfig[];
}

export interface LightView {
  index: number;
  light: LightConfig;
  name: string;
  on: boolean;
  available: boolean;
  color: string;
  /** 0..1, para el halo. */
  intensity: number;
  room: string | null;
}

export interface LabelInfo {
  x: number;
  y: number;
  fs: number;
  lines: string[];
  w: number;
  h: number;
}
