// Renders the hand-made profile graphics into assets/.
// Run: node scripts/build-assets.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (file, svg) => {
  const path = join(root, "assets", file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, svg.replace(/\n\s*\n/g, "\n"));
  console.log(`assets/${file}  ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
};

const C = {
  bg0: "#05070d",
  bg1: "#0b1224",
  panel: "#0a0f1d",
  line: "#1c2740",
  text: "#e8eef7",
  muted: "#8d9bb3",
  cyan: "#5eead4",
  sky: "#38bdf8",
  rose: "#fb7185",
  pink: "#f472b6",
  gold: "#fbbf24",
  green: "#4ade80",
  violet: "#a78bfa",
};
const SANS = "'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'Cascadia Code', Consolas, Menlo, monospace";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r1 = (n) => Math.round(n * 10) / 10;

// Deterministic pseudo-random numbers so rebuilding gives identical files.
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

const panel = (w, h, id, accent) => `<defs>
  <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg0}"/>
  </linearGradient>
  <linearGradient id="${id}-edge" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${accent}" stop-opacity="0.9"/>
    <stop offset="0.5" stop-color="${accent}" stop-opacity="0.15"/>
    <stop offset="1" stop-color="${accent}" stop-opacity="0.7"/>
  </linearGradient>
</defs>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="16" fill="url(#${id}-bg)"/>
<rect class="edge" x="1" y="1" width="${w - 2}" height="${h - 2}" rx="16" fill="none" stroke="url(#${id}-edge)" stroke-width="1.5"/>`;

const edgeCss = `.edge { animation: edge 5s ease-in-out infinite; }
@keyframes edge { 0%,100% { opacity: .55 } 50% { opacity: 1 } }`;

// ---------- 3D wireframe heart ----------
// The classic heart curve as the outline, puffed into a pillow along z.
// Every latitude and meridian is one path whose `d` steps through precomputed
// rotation frames, so the SVG shows real 3D motion with no WebGL.
const heartXY = (t) => [
  16 * Math.sin(t) ** 3,
  -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 2.5,
];
const DEPTH = 8;
const puff = (z) => Math.sqrt(Math.max(0, 1 - z * z));

function heartCurves() {
  const curves = [];
  const N = 40;
  for (const z of [-0.8, -0.55, -0.28, 0, 0.28, 0.55, 0.8]) {
    const s = puff(z);
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const [x, y] = heartXY((i / N) * Math.PI * 2);
      pts.push([x * s, y * s, z * DEPTH]);
    }
    curves.push({ pts, kind: "lat" });
  }
  const M = 14;
  for (let k = 0; k < M; k++) {
    const [x, y] = heartXY((k / M) * Math.PI * 2 + 0.11);
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

function heartFrames({ cx, cy, scale, frames = 30 }) {
  const tilt = -0.32;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const curves = heartCurves();
  return curves.map(({ pts, kind }) => {
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
      const depth = zsum / pts.length / DEPTH; // -1 back .. 1 front
      ops.push(r1(0.28 + 0.36 * (depth + 1)));
    }
    return { ds, ops, kind };
  });
}

function heart3d({ cx, cy, scale, dur = 10 }) {
  const curves = heartFrames({ cx, cy, scale });
  const paths = curves
    .map(
      ({ ds, ops, kind }) => `<path d="${ds[0]}" stroke="${kind === "lat" ? "url(#hg)" : C.pink}" stroke-width="${kind === "lat" ? 1.6 : 1}" fill="none" stroke-linejoin="round">
<animate attributeName="d" dur="${dur}s" repeatCount="indefinite" values="${ds.join(";")}"/>
<animate attributeName="stroke-opacity" dur="${dur}s" repeatCount="indefinite" values="${ops.join(";")}"/>
</path>`,
    )
    .join("\n");
  return `<defs>
  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.pink}"/><stop offset="1" stop-color="${C.rose}"/>
  </linearGradient>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="3.2" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<g class="beat" style="transform-origin: ${cx}px ${cy}px" filter="url(#glow)">
