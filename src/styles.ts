import { css } from "lit";

export const styles = css`
  :host {
    --fl-chip: var(--secondary-background-color, #262626);
    --fl-line: var(--divider-color, #2c2c2c);
    --fl-mut: var(--secondary-text-color, #9b9b9b);
    --fl-warm: 255, 193, 99;
    --fl-red: 248, 113, 113;
    --fl-edit: 255, 159, 26;
  }
  /* La tarjeta ocupa el alto que le dé el panel (se puede cambiar su tamaño) y el plano llena lo que queda. */
  :host { display: block; height: 100%; }
  ha-card { overflow: hidden; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; flex-wrap: wrap; }
  .top .t { display: flex; gap: 8px; align-items: center; font-weight: 600; font-size: 15px; }
  .top .t ha-icon { --mdc-icon-size: 20px; }
  .count { font-size: 12.5px; color: rgb(var(--fl-warm)); font-variant-numeric: tabular-nums; }
  .btn { font: inherit; font-size: 12.5px; color: var(--primary-text-color); background: var(--fl-chip); border: 1px solid var(--fl-line);
         border-radius: 10px; padding: 6px 10px; cursor: pointer; }
  .btn.danger { color: rgb(var(--fl-red)); border-color: rgba(var(--fl-red), .35); }
  .btn.yes { background: rgba(var(--fl-red), .18); color: rgb(var(--fl-red)); }
  .btn.on { border-color: rgb(var(--fl-edit)); background: rgba(var(--fl-edit), .14); }
  .btn[disabled] { opacity: .4; cursor: default; }
  .body { flex: 1 1 auto; min-height: 0; display: flex; gap: 12px; padding: 0 14px 14px; }
  .body.compact { gap: 10px; padding: 0 12px 12px; }
  .rail { display: flex; gap: 6px; }
  .rail button { border: 1px solid var(--fl-line); background: var(--fl-chip); color: var(--fl-mut); border-radius: 12px; cursor: pointer; font: inherit; }
  .rail button b { color: var(--primary-text-color); line-height: 1; }
  .rail button small { font-size: 11px; }
  /* Arriba: botones en fila que reparten el ancho. */
  .rail.top { padding: 0 14px 10px; flex-wrap: wrap; }
  .rail.top button { flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 7px 8px; }
  .rail.top button b { font-size: 16px; }
  .rail.top button small { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rail.top button.on { box-shadow: inset 0 -3px 0 rgb(var(--fl-warm)); border-color: var(--primary-text-color); color: var(--primary-text-color); }
  /* Al lado: columna tipo ascensor. */
  .rail.side { flex-direction: column; flex: none; width: 64px; }
  .rail.side button { display: grid; justify-items: center; gap: 2px; padding: 8px 4px; }
  .rail.side button b { font-size: 21px; }
  .rail.side button.on { box-shadow: inset 3px 0 0 rgb(var(--fl-warm)); border-color: var(--primary-text-color); }
  .n { font-size: 11px; min-width: 18px; height: 18px; border-radius: 9px; display: inline-grid; place-items: center; padding: 0 5px;
       background: rgba(var(--fl-warm), .16); color: rgb(var(--fl-warm)); font-variant-numeric: tabular-nums; }
  .n.z { background: transparent; color: var(--fl-mut); }
  .plan-box { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; border-radius: 14px; overflow: hidden; }
  /* Sin alto fijo (paneles de columnas) el plano toma su proporción; con alto fijo lo llena y se centra. */
  svg.plan { display: block; width: 100%; height: 100%; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  .ed svg.plan { height: auto; }
  svg text { font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
  svg .hit { cursor: pointer; }
  svg .nohit { pointer-events: none; }
  svg .drag { cursor: grab; }
  /* editor */
  .ed { display: grid; gap: 10px; }
  .ed .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .ed .seg { display: inline-flex; gap: 3px; padding: 3px; border-radius: 12px; border: 1px solid var(--fl-line); background: var(--fl-chip); flex-wrap: wrap; }
  .ed .seg button { font: inherit; font-size: 13px; color: var(--fl-mut); background: none; border: 0; border-radius: 9px; padding: 6px 11px; cursor: pointer; }
  .ed .seg button.on { background: rgba(var(--fl-edit), .16); color: var(--primary-text-color); box-shadow: inset 0 0 0 1px rgba(var(--fl-edit), .5); }
  .ed .hint { color: var(--fl-mut); font-size: 13px; }
  .ed input[type=text], .ed input[type=number], .ed select { font: inherit; font-size: 13px; color: var(--primary-text-color); background: var(--card-background-color, #1c1c1c);
       border: 1px solid var(--fl-line); border-radius: 9px; padding: 6px 8px; min-width: 0; }
  .ed input[type=number] { width: 84px; }
  .ed label { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; color: var(--fl-mut); }
  .ed .panel { border: 1px dashed rgba(var(--fl-edit), .5); background: rgba(var(--fl-edit), .05); border-radius: 12px; padding: 10px; display: grid; gap: 8px; }
  .ed .plan-box svg { touch-action: none; }
  .ed ha-entity-picker { flex: 1 1 240px; min-width: 200px; }
`;
