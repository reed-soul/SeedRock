#!/usr/bin/env node
// Procedural PBR rock texture generator — offline stand-in until AI textures land.
// Run: npm run textures

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../public/assets/textures');
const OVERLAY_DIR = path.join(OUT_DIR, 'overlays');
const SIZE = 512;

const SPECIES = {
  granite: { rgb: [154, 149, 144], var: 28, grain: 0.14, pore: 0.06, roughBase: 0.9 },
  sandstone: { rgb: [196, 165, 116], var: 22, grain: 0.1, pore: 0.04, roughBase: 0.95 },
  basalt: { rgb: [58, 58, 66], var: 18, grain: 0.16, pore: 0.03, roughBase: 0.85 },
  limestone: { rgb: [216, 210, 196], var: 16, grain: 0.08, pore: 0.05, roughBase: 0.92 },
  volcanic: { rgb: [107, 74, 66], var: 30, grain: 0.2, pore: 0.12, roughBase: 0.97 },
  glacial: { rgb: [138, 147, 156], var: 22, grain: 0.13, pore: 0.05, roughBase: 0.84 },
  river_cobble: { rgb: [122, 117, 110], var: 20, grain: 0.09, pore: 0.03, roughBase: 0.78 },
  karst: { rgb: [200, 192, 176], var: 24, grain: 0.18, pore: 0.14, roughBase: 0.88 },
  schist: { rgb: [110, 106, 98], var: 26, grain: 0.15, pore: 0.04, roughBase: 0.89 },
};

function hash(x, y, seed) {
  let h = seed ^ (x * 374761393) ^ (y * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function valueNoise(x, y, seed, scale) {
  const fx = x * scale;
  const fy = y * scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const u = tx * tx * (3 - 2 * tx);
  const v = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed) / 4294967295;
  const b = hash(ix + 1, iy, seed) / 4294967295;
  const c = hash(ix, iy + 1, seed) / 4294967295;
  const d = hash(ix + 1, iy + 1, seed) / 4294967295;
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x, y, seed, octaves = 5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x, y, seed + i * 97, freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

function heightAt(x, y, seed, cfg) {
  const layer = fbm(x, y, seed, 4);
  const grain = fbm(x * 3.7, y * 3.7, seed + 11, 3);
  const pore = fbm(x * 9.2, y * 9.2, seed + 23, 2);
  return layer * cfg.grain + grain * cfg.grain * 0.4 - pore * cfg.pore;
}

async function writePng(name, rgba, w = SIZE, h = SIZE, dir = OUT_DIR) {
  await sharp(Buffer.from(rgba), { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(path.join(dir, name));
}

async function generateMossOverlay(seed) {
  const albedo = new Uint8Array(SIZE * SIZE * 4);
  const normal = new Uint8Array(SIZE * SIZE * 4);
  const roughness = new Uint8Array(SIZE * SIZE * 4);
  const heights = new Float32Array(SIZE * SIZE);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE, v = y / SIZE;
      heights[y * SIZE + x] = fbm(u, v, seed, 6) * 0.6 + fbm(u * 4.2, v * 4.2, seed + 7, 3) * 0.4;
    }
  }

  const sampleH = (x, y) => heights[Math.max(0, Math.min(SIZE - 1, y)) * SIZE + Math.max(0, Math.min(SIZE - 1, x))];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const n = fbm(x / SIZE, y / SIZE, seed + 3, 5);
      const clump = fbm(x * 5.1 / SIZE, y * 5.1 / SIZE, seed + 9, 3);
      albedo[i] = Math.round(28 + n * 35 + clump * 20);
      albedo[i + 1] = Math.round(72 + n * 55 + clump * 35);
      albedo[i + 2] = Math.round(24 + n * 25 + clump * 12);
      albedo[i + 3] = 255;

      const dhdx = sampleH(x + 1, y) - sampleH(x - 1, y);
      const dhdy = sampleH(x, y + 1) - sampleH(x, y - 1);
      const nx = -dhdx * 5, ny = -dhdy * 5, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      normal[i] = Math.round((nx / len) * 0.5 * 255 + 128);
      normal[i + 1] = Math.round((ny / len) * 0.5 * 255 + 128);
      normal[i + 2] = Math.round((nz / len) * 0.5 * 255 + 255);
      normal[i + 3] = 255;

      const rough = Math.round((0.82 + n * 0.12) * 255);
      roughness[i] = rough; roughness[i + 1] = rough; roughness[i + 2] = rough; roughness[i + 3] = 255;
    }
  }

  await writePng('moss_albedo.png', albedo, SIZE, SIZE, OVERLAY_DIR);
  await writePng('moss_normal.png', normal, SIZE, SIZE, OVERLAY_DIR);
  await writePng('moss_roughness.png', roughness, SIZE, SIZE, OVERLAY_DIR);
  console.log('  ✓ moss overlay');
}

async function generateSpecies(id, cfg, seed) {
  const albedo = new Uint8Array(SIZE * SIZE * 4);
  const normal = new Uint8Array(SIZE * SIZE * 4);
  const roughness = new Uint8Array(SIZE * SIZE * 4);
  const heights = new Float32Array(SIZE * SIZE);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      heights[y * SIZE + x] = heightAt(u, v, seed, cfg);
    }
  }

  const sampleH = (x, y) => {
    const cx = Math.max(0, Math.min(SIZE - 1, x));
    const cy = Math.max(0, Math.min(SIZE - 1, y));
    return heights[cy * SIZE + cx];
  };

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const h = heights[y * SIZE + x];
      const n = fbm(x / SIZE, y / SIZE, seed + 5, 6);

      const r = Math.max(0, Math.min(255, cfg.rgb[0] + (n - 0.5) * cfg.var * 2 + h * 40));
      const g = Math.max(0, Math.min(255, cfg.rgb[1] + (n - 0.5) * cfg.var * 2 + h * 38));
      const b = Math.max(0, Math.min(255, cfg.rgb[2] + (n - 0.5) * cfg.var * 2 + h * 36));

      albedo[i] = r;
      albedo[i + 1] = g;
      albedo[i + 2] = b;
      albedo[i + 3] = 255;

      const dhdx = sampleH(x + 1, y) - sampleH(x - 1, y);
      const dhdy = sampleH(x, y + 1) - sampleH(x, y - 1);
      const nx = -dhdx * 4;
      const ny = -dhdy * 4;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      normal[i] = Math.round((nx / len) * 0.5 * 255 + 128);
      normal[i + 1] = Math.round((ny / len) * 0.5 * 255 + 128);
      normal[i + 2] = Math.round((nz / len) * 0.5 * 255 + 255);
      normal[i + 3] = 255;

      const rough = Math.max(0, Math.min(255, (cfg.roughBase + n * 0.08 + Math.abs(h) * 0.15) * 255));
      roughness[i] = rough;
      roughness[i + 1] = rough;
      roughness[i + 2] = rough;
      roughness[i + 3] = 255;
    }
  }

  await writePng(`${id}_albedo.png`, albedo);
  await writePng(`${id}_normal.png`, normal);
  await writePng(`${id}_roughness.png`, roughness);
  console.log(`  ✓ ${id}`);
}

await mkdir(OUT_DIR, { recursive: true });
await mkdir(OVERLAY_DIR, { recursive: true });
console.log(`Generating PBR textures → ${OUT_DIR}`);
let seed = 42;
for (const [id, cfg] of Object.entries(SPECIES)) {
  await generateSpecies(id, cfg, seed);
  seed += 1337;
}
console.log('Generating overlay textures →', OVERLAY_DIR);
await generateMossOverlay(9001);
console.log('Done.');