${paths}
</g>`;
}

// ---------- hero ----------
function hero() {
  const W = 1200, H = 360;
  seed = 7;
  const particles = Array.from({ length: 46 }, () => {
    const x = r1(rand() * W), y = r1(rand() * H);
    const r = r1(0.6 + rand() * 1.6);
    const d = r1(7 + rand() * 9), delay = r1(-rand() * 12);
    const col = rand() > 0.75 ? C.rose : rand() > 0.5 ? C.sky : C.cyan;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" class="pt" style="animation-duration:${d}s;animation-delay:${delay}s"/>`;
  }).join("\n");

  // ECG trace: flat line with a heartbeat every 240px.
  let ecg = `M0 316`;
  for (let x = 0; x < W; x += 240) {
    ecg += ` L${x + 120} 316 L${x + 132} 308 L${x + 142} 316 L${x + 150} 316 L${x + 158} 282 L${x + 168} 336 L${x + 176} 316 L${x + 196} 316 L${x + 208} 304 L${x + 222} 316`;
  }
  ecg += ` L${W} 316`;

  const lines = [
    "I build AI tools people actually use.",
    "I rebuilt a database after ransomware hit.",
    "I write memory allocators for fun.",
  ];
  const cw = 13.25; // monospace advance at 22px
  const typed = lines
    .map((line, i) => {
      const w = r1(line.length * cw + 4);
      return `<g class="ty ty${i}">
  <clipPath id="tc${i}"><rect class="tr tr${i}" x="64" y="226" width="${w}" height="34" style="--w:${w}px"/></clipPath>
  <text x="66" y="250" class="mono" font-size="22" fill="${C.text}" clip-path="url(#tc${i})">${esc(line)}</text>
</g>`;
    })
    .join("\n");

  const css = `
.pt { animation: drift 10s ease-in-out infinite alternate; opacity: .55; transform-box: fill-box; }
@keyframes drift { 0% { transform: translate(0,0); opacity: .15 } 50% { opacity: .75 } 100% { transform: translate(14px,-22px); opacity: .2 } }
.beat { animation: beat 1.2s ease-in-out infinite; }
@keyframes beat { 0%,40%,100% { transform: scale(1) } 12% { transform: scale(1.045) } 24% { transform: scale(.99) } 30% { transform: scale(1.03) } }
.sweep { stroke-dasharray: 180 1400; animation: sweep 4.8s linear infinite; }
@keyframes sweep { from { stroke-dashoffset: 180 } to { stroke-dashoffset: -1400 } }
.ty { opacity: 0; animation: show 12s infinite; }
.ty1 { animation-delay: 4s } .ty2 { animation-delay: 8s }
@keyframes show { 0%,33% { opacity: 1 } 33.01%,100% { opacity: 0 } }
.tr { width: 0; animation: type 12s steps(38) infinite; }
.tr1 { animation-delay: 4s } .tr2 { animation-delay: 8s }
@keyframes type { 0% { width: 0 } 14% { width: var(--w) } 100% { width: var(--w) } }
.cur { animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0 } }
.dot { animation: ping 2s ease-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes ping { 0% { transform: scale(1); opacity: .9 } 100% { transform: scale(3); opacity: 0 } }
.orbit { animation: spin 14s linear infinite; transform-origin: 960px 300px; }
@keyframes spin { to { transform: rotate(360deg) } }
.fade { animation: rise 1.2s ease-out both; }
@keyframes rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
${edgeCss}`;

  const body = `${panel(W, H, "hero", C.rose)}
<defs>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M40 0H0V40" fill="none" stroke="${C.line}" stroke-width="0.6"/>
  </pattern>
  <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${C.rose}" stop-opacity="0.28"/><stop offset="1" stop-color="${C.rose}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="name" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.sky}"/>
  </linearGradient>
  <clipPath id="inside"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16"/></clipPath>
</defs>
<g clip-path="url(#inside)">
  <rect width="${W}" height="${H}" fill="url(#grid)" opacity="0.45"/>
  ${particles}
  <circle cx="960" cy="170" r="190" fill="url(#halo)"/>
  <path d="${ecg}" fill="none" stroke="${C.rose}" stroke-opacity="0.18" stroke-width="1.5"/>
  <path class="sweep" pathLength="1580" d="${ecg}" fill="none" stroke="${C.rose}" stroke-width="2.2" stroke-linecap="round" filter="url(#glow)"/>
</g>
<g class="fade">
  <text x="64" y="92" class="mono" font-size="15" letter-spacing="3" fill="${C.cyan}">// UIC COMPUTER SCIENCE · CHICAGO</text>
  <text x="62" y="160" font-size="66" font-weight="800" fill="url(#name)" letter-spacing="-1">Soham Basanwar</text>
  <text x="64" y="197" font-size="20" fill="${C.muted}">AI · full-stack · systems — and a soft spot for the human heart.</text>
</g>
<text x="64" y="250" class="mono" font-size="22" fill="${C.rose}">›</text>
<g transform="translate(18 0)">
${typed}
</g>
<g transform="translate(64 274)">
  <circle cx="7" cy="7" r="5" fill="${C.green}"/>
  <circle class="dot" cx="7" cy="7" r="5" fill="${C.green}"/>
  <text x="22" y="12" class="mono" font-size="14" fill="${C.text}">Open to Summer 2027 internships — AI / ML · full-stack · back end</text>
</g>
<ellipse cx="960" cy="300" rx="130" ry="16" fill="none" stroke="${C.rose}" stroke-opacity="0.25"/>
<g class="orbit"><circle cx="1090" cy="300" r="3" fill="${C.pink}"/><circle cx="830" cy="300" r="2" fill="${C.cyan}"/></g>
${heart3d({ cx: 960, cy: 168, scale: 6.3 })}
<text x="1110" y="70" class="mono" font-size="12" fill="${C.muted}" text-anchor="end">wireframe · 3D</text>
<text x="1110" y="88" class="mono" font-size="12" fill="${C.rose}" text-anchor="end">♥ 72 bpm</text>`;
  return svg(W, H, "Soham Basanwar — AI, full-stack and systems. Open to Summer 2027 internships.", body, css);
}

