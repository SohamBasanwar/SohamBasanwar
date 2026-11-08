// Renders the hand-made profile graphics into assets/, in GitHub's own colors.
// Every image is written twice (name-dark.svg, name-light.svg) and the README
// picks one with <picture>, so it follows the visitor's GitHub theme.
// Run: node scripts/build-assets.mjs
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (file, svg) => {
  const path = join(root, "assets", file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, svg.replace(/\n\s*\n/g, "\n"));
  console.log(`assets/${file}  ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
};

// GitHub Primer color tokens.
const THEMES = {
  dark: {
    canvas: "#0d1117", subtle: "#151b23", border: "#3d444d", line: "#262c36",
    fg: "#f0f6fc", muted: "#9198a1", accent: "#4493f8", success: "#3fb950",
    attention: "#d29922", danger: "#f85149", done: "#ab7df8", sponsors: "#db61a2",
  },
  light: {
    canvas: "#ffffff", subtle: "#f6f8fa", border: "#d1d9e0", line: "#eaeef2",
    fg: "#1f2328", muted: "#59636e", accent: "#0969da", success: "#1a7f37",
    attention: "#9a6700", danger: "#d1242f", done: "#8250df", sponsors: "#bf3989",
  },
};
// Linguist colors, as on GitHub repo cards.
const LANG = { C: "#555555", "C++": "#f34b7d", Java: "#b07219", TypeScript: "#3178c6", Python: "#3572A5", JavaScript: "#f1e05a" };

const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r1 = (n) => Math.round(n * 10) / 10;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const svg = (w, h, label, body, css = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<style>
text { font-family: ${SANS}; }
.mono { font-family: ${MONO}; }
${css}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
${body}
</svg>
`;

const box = (w, h, T, rx = 6) =>
  `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}" fill="${T.canvas}" stroke="${T.border}"/>`;

// A Primer "Label": outlined, fully rounded, small text.
const label = (text, color, x, y, anchor = "start") => {
  const w = Math.round(text.length * 6.6 + 18);
  const lx = anchor === "end" ? x - w : x;
  return `<g transform="translate(${lx} ${y})"><rect x="0.5" y="0.5" width="${w - 1}" height="19" rx="9.5" fill="none" stroke="${color}"/><text x="${w / 2}" y="14" text-anchor="middle" font-size="12" font-weight="500" fill="${color}">${esc(text)}</text></g>`;
};

const REPO_ICON = "M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z";

// ---------- 3D wireframe heart ----------
// The classic heart curve puffed into a pillow along z. Each latitude and
// meridian is one path whose `d` steps through precomputed rotation frames,
// so the image shows real 3D motion without WebGL.
const heartXY = (t) => [
  16 * Math.sin(t) ** 3,
  -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 2.5,
];
const DEPTH = 8;
const puff = (z) => Math.sqrt(Math.max(0, 1 - z * z));

function heartCurves() {
  const curves = [];
  for (const z of [-0.8, -0.55, -0.28, 0, 0.28, 0.55, 0.8]) {
    const s = puff(z);
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const [x, y] = heartXY((i / 40) * Math.PI * 2);
      pts.push([x * s, y * s, z * DEPTH]);
    }
    curves.push({ pts, kind: "lat" });
  }
  for (let k = 0; k < 14; k++) {
    const [x, y] = heartXY((k / 14) * Math.PI * 2 + 0.11);
    const pts = [];
    for (let j = 0; j <= 20; j++) {
      const z = -1 + (j / 20) * 2;
      const s = puff(z);
      pts.push([x * s, y * s, z * DEPTH]);
    }
    curves.push({ pts, kind: "mer" });
  }
  return curves;
}

function heart3d({ cx, cy, scale, color, dur = 12, frames = 30 }) {
  const tilt = -0.32;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  return heartCurves()
    .map(({ pts, kind }) => {
      const ds = [];
      const ops = [];
      for (let f = 0; f <= frames; f++) {
        // The heart is symmetric under a half turn, so 0..180 degrees loops seamlessly.
        const a = (f / frames) * Math.PI;
        const ca = Math.cos(a), sa = Math.sin(a);
        let zsum = 0;
        const p2 = pts.map(([x, y, z]) => {
          const x1 = x * ca + z * sa;
          const z1 = -x * sa + z * ca;
          const y2 = y * ct - z1 * st;
          const z2 = y * st + z1 * ct;
          zsum += z2;
          const p = 70 / (70 - z2);
          return [r1(cx + x1 * scale * p), r1(cy + y2 * scale * p)];
        });
        ds.push("M" + p2.map((p) => p.join(" ")).join("L"));
        ops.push(r1(0.18 + 0.36 * (zsum / pts.length / DEPTH + 1)));
      }
      return `<path d="${ds[0]}" stroke="${color}" stroke-width="${kind === "lat" ? 1.4 : 0.9}" fill="none" stroke-linejoin="round">
<animate attributeName="d" dur="${dur}s" repeatCount="indefinite" values="${ds.join(";")}"/>
<animate attributeName="stroke-opacity" dur="${dur}s" repeatCount="indefinite" values="${ops.join(";")}"/>
</path>`;
    })
    .join("\n");
}

// ---------- hero ----------
function hero(T) {
  const W = 1200, H = 320;
  seed = 7;
  const particles = Array.from({ length: 28 }, () => {
    const x = r1(640 + rand() * 540), y = r1(20 + rand() * 280);
    const d = r1(8 + rand() * 8), delay = r1(-rand() * 12);
    return `<circle cx="${x}" cy="${y}" r="${r1(0.8 + rand())}" fill="${T.sponsors}" class="pt" style="animation-duration:${d}s;animation-delay:${delay}s"/>`;
  }).join("\n");

  let ecg = `M0 286`;
  for (let x = 0; x < W; x += 240) {
    ecg += ` L${x + 120} 286 L${x + 132} 280 L${x + 142} 286 L${x + 150} 286 L${x + 158} 258 L${x + 168} 302 L${x + 176} 286 L${x + 196} 286 L${x + 208} 277 L${x + 222} 286`;
  }
  ecg += ` L${W} 286`;

  const lines = [
    "I build AI tools people actually use.",
    "I rebuilt a database after ransomware hit.",
    "I write memory allocators for fun.",
  ];
  const cw = 10.84; // monospace advance at 18px
  const typed = lines
    .map((line, i) => {
      const w = r1(line.length * cw + 4);
      return `<g class="ty ty${i}">
  <clipPath id="tc${i}"><rect class="tr tr${i}" x="78" y="194" width="${w}" height="28" style="--w:${w}px"/></clipPath>
  <text x="80" y="214" class="mono" font-size="18" fill="${T.fg}" clip-path="url(#tc${i})">${esc(line)}</text>
</g>`;
    })
    .join("\n");

  const css = `
.pt { animation: drift 10s ease-in-out infinite alternate; transform-box: fill-box; }
@keyframes drift { 0% { transform: translate(0,0); opacity: 0 } 50% { opacity: .5 } 100% { transform: translate(10px,-18px); opacity: 0 } }
.sweep { stroke-dasharray: 160 1420; animation: sweep 5s linear infinite; }
@keyframes sweep { from { stroke-dashoffset: 160 } to { stroke-dashoffset: -1420 } }
.ty { opacity: 0; animation: show 12s infinite; }
.ty1 { animation-delay: 4s } .ty2 { animation-delay: 8s }
@keyframes show { 0%,33% { opacity: 1 } 33.01%,100% { opacity: 0 } }
.tr { width: 0; animation: type 12s steps(38) infinite; }
.tr1 { animation-delay: 4s } .tr2 { animation-delay: 8s }
@keyframes type { 0% { width: 0 } 14% { width: var(--w) } 100% { width: var(--w) } }
.dot { animation: ping 2.4s ease-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes ping { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(2.6); opacity: 0 } }`;

  const body = `${box(W, H, T, 12)}
<defs>
  <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${T.line}"/></pattern>
  <clipPath id="inside"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12"/></clipPath>
</defs>
<g clip-path="url(#inside)">
  <rect x="640" width="${W - 640}" height="${H}" fill="url(#dots)"/>
  ${particles}
  <path d="${ecg}" fill="none" stroke="${T.border}" stroke-width="1"/>
  <path class="sweep" pathLength="1580" d="${ecg}" fill="none" stroke="${T.sponsors}" stroke-width="1.6" stroke-linecap="round"/>
</g>
<text x="80" y="76" class="mono" font-size="14" fill="${T.muted}">University of Illinois Chicago · Computer Science</text>
<text x="77" y="138" font-size="54" font-weight="600" fill="${T.fg}" letter-spacing="-1">Soham Basanwar</text>
<text x="80" y="172" font-size="18" fill="${T.muted}">AI, full-stack and systems, with a soft spot for the human heart.</text>
<text x="80" y="214" class="mono" font-size="18" fill="${T.sponsors}">$</text>
<g transform="translate(18 0)">
${typed}
</g>
<g transform="translate(80 236)">
  <rect x="0.5" y="0.5" width="279" height="23" rx="11.5" fill="none" stroke="${T.success}"/>
  <circle cx="14" cy="12" r="4" fill="${T.success}"/><circle class="dot" cx="14" cy="12" r="4" fill="${T.success}"/>
  <text x="26" y="16.5" font-size="12.5" font-weight="500" fill="${T.success}">Open to Summer 2027 internships</text>
</g>
${heart3d({ cx: 940, cy: 150, scale: 5.6, color: T.sponsors })}`;
  return svg(W, H, "Soham Basanwar: AI, full-stack and systems. Open to Summer 2027 internships.", body, css);
}

// ---------- small animated motifs for the cards (about 78x44) ----------
const motifs = {
  alloc: (T) => {
    let s = "";
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 6; c++)
        s += `<rect x="${c * 13}" y="${r * 14}" width="10" height="10" rx="2" fill="${T.accent}" class="blk" style="animation-delay:-${r1(((r * 6 + c) * 0.37) % 3.2)}s"/>`;
    return { body: s, css: `.blk { animation: blk 3.2s ease-in-out infinite; } @keyframes blk { 0%,100% { fill-opacity: .12 } 40%,60% { fill-opacity: .8 } }` };
  },
  match: (T) => ({
    body: [0.92, 0.68, 0.42]
      .map((v, i) => `<rect x="0" y="${4 + i * 14}" width="78" height="6" rx="3" fill="${T.line}"/><rect class="bar" x="0" y="${4 + i * 14}" width="${r1(78 * v)}" height="6" rx="3" fill="${T.success}" style="animation-delay:${i * 0.25}s"/>`)
      .join(""),
    css: `.bar { transform-box: fill-box; animation: grow 4s ease-out infinite; } @keyframes grow { 0% { transform: scaleX(0) } 45%,100% { transform: scaleX(1) } }`,
  }),
  board: (T) => {
    let s = "";
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) if ((r + c) % 2) s += `<rect x="${c * 13}" y="${r * 11}" width="13" height="11" fill="${T.line}"/>`;
    s += `<circle cx="32.5" cy="38.5" r="4.5" fill="${T.danger}" class="hop"/><circle cx="58.5" cy="5.5" r="4.5" fill="${T.muted}"/><circle cx="71.5" cy="16.5" r="4.5" fill="${T.muted}"/>`;
    return { body: s, css: `.hop { animation: hop 3s ease-in-out infinite; } @keyframes hop { 0%,20% { transform: translate(0,0) } 45%,65% { transform: translate(13px,-11px) } 90%,100% { transform: translate(26px,-22px); opacity: 0 } }` };
  },
  rain: (T) => ({
    body: `<path d="M14 24 a9 9 0 0 1 7-13 a12 12 0 0 1 22-3 a10 10 0 0 1 18 5 a7.5 7.5 0 0 1 1 11 z" fill="none" stroke="${T.muted}" stroke-width="1.2"/>` +
      [12, 26, 40, 54].map((x, i) => `<line x1="${x}" y1="29" x2="${x - 2}" y2="35" stroke="${T.accent}" stroke-width="1.6" stroke-linecap="round" class="drop" style="animation-delay:-${r1(i * 0.4)}s"/>`).join(""),
    css: `.drop { animation: fall 1.6s linear infinite; } @keyframes fall { from { transform: translateY(0); opacity: 1 } to { transform: translateY(12px); opacity: 0 } }`,
  }),
  mood: (T) => ({
    body: `<rect x="0.5" y="0.5" width="77" height="30" rx="8" fill="none" stroke="${T.border}"/><path d="M12 31 l-4 8 l10 -8" fill="${T.canvas}" stroke="${T.border}"/>
<rect x="9" y="9" width="38" height="4" rx="2" fill="${T.muted}" fill-opacity="0.5"/><rect x="9" y="18" width="24" height="4" rx="2" fill="${T.muted}" fill-opacity="0.3"/>
<circle cx="63" cy="15.5" r="6" class="emo" fill="${T.sponsors}"/>`,
    css: `.emo { animation: emo 6s infinite; } @keyframes emo { 0%,100% { fill: ${T.sponsors} } 25% { fill: ${T.attention} } 50% { fill: ${T.accent} } 75% { fill: ${T.done} } }`,
  }),
  orbit: (T) => ({
    body: `<ellipse cx="39" cy="22" rx="36" ry="12" fill="none" stroke="${T.border}"/><circle cx="39" cy="22" r="6" fill="${T.accent}"/>
<g class="spin"><circle cx="75" cy="22" r="3" fill="${T.sponsors}"/><circle cx="3" cy="22" r="2" fill="${T.muted}"/></g>`,
    css: `.spin { animation: spin 6s linear infinite; transform-origin: 39px 22px; } @keyframes spin { to { transform: rotate(360deg) } }`,
  }),
  plan: (T) => ({
    body: `<rect x="0" y="6" width="78" height="1" fill="${T.border}"/>
<rect x="0" y="14" width="24" height="10" rx="3" fill="${T.done}" fill-opacity="0.75"/><rect x="28" y="14" width="20" height="10" rx="3" fill="${T.accent}" fill-opacity="0.7"/>
<rect class="buf" x="52.5" y="14.5" width="25" height="9" rx="3" fill="none" stroke="${T.attention}" stroke-dasharray="2 2"/>
<rect class="now" x="0" y="2" width="1.5" height="28" fill="${T.danger}"/>`,
    css: `.now { animation: now 5s linear infinite; } @keyframes now { from { transform: translateX(0) } to { transform: translateX(76px) } }
.buf { animation: buf 1.6s ease-in-out infinite; } @keyframes buf { 50% { stroke-opacity: .3 } }`,
  }),
  sun: (T) => {
    const dots = Array.from({ length: 12 }, (_, i) => {
      const t = (i / 12) * Math.PI * 2;
      return `<circle cx="${r1(39 + Math.cos(t) * 19)}" cy="${r1(22 + Math.sin(t) * 19)}" r="${i % 3 ? 1.3 : 2.2}" fill="${T.attention}"/>`;
    }).join("");
    return {
      body: `<circle cx="39" cy="22" r="8" fill="${T.attention}" fill-opacity="0.8"/><g class="spin">${dots}</g>`,
      css: `.spin { animation: spin 9s linear infinite; transform-origin: 39px 22px; } @keyframes spin { to { transform: rotate(360deg) } }`,
    };
  },
  maze: (T) => {
    const route = "M7 37 V7 H22 V37 H37 V7 H52 V37 H67 V7";
    return {
      body: `<path d="M0.5 0.5H77.5V43.5H0.5Z M15 0.5V30 M30 14V43.5 M45 0.5V30 M60 14V43.5" fill="none" stroke="${T.border}" stroke-width="1.2"/>
<circle r="3.2" fill="${T.danger}"><animateMotion dur="6s" repeatCount="indefinite" path="${route}"/></circle>`,
      css: "",
    };
  },
};

