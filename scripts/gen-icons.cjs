// One-off: generate square PWA icons from public/logoofficial.png (8-bit RGBA PNG).
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public', 'logoofficial.png');
const OUT = path.join(__dirname, '..', 'public');

function decodePNG(buf) {
  let pos = 8; // skip signature
  let w, h;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6) throw new Error('expected 8-bit RGBA');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rowStart + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let val;
      switch (ft) {
        case 0: val = rawByte; break;
        case 1: val = rawByte + a; break;
        case 2: val = rawByte + b; break;
        case 3: val = rawByte + ((a + b) >> 1); break;
        case 4: val = rawByte + paeth(a, b, c); break;
        default: throw new Error('bad filter ' + ft);
      }
      out[y * stride + x] = val & 0xff;
    }
  }
  return { w, h, data: out };
}

function encodePNG(w, h, data) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const comp = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, d) => {
    const c = Buffer.alloc(12 + d.length);
    c.writeUInt32BE(d.length, 0);
    c.write(type, 4, 'ascii');
    d.copy(c, 8);
    const crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), d]);
    c.writeUInt32BE(crc32(crcBuf) >>> 0, 8 + d.length);
    return c;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0))]);
}

const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

// bilinear sample source RGBA at (fx,fy) in source coords
function sample(src, fx, fy) {
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, src.w - 1), y1 = Math.min(y0 + 1, src.h - 1);
  const dx = fx - x0, dy = fy - y0;
  const px = (x, y, ch) => src.data[(y * src.w + x) * 4 + ch];
  const out = [0, 0, 0, 0];
  for (let ch = 0; ch < 4; ch++) {
    const top = px(x0, y0, ch) * (1 - dx) + px(x1, y0, ch) * dx;
    const bot = px(x0, y1, ch) * (1 - dx) + px(x1, y1, ch) * dx;
    out[ch] = top * (1 - dy) + bot * dy;
  }
  return out;
}

function makeIcon(src, size, contentRatio, bg) {
  const data = Buffer.alloc(size * size * 4);
  // fill background
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = 255;
  }
  // fit logo within contentRatio box, preserving aspect
  const box = size * contentRatio;
  const scale = Math.min(box / src.w, box / src.h);
  const dw = src.w * scale, dh = src.h * scale;
  const ox = (size - dw) / 2, oy = (size - dh) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x < ox || x >= ox + dw || y < oy || y >= oy + dh) continue;
      const sx = (x - ox) / scale, sy = (y - oy) / scale;
      const [r, g, b, a] = sample(src, sx, sy);
      const af = a / 255;
      const di = (y * size + x) * 4;
      data[di] = Math.round(r * af + data[di] * (1 - af));
      data[di + 1] = Math.round(g * af + data[di + 1] * (1 - af));
      data[di + 2] = Math.round(b * af + data[di + 2] * (1 - af));
      data[di + 3] = 255;
    }
  }
  return encodePNG(size, size, data);
}

const src = decodePNG(fs.readFileSync(SRC));
const white = [255, 255, 255];
// regular icons: logo at 78% on white
fs.writeFileSync(path.join(OUT, 'icon-192.png'), makeIcon(src, 192, 0.78, white));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), makeIcon(src, 512, 0.78, white));
// maskable: logo within 60% safe zone on white full-bleed
fs.writeFileSync(path.join(OUT, 'icon-maskable-512.png'), makeIcon(src, 512, 0.6, white));
// apple touch icon (180, no transparency) on white
fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), makeIcon(src, 180, 0.72, white));
console.log('icons generated');
