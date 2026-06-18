







function roundRectSubpath(ctx, x, y, w, h, r, ccw) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + radius, y);
  if (ccw) {
    ctx.arcTo(x, y, x, y + h, radius);
    ctx.arcTo(x, y + h, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x + w, y, radius);
    ctx.arcTo(x + w, y, x, y, radius);
  } else {
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
  }
  ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  roundRectSubpath(ctx, x, y, w, h, r, false);
}








function fluidModuleSubpath(ctx, x, y, m, r, tl, tr, br, bl) {
  ctx.moveTo(x + (tl ? r : 0), y);
  ctx.lineTo(x + m - (tr ? r : 0), y);
  if (tr) ctx.arcTo(x + m, y, x + m, y + r, r);
  ctx.lineTo(x + m, y + m - (br ? r : 0));
  if (br) ctx.arcTo(x + m, y + m, x + m - r, y + m, r);
  ctx.lineTo(x + (bl ? r : 0), y + m);
  if (bl) ctx.arcTo(x, y + m, x, y + m - r, r);
  ctx.lineTo(x, y + (tl ? r : 0));
  if (tl) ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}


function inRoundRect(px, py, x, y, w, h, r) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const dx = Math.max(x + rr - px, 0, px - (x + w - rr));
  const dy = Math.max(y + rr - py, 0, py - (y + h - rr));
  return dx * dx + dy * dy <= rr * rr;
}



function isFinderModule(x, y, n) {
  if (x < 7 && y < 7) return true;
  if (x >= n - 7 && y < 7) return true;
  if (x < 7 && y >= n - 7) return true;
  return false;
}

function finderOrigins(n, off, modulePx) {
  return [
    { x: off, y: off },
    { x: off + (n - 7) * modulePx, y: off },
    { x: off, y: off + (n - 7) * modulePx },
  ];
}






function drawFinder(ctx, ox, oy, modulePx, fg, frac) {
  const m = modulePx;
  ctx.fillStyle = fg;


  ctx.beginPath();
  roundRectSubpath(ctx, ox, oy, 7 * m, 7 * m, frac * 3.5 * m, false);
  roundRectSubpath(ctx, ox + m, oy + m, 5 * m, 5 * m, frac * 2.5 * m, true);
  ctx.fill();


  roundRectPath(ctx, ox + 2 * m, oy + 2 * m, 3 * m, 3 * m, frac * 1.5 * m);
  ctx.fill();
}

function logoBox(sizePx, bodyPx, m, settings) {
  const dims = settings.logoRgba;
  const aspect = dims && dims.width && dims.height ? dims.width / dims.height : 1;
  const maxSide = bodyPx * (settings.logoScale || 0.2);
  let w = maxSide;
  let h = maxSide;
  if (aspect >= 1) {
    h = maxSide / aspect;
  } else {
    w = maxSide * aspect;
  }
  const cx = sizePx / 2;
  const cy = sizePx / 2;


  const padFrac =
    Math.max(0, Math.min(100, settings.logoMaskPadding == null ? 100 : settings.logoMaskPadding)) / 100;
  const pad = m * 0.9 * padFrac;
  return { x: cx - w / 2, y: cy - h / 2, w, h, pad };
}





function getLogoLayout(sizePx, bodyPx, m, settings) {
  const box = logoBox(sizePx, bodyPx, m, settings);
  const plateW = box.w + box.pad * 2;
  const plateH = box.h + box.pad * 2;
  const radiusFrac =
    Math.max(0, Math.min(50, settings.logoRadius == null ? 25 : settings.logoRadius)) / 100;
  const plate = {
    x: box.x - box.pad,
    y: box.y - box.pad,
    w: plateW,
    h: plateH,
    r: radiusFrac * Math.min(plateW, plateH),
  };
  return { plate };
}





function drawLogoPlate(ctx, settings, layout) {
  if (settings.transparent) return;
  const { plate } = layout;
  roundRectPath(ctx, plate.x, plate.y, plate.w, plate.h, plate.r);
  ctx.fillStyle = settings.bgColor || "#ffffff";
  ctx.fill();
}



function drawQr(ctx, qr, settings, modulePx) {
  const n = qr.modules.size;
  const data = qr.modules.data;
  const quiet = settings.quietZone || 0;
  const total = n + quiet * 2;
  const sizePx = total * modulePx;
  const bodyPx = n * modulePx;
  const off = quiet * modulePx;
  const style = settings.dotStyle || "square";
  const fg = settings.fgColor || "#000000";
  const ko = settings.bgColor || "#ffffff";
  const finderFrac = Math.max(0, Math.min(1, (settings.finderRadius || 0) / 100));



  const specialFinders = finderFrac > 0 || style === "smooth" || style === "rounded";
  const hasLogo = Boolean(settings.logoRgba);
  const layout = hasLogo ? getLogoLayout(sizePx, bodyPx, modulePx, settings) : null;

  ctx.clearRect(0, 0, sizePx, sizePx);




  const bgFrac = Math.max(0, Math.min(50, settings.bgRadius || 0)) / 100;
  const bgR = bgFrac * (sizePx / 2);

  if (!settings.transparent) {
    ctx.fillStyle = ko;
    if (bgR > 0) {
      roundRectPath(ctx, 0, 0, sizePx, sizePx, bgR);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, sizePx, sizePx);
    }
  }









  ctx.beginPath();
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (!data[y * n + x]) continue;
      if (specialFinders && isFinderModule(x, y, n)) continue;
      const px = off + x * modulePx;
      const py = off + y * modulePx;
      if (layout && inRoundRect(px + modulePx / 2, py + modulePx / 2,
        layout.plate.x, layout.plate.y, layout.plate.w, layout.plate.h, layout.plate.r)) {
        continue;
      }
      if (style === "smooth") {
        const r = modulePx / 2;
        const t = y > 0 && data[(y - 1) * n + x];
        const b = y < n - 1 && data[(y + 1) * n + x];
        const l = x > 0 && data[y * n + (x - 1)];
        const rt = x < n - 1 && data[y * n + (x + 1)];
        fluidModuleSubpath(ctx, px, py, modulePx, r, !t && !l, !t && !rt, !b && !rt, !b && !l);
      } else if (style === "rounded") {
        roundRectSubpath(ctx, px, py, modulePx, modulePx, modulePx * 0.35, false);
      } else {
        ctx.rect(px, py, modulePx, modulePx);
      }
    }
  }
  ctx.fillStyle = fg;
  ctx.fill();

  if (specialFinders) {
    for (const o of finderOrigins(n, off, modulePx)) {
      drawFinder(ctx, o.x, o.y, modulePx, fg, finderFrac);
    }
  }

  if (layout) {
    drawLogoPlate(ctx, settings, layout);
  }
}

module.exports = { drawQr };