// ---------- repo-style cards, like GitHub's pinned repositories ----------
function card(T, { w = 420, h = 150, title, lines, lang, extra, status, statusTone, motif }) {
  const m = motifs[motif](T);
  const body = `${box(w, h, T)}
<g transform="translate(16 20)"><path d="${REPO_ICON}" fill="${T.muted}"/></g>
<text x="40" y="33" font-size="15" font-weight="600" fill="${T.accent}">${esc(title)}</text>
<g transform="translate(${w - 16 - 78} 16)">${m.body}</g>
${lines.map((l, i) => `<text x="16" y="${78 + i * 20}" font-size="13" fill="${T.muted}">${esc(l)}</text>`).join("\n")}
<circle cx="22" cy="${h - 24}" r="6" fill="${LANG[lang]}"/>
<text x="34" y="${h - 20}" font-size="12" fill="${T.muted}">${esc([lang, ...extra].join("  ·  "))}</text>
${label(status, T[statusTone], w - 16, h - 34, "end")}`;
  return svg(w, h, `${title}: ${lines.join(" ")}`, body, m.css);
}

// ---------- Checago: incident → rebuild ----------
function now(T) {
  const W = 1000, H = 220;
  const steps = [
    ["Week 1", "Ransomware wipes", "the database", T.danger],
    ["Rebuild", "47-table MySQL", "schema restored", T.attention],
    ["Cloud", "Moved to AWS", "RDS + EC2", T.accent],
    ["Ship", "GitHub → AWS", "CI/CD pipeline", T.done],
    ["Migrate", "Android, site + 158", "PHP endpoints", T.success],
  ];
  const x0 = 100, x1 = 900, y = 112;
  const gap = (x1 - x0) / (steps.length - 1);
  const nodes = steps
    .map(([k, a, b, col], i) => {
      const x = x0 + i * gap;
      return `<g class="node" style="animation-delay:${r1(i * 1.1)}s">
  <circle cx="${x}" cy="${y}" r="9" fill="${T.canvas}" stroke="${col}" stroke-width="1.5"/>
  <circle cx="${x}" cy="${y}" r="3.5" fill="${col}"/>
  <text x="${x}" y="${y - 20}" text-anchor="middle" font-size="12" fill="${T.muted}">${esc(k)}</text>
  <text x="${x}" y="${y + 32}" text-anchor="middle" font-size="13.5" font-weight="600" fill="${T.fg}">${esc(a)}</text>
  <text x="${x}" y="${y + 50}" text-anchor="middle" font-size="12.5" fill="${T.muted}">${esc(b)}</text>
</g>`;
    })
    .join("\n");
  const css = `.prog { stroke-dasharray: 800; animation: prog 8s ease-in-out infinite; }
@keyframes prog { 0% { stroke-dashoffset: 800 } 60%,100% { stroke-dashoffset: 0 } }
.node { opacity: .4; animation: lit 8s ease-out infinite; }
@keyframes lit { 0% { opacity: .4 } 8%,90% { opacity: 1 } 100% { opacity: .4 } }`;
  const body = `${box(W, H, T)}
<text x="20" y="34" font-size="15" font-weight="600" fill="${T.fg}">Full-Stack Software Developer Intern <tspan font-weight="400" fill="${T.muted}">at Checago Coffee</tspan></text>
${label("May 2026 – present", T.success, W - 20, 19, "end")}
<line x1="20" y1="52" x2="${W - 20}" y2="52" stroke="${T.line}"/>
<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${T.border}" stroke-width="2"/>
<line class="prog" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${T.success}" stroke-width="2"/>
${nodes}
<text x="${W / 2}" y="${H - 16}" text-anchor="middle" class="mono" font-size="12" fill="${T.muted}">47 tables · 158 PHP endpoints · 11 admin pages · Google Sign-In · OSRM routing</text>`;
  return svg(W, H, "Checago Coffee: ransomware wiped the database in week one; rebuilt the MySQL schema, moved to AWS RDS and EC2, set up CI/CD and migrated the Android app, website and 158 PHP endpoints.", body, css);
}

