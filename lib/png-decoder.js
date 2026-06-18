









const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67,
  83, 99, 115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5,
  5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
  1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11,
  11, 12, 12, 13, 13,
];
const CLEN_ORDER = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];

function buildTree(lengths, num) {
  const counts = new Uint16Array(16);
  for (let i = 0; i < num; i += 1) counts[lengths[i]] += 1;
  counts[0] = 0;
  const offsets = new Uint16Array(16);
  for (let i = 1; i < 16; i += 1) offsets[i] = offsets[i - 1] + counts[i - 1];
  const symbols = new Uint16Array(num);
  for (let i = 0; i < num; i += 1) {
    if (lengths[i]) {
      symbols[offsets[lengths[i]]] = i;
      offsets[lengths[i]] += 1;
    }
  }
  return { counts, symbols };
}

function inflate(data) {
  let pos = 0;
  let bitBuf = 0;
  let bitCnt = 0;

  function getBit() {
    if (bitCnt === 0) {
      bitBuf = data[pos];
      pos += 1;
      bitCnt = 8;
    }
    const b = bitBuf & 1;
    bitBuf >>= 1;
    bitCnt -= 1;
    return b;
  }

  function getBits(n) {
    let v = 0;
    for (let i = 0; i < n; i += 1) v |= getBit() << i;
    return v >>> 0;
  }

  function decode(tree) {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len <= 15; len += 1) {
      code |= getBit();
      const count = tree.counts[len];
      if (code < first + count) return tree.symbols[index + code - first];
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error("inflate: bad Huffman code");
  }

  let fixedLit = null;
  let fixedDist = null;
  function fixedTrees() {
    if (!fixedLit) {
      const litLen = new Uint8Array(288);
      for (let i = 0; i < 144; i += 1) litLen[i] = 8;
      for (let i = 144; i < 256; i += 1) litLen[i] = 9;
      for (let i = 256; i < 280; i += 1) litLen[i] = 7;
      for (let i = 280; i < 288; i += 1) litLen[i] = 8;
      fixedLit = buildTree(litLen, 288);
      const distLen = new Uint8Array(30).fill(5);
      fixedDist = buildTree(distLen, 30);
    }
    return { lit: fixedLit, dist: fixedDist };
  }

  function dynamicTrees() {
    const hlit = getBits(5) + 257;
    const hdist = getBits(5) + 1;
    const hclen = getBits(4) + 4;
    const clLen = new Uint8Array(19);
    for (let i = 0; i < hclen; i += 1) {
      clLen[CLEN_ORDER[i]] = getBits(3);
    }
    const clTree = buildTree(clLen, 19);

    const lengths = new Uint8Array(hlit + hdist);
    let i = 0;
    while (i < hlit + hdist) {
      const sym = decode(clTree);
      if (sym < 16) {
        lengths[i] = sym;
        i += 1;
      } else if (sym === 16) {
        const rep = getBits(2) + 3;
        const prev = lengths[i - 1];
        for (let r = 0; r < rep; r += 1) {
          lengths[i] = prev;
          i += 1;
        }
      } else if (sym === 17) {
        const rep = getBits(3) + 3;
        i += rep;
      } else {
        const rep = getBits(7) + 11;
        i += rep;
      }
    }
    const litTree = buildTree(lengths.subarray(0, hlit), hlit);
    const distTree = buildTree(lengths.subarray(hlit), hdist);
    return { lit: litTree, dist: distTree };
  }

  const out = [];
  let final = 0;
  do {
    final = getBit();
    const type = getBits(2);
    if (type === 0) {
      bitCnt = 0;
      const len = data[pos] | (data[pos + 1] << 8);
      pos += 4;
      for (let i = 0; i < len; i += 1) {
        out.push(data[pos]);
        pos += 1;
      }
    } else {
      const trees = type === 1 ? fixedTrees() : dynamicTrees();
      for (;;) {
        const sym = decode(trees.lit);
        if (sym === 256) break;
        if (sym < 256) {
          out.push(sym);
        } else {
          const l = LENGTH_BASE[sym - 257] + getBits(LENGTH_EXTRA[sym - 257]);
          const dsym = decode(trees.dist);
          const dist = DIST_BASE[dsym] + getBits(DIST_EXTRA[dsym]);
          let start = out.length - dist;
          for (let i = 0; i < l; i += 1) {
            out.push(out[start]);
            start += 1;
          }
        }
      }
    }
  } while (!final);

  return Uint8Array.from(out);
}



