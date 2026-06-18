






const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes, start, end) {
  let crc = 0xffffffff;
  for (let i = start; i < end; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  const MOD = 65521;

  const NMAX = 5552;
  let a = 1;
  let b = 0;
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    let n = Math.min(NMAX, len - i);
    while (n > 0) {
      a += bytes[i];
      b += a;
      i += 1;
      n -= 1;
    }
    a %= MOD;
    b %= MOD;
  }
  return ((b << 16) | a) >>> 0;
}


function buildRawScanlines(rgba, width, height) {
  const rowLen = width * 4;
  const raw = new Uint8Array((rowLen + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    raw[p] = 0;
    p += 1;
    const src = y * rowLen;
    raw.set(rgba.subarray(src, src + rowLen), p);
    p += rowLen;
  }
  return raw;
}


function zlibStore(raw) {
  const MAX = 65535;
  const blockCount = Math.max(1, Math.ceil(raw.length / MAX));
  const out = new Uint8Array(2 + raw.length + blockCount * 5 + 4);
  let p = 0;
  out[p] = 0x78;
  p += 1;
  out[p] = 0x01;
  p += 1;

  let i = 0;
  if (raw.length === 0) {
    out[p] = 0x01;
    p += 5;
    out[p - 2] = 0xff;
    out[p - 1] = 0xff;
  } else {
    while (i < raw.length) {
      const len = Math.min(MAX, raw.length - i);
      const isFinal = i + len >= raw.length ? 1 : 0;
      out[p] = isFinal;
      p += 1;
      out[p] = len & 0xff;
      out[p + 1] = (len >>> 8) & 0xff;
      const nlen = ~len & 0xffff;
      out[p + 2] = nlen & 0xff;
      out[p + 3] = (nlen >>> 8) & 0xff;
      p += 4;
      out.set(raw.subarray(i, i + len), p);
      p += len;
      i += len;
    }
  }

  const adler = adler32(raw);
  out[p] = (adler >>> 24) & 0xff;
  out[p + 1] = (adler >>> 16) & 0xff;
  out[p + 2] = (adler >>> 8) & 0xff;
  out[p + 3] = adler & 0xff;
  p += 4;

  return out.subarray(0, p);
}

function makeChunk(type, data) {
  const len = data.length;
  const out = new Uint8Array(12 + len);
  const view = new DataView(out.buffer);
  view.setUint32(0, len, false);
  for (let i = 0; i < 4; i += 1) {
    out[4 + i] = type.charCodeAt(i);
  }
  out.set(data, 8);
  view.setUint32(8 + len, crc32(out, 4, 8 + len), false);
  return out;
}

function concatChunks(chunks) {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}



function encodePng(rgba, width, height) {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = buildRawScanlines(rgba, width, height);
  const idatData = zlibStore(raw);

  const file = concatChunks([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idatData),
    makeChunk("IEND", new Uint8Array(0)),
  ]);

  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

module.exports = { encodePng };