// ---------- project cards ----------
const chipW = (t) => Math.round(t.length * 7.1 + 18);
const chips = (list, x, y, accent) => {
  let cx = x;
  return list
    .map((t) => {
      const w = chipW(t);
      const g = `<g transform="translate(${cx} ${y})"><rect width="${w}" height="24" rx="12" fill="${accent}" fill-opacity="0.1" stroke="${accent}" stroke-opacity="0.4"/><text x="${w / 2}" y="16.5" text-anchor="middle" class="mono" font-size="12" fill="${C.text}">${esc(t)}</text></g>`;
      cx += w + 8;
      return g;
    })
    .join("");
};
const pill = (label, color, x, y) => {
  const w = Math.round(label.length * 7.6 + 30);
  return `<g transform="translate(${x} ${y})"><rect width="${w}" height="22" rx="11" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-opacity="0.5"/><circle class="blip" cx="12" cy="11" r="3.5" fill="${color}"/><text x="22" y="15.5" class="mono" font-size="11" letter-spacing="1.5" fill="${color}">${esc(label)}</text></g>`;
};

const motifs = {
  alloc: (a) => {
    let s = "";
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 6; c++) {
        const d = ((r * 6 + c) * 0.37) % 3.2;
        s += `<rect x="${c * 18}" y="${r * 20}" width="14" height="14" rx="3" fill="${a}" class="blk" style="animation-delay:-${r1(d)}s"/>`;
      }
    return {
      body: s + ``,
      css: `.blk { animation: blk 3.2s ease-in-out infinite; } @keyframes blk { 0%,100% { fill-opacity: .12 } 40%,60% { fill-opacity: .85 } }`,
    };
  },
  match: (a) => ({
    body: [0.92, 0.7, 0.45]
      .map(
        (v, i) =>
          `<rect x="0" y="${i * 20}" width="104" height="10" rx="5" fill="${C.line}"/><rect class="bar" x="0" y="${i * 20}" width="${r1(104 * v)}" height="10" rx="5" fill="${a}" style="animation-delay:${i * 0.25}s"/>`,
      )
      .join("") + ``,
    css: `.bar { transform-box: fill-box; animation: grow 4s ease-out infinite; } @keyframes grow { 0% { transform: scaleX(0) } 45%,100% { transform: scaleX(1) } }`,
  }),
  board: (a) => {
    let s = "";
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 6; c++)
        if ((r + c) % 2) s += `<rect x="${c * 17}" y="${r * 15}" width="17" height="15" fill="${C.line}"/>`;
    s += `<circle cx="42.5" cy="52.5" r="6" fill="${C.rose}" class="hop"/><circle cx="76.5" cy="7.5" r="6" fill="${a}"/><circle cx="93.5" cy="22.5" r="6" fill="${a}"/>`;
    return {
      body: s + ``,
      css: `.hop { animation: hop 3s ease-in-out infinite; } @keyframes hop { 0%,20% { transform: translate(0,0) } 45%,65% { transform: translate(17px,-15px) } 90%,100% { transform: translate(34px,-30px); opacity: 0 } }`,
    };
  },
  rain: (a) => {
    const drops = [8, 26, 44, 62, 80, 98]
      .map((x, i) => `<line x1="${x}" y1="34" x2="${x - 3}" y2="42" stroke="${a}" stroke-width="2" stroke-linecap="round" class="drop" style="animation-delay:-${r1(i * 0.27)}s"/>`)
      .join("");
    return {
      body: `<path d="M18 30 a12 12 0 0 1 10-18 a16 16 0 0 1 30-4 a13 13 0 0 1 24 6 a10 10 0 0 1 2 16 z" fill="${C.line}" stroke="${a}" stroke-opacity="0.6"/>${drops}`,
      css: `.drop { animation: fall 1.6s linear infinite; } @keyframes fall { from { transform: translateY(0); opacity: 1 } to { transform: translateY(22px); opacity: 0 } }`,
    };
  },
  mood: (a) => ({
    body: `<rect x="0" y="0" width="104" height="40" rx="12" fill="${C.line}"/><path d="M18 40 l-6 10 l14 -10z" fill="${C.line}"/>
<rect x="12" y="12" width="52" height="6" rx="3" fill="${C.muted}" fill-opacity="0.5"/><rect x="12" y="24" width="34" height="6" rx="3" fill="${C.muted}" fill-opacity="0.35"/>
<circle cx="86" cy="20" r="8" class="emo" fill="${a}"/>`,
    css: `.emo { animation: emo 6s infinite; transform-box: fill-box; transform-origin: center; } @keyframes emo { 0%,100% { fill: ${C.rose}; transform: scale(1) } 25% { fill: ${C.gold}; transform: scale(1.25) } 50% { fill: ${C.sky}; transform: scale(1) } 75% { fill: ${C.violet}; transform: scale(1.2) } }`,
  }),
  orbit: (a) => ({
    body: `<circle cx="52" cy="30" r="9" fill="${a}" fill-opacity="0.85"/><ellipse cx="52" cy="30" rx="44" ry="16" fill="none" stroke="${a}" stroke-opacity="0.3"/><ellipse cx="52" cy="30" rx="28" ry="28" fill="none" stroke="${C.sky}" stroke-opacity="0.2"/>
<g class="spin"><circle cx="96" cy="30" r="3.5" fill="${C.rose}"/><circle cx="8" cy="30" r="2.5" fill="${C.cyan}"/></g>
`,
    css: `.spin { animation: spin 5s linear infinite; transform-origin: 52px 30px; } @keyframes spin { to { transform: rotate(360deg) } }`,
  }),
  plan: (a) => ({
    body: `<rect x="0" y="6" width="104" height="2" fill="${C.line}"/>
<rect x="0" y="16" width="34" height="14" rx="4" fill="${a}" fill-opacity="0.8"/><rect x="40" y="16" width="26" height="14" rx="4" fill="${C.sky}" fill-opacity="0.7"/>
<rect class="buf" x="72" y="16" width="32" height="14" rx="4" fill="none" stroke="${C.gold}" stroke-dasharray="3 3"/><text x="88" y="45" text-anchor="middle" class="mono" font-size="9" fill="${C.gold}">buffer</text>
<rect class="now" x="0" y="2" width="2" height="34" fill="${C.rose}"/>`,
    css: `.now { animation: now 5s linear infinite; } @keyframes now { from { transform: translateX(0) } to { transform: translateX(102px) } }
.buf { animation: buf 1.6s ease-in-out infinite; } @keyframes buf { 50% { stroke-opacity: .3 } }`,
  }),
  sun: (a) => {
    const dots = Array.from({ length: 12 }, (_, i) => {
      const t = (i / 12) * Math.PI * 2;
      return `<circle cx="${r1(52 + Math.cos(t) * 26)}" cy="${r1(30 + Math.sin(t) * 26)}" r="${i % 3 ? 1.8 : 3}" fill="${i % 2 ? a : C.gold}"/>`;
    }).join("");
    return {
      body: `<circle cx="52" cy="30" r="12" fill="${C.gold}" fill-opacity="0.85" class="core"/><g class="spin">${dots}</g>`,
      css: `.spin { animation: spin 9s linear infinite; transform-origin: 52px 30px; } @keyframes spin { to { transform: rotate(360deg) } }
.core { animation: glowc 2.4s ease-in-out infinite; } @keyframes glowc { 50% { fill-opacity: .45 } }`,
    };
  },
  maze: (a) => {
    const walls = "M0 0H104V60H0Z M20 0V40 M40 20V60 M60 0V40 M80 20V60";
    const route = "M10 50 V10 H30 V50 H50 V10 H70 V50 H90 V10";
    return {
      body: `<path d="${walls}" fill="none" stroke="${C.line}" stroke-width="2"/><path d="${route}" fill="none" stroke="${a}" stroke-opacity="0.25" stroke-dasharray="2 4"/>
<circle r="4.5" fill="${C.rose}"><animateMotion dur="6s" repeatCount="indefinite" path="${route}"/></circle>
`,
      css: "",
    };
  },
};

