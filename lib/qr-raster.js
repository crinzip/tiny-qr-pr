



function hexToRgb(hex, fallback) {
  let v = String(hex || "").trim().toLowerCase().replace(/^#/, "");
  if (v.length === 3) {
    v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
  }
  if (!/^[0-9a-f]{6}$/.test(v)) return fallback;
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}


function roundedCovered(lx, ly, m, r) {
  const cx = lx + 0.5;
  const cy = ly + 0.5;
  const ax = cx < r ? r : cx > m - r ? m - r : cx;
  const ay = cy < r ? r : cy > m - r ? m - r : cy;
  const dx = cx - ax;
  const dy = cy - ay;
  return dx * dx + dy * dy <= r * r;
}





function fluidCarved(lx, ly, m, r, tl, tr, br, bl) {
  const cx = lx + 0.5;
  const cy = ly + 0.5;
  if (tl && cx < r && cy < r) { const dx = cx - r, dy = cy - r; if (dx * dx + dy * dy > r * r) return true; }
  if (tr && cx > m - r && cy < r) { const dx = cx - (m - r), dy = cy - r; if (dx * dx + dy * dy > r * r) return true; }
  if (br && cx > m - r && cy > m - r) { const dx = cx - (m - r), dy = cy - (m - r); if (dx * dx + dy * dy > r * r) return true; }
  if (bl && cx < r && cy > m - r) { const dx = cx - r, dy = cy - (m - r); if (dx * dx + dy * dy > r * r) return true; }
  return false;
}


function inRoundRect(px, py, x, y, w, h, r) {
  const cx = px + 0.5;
  const cy = py + 0.5;
  if (cx < x || cx > x + w || cy < y || cy > y + h) return false;
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const dx = Math.max(x + rr - cx, 0, cx - (x + w - rr));
  const dy = Math.max(y + rr - cy, 0, cy - (y + h - rr));
  return dx * dx + dy * dy <= rr * rr;
}


function isFinderModule(x, y, n) {
  if (x < 7 && y < 7) return true;
  if (x >= n - 7 && y < 7) return true;
  if (x < 7 && y >= n - 7) return true;
  return false;
}



function getLogoLayout(sizePx, bodyPx, m, settings) {
  const logo = settings.logoRgba;
  if (!logo || !logo.data || !logo.width || !logo.height) return null;

  const maxSide = bodyPx * (settings.logoScale || 0.2);
  const aspect = logo.width / logo.height;
  let w = maxSide;
  let h = maxSide;
  if (aspect >= 1) {
    h = maxSide / aspect;
  } else {
    w = maxSide * aspect;
  }
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));

  const cx = Math.round(sizePx / 2);
  const cy = Math.round(sizePx / 2);


  const padFrac =
    Math.max(0, Math.min(100, settings.logoMaskPadding == null ? 100 : settings.logoMaskPadding)) / 100;
  const pad = Math.round(m * 0.9 * padFrac);
  const halfW = Math.round(w / 2);
  const halfH = Math.round(h / 2);
  const plateX0 = cx - halfW - pad;
  const plateY0 = cy - halfH - pad;
  const plateW = 2 * halfW + 2 * pad;
  const plateH = 2 * halfH + 2 * pad;
  const radiusFrac =
    Math.max(0, Math.min(50, settings.logoRadius == null ? 25 : settings.logoRadius)) / 100;
  return {
    logo,
    w,
    h,
    x0: cx - halfW,
    y0: cy - halfH,
    plateX0,
    plateY0,
    plateW,
    plateH,
    plateR: radiusFrac * Math.min(plateW, plateH),
    logoR: radiusFrac * Math.min(w, h),
  };
}

function compositeLogo(out, sizePx, settings, bg, transparent, layout) {
  if (!layout) return;
  const { logo, w, h, x0, y0, plateX0, plateY0, plateW, plateH, plateR, logoR } = layout;




  if (!transparent) {
    for (let y = plateY0; y < plateY0 + plateH; y += 1) {
      if (y < 0 || y >= sizePx) continue;
      for (let x = plateX0; x < plateX0 + plateW; x += 1) {
        if (x < 0 || x >= sizePx) continue;
        if (!inRoundRect(x, y, plateX0, plateY0, plateW, plateH, plateR)) continue;
        const o = (y * sizePx + x) * 4;
        out[o] = bg[0];
        out[o + 1] = bg[1];
        out[o + 2] = bg[2];
        out[o + 3] = 255;
      }
    }
  }




  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(logo.height - 1, Math.floor((y * logo.height) / h));
    const py = y0 + y;
    if (py < 0 || py >= sizePx) continue;
    for (let x = 0; x < w; x += 1) {
      if (logoR > 0 && !inRoundRect(x, y, 0, 0, w, h, logoR)) continue;
      const sx = Math.min(logo.width - 1, Math.floor((x * logo.width) / w));
      const si = (sy * logo.width + sx) * 4;
      const a = logo.data[si + 3] / 255;
      if (a <= 0) continue;
      const px = x0 + x;
      if (px < 0 || px >= sizePx) continue;
      const o = (py * sizePx + px) * 4;
      if (out[o + 3] === 0) {

        out[o] = logo.data[si];
        out[o + 1] = logo.data[si + 1];
        out[o + 2] = logo.data[si + 2];
        out[o + 3] = logo.data[si + 3];
      } else {
        out[o] = Math.round(logo.data[si] * a + out[o] * (1 - a));
        out[o + 1] = Math.round(logo.data[si + 1] * a + out[o + 1] * (1 - a));
        out[o + 2] = Math.round(logo.data[si + 2] * a + out[o + 2] * (1 - a));
        out[o + 3] = 255;
      }
    }
  }
}


