// Real content of examples/official-demo.json, shared by every mockup.
window.MOCK = (() => {
  const DURATION = 12000;
  const PLAYHEAD = 7220;
  const elements = [
    { id: "axes", n: 1, kind: "Axes", label: "Axes", math: "x ∈ [−4, 4]", start: 0, end: 12000, color: "#FFFFFF", glyph: "axes" },
    { id: "graph", n: 2, kind: "Graph", label: "x²", math: "f(x) = x²", start: 1000, end: 7800, color: "#58C4DD", glyph: "graph", owned: true },
    { id: "equation", n: 3, kind: "Equation", label: "f(x)=x^2", math: "f(x) = x²", start: 3000, end: 12000, color: "#FFFFFF", glyph: "tex" },
    { id: "annotation", n: 4, kind: "Text", label: "Vertex at the origin", math: "“Vertex at the origin”", start: 5000, end: 9800, color: "#FFFF00", glyph: "text", owned: true },
    { id: "target", n: 5, kind: "Graph", label: "(x−2)²+1", math: "g(x) = (x−2)² + 1", start: 7800, end: 12000, color: "#FC6255", glyph: "graph", owned: true },
  ];
  const animations = [
    { n: 1, kind: "Create", target: "axes", start: 0, end: 1000 },
    { n: 2, kind: "Create", target: "graph", start: 1000, end: 2500 },
    { n: 3, kind: "Write", target: "equation", start: 3000, end: 4000 },
    { n: 4, kind: "FadeIn", target: "annotation", start: 5000, end: 5800 },
    { n: 5, kind: "Transform", target: "graph", start: 6000, end: 7800 },
    { n: 6, kind: "MoveTo", target: "annotation", start: 8000, end: 9000 },
    { n: 7, kind: "FadeOut", target: "annotation", start: 9000, end: 9800 },
  ];
  const catalog = [
    { group: "Text", items: ["Equation", "Text"] },
    { group: "Shapes", items: ["Circle", "Dot", "Ellipse", "Rectangle", "Square", "Triangle", "Polygon", "Arc", "Line", "Arrow"] },
    { group: "Coordinates", items: ["Axes", "Number plane", "Number line"] },
    { group: "Graphs", items: ["Graph", "Area under graph"] },
  ];
  const pct = (ms) => (ms / DURATION) * 100;
  const secs = (ms) => (ms / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " s";
  const timecode = (ms) => {
    const f = Math.floor(((ms % 1000) / 1000) * 15);
    const s = Math.floor(ms / 1000);
    const two = (v) => String(v).padStart(2, "0");
    return `00:00:${two(s)}:${two(f)}`;
  };

  // The frame Manim renders at the playhead: mid-Transform, annotation visible.
  function stage({ graticule = false, gratColor = "rgba(255,255,255,.14)" } = {}) {
    const W = 1600, H = 900, U = W / 14.22;
    const ox = W / 2, oy = H / 2 + 3 * 0.65 * U;
    const X = (x) => ox + x * U, Y = (y) => oy - y * 0.65 * U;
    const curve = (f, a, b) => {
      let d = "";
      for (let i = 0; i <= 60; i++) {
        const x = a + ((b - a) * i) / 60;
        d += (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(f(x)).toFixed(1);
      }
      return d;
    };
    const t = 0.68; // Transform progress at 7.22 s
    const mid = (x) => (1 - t) * x * x + t * ((x - 2) ** 2 + 1);
    let grat = "";
    if (graticule) {
      for (let i = 1; i < 10; i++) grat += `<line x1="${(W / 10) * i}" y1="0" x2="${(W / 10) * i}" y2="${H}" stroke="${gratColor}" stroke-width="1.5"/>`;
      for (let i = 1; i < 8; i++) grat += `<line x1="0" y1="${(H / 8) * i}" x2="${W}" y2="${(H / 8) * i}" stroke="${gratColor}" stroke-width="1.5"/>`;
    }
    let ticks = "";
    for (let x = -4; x <= 4; x++) if (x) ticks += `<line x1="${X(x)}" y1="${Y(0) - 7}" x2="${X(x)}" y2="${Y(0) + 7}" stroke="#fff" stroke-width="3"/>`;
    for (let y = -2; y <= 8; y++) if (y) ticks += `<line x1="${X(0) - 7}" y1="${Y(y)}" x2="${X(0) + 7}" y2="${Y(y)}" stroke="#fff" stroke-width="3"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Rendered frame at 7.22 s">
      <rect width="${W}" height="${H}" fill="#000"/>${grat}
      <line x1="${X(-4)}" y1="${Y(0)}" x2="${X(4)}" y2="${Y(0)}" stroke="#fff" stroke-width="3"/>
      <line x1="${X(0)}" y1="${Y(-2)}" x2="${X(0)}" y2="${Y(8)}" stroke="#fff" stroke-width="3"/>
      <path d="M${X(4)} ${Y(0)} l-16 -9 v18z M${X(0)} ${Y(8)} l-9 16 h18z" fill="#fff"/>${ticks}
      <path d="${curve(mid, -1.2, 3.6)}" fill="none" stroke="#9b8fa0" stroke-width="5" opacity=".35"/>
      <path d="${curve(mid, -1.2, 3.6)}" fill="none" stroke="${mixHex("#58C4DD", "#FC6255", t)}" stroke-width="5"/>
      <text x="150" y="150" fill="#fff" font-family="'Cambria Math','STIX Two Math',serif" font-size="64" font-style="italic">f<tspan font-style="normal">(</tspan>x<tspan font-style="normal">) = </tspan>x<tspan baseline-shift="super" font-size="40" font-style="normal">2</tspan></text>
      <text x="${X(0.2)}" y="${Y(-1.1)}" fill="#FFFF00" font-family="'CMU Serif','Cambria',serif" font-size="44">Vertex at the origin</text>
    </svg>`;
  }
  function mixHex(a, b, t) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
  }

  // Drawn icons, one stroke weight, for element kinds.
  const glyphs = {
    axes: '<path d="M4 20V4M4 20h16M4 4l-2 3M4 4l2 3M20 20l-3-2M20 20l-3 2"/>',
    graph: '<path d="M3 4c3 10 6 15 9 15s6-5 9-15"/><path d="M3 20h18" opacity=".45"/>',
    area: '<path d="M3 20h18"/><path d="M5 20c2-8 5-13 9-13s5 4 5 13" /><path d="M8 20v-6M11 20v-9M14 20V9M17 20v-7" opacity=".5"/>',
    tex: '<path d="M5 7h6M8 7v10M14 9l5 8M19 9l-5 8"/>',
    text: '<path d="M5 6h14M12 6v13M9 19h6"/>',
    circle: '<circle cx="12" cy="12" r="7.5"/>',
    dot: '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="9" ry="5.5"/>',
    rectangle: '<rect x="3" y="7" width="18" height="10" rx="1"/>',
    square: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
    triangle: '<path d="M12 4l8.5 15h-17z"/>',
    polygon: '<path d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z"/>',
    arc: '<path d="M4 17a8 8 0 0116 0"/>',
    line: '<path d="M4 19L20 5"/>',
    arrow: '<path d="M4 19L19 6M11 6h8v8"/>',
    plane: '<path d="M3 8h18M3 16h18M8 3v18M16 3v18" opacity=".55"/><path d="M3 12h18M12 3v18"/>',
    numberline: '<path d="M2 12h20M5 9v6M12 9v6M19 9v6"/>',
  };
  const kindGlyph = {
    Equation: "tex", Text: "text", Circle: "circle", Dot: "dot", Ellipse: "ellipse", Rectangle: "rectangle",
    Square: "square", Triangle: "triangle", Polygon: "polygon", Arc: "arc", Line: "line", Arrow: "arrow",
    Axes: "axes", "Number plane": "plane", "Number line": "numberline", Graph: "graph", "Area under graph": "area",
  };
  const icon = (name, size = 16) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[kindGlyph[name] ?? name] ?? glyphs.circle}</svg>`;

  function themeSwitch() {
    const params = new URLSearchParams(location.search);
    document.documentElement.dataset.theme = params.get("theme") ?? "dark";
    document.addEventListener("click", (e) => {
      if (!e.target.closest("[data-toggle-theme]")) return;
      const root = document.documentElement;
      root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    });
  }

  return { DURATION, PLAYHEAD, elements, animations, catalog, pct, secs, timecode, stage, icon, themeSwitch,
    byId: Object.fromEntries(elements.map((e) => [e.id, e])) };
})();