function card({ file, w = 420, h = 220, title, lines, tags, status, statusColor, motif, accent, compact = false }) {
  const m = motifs[motif](accent);
  const pad = compact ? 20 : 24;
  const mx = w - 104 - pad - 4;
  const titleY = compact ? 100 : 82;
  const body = `${panel(w, h, "c", accent)}
${pill(status, statusColor, pad, pad)}
<g transform="translate(${mx} ${pad + 2})">${m.body}</g>
<text x="${pad}" y="${titleY}" font-size="${compact ? 21 : 25}" font-weight="700" fill="${C.text}">${esc(title)}</text>
${lines.map((l, i) => `<text x="${pad}" y="${titleY + 30 + i * 21}" font-size="${compact ? 13.5 : 14.5}" fill="${C.muted}">${esc(l)}</text>`).join("\n")}
${chips(tags, pad, h - pad - 24, accent)}`;
  out(
    `cards/${file}.svg`,
    svg(w, h, `${title} — ${lines.join(" ")}`, body, `${edgeCss}
.blip { animation: blipk 2s ease-in-out infinite; } @keyframes blipk { 50% { opacity: .25 } }
${m.css}`),
  );
}

// ---------- Checago: incident → rebuild ----------
function now() {
  const W = 1000, H = 270;
  const steps = [
    ["Week 1", "Ransomware wipes", "the database", C.rose],
    ["Rebuild", "47-table MySQL", "schema restored", C.gold],
    ["Cloud", "Moved to AWS", "RDS + EC2", C.sky],
    ["Ship", "GitHub → AWS", "CI/CD pipeline", C.violet],
    ["Migrate", "Android, site + 158", "PHP endpoints", C.green],
  ];
  const x0 = 90, x1 = 910, y = 150;
  const gap = (x1 - x0) / (steps.length - 1);
  const nodes = steps
    .map(([k, a, b, col], i) => {
      const x = x0 + i * gap;
      return `<g class="node" style="animation-delay:${r1(i * 1.1)}s">
  <circle cx="${x}" cy="${y}" r="16" fill="${C.panel}" stroke="${col}" stroke-width="2"/>
  <circle cx="${x}" cy="${y}" r="6" fill="${col}"/>
  <text x="${x}" y="${y - 30}" text-anchor="middle" class="mono" font-size="11" letter-spacing="2" fill="${col}">${esc(k.toUpperCase())}</text>
  <text x="${x}" y="${y + 42}" text-anchor="middle" font-size="14.5" font-weight="600" fill="${C.text}">${esc(a)}</text>
  <text x="${x}" y="${y + 61}" text-anchor="middle" font-size="13.5" fill="${C.muted}">${esc(b)}</text>
</g>`;
    })
    .join("\n");
  const css = `${edgeCss}
.prog { stroke-dasharray: 820; animation: prog 8s ease-in-out infinite; }
@keyframes prog { 0% { stroke-dashoffset: 820 } 60%,100% { stroke-dashoffset: 0 } }
.node { opacity: .35; animation: lit 8s ease-out infinite; }
@keyframes lit { 0% { opacity: .35 } 8%,90% { opacity: 1 } 100% { opacity: .35 } }
.blip { animation: blipk 2s ease-in-out infinite; } @keyframes blipk { 50% { opacity: .25 } }`;
  const body = `${panel(W, H, "now", C.green)}
<defs><linearGradient id="pg" x1="0" x2="1"><stop offset="0" stop-color="${C.rose}"/><stop offset="0.5" stop-color="${C.sky}"/><stop offset="1" stop-color="${C.green}"/></linearGradient></defs>
${pill("NOW · MAY 2026 – PRESENT", C.green, 28, 24)}
<text x="28" y="80" font-size="22" font-weight="700" fill="${C.text}">Full-Stack Software Developer Intern · Checago Coffee</text>
<text x="${W - 28}" y="40" text-anchor="end" class="mono" font-size="12" fill="${C.muted}">incident → rebuild</text>
<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.line}" stroke-width="4" stroke-linecap="round"/>
<line class="prog" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="url(#pg)" stroke-width="4" stroke-linecap="round"/>
${nodes}
<text x="${W / 2}" y="${H - 18}" text-anchor="middle" class="mono" font-size="12" fill="${C.muted}">47 tables · 158 PHP endpoints · 11 admin pages · Google Sign-In · OSRM routing</text>`;
  out("now.svg", svg(W, H, "Checago Coffee: ransomware wiped the database in week one; rebuilt the MySQL schema, moved to AWS RDS and EC2, set up CI/CD and migrated the Android app, website and 158 PHP endpoints.", body, css));
}