function rasterizeQr(qr, settings, modulePx) {
  const n = qr.modules.size;
  const data = qr.modules.data;
  const quiet = settings.quietZone || 0;
  const total = n + quiet * 2;
  const sizePx = total * modulePx;
  const off = quiet * modulePx;
  const bodyPx = n * modulePx;
  const style = settings.dotStyle || "square";
  const fg = hexToRgb(settings.fgColor, [0, 0, 0]);
  const bg = hexToRgb(settings.bgColor, [255, 255, 255]);
  const transparent = Boolean(settings.transparent);



  const bgFrac = Math.max(0, Math.min(50, settings.bgRadius || 0)) / 100;
  const bgR = bgFrac * (sizePx / 2);
  const insideCard = (px, py) =>
    bgR <= 0 || inRoundRect(px, py, 0, 0, sizePx, sizePx, bgR);

  const finderFrac = Math.max(0, Math.min(1, (settings.finderRadius || 0) / 100));

  const specialFinders = finderFrac > 0 || style === "smooth" || style === "rounded";
  const logoLayout = getLogoLayout(sizePx, bodyPx, modulePx, settings);

  const out = new Uint8Array(sizePx * sizePx * 4);
  const setPixel = (px, py, rgb) => {
    const o = (py * sizePx + px) * 4;
    out[o] = rgb[0];
    out[o + 1] = rgb[1];
    out[o + 2] = rgb[2];
    out[o + 3] = 255;
  };

  if (!transparent) {
    for (let py = 0; py < sizePx; py += 1) {
      for (let px = 0; px < sizePx; px += 1) {
        if (!insideCard(px, py)) continue;
        setPixel(px, py, bg);
      }
    }
  }

  const center = modulePx / 2;
  const roundR = modulePx * 0.35;
  const fluidR = modulePx / 2;

  for (let my = 0; my < n; my += 1) {
    for (let mx = 0; mx < n; mx += 1) {
      if (!data[my * n + mx]) continue;
      if (specialFinders && isFinderModule(mx, my, n)) continue;
      const baseX = off + mx * modulePx;
      const baseY = off + my * modulePx;

      if (logoLayout && inRoundRect(baseX + center, baseY + center,
        logoLayout.plateX0, logoLayout.plateY0, logoLayout.plateW, logoLayout.plateH, logoLayout.plateR)) {
        continue;
      }

      let sTL = false;
      let sTR = false;
      let sBR = false;
      let sBL = false;
      if (style === "smooth") {
        const t = my > 0 && data[(my - 1) * n + mx];
        const b = my < n - 1 && data[(my + 1) * n + mx];
        const l = mx > 0 && data[my * n + (mx - 1)];
        const rt = mx < n - 1 && data[my * n + (mx + 1)];
        sTL = !t && !l;
        sTR = !t && !rt;
        sBR = !b && !rt;
        sBL = !b && !l;
      }
      for (let ly = 0; ly < modulePx; ly += 1) {
        for (let lx = 0; lx < modulePx; lx += 1) {
          let covered = true;
          if (style === "smooth") {
            covered = !fluidCarved(lx, ly, modulePx, fluidR, sTL, sTR, sBR, sBL);
          } else if (style === "rounded") {
            covered = roundedCovered(lx, ly, modulePx, roundR);
          }
          if (!covered) continue;
          const px = baseX + lx;
          const py = baseY + ly;
          if (!insideCard(px, py)) continue;
          setPixel(px, py, fg);
        }
      }
    }
  }

  if (specialFinders) {
    rasterizeFinders(out, sizePx, n, off, modulePx, fg, finderFrac, insideCard, setPixel);
  }

  compositeLogo(out, sizePx, settings, bg, transparent, logoLayout);

  return { data: out, width: sizePx, height: sizePx };
}




function rasterizeFinders(out, sizePx, n, off, m, fg, frac, insideCard, setPixel) {
  const origins = [
    { x: off, y: off },
    { x: off + (n - 7) * m, y: off },
    { x: off, y: off + (n - 7) * m },
  ];
  for (const o of origins) {
    const x0 = o.x;
    const y0 = o.y;
    const side = 7 * m;
    for (let py = y0; py < y0 + side; py += 1) {
      for (let px = x0; px < x0 + side; px += 1) {
        const inOuter = inRoundRect(px, py, x0, y0, 7 * m, 7 * m, frac * 3.5 * m);
        if (!inOuter) continue;
        const inHole = inRoundRect(px, py, x0 + m, y0 + m, 5 * m, 5 * m, frac * 2.5 * m);
        const inCenter = inRoundRect(px, py, x0 + 2 * m, y0 + 2 * m, 3 * m, 3 * m, frac * 1.5 * m);
        const dark = (inOuter && !inHole) || inCenter;
        if (!dark) continue;
        if (!insideCard(px, py)) continue;
        setPixel(px, py, fg);
      }
    }
  }
}

module.exports = { rasterizeQr, hexToRgb };