function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilter(raw, width, height, bpp) {
  const stride = width * bpp;
  const out = new Uint8Array(stride * height);
  let rawPos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawPos];
    rawPos += 1;
    const row = y * stride;
    const prevRow = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[rawPos + x];
      const a = x >= bpp ? out[row + x - bpp] : 0;
      const b = y > 0 ? out[prevRow + x] : 0;
      const c = x >= bpp && y > 0 ? out[prevRow + x - bpp] : 0;
      let recon;
      if (filter === 0) recon = value;
      else if (filter === 1) recon = value + a;
      else if (filter === 2) recon = value + b;
      else if (filter === 3) recon = value + ((a + b) >> 1);
      else if (filter === 4) recon = value + paeth(a, b, c);
      else throw new Error(`PNG: bad filter ${filter}`);
      out[row + x] = recon & 0xff;
    }
    rawPos += stride;
  }
  return out;
}


function decodePng(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i += 1) {
    if (u8[i] !== sig[i]) throw new Error("Not a PNG file");
  }

  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette = null;
  let trns = null;
  const idatParts = [];

  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  while (pos < u8.length) {
    const len = view.getUint32(pos, false);
    const type = String.fromCharCode(u8[pos + 4], u8[pos + 5], u8[pos + 6], u8[pos + 7]);
    const dataStart = pos + 8;
    if (type === "IHDR") {
      width = view.getUint32(dataStart, false);
      height = view.getUint32(dataStart + 4, false);
      bitDepth = u8[dataStart + 8];
      colorType = u8[dataStart + 9];
      interlace = u8[dataStart + 12];
    } else if (type === "PLTE") {
      palette = u8.subarray(dataStart, dataStart + len);
    } else if (type === "tRNS") {
      trns = u8.subarray(dataStart, dataStart + len);
    } else if (type === "IDAT") {
      idatParts.push(u8.subarray(dataStart, dataStart + len));
    } else if (type === "IEND") {
      break;
    }
    pos = dataStart + len + 4;
  }

  if (interlace !== 0) throw new Error("Interlaced PNG not supported");
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}`);


  let total = 0;
  for (const part of idatParts) total += part.length;
  const zlib = new Uint8Array(total);
  let zp = 0;
  for (const part of idatParts) {
    zlib.set(part, zp);
    zp += part.length;
  }
  const raw = inflate(zlib.subarray(2));

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`Unsupported PNG color type ${colorType}`);
  const bpp = channels;
  const pixels = unfilter(raw, width, height, bpp);

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const s = i * bpp;
    const d = i * 4;
    if (colorType === 6) {
      rgba[d] = pixels[s];
      rgba[d + 1] = pixels[s + 1];
      rgba[d + 2] = pixels[s + 2];
      rgba[d + 3] = pixels[s + 3];
    } else if (colorType === 2) {
      rgba[d] = pixels[s];
      rgba[d + 1] = pixels[s + 1];
      rgba[d + 2] = pixels[s + 2];
      rgba[d + 3] = 255;
    } else if (colorType === 0) {
      const g = pixels[s];
      rgba[d] = g;
      rgba[d + 1] = g;
      rgba[d + 2] = g;
      rgba[d + 3] = 255;
    } else if (colorType === 4) {
      const g = pixels[s];
      rgba[d] = g;
      rgba[d + 1] = g;
      rgba[d + 2] = g;
      rgba[d + 3] = pixels[s + 1];
    } else if (colorType === 3) {
      const idx = pixels[s];
      rgba[d] = palette[idx * 3];
      rgba[d + 1] = palette[idx * 3 + 1];
      rgba[d + 2] = palette[idx * 3 + 2];
      rgba[d + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }

  return { width, height, data: rgba };
}

module.exports = { decodePng, inflate };