// ---------- ICSC 2026 ----------
function icsc() {
  const W = 1000, H = 200;
  const css = `${edgeCss}
.shine { animation: shine 3.6s ease-in-out infinite; }
@keyframes shine { 0% { transform: translateX(-90px) } 60%,100% { transform: translateX(90px) } }
.ray { animation: ray 12s linear infinite; transform-origin: 110px 100px; }
@keyframes ray { to { transform: rotate(360deg) } }
.blip { animation: blipk 2s ease-in-out infinite; } @keyframes blipk { 50% { opacity: .25 } }`;
  const rays = Array.from({ length: 16 }, (_, i) => {
    const t = (i / 16) * Math.PI * 2;
    return `<line x1="${r1(110 + Math.cos(t) * 52)}" y1="${r1(100 + Math.sin(t) * 52)}" x2="${r1(110 + Math.cos(t) * 66)}" y2="${r1(100 + Math.sin(t) * 66)}" stroke="${C.gold}" stroke-opacity="0.45" stroke-width="2" stroke-linecap="round"/>`;
  }).join("");
  const rows = [
    ["1st Prize", "Senior category"],
    ["1st National Award", "United States"],
    ["Gold Honour", "top 1% of all participants"],
  ];
  const body = `${panel(W, H, "icsc", C.gold)}
<defs>
  <radialGradient id="medal" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff3c4"/><stop offset="0.5" stop-color="${C.gold}"/><stop offset="1" stop-color="#b45309"/></radialGradient>
  <clipPath id="disc"><circle cx="110" cy="100" r="40"/></clipPath>
  <linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<g class="ray">${rays}</g>
<circle cx="110" cy="100" r="40" fill="url(#medal)"/>
<g clip-path="url(#disc)"><rect class="shine" x="80" y="50" width="34" height="110" fill="url(#sh)" transform="skewX(-20)"/></g>
<text x="110" y="113" text-anchor="middle" font-size="36" font-weight="800" fill="#7c2d12">1</text>
${pill("AWARDED · SEPTEMBER 2026", C.gold, 210, 28)}
<text x="210" y="88" font-size="23" font-weight="700" fill="${C.text}">International Computer Science Competition 2026</text>
${rows
  .map(
    ([a, b], i) =>
      `<g transform="translate(${210 + i * 255} 116)"><text font-size="17" font-weight="700" fill="${C.gold}">${esc(a)}</text><text y="24" font-size="14" fill="${C.muted}">${esc(b)}</text></g>`,
  )
  .join("\n")}
<text x="210" y="${H - 22}" class="mono" font-size="12" fill="${C.muted}">35 points in the final round</text>`;
  out("icsc.svg", svg(W, H, "ICSC 2026: 1st Prize Senior category, 1st National Award United States, Gold Honour top 1%.", body, css));
}

