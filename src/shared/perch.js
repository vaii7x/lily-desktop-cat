// Perching geometry (Phase 7), in DIP screen coordinates. Pure, so it can be unit-tested.
// A surface is a flat line she can stand on: {id, x0, x1, y}. Window tops have the window's id, the taskbar
// edge (bottom of a work area) has id null.

// The parts of [x0, x1] not covered by any of the [a, b] spans.
function subtract(x0, x1, spans) {
  let parts = [[x0, x1]];
  for (const [a, b] of spans) {
    parts = parts.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, Math.min(a, q)], [Math.max(b, p), q]].filter(([u, v]) => v > u)));
  }
  return parts;
}

// Visible window tops she fits on. wins are {id, rect} in z-order, topmost first. A top edge counts where no
// window above it covers it, at least minWidth wide, with headroom for her above it inside a work area.
function surfaces(wins, areas, headroom, minWidth) {
  const out = [];
  wins.forEach(({ id, rect }, i) => {
    const y = rect.y;
    const area = areas.find((a) => rect.x < a.x + a.width && rect.x + rect.width > a.x && y - headroom >= a.y && y <= a.y + a.height);
    if (!area) return;
    const over = wins.slice(0, i).map((w) => w.rect).filter((r) => r.y <= y && r.y + r.height > y).map((r) => [r.x, r.x + r.width]);
    const x0 = Math.max(rect.x, area.x);
    const x1 = Math.min(rect.x + rect.width, area.x + area.width);
    for (const [a, b] of subtract(x0, x1, over)) if (b - a >= minWidth) out.push({ id, x0: a, x1: b, y });
  });
  return out;
}

// The surface under her feet at (x, y): the highest one at or below y (tol px of slack, so standing on one
// counts) whose span holds x. Falls back to the taskbar edge of the work area under x, else the nearest one.
function groundAt(x, y, surfs, areas, tol = 2) {
  const floor = (a) => ({ id: null, x0: a.x, x1: a.x + a.width, y: a.y + a.height });
  const all = [...surfs, ...areas.map(floor)];
  const hit = all.filter((s) => x >= s.x0 && x <= s.x1 && s.y >= y - tol).sort((a, b) => a.y - b.y)[0];
  if (hit) return hit;
  const dist = (a) => Math.max(a.x - x, 0, x - (a.x + a.width));
  return floor(areas.reduce((best, a) => (dist(a) < dist(best) ? a : best)));
}

// A window rect that covers a whole display (fullscreen video, games), within a couple of px. Returns the
// display's bounds, or null.
function coveredDisplay(rect, displays, tol = 2) {
  return displays.find((d) => rect.x <= d.x + tol && rect.y <= d.y + tol
    && rect.x + rect.width >= d.x + d.width - tol && rect.y + rect.height >= d.y + d.height - tol) || null;
}

module.exports = { subtract, surfaces, groundAt, coveredDisplay };