// ---------- ICSC 2026 ----------
function icsc(T) {
  const W = 1000, H = 150;
  const css = `.ring { stroke-dasharray: 40 162; animation: ring 6s linear infinite; transform-origin: 56px 75px; }
@keyframes ring { to { transform: rotate(360deg) } }`;
  const cols = [
    ["1st Prize", "Senior category"],
    ["1st National Award", "United States"],
    ["Gold Honour", "Top 1% of all participants"],
    ["35 points", "Final round"],
  ];
  const title = "International Computer Science Competition 2026";
  const body = `${box(W, H, T)}
<circle cx="56" cy="75" r="32" fill="${T.subtle}" stroke="${T.border}"/>
<circle class="ring" cx="56" cy="75" r="32" fill="none" stroke="${T.attention}" stroke-width="1.5" stroke-linecap="round"/>
<g transform="translate(40 59)" fill="none" stroke="${T.attention}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 3h16v8a8 8 0 0 1-16 0z"/>
  <path d="M8 6H4.5a3.5 3.5 0 0 0 4.6 7.2M24 6h3.5a3.5 3.5 0 0 1-4.6 7.2"/>
  <path d="M16 19v5M11 29h10M12.5 24.5h7"/>
</g>
<text x="112" y="40" font-size="15" font-weight="600" fill="${T.fg}">${esc(title)}</text>
${label("Awarded · Sep 2026", T.attention, W - 20, 19, "end")}
${cols
  .map(([a, b], i) => {
    const x = 112 + i * 220;
    return `${i ? `<line x1="${x - 18}" y1="70" x2="${x - 18}" y2="122" stroke="${T.line}"/>` : ""}
<text x="${x}" y="92" font-size="20" font-weight="600" fill="${i < 3 ? T.fg : T.muted}">${esc(a)}</text>
<text x="${x}" y="114" font-size="12.5" fill="${T.muted}">${esc(b)}</text>`;
  })
  .join("\n")}`;
  return svg(W, H, "ICSC 2026: 1st Prize Senior category, 1st National Award United States, Gold Honour top 1%, 35 points in the final round.", body, css);
}