// ---------- divider ----------
function divider() {
  const W = 1000, H = 18;
  const css = `.scan { animation: scan 6s ease-in-out infinite; } @keyframes scan { 0% { transform: translateX(-160px) } 100% { transform: translateX(${W}px) } }`;
  const body = `<defs><linearGradient id="dl" x1="0" x2="1"><stop offset="0" stop-color="${C.rose}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.rose}"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient></defs>
<line x1="0" y1="9" x2="${W}" y2="9" stroke="${C.muted}" stroke-opacity="0.25"/>
<rect class="scan" x="0" y="8" width="160" height="2" rx="1" fill="url(#dl)"/>
<circle cx="${W / 2}" cy="9" r="3" fill="${C.rose}"/>`;
  out("divider.svg", svg(W, H, "", body, css));
}

out("hero.svg", hero());
now();
icsc();
divider();

const A = { cyan: C.cyan, sky: C.sky, rose: C.rose, gold: C.gold, violet: C.violet, green: C.green };
const SHIPPED = ["SHIPPED", C.cyan];
card({ file: "sohamalloc", title: "sohamalloc", motif: "alloc", accent: A.cyan, status: "NEW · 2026", statusColor: C.green,
  lines: ["A drop-in malloc / free written from scratch in C11.", "Gives freed memory back to the kernel right away."],
  tags: ["C11", "LD_PRELOAD", "Linux", "Allocators"] });
