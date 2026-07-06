#!/usr/bin/env node
// Derive tangent-space normal + roughness + AO maps from an albedo texture.
//
// Albedo luminance is treated as a height field:
//   normal    — Sobel gradient of the height field (wrap-sampled → tileable)
//   roughness — contrast-stretched luminance biased by a per-species base,
//               rougher in dark crevices, smoother on light ridges
//   ao        — cavity darkening from local Laplacian + gradient magnitude
//               (sharp concavities collect shadow)
//
// This keeps the whole PBR set consistent and seamless with the AI albedo
// without needing extra image generations. Adapted from SeedThree's derive-pbr
// (normal+roughness) with an added AO pass matching generate-procedural.mjs.
//
// Usage:
//   node scripts/texture/derive-pbr.mjs <albedo.png> [--strength 2.5] [--rough-base 0.9]
//   node scripts/texture/derive-pbr.mjs ai-output/granite_albedo.png            # species auto-detected
// Writes <base sans _albedo>_normal.png, _roughness.png, _ao.png beside the input.

import sharp from 'sharp';
import path from 'node:path';

// Per-species roughness baseline — must match generate-procedural.mjs SPECIES.roughBase.
// Rock type drives how matte it reads: basalt smoother, volcanic/tuff rougher.
const SPECIES_ROUGH_BASE = {
  granite: 0.9, sandstone: 0.95, basalt: 0.85, limestone: 0.92,
  volcanic: 0.97, glacial: 0.84, river_cobble: 0.78, karst: 0.88, schist: 0.89,
  slate: 0.86, crystal: 0.18, marble: 0.28, obsidian: 0.14, ore: 0.4,
};

const args = process.argv.slice(2);
const input = args[0];
if (!input) {
  console.error('usage: derive-pbr.mjs <albedo.png> [--strength N] [--rough-base N]');
  process.exit(2);
}
const si = args.indexOf('--strength');
const strength = si >= 0 ? parseFloat(args[si + 1]) : 2.5;
const rbi = args.indexOf('--rough-base');
// Auto-detect species from filename → roughBase; --rough-base overrides.
const speciesMatch = path.basename(input).match(/^([a-z_]+)_albedo/i);
const detectedBase = speciesMatch ? SPECIES_ROUGH_BASE[speciesMatch[1]] : undefined;
const roughBase = rbi >= 0
  ? parseFloat(args[rbi + 1])
  : (detectedBase ?? 0.9);

const stem = input.replace(/(_albedo)?\.png$/i, '');
const normalOut = `${stem}_normal.png`;
const roughOut = `${stem}_roughness.png`;
const aoOut = `${stem}_ao.png`;

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

// Luminance height field in [0,1]. Alpha-aware: transparent margins are masked
// out — deriving from them paints ghost silhouettes into the data maps.
const lum = new Float32Array(W * H);
const mask = new Uint8Array(W * H);
let hasAlpha = false;
for (let i = 0; i < W * H; i++) {
  const r = data[i * C], g = data[i * C + 1], b = data[i * C + 2];
  lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  mask[i] = data[i * C + 3] > 16 ? 1 : 0;
  if (!mask[i]) hasAlpha = true;
}
if (!hasAlpha) mask.fill(1); // fully opaque albedo: treat all pixels as valid

const wrap = (v, n) => (v % n + n) % n;
const L = (x, y) => lum[wrap(y, H) * W + wrap(x, W)];

// Normal map (RGB) via Sobel, tileable through wrap sampling.
// Outside the alpha mask: flat neutral (128,128,255).
const normal = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 3;
    if (!mask[y * W + x]) {
      normal[o] = 128; normal[o + 1] = 128; normal[o + 2] = 255;
      continue;
    }
    const gx = (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1))
             - (L(x - 1, y - 1) + 2 * L(x - 1, y) + L(x - 1, y + 1));
    const gy = (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1))
             - (L(x - 1, y - 1) + 2 * L(x, y - 1) + L(x + 1, y - 1));
    let nx = -gx * strength, ny = -gy * strength, nz = 1;
    const inv = 1 / Math.hypot(nx, ny, nz);
    nx *= inv; ny *= inv; nz *= inv;
    normal[o] = Math.round((nx * 0.5 + 0.5) * 255);
    normal[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    normal[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
  }
}

// Roughness (grayscale): anchored to the species roughBase, rougher in dark
// crevices, slightly smoother on light ridges. Range clamped to [0,1].
// Outside the alpha mask: neutral 0.7 (178).
const rough = Buffer.alloc(W * H);
for (let i = 0; i < W * H; i++) {
  if (!mask[i]) { rough[i] = 178; continue; }
  // lum in [0,1]; dark (lum→0) pushes toward +0.10, light (lum→1) toward −0.06
  const r = roughBase + 0.10 - 0.16 * lum[i];
  rough[i] = Math.round(Math.max(0, Math.min(1, r)) * 255);
}

// Ambient occlusion (grayscale): cavity darkening from local Laplacian +
// gradient magnitude — sharp concavities (pits, fractures, between grains)
// collect ambient shadow. White (255) = exposed, lower = occluded.
// Mirrors the AO logic in generate-procedural.mjs so AI-derived and
// procedural-derived maps share the same response curve.
const ao = Buffer.alloc(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!mask[i]) { ao[i] = 255; continue; }
    const h = lum[i];
    // Laplacian: sum of 4-neighbours minus 4×centre — peaks in pits.
    const lap = Math.abs(
      L(x + 1, y) + L(x - 1, y) + L(x, y + 1) + L(x, y - 1) - 4 * h,
    );
    // Gradient magnitude (cavity): high on the steep walls of a concavity.
    const dhdx = L(x + 1, y) - L(x - 1, y);
    const dhdy = L(x, y + 1) - L(x, y - 1);
    const cavity = Math.abs(dhdx) + Math.abs(dhdy);
    const aoVal = Math.max(0, Math.min(1, 1 - cavity * 1.6 - lap * 0.45));
    ao[i] = Math.round(aoVal * 255);
  }
}

await sharp(normal, { raw: { width: W, height: H, channels: 3 } }).png().toFile(normalOut);
await sharp(rough, { raw: { width: W, height: H, channels: 1 } }).png().toFile(roughOut);
await sharp(ao, { raw: { width: W, height: H, channels: 1 } }).png().toFile(aoOut);

console.log(`albedo:    ${path.basename(input)} ${W}x${H}`);
console.log(`normal  -> ${path.basename(normalOut)}  (strength ${strength})`);
const usedOverride = rbi >= 0;
console.log(`roughness -> ${path.basename(roughOut)}  (base ${roughBase.toFixed(2)}${!usedOverride && detectedBase ? `, from species "${speciesMatch[1]}"` : ''})`);
console.log(`ao      -> ${path.basename(aoOut)}`);
