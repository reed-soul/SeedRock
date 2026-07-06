import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '../scripts/texture/derive-pbr.mjs');

async function makeAlbedo(dir, name, pattern) {
  // 64×64 albedo: a deterministic pattern with light/dark variation so Sobel
  // and AO have something to respond to.
  const W = 64, H = 64;
  const buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const v = pattern(x, y);
      buf[i] = buf[i + 1] = buf[i + 2] = v;
      buf[i + 3] = 255;
    }
  }
  const file = path.join(dir, name);
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile(file);
  return file;
}

function run(script, args) {
  return new Promise((resolve, reject) => {
    const p = spawn('node', [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('close', (code) => resolve({ code, stdout, stderr }));
    p.on('error', reject);
  });
}

test('derive-pbr: produces normal, roughness, ao beside the albedo', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'seedrock-derive-'));
  try {
    const albedo = await makeAlbedo(dir, 'testrock_albedo.png', (x, y) => {
      // concentric rings → strong gradient for Sobel to pick up
      const d = Math.hypot(x - 32, y - 32);
      return Math.round(128 + 100 * Math.sin(d * 0.5));
    });

    const { code, stderr } = await run(SCRIPT, [albedo]);
    assert.equal(code, 0, `script failed: ${stderr}`);
    assert.equal(stderr, '', `unexpected stderr: ${stderr}`);

    const channels = ['normal', 'roughness', 'ao'];
    for (const ch of channels) {
      const file = path.join(dir, `testrock_${ch}.png`);
      const buf = await readFile(file);
      const meta = await sharp(buf).metadata();
      assert.equal(meta.width, 64, `${ch} wrong width`);
      assert.equal(meta.height, 64, `${ch} wrong height`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('derive-pbr: species auto-detect sets roughness baseline', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'seedrock-derive-'));
  try {
    // Two flat-gray albedos differing only by species name → roughness baseline
    // should differ (basalt 0.85 vs volcanic 0.97).
    const flat = () => 160;
    const basaltAlb = await makeAlbedo(dir, 'basalt_albedo.png', flat);
    const volcAlb = await makeAlbedo(dir, 'volcanic_albedo.png', flat);

    const { stdout: basaltOut } = await run(SCRIPT, [basaltAlb]);
    const { stdout: volcOut } = await run(SCRIPT, [volcAlb]);

    assert.match(basaltOut, /base 0\.85.*species "basalt"/);
    assert.match(volcOut, /base 0\.97.*species "volcanic"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('derive-pbr: --rough-base overrides species detection', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'seedrock-derive-'));
  try {
    const albedo = await makeAlbedo(dir, 'granite_albedo.png', () => 160);
    const { stdout } = await run(SCRIPT, [albedo, '--rough-base', '0.5']);
    assert.match(stdout, /base 0\.50/);
    // should NOT mention species detection when overridden
    assert.doesNotMatch(stdout, /from species/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
