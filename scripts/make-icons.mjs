// Generates the app icons: a small, thin ring on true black with generous negative space.
// Usage: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const SS = 4; // supersampling per axis

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, ringRadius, ringWidth) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const dx = x + (sx + 0.5) / SS - c;
          const dy = y + (sy + 0.5) / SS - c;
          const d = Math.hypot(dx, dy);
          if (Math.abs(d - ringRadius) <= ringWidth / 2) hits++;
        }
      }
      const v = Math.round((hits / (SS * SS)) * 235);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = raw[o + 1] = raw[o + 2] = v;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
// Ring diameter is ~26% of the canvas and thin (~1.1%), so it survives maskable cropping.
const make = (size) => png(size, size * 0.13, Math.max(1.25, size * 0.008));
writeFileSync('public/icons/icon-192.png', make(192));
writeFileSync('public/icons/icon-512.png', make(512));
writeFileSync('public/icons/icon-maskable-512.png', make(512));
writeFileSync('public/icons/apple-touch-icon.png', make(180));
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#000"/><circle cx="32" cy="32" r="8.5" fill="none" stroke="#ebebeb" stroke-width="1"/></svg>\n`,
);
console.log('icons written');
