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
const LANG_COLORS = {
  C: "#8b9eff", "C++": "#f34b7d", Java: "#f89820", TypeScript: "#3b82f6", JavaScript: "#f1e05a",
  Python: "#5eead4", Other: "#475569", HTML: "#e34c26", CSS: "#a78bfa", Go: "#00add8", "F#": "#b845fc", Julia: "#a270ba",
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

const SANS = "'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'Cascadia Code', Consolas, Menlo, monospace";
const frame = (w, h, label, body, css) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
<title>${label}</title>
<style>
text { font-family: ${SANS}; } .mono { font-family: ${MONO}; }
.in { opacity: 0; animation: in .7s ease-out forwards; }
@keyframes in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
${css}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; opacity: 1 !important; } }
</style>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1224"/><stop offset="1" stop-color="#05070d"/></linearGradient>
<linearGradient id="edge" x1="0" x2="1"><stop offset="0" stop-color="#fb7185" stop-opacity=".8"/><stop offset=".5" stop-color="#fb7185" stop-opacity=".12"/><stop offset="1" stop-color="#5eead4" stop-opacity=".7"/></linearGradient></defs>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="16" fill="url(#bg)" stroke="url(#edge)" stroke-width="1.5"/>
${body}
</svg>
`;

function statsSvg(c, r, updated) {
  const items = [
    ["Contributions · last year", c.total, "#5eead4"],
    ["Active days", c.active, "#38bdf8"],
    ["Languages used", r.langCount, "#fb7185"],
    ["Longest streak", `${c.longest}d`, "#fbbf24"],
    ["Public repos", r.repos, "#a78bfa"],
    ["Stars earned", r.stars, "#4ade80"],
  ];
  const body = `<text x="24" y="38" class="mono" font-size="12" letter-spacing="2.5" fill="#5eead4">// ACTIVITY</text>
<text x="471" y="38" text-anchor="end" class="mono" font-size="11" fill="#8d9bb3">updated ${updated}</text>
${items
  .map(([label, value, col], i) => {
    const x = 24 + (i % 3) * 152, y = 64 + Math.floor(i / 3) * 62;
    return `<g class="in" style="animation-delay:${(i * 0.12).toFixed(2)}s"><rect x="${x}" y="${y}" width="140" height="52" rx="10" fill="#0a0f1d" stroke="#1c2740"/>
<rect x="${x}" y="${y + 12}" width="3" height="28" rx="1.5" fill="${col}"/>
<text x="${x + 14}" y="${y + 26}" font-size="20" font-weight="700" fill="#e8eef7">${value}</text>
<text x="${x + 14}" y="${y + 43}" font-size="11" fill="#8d9bb3">${label}</text></g>`;
  })
  .join("\n")}`;
  return frame(495, 200, `GitHub activity: ${c.total} contributions in the last year, ${r.repos} public repos`, body, "");
}

function langSvg(langs) {
  let x = 24;
  const bar = langs
    .map((l, i) => {
      const w = (l.pct / 100) * 447;
      const seg = `<rect class="seg" x="${x.toFixed(1)}" y="62" width="${Math.max(w - 2, 1).toFixed(1)}" height="12" rx="3" fill="${LANG_COLORS[l.name] || "#8d9bb3"}" style="animation-delay:${(i * 0.12).toFixed(2)}s"/>`;
      x += w;
      return seg;
    })
    .join("");
  const rows = langs
    .map((l, i) => {
      const cx = 24 + (i % 2) * 232, cy = 106 + Math.floor(i / 2) * 28;
      return `<g class="in" style="animation-delay:${(0.4 + i * 0.1).toFixed(2)}s"><circle cx="${cx + 6}" cy="${cy - 4}" r="5" fill="${LANG_COLORS[l.name] || "#8d9bb3"}"/>
<text x="${cx + 18}" y="${cy}" font-size="14" fill="#e8eef7">${l.name}</text><text x="${cx + 200}" y="${cy}" text-anchor="end" class="mono" font-size="12" fill="#8d9bb3">${l.pct.toFixed(1)}%</text></g>`;
    })
    .join("\n");
  const body = `<text x="24" y="38" class="mono" font-size="12" letter-spacing="2.5" fill="#5eead4">// LANGUAGES</text>
<rect x="24" y="62" width="447" height="12" rx="3" fill="#1c2740"/>
${bar}
${rows}`;
  const css = `.seg { transform-box: fill-box; transform: scaleX(0); animation: grow .9s ease-out forwards; }
@keyframes grow { to { transform: scaleX(1) } }`;
  return frame(495, 200, `Top languages: ${langs.map((l) => l.name).join(", ")}`, body, css);
}

const [c, r] = await Promise.all([contributions(), repoStats()]);
const updated = new Date().toISOString().slice(0, 10);
mkdirSync(join(root, "generated"), { recursive: true });
writeFileSync(join(root, "generated/stats.svg"), statsSvg(c, r, updated));
writeFileSync(join(root, "generated/languages.svg"), langSvg(r.langs));
console.log({ ...c, repos: r.repos, stars: r.stars, langs: r.langs.map((l) => `${l.name} ${l.pct.toFixed(1)}%`) });
