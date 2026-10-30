// Window placement math in DIP screen coordinates. Rects are {x, y, width, height}.

function distanceToRect(px, py, r) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.width));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.height));
  return Math.hypot(dx, dy);
}

// Keeps the cat rect (offset inside the window) fully inside the work area nearest its centre,
// so she is never off-screen or under the taskbar; she changes monitor when her centre does.
// Returns integer {x, y} for the window.
function clampPosition(pos, cat, areas) {
  const r = positionRange(cat, nearestArea(pos, cat, areas));
  return { x: Math.round(Math.min(Math.max(pos.x, r.x0), r.x1)), y: Math.round(Math.min(Math.max(pos.y, r.y0), r.y1)) };
}

function nearestArea(pos, cat, areas) {
  const cx = pos.x + cat.x + cat.width / 2;
  const cy = pos.y + cat.y + cat.height / 2;
  return areas.reduce((best, r) => (distanceToRect(cx, cy, r) < distanceToRect(cx, cy, best) ? r : best));
}

// Window positions that keep the cat rect fully inside area: {x0, x1, y0, y1}.
function positionRange(cat, a) {
  return { x0: a.x - cat.x, x1: a.x + a.width - cat.width - cat.x, y0: a.y - cat.y, y1: a.y + a.height - cat.height - cat.y };
}

// Default spot: bottom-right of the work area, cat fully visible.
function defaultPosition(size, area) {
  return { x: area.x + area.width - size.width - 40, y: area.y + area.height - size.height };
}

// Puts a popup beside the cat window: right side if it fits, else left; kept inside the area.
function besidePosition(anchor, popup, area) {
  const right = anchor.x + anchor.width;
  let x = right + popup.width <= area.x + area.width ? right : anchor.x - popup.width;
  x = Math.min(Math.max(x, area.x), area.x + area.width - popup.width);
  const y = Math.min(Math.max(anchor.y + anchor.height - popup.height, area.y), area.y + area.height - popup.height);
  return { x: Math.round(x), y: Math.round(y) };
}

// Tight box around the non-transparent pixels of role-grid frames, in sprite px.
function opaqueBounds(frames) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (const rows of frames) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '.') continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    });
  }
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

module.exports = { clampPosition, nearestArea, positionRange, defaultPosition, besidePosition, opaqueBounds };
