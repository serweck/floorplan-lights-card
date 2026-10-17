import { html, svg, nothing, type TemplateResult, type SVGTemplateResult } from "lit";
import type { HomeAssistant } from "custom-card-helpers";
import type { FloorConfig, LightView } from "./types";
import { WARM, centroid, floorBounds, labelInfo, lightView } from "./geometry";

export type Style = "day" | "night";
export interface EditState { mode: "luces" | "estancias" | "rotulos"; sel: { t: string; i: number } | null }
export interface PlanOptions { key: string; style: Style; labels?: boolean; dot?: number; edit?: EditState; pad?: number }

const STYLES = {
  day: { bg: "#eef1f5", room: "#fbfcfd", lit: "#fff4dc", wall: "#1d2531", tab: "#1d2531", dash: "#98a1af", label: "#2f3946", off: "#ffffff", offStroke: "#7b8594", glow: 0.7, blend: "multiply" },
  night: { bg: "#090d14", room: "#111720", lit: "#1c1912", wall: "#b2c2da", tab: "#6d7d96", dash: "#3d4a5e", label: "#8d9ab0", off: "#0d131c", offStroke: "#56637a", glow: 0.95, blend: "screen" },
} as const;
const ORANGE = "#ff9f1a", RED = "#ff5d5d", BLUE = "#4aa3ff";
const d = (poly: [number, number][]) => "M" + poly.map((p) => `${(+p[0]).toFixed(3)} ${(+p[1]).toFixed(3)}`).join(" L") + " Z";
const gid = (key: string, color: string) => `${key}-g${color.replace("#", "")}`;

export const styleBg = (s: Style) => STYLES[s].bg;

