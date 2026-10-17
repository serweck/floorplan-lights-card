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
  ha-card { overflow: hidden; }
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
  .body { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 12px; padding: 0 14px 14px; align-items: start; }
  .body.compact { grid-template-columns: 60px minmax(0, 1fr); gap: 10px; padding: 0 12px 12px; }
  @media (max-width: 480px) { .body:not(.compact) { grid-template-columns: minmax(0, 1fr); } .body:not(.compact) .rail { flex-direction: row; } .body:not(.compact) .rail button { flex: 1; } }
  .rail { display: flex; flex-direction: column; gap: 6px; }
  .rail button { border: 1px solid var(--fl-line); background: var(--fl-chip); color: var(--fl-mut); border-radius: 12px; padding: 8px 4px; cursor: pointer;
                 display: grid; justify-items: center; gap: 2px; font: inherit; }
  .rail button b { font-size: 21px; color: var(--primary-text-color); line-height: 1; }
  .rail button small { font-size: 11px; }
  .rail button.on { box-shadow: inset 3px 0 0 rgb(var(--fl-warm)); border-color: var(--primary-text-color); }
  .n { font-size: 11px; min-width: 18px; height: 18px; border-radius: 9px; display: inline-grid; place-items: center; padding: 0 5px;
       background: rgba(var(--fl-warm), .16); color: rgb(var(--fl-warm)); font-variant-numeric: tabular-nums; }
  .n.z { background: transparent; color: var(--fl-mut); }
  .plan-box { border-radius: 14px; overflow: hidden; }
  /* El plano entero cabe en la pantalla: a todo el ancho de un panel sería más alto que la ventana. */
  .body:not(.compact) .plan-box svg { max-height: 78vh; }
  .compact .plan-box { display: grid; place-items: center; }
  .compact .plan-box svg { max-height: 280px; width: auto; max-width: 100%; }
  svg.plan { display: block; width: 100%; height: auto; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
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
