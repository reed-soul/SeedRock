#!/usr/bin/env node
// Ingest AI-generated PBR textures into public/assets/textures/.
//
// Usage:
//   npm run textures:ingest -- --species granite --dir ./ai-output/
//
// Expected filenames (any of these patterns):
//   granite_albedo.png | granite_albedo.jpg
//   granite_normal.png
//   granite_roughness.png
//
// Species ids with camelCase (riverCobble) map to river_cobble_* files.

import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../public/assets/textures');

const SPECIES_IDS = [
  'granite', 'sandstone', 'basalt', 'limestone', 'volcanic', 'glacial', 'river_cobble', 'karst',
];

function parseArgs(argv) {
  const args = { species: null, dir: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--species') args.species = argv[++i];
    else if (argv[i] === '--dir') args.dir = argv[++i];
  }
  return args;
}

function toFilePrefix(speciesArg) {
  if (speciesArg === 'riverCobble') return 'river_cobble';
  return speciesArg.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

async function findFile(dir, prefix, suffix) {
  const files = await readdir(dir);
  const re = new RegExp(`^${prefix}_${suffix}\\.(png|jpg|webp)$`, 'i');
  const match = files.find((f) => re.test(f));
  return match ? path.join(dir, match) : null;
}

const { species, dir } = parseArgs(process.argv);
if (!species || !dir) {
  console.error('Usage: npm run textures:ingest -- --species <id> --dir <folder>');
  process.exit(1);
}

const prefix = toFilePrefix(species);
if (!SPECIES_IDS.includes(prefix)) {
  console.error(`Unknown species "${species}" → prefix "${prefix}". Known: ${SPECIES_IDS.join(', ')}`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const channels = ['albedo', 'normal', 'roughness'];
let copied = 0;

for (const ch of channels) {
  const src = await findFile(path.resolve(dir), prefix, ch);
  if (!src) {
    console.warn(`  ⚠ missing ${prefix}_${ch}.* in ${dir}`);
    continue;
  }
  const ext = path.extname(src).toLowerCase();
  const dest = path.join(OUT_DIR, `${prefix}_${ch}${ext === '.jpg' ? '.jpg' : '.png'}`);
  await copyFile(src, dest);
  console.log(`  ✓ ${path.basename(dest)}`);
  copied++;
}

if (!copied) {
  console.error('No textures copied.');
  process.exit(1);
}
console.log(`Ingested ${copied} maps for ${prefix}.`);