/** El plano de una planta como SVG: suelos, luz recortada por estancia, muros con huecos de puerta, rótulos y luces. */
export function planSvg(floor: FloorConfig, hass: HomeAssistant, opt: PlanOptions): TemplateResult {
  const S = STYLES[opt.style];
  const key = opt.key;
  const views: LightView[] = floor.lights.map((l, i) => lightView(hass, floor, l, i));
  const lit = new Set(views.filter((v) => v.on && v.room).map((v) => v.room));
  const colors = [...new Set([WARM, ...views.map((v) => v.color)])];
  const ed = opt.edit;
  const isSel = (t: string, i: number) => !!ed?.sel && ed.sel.t === t && ed.sel.i === i;
  const [x1, y1, x2, y2] = floorBounds(floor); const pad = opt.pad ?? 0.6;
  const vb = [x1 - pad, y1 - pad, x2 - x1 + pad * 2, y2 - y1 + pad * 2].map((n) => n.toFixed(2)).join(" ");

  const defs = svg`<defs>
    ${colors.map((c) => svg`<radialGradient id=${gid(key, c)}><stop offset="0" stop-color=${c} stop-opacity=${S.glow}></stop><stop offset=".3" stop-color=${c} stop-opacity=${S.glow * 0.45}></stop><stop offset="1" stop-color=${c} stop-opacity="0"></stop></radialGradient>`)}
    ${floor.rooms.map((r, i) => svg`<clipPath id=${`${key}-c${i}`}><path d=${d(r.poly)}></path></clipPath>`)}
    <pattern id=${`${key}-hatch`} width=".35" height=".35" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2=".35" stroke=${S.dash} stroke-width=".04"></line></pattern>
    <mask id=${`${key}-m`} maskUnits="userSpaceOnUse" x="-60" y="-60" width="160" height="160"><rect x="-60" y="-60" width="160" height="160" fill="#fff"></rect>
      ${(floor.doors ?? []).map((dr) => dr.o === "h"
        ? svg`<rect x=${dr.a} y=${dr.at - 0.3} width=${dr.b - dr.a} height=".6" fill="#000"></rect>`
        : svg`<rect x=${dr.at - 0.3} y=${dr.a} width=".6" height=${dr.b - dr.a} fill="#000"></rect>`)}
    </mask>
  </defs>`;

  const floors = floor.rooms.map((r) => svg`<path class="nohit" d=${d(r.poly)} fill=${r.ext ? `url(#${key}-hatch)` : lit.has(r.id) ? S.lit : S.room}
    stroke=${r.ext ? S.dash : "none"} stroke-width=".05" stroke-dasharray=${r.ext ? ".25 .18" : "none"}></path>`);
  const glows = svg`<g class="nohit" style=${`mix-blend-mode:${S.blend}`}>${floor.rooms.map((r, i) => {
    const src = views.filter((v) => v.on && v.room === r.id);
    if (!src.length) return nothing;
    return svg`<g clip-path=${`url(#${key}-c${i})`}>${src.map((v) => svg`<circle cx=${v.light.x} cy=${v.light.y} r=${(v.light.ext ? 2.6 : v.light.color ? 3.8 : 3.4) * (0.6 + 0.4 * v.intensity)} fill=${`url(#${gid(key, v.color)})`} opacity=${0.45 + 0.55 * v.intensity}></circle>`)}</g>`;
  })}</g>`;
  const walls = svg`<g class="nohit" mask=${`url(#${key}-m)`}>
    ${(floor.walls ?? []).map(([a, b, c, e]) => svg`<line x1=${a} y1=${b} x2=${c} y2=${e} stroke=${S.tab} stroke-width=".11" stroke-linecap="square"></line>`)}
    <path d=${d(floor.outline)} fill="none" stroke=${S.wall} stroke-width=".24"></path>
  </g>`;
  const lines = svg`<g class="nohit">
    ${(floor.dashed ?? []).map(([a, b, c, e]) => svg`<line x1=${a} y1=${b} x2=${c} y2=${e} stroke=${S.dash} stroke-width=".05" stroke-dasharray=".3 .2"></line>`)}
    ${(floor.railing ?? []).map(([a, b, c, e]) => svg`<line x1=${a} y1=${b} x2=${c} y2=${e} stroke=${S.tab} stroke-width=".06"></line>`)}
    ${(floor.doors ?? []).filter((dr) => ["glass", "window", "garage", "main"].includes(dr.k ?? "")).map((dr) => {
      const dash = dr.k === "garage" ? ".35 .2" : "none";
      return dr.o === "h"
        ? svg`<line x1=${dr.a} y1=${dr.at - 0.05} x2=${dr.b} y2=${dr.at - 0.05} stroke=${S.tab} stroke-width=".035" stroke-dasharray=${dash}></line><line x1=${dr.a} y1=${dr.at + 0.05} x2=${dr.b} y2=${dr.at + 0.05} stroke=${S.tab} stroke-width=".035" stroke-dasharray=${dash}></line>`
        : svg`<line x1=${dr.at - 0.05} y1=${dr.a} x2=${dr.at - 0.05} y2=${dr.b} stroke=${S.tab} stroke-width=".035" stroke-dasharray=${dash}></line><line x1=${dr.at + 0.05} y1=${dr.a} x2=${dr.at + 0.05} y2=${dr.b} stroke=${S.tab} stroke-width=".035" stroke-dasharray=${dash}></line>`;
    })}
  </g>`;

  const text = (x: number, y: number, fs: number, ls: string[], fill: string) => {
    const y0 = y - (ls.length - 1) * fs * 0.58;
    return ls.map((ln, k) => svg`<text x=${x} y=${y0 + k * fs * 1.15} font-size=${fs.toFixed(3)} font-weight="600" fill=${fill} text-anchor="middle" dominant-baseline="middle">${ln}</text>`);
  };
  const labels: SVGTemplateResult[] = [];
  if (opt.labels !== false) {
    floor.rooms.forEach((r, i) => {
      const L = labelInfo(floor, r); if (!L) return;
      const fill = lit.has(r.id) && opt.style === "night" ? "#ffe9c7" : S.label;
      if (ed?.mode === "rotulos") {
        const sel = isSel("label", i); const y0 = L.y - (L.lines.length - 1) * L.fs * 0.58;
        labels.push(svg`<g class="drag" data-drag="label" data-i=${i}><rect x=${L.x - L.w / 2 - 0.12} y=${y0 - L.fs * 0.7} width=${L.w + 0.24} height=${L.h + 0.1} rx=".08" fill=${sel ? "rgba(255,93,93,.18)" : "rgba(255,159,26,.14)"} stroke=${sel ? RED : ORANGE} stroke-width=".03"></rect>${text(L.x, L.y, L.fs, L.lines, fill)}</g>`);
      } else labels.push(svg`<g class="nohit">${text(L.x, L.y, L.fs, L.lines, fill)}</g>`);
    });
    (floor.labels ?? []).forEach((L, k) => {
      const fs = L.fs ?? 0.36;
      if (ed?.mode === "rotulos") {
        const sel = isSel("flabel", k); const w = L.text.length * 0.56 * fs;
        labels.push(svg`<g class="drag" data-drag="flabel" data-i=${k}><rect x=${L.x - w / 2 - 0.12} y=${L.y - fs * 0.7} width=${w + 0.24} height=${fs * 1.4} rx=".08" fill=${sel ? "rgba(255,93,93,.18)" : "rgba(132,180,255,.16)"} stroke=${sel ? RED : "#84b4ff"} stroke-width=".03"></rect>${text(L.x, L.y, fs, [L.text], S.label)}</g>`);
      } else labels.push(svg`<g class="nohit">${text(L.x, L.y, fs, [L.text], S.label)}</g>`);
    });
  }

  const rooms = ed?.mode === "estancias" ? svg`
    ${floor.rooms.map((r, i) => r.poly.map((p, j) => { const q = r.poly[(j + 1) % r.poly.length];
      return svg`<line class="drag" data-drag="redge" data-i=${i} data-j=${j} x1=${p[0]} y1=${p[1]} x2=${q[0]} y2=${q[1]} stroke=${isSel("room", i) ? RED : BLUE} stroke-width=".18" stroke-linecap="round" opacity=".6"></line>`; }))}
    ${floor.rooms.map((r, i) => r.poly.map(([x, y], j) => svg`<circle class="drag" data-drag="rvtx" data-i=${i} data-j=${j} cx=${x} cy=${y} r=".14" fill=${BLUE} stroke="#000" stroke-width=".03"></circle>`))}` : nothing;

  const editLights = ed?.mode === "luces";
  const r0 = opt.dot ?? 0.2;
  const lights = views.map((v) => {
    const c = v.color; const l = v.light;
    const fill = v.on ? c : S.off;
    const stroke = !v.available ? S.offStroke : l.color ? l.color : v.on ? "#7a5a1e" : S.offStroke;
    const core = l.ext
      ? svg`<rect x=${-r0} y=${-r0} width=${r0 * 2} height=${r0 * 2} rx=".05" transform="rotate(45)" fill=${fill} stroke=${stroke} stroke-width=${l.color ? 0.08 : 0.05} stroke-dasharray=${v.available ? "none" : ".08 .06"}></rect>`
      : svg`<circle r=${r0} fill=${fill} stroke=${stroke} stroke-width=${l.color ? 0.08 : 0.05} stroke-dasharray=${v.available ? "none" : ".08 .06"}></circle>`;
    let hit: SVGTemplateResult | typeof nothing = nothing;
    if (editLights) {
      const sel = isSel("light", v.index);
      hit = svg`<circle class="drag" data-drag="light" data-i=${v.index} r=".55" fill=${sel ? "rgba(255,93,93,.22)" : "rgba(255,159,26,.18)"} stroke=${sel ? RED : ORANGE} stroke-width=${sel ? 0.07 : 0.04}></circle>
        <text class="nohit" x=".42" y=".1" font-size=".26" fill=${opt.style === "night" ? "#ffd9a0" : "#7a4a05"} stroke=${S.bg} stroke-width=".08" paint-order="stroke">${v.name}</text>`;
    } else if (!ed) hit = svg`<circle class="hit" data-light=${v.index} r=".6" fill="transparent"><title>${v.name}</title></circle>`;
    return svg`<g transform=${`translate(${l.x} ${l.y})`} class=${ed && !editLights ? "nohit" : ""} opacity=${ed && !editLights ? 0.55 : 1}>${core}${hit}</g>`;
  });

  return html`<svg class="plan" viewBox=${vb} role="img" aria-label=${`Plano de ${floor.name}`} style=${`background:${S.bg}`}>${defs}${floors}${glows}${walls}${lines}${labels}${rooms}${lights}</svg>`;
}

/** Centro por defecto de una estancia (para «colocar solo» el rótulo). */
export const roomCenter = centroid;