card({ file: "persistai", title: "PersistAI", motif: "match", accent: A.sky, status: SHIPPED[0], statusColor: SHIPPED[1],
  lines: ["Matches your résumé to a job post, scores each", "entry and builds an ATS-ready PDF."],
  tags: ["React Native", "Flask", "Firebase", "AI"] });
card({ file: "checkers", title: "Checkers Online", motif: "board", accent: A.violet, status: SHIPPED[0], statusColor: SHIPPED[1],
  lines: ["Networked two-player checkers with a live server", "dashboard. Three Maven modules, 67 tests."],
  tags: ["Java 17", "JavaFX", "Sockets", "Maven"] });
card({ file: "weather", title: "Simple Weather", motif: "rain", accent: A.sky, status: SHIPPED[0], statusColor: SHIPPED[1],
  lines: ["Live NWS forecasts with 16 animated conditions,", "alerts, favorites and Bear the mascot. 70 tests."],
  tags: ["Java", "JavaFX", "NWS API", "Maven"] });
card({ file: "saya", title: "Saya", motif: "mood", accent: A.rose, status: SHIPPED[0], statusColor: SHIPPED[1],
  lines: ["An emotion-aware chatbot that reads the mood", "of a conversation and answers to match it."],
  tags: ["Python", "FastAPI", "OpenAI API"] });
card({ file: "portfolio", title: "Portfolio", motif: "orbit", accent: A.cyan, status: "LIVE", statusColor: C.green,
  lines: ["My site as a world to explore, with a 3D guide", "who walks visitors through my work."],
  tags: ["React", "TypeScript", "Three.js"] });

const lab = { w: 300, h: 220, compact: true, status: "IN THE LAB", statusColor: C.gold };
card({ ...lab, file: "commandflow", title: "CommandFlow AI", motif: "plan", accent: A.violet,
  lines: ["Tell it the work; it plans when to", "start and always keeps a buffer."],
  tags: ["React", "FastAPI", "NLP"] });
card({ ...lab, file: "helios", title: "Project Helios", motif: "sun", accent: A.gold,
  lines: ["A local-first AI assistant you can", "talk to or wave at. Data stays home."],
  tags: ["Tauri", "Three.js", "llama.cpp"] });
card({ ...lab, file: "maze", title: "Dual-Reality Maze", motif: "maze", accent: A.rose,
  lines: ["A two-player Arduino maze game", "with a story I wrote myself."],
  tags: ["Arduino", "C++", "Canvas"] });
