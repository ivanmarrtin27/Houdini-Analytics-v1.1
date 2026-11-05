import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const brand = path.join(root, 'brand');
const icons = path.join(root, 'icons');
const iconSrc = path.join(brand, 'houdini-analytics-icon.png');
const markSrc = path.join(brand, 'houdini-analytics-mark.png');
const lockSrc = path.join(brand, 'houdini-analytics-lockup.png');

async function squareOnBlack(src, size, out, margin = 0.12) {
  const inner = Math.round(size * (1 - margin * 2));
  const buf = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: buf, gravity: 'centre' }])
    .png()
    .toFile(out);
  console.log('wrote', path.relative(root, out), size);
}

async function framedIconOnBlack(size, out, margin = 0.14) {
  const src = fs.existsSync(iconSrc) ? iconSrc : markSrc;
  const frame = Math.round(size * (1 - margin * 2));
  const inner = Math.round(frame * 0.82);
  const iconBuf = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const framed = await sharp({
    create: { width: frame, height: frame, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: iconBuf, gravity: 'centre' }])
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: framed, gravity: 'centre' }])
    .png()
    .toFile(out);
}

async function ogShare() {
  const w = 1200;
  const h = 630;
  const src = fs.existsSync(iconSrc) ? iconSrc : markSrc;
  const box = 460;
  const inner = Math.round(box * 0.78);
  const iconBuf = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const framed = await sharp({
    create: { width: box, height: box, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: iconBuf, gravity: 'centre' }])
    .png()
    .toBuffer();
  await sharp({
    create: { width: w, height: h, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: framed, gravity: 'centre' }])
    .png()
    .toFile(path.join(brand, 'og-share.png'));
  await framedIconOnBlack(512, path.join(brand, 'og-share-512.png'));
  console.log('wrote og-share.png + og-share-512.png (isotipo encuadrado)');
}

await squareOnBlack(iconSrc, 32, path.join(icons, 'favicon-32.png'));
await squareOnBlack(iconSrc, 48, path.join(icons, 'favicon-48.png'));
await squareOnBlack(iconSrc, 180, path.join(icons, 'apple-touch-icon.png'));
await squareOnBlack(iconSrc, 192, path.join(icons, 'icon-192.png'));
await squareOnBlack(iconSrc, 512, path.join(icons, 'icon-512.png'));
await ogShare();
console.log('DONE');