const CARDS = [
  { file: "sohamalloc", title: "sohamalloc", motif: "alloc", lang: "C", extra: ["LD_PRELOAD", "Linux"], status: "New", statusTone: "success",
    lines: ["A drop-in malloc / free written from scratch in C11.", "Gives freed memory back to the kernel right away."] },
  { file: "persistai", title: "PersistAI", motif: "match", lang: "TypeScript", extra: ["React Native", "Flask"], status: "Shipped", statusTone: "muted",
    lines: ["Matches your résumé to a job post, scores each", "entry and builds an ATS-ready PDF."] },
  { file: "checkers", title: "Checkers", motif: "board", lang: "Java", extra: ["JavaFX", "Sockets"], status: "Shipped", statusTone: "muted",
    lines: ["Networked two-player checkers with a live server", "dashboard. Three Maven modules, 67 tests."] },
  { file: "weather", title: "Weather-App", motif: "rain", lang: "Java", extra: ["JavaFX", "NWS API"], status: "Shipped", statusTone: "muted",
    lines: ["Live NWS forecasts with 16 animated conditions,", "alerts, favorites and a mascot. 70 tests."] },
  { file: "saya", title: "Saya", motif: "mood", lang: "Python", extra: ["FastAPI", "OpenAI API"], status: "Shipped", statusTone: "muted",
    lines: ["An emotion-aware chatbot that reads the mood", "of a conversation and answers to match it."] },
  { file: "portfolio", title: "portfolio", motif: "orbit", lang: "TypeScript", extra: ["React", "Three.js"], status: "Live", statusTone: "success",
    lines: ["My site as a world to explore, with a 3D guide", "who walks visitors through my work."] },
];
const LAB = [
  { file: "commandflow", title: "CommandFlow AI", motif: "plan", lang: "Python", extra: ["FastAPI"],
    lines: ["Tell it the work; it plans when to", "start and always keeps a buffer."] },
  { file: "helios", title: "Project Helios", motif: "sun", lang: "TypeScript", extra: ["Tauri"],
    lines: ["A local-first AI assistant you can", "talk to or wave at. Data stays home."] },
  { file: "maze", title: "Dual-Reality Maze", motif: "maze", lang: "C++", extra: ["Arduino"],
    lines: ["A two-player Arduino maze game", "with a story I wrote myself."] },
];

rmSync(join(root, "assets"), { recursive: true, force: true });
for (const [name, T] of Object.entries(THEMES)) {
  out(`hero-${name}.svg`, hero(T));
  out(`now-${name}.svg`, now(T));
  out(`icsc-${name}.svg`, icsc(T));
  for (const c of CARDS) out(`cards/${c.file}-${name}.svg`, card(T, c));
  for (const c of LAB) out(`cards/${c.file}-${name}.svg`, card(T, { ...c, w: 300, h: 150, status: "In progress", statusTone: "attention" }));
}
