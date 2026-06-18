



const { encodePng } = require("./png-encoder");

function flattenPixel(rgba, i, out, oi) {
  const a = rgba[i + 3] / 255;
  out[oi] = Math.round(rgba[i] * a + 255 * (1 - a));
  out[oi + 1] = Math.round(rgba[i + 1] * a + 255 * (1 - a));
  out[oi + 2] = Math.round(rgba[i + 2] * a + 255 * (1 - a));
}



function encodeBmp(rgba, w, h) {
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const pixelArray = rowSize * h;
  const fileSize = 54 + pixelArray;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, w, true);
  view.setInt32(22, h, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelArray, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);

  const rgb = new Uint8Array(3);
  for (let fy = 0; fy < h; fy += 1) {
    const iy = h - 1 - fy;
    const rowOff = 54 + fy * rowSize;
    for (let x = 0; x < w; x += 1) {
      flattenPixel(rgba, (iy * w + x) * 4, rgb, 0);
      const o = rowOff + x * 3;
      bytes[o] = rgb[2];
      bytes[o + 1] = rgb[1];
      bytes[o + 2] = rgb[0];
    }
  }
  return buf;
}



function quantizeWebSafe(r, g, b) {
  const qr = Math.round(r / 51) * 51;
  const qg = Math.round(g / 51) * 51;
  const qb = Math.round(b / 51) * 51;
  return (qr << 16) | (qg << 8) | qb;
}

function buildIndexedImage(rgba, w, h) {
  const count = w * h;
  let hasTransparent = false;
  const exact = new Map();
  let exactOverflow = false;
  for (let i = 0; i < count; i += 1) {
    const a = rgba[i * 4 + 3];
    if (a < 128) {
      hasTransparent = true;
      continue;
    }
    const key = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
    if (!exact.has(key)) {
      exact.set(key, exact.size);
      if (exact.size + 1 > 256) {
        exactOverflow = true;
        break;
      }
    }
  }

  const useExact = !exactOverflow;
  const colorToIndex = new Map();
  const palette = [];
  if (useExact) {
    for (const key of exact.keys()) {
      colorToIndex.set(key, palette.length);
      palette.push(key);
    }
  } else {

    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          colorToIndex.set((r << 16) | (g << 8) | b, palette.length);
          palette.push((r << 16) | (g << 8) | b);
        }
      }
    }
  }

  const transparentIndex = hasTransparent ? palette.length : -1;
  if (hasTransparent) palette.push(0x000000);

  const indices = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    if (rgba[i * 4 + 3] < 128) {
      indices[i] = transparentIndex;
      continue;
    }
    let key = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
    if (!useExact) key = quantizeWebSafe(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    indices[i] = colorToIndex.get(key);
  }

  return { indices, palette, transparentIndex };
}

function lzwEncode(indices, minCodeSize) {
  const out = [];
  let bitBuffer = 0;
  let bitCount = 0;
  function write(code, size) {
    bitBuffer |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      out.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  }

  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let dict = new Map();
  let next = eoiCode + 1;
  function reset() {
    dict = new Map();
    next = eoiCode + 1;
    codeSize = minCodeSize + 1;
  }

  write(clearCode, codeSize);
  reset();

  let w = String.fromCharCode(indices[0]);
  for (let i = 1; i < indices.length; i += 1) {
    const c = String.fromCharCode(indices[i]);
    const wc = w + c;
    if (dict.has(wc)) {
      w = wc;
    } else {
      write(w.length === 1 ? w.charCodeAt(0) : dict.get(w), codeSize);
      dict.set(wc, next);
      next += 1;
      if (next > 1 << codeSize && codeSize < 12) codeSize += 1;
      if (next > 4095) {
        write(clearCode, codeSize);
        reset();
      }
      w = c;
    }
  }
  write(w.length === 1 ? w.charCodeAt(0) : dict.get(w), codeSize);
  write(eoiCode, codeSize);
  if (bitCount > 0) out.push(bitBuffer & 0xff);
  return out;
}

function encodeGif(rgba, w, h) {
  const { indices, palette, transparentIndex } = buildIndexedImage(rgba, w, h);


  let tableBits = 1;
  while (1 << tableBits < palette.length) tableBits += 1;
  if (tableBits < 1) tableBits = 1;
  const tableSize = 1 << tableBits;

  const minCodeSize = Math.max(2, tableBits);
  const lzw = lzwEncode(indices, minCodeSize);

  const head = [];
  function push(...vals) {
    for (const v of vals) head.push(v & 0xff);
  }

  "GIF89a".split("").forEach((ch) => head.push(ch.charCodeAt(0)));
  push(w & 0xff, (w >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff);
  push(0x80 | ((tableBits - 1) & 0x07));
  push(0, 0);

  for (let i = 0; i < tableSize; i += 1) {
    const c = i < palette.length ? palette[i] : 0;
    push((c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff);
  }

  if (transparentIndex >= 0) {
    push(0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, transparentIndex, 0x00);
  }

  push(0x2c, 0, 0, 0, 0, w & 0xff, (w >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff, 0x00);

  push(minCodeSize);
  for (let i = 0; i < lzw.length; i += 255) {
    const chunk = lzw.slice(i, i + 255);
    push(chunk.length);
    for (const b of chunk) push(b);
  }
  push(0x00);
  push(0x3b);

  return Uint8Array.from(head).buffer;
}



const FORMATS = {
  png: { ext: "png", mime: "image/png" },
  bmp: { ext: "bmp", mime: "image/bmp" },
  gif: { ext: "gif", mime: "image/gif" },
};


function encodeImage(format, rgba, w, h) {
  const fmt = String(format || "png").toLowerCase();
  if (fmt === "bmp") return { buffer: encodeBmp(rgba, w, h), ext: "bmp" };
  if (fmt === "gif") return { buffer: encodeGif(rgba, w, h), ext: "gif" };
  return { buffer: encodePng(rgba, w, h), ext: "png" };
}

module.exports = { encodeImage, encodeBmp, encodeGif, FORMATS };
