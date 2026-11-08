// Builds generated/stats.svg and generated/languages.svg from public GitHub data.
// Run: node scripts/build-stats.mjs   (GITHUB_TOKEN is optional; it only raises the rate limit)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const USER = process.env.USERNAME_OVERRIDE || "SohamBasanwar";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const headers = { "User-Agent": `${USER}-profile`, Accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const get = async (url, as = "json") => {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return as === "json" ? res.json() : res.text();
};

// Byte counts reward one large file over many projects, so each repo adds the
// square root of its bytes. Notebooks and build glue are left out.
const SKIP = new Set(["Jupyter Notebook", "Batchfile", "CMake", "Makefile", "Shell", "Dockerfile"]);
// Linguist colors, the same dots GitHub shows on repositories.
const LANG_COLORS = {
  C: "#555555", "C++": "#f34b7d", Java: "#b07219", TypeScript: "#3178c6", JavaScript: "#f1e05a",
  Python: "#3572A5", HTML: "#e34c26", CSS: "#663399", Go: "#00ADD8", "F#": "#b845fc", Julia: "#a270ba",
};

async function contributions() {
  const html = await get(`https://github.com/users/${USER}/contributions`, "text");
  const total = Number((html.match(/([\d,]+)\s+contributions?\s+in the last year/) || [, "0"])[1].replace(/,/g, ""));
  const dates = {};
  for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"\s+id="([^"]+)"/g)) dates[m[2]] = m[1];
  const counts = {};
  for (const m of html.matchAll(/for="([^"]+)"[^>]*>(No|\d+) contributions?/g)) {
    if (dates[m[1]]) counts[dates[m[1]]] = m[2] === "No" ? 0 : Number(m[2]);
  }
  const days = Object.keys(counts).sort();
  let longest = 0, run = 0;
  for (const d of days) {
    run = counts[d] > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const active = days.filter((d) => counts[d] > 0).length;
  return { total, longest, active };
}

async function repoStats() {
  const repos = (await get(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner`)).filter(
    (r) => !r.fork && r.name !== USER,
  );
  const scores = {};
  for (const r of repos) {
    const langs = await get(r.languages_url);
    for (const [lang, bytes] of Object.entries(langs)) {
      if (!SKIP.has(lang)) scores[lang] = (scores[lang] || 0) + Math.sqrt(bytes);
    }
  }
  const sum = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const langs = ranked.slice(0, 5).map(([name, s]) => ({ name, pct: (s / sum) * 100 }));
  const rest = ranked.slice(5).reduce((a, [, s]) => a + s, 0);
  if (rest) langs.push({ name: "Other", pct: (rest / sum) * 100 });
  return {
    repos: repos.length,
    stars: repos.reduce((a, r) => a + r.stargazers_count, 0),
    langCount: Object.keys(scores).length,
    langs,
  };
}

// GitHub Primer color tokens, matching scripts/build-assets.mjs.
const THEMES = {
  dark: { canvas: "#0d1117", border: "#3d444d", line: "#262c36", fg: "#f0f6fc", muted: "#9198a1", other: "#656c76" },
  light: { canvas: "#ffffff", border: "#d1d9e0", line: "#eaeef2", fg: "#1f2328", muted: "#59636e", other: "#818b98" },
};
const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const frame = (T, w, h, label, body, css = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
<title>${label}</title>
<style>
text { font-family: ${SANS}; }
.in { opacity: 0; animation: in .6s ease-out forwards; }
@keyframes in { to { opacity: 1 } }
${css}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; opacity: 1 !important; transform: none !important; } }
</style>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="6" fill="${T.canvas}" stroke="${T.border}"/>
${body}
</svg>
`;

function statsSvg(T, c, r, updated) {
  const items = [
    [c.total, "Contributions"],
    [c.active, "Active days"],
    [r.langCount, "Languages used"],
    [`${c.longest} days`, "Longest streak"],
    [r.repos, "Public repos"],
    [r.stars, "Stars earned"],
  ];
  const body = `<text x="20" y="34" font-size="15" font-weight="600" fill="${T.fg}">Activity <tspan font-weight="400" fill="${T.muted}">in the past year</tspan></text>
<text x="475" y="34" text-anchor="end" font-size="12" fill="${T.muted}">updated ${updated}</text>
<line x1="20" y1="50" x2="475" y2="50" stroke="${T.line}"/>
${items
  .map(([value, label], i) => {
    const x = 20 + (i % 3) * 156, y = 84 + Math.floor(i / 3) * 56;
    return `<g class="in" style="animation-delay:${(i * 0.1).toFixed(2)}s"><text x="${x}" y="${y}" font-size="22" font-weight="600" fill="${T.fg}">${value}</text>
<text x="${x}" y="${y + 20}" font-size="12" fill="${T.muted}">${label}</text></g>`;
  })
  .join("\n")}`;
  return frame(T, 495, 200, `GitHub activity: ${c.total} contributions in the last year, ${r.repos} public repos`, body);
}

function langSvg(T, langs) {
  const color = (name) => LANG_COLORS[name] || T.other;
  let x = 20;
  const bar = langs
    .map((l, i) => {
      const w = (l.pct / 100) * 455;
      const seg = `<rect class="seg" x="${x.toFixed(1)}" y="66" width="${Math.max(w - 2, 1).toFixed(1)}" height="8" fill="${color(l.name)}" style="animation-delay:${(i * 0.1).toFixed(2)}s"/>`;
      x += w;
      return seg;
    })
    .join("");
  const rows = langs
    .map((l, i) => {
      const cx = 20 + (i % 2) * 240, cy = 108 + Math.floor(i / 2) * 28;
      return `<g class="in" style="animation-delay:${(0.3 + i * 0.08).toFixed(2)}s"><circle cx="${cx + 5}" cy="${cy - 4}" r="5" fill="${color(l.name)}"/>
<text x="${cx + 18}" y="${cy}" font-size="13" font-weight="600" fill="${T.fg}">${l.name}</text><text x="${cx + 215}" y="${cy}" text-anchor="end" font-size="12" fill="${T.muted}">${l.pct.toFixed(1)}%</text></g>`;
    })
    .join("\n");
  const body = `<text x="20" y="34" font-size="15" font-weight="600" fill="${T.fg}">Languages</text>
<line x1="20" y1="50" x2="475" y2="50" stroke="${T.line}"/>
<clipPath id="barclip"><rect x="20" y="66" width="455" height="8" rx="4"/></clipPath>
<g clip-path="url(#barclip)"><rect x="20" y="66" width="455" height="8" fill="${T.line}"/>${bar}</g>
${rows}`;
  const css = `.seg { transform-box: fill-box; transform: scaleX(0); animation: grow .8s ease-out forwards; }
@keyframes grow { to { transform: scaleX(1) } }`;
  return frame(T, 495, 200, `Top languages: ${langs.map((l) => l.name).join(", ")}`, body, css);
}

const [c, r] = await Promise.all([contributions(), repoStats()]);
const updated = new Date().toISOString().slice(0, 10);
mkdirSync(join(root, "generated"), { recursive: true });
for (const [name, T] of Object.entries(THEMES)) {
  writeFileSync(join(root, `generated/stats-${name}.svg`), statsSvg(T, c, r, updated));
  writeFileSync(join(root, `generated/languages-${name}.svg`), langSvg(T, r.langs));
}
console.log({ ...c, repos: r.repos, stars: r.stars, langs: r.langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`) });
