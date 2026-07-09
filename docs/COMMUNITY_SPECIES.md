# Community species guide

Step-by-step guide for adding a new rock type to SeedRock. For a complete real PR, see **[#14 Schist](https://github.com/reed-soul/SeedRock/pull/14)**.

## Overview

| Step | What you do | Where |
|------|-------------|-------|
| 1 | Copy preset template | `src/species/<name>.js` |
| 2 | Register species | `src/species/index.js` |
| 3 | Add PBR textures (4 maps) | `public/assets/textures/` |
| 4 | Validate & screenshot | `pnpm test`, viewer |
| 5 | Open PR | one species per PR |

## 1. Create the preset

```bash
cp src/species/_template.js src/species/marble.js
```

Edit the file:

- **`id`** — camelCase key, must match registry entry (`marble`)
- **`name`** — display label in GUI
- **`textures`** — filenames use `snake_case` prefix (`marble_albedo.png`)
- **`shape` / `noise` / `erosion`** — tune until the silhouette feels right

Use an existing species as reference:

| Species | Best for learning |
|---------|-------------------|
| `granite.js` | Blocky igneous, ridged noise |
| `schist.js` | Foliated metamorphic, community example |
| `karst.js` | Porous, high erosion |

## 2. Register

```js
// src/species/index.js
import { marble } from './marble.js';

export const SPECIES = {
  // ...existing
  marble,
};
```

Registry key **must equal** `preset.id`.

## 3. Textures

### Required maps

| File | Channel | Notes |
|------|---------|-------|
| `<prefix>_albedo.png` | sRGB | Flat lit, no baked shadows |
| `<prefix>_normal.png` | linear | OpenGL +Y normal |
| `<prefix>_roughness.png` | linear | white = rough |

### Optional (recommended)

| File | Channel | Notes |
|------|---------|-------|
| `<prefix>_ao.png` | linear | white = exposed, black = crevice |

AO is auto-loaded when present (`pnpm textures` generates procedural AO for all built-in species).

### Option A — procedural placeholder

Add your species to `scripts/texture/generate-procedural.mjs`:

```js
marble: { rgb: [220, 215, 208], var: 14, grain: 0.07, pore: 0.03, roughBase: 0.75 },
```

Then:

```bash
pnpm textures
```

### Option B — AI-generated (recommended for PRs)

```bash
pnpm textures:prompts -- --species marble
# generate albedo, normal, roughness, ao with Flux / gpt-image / SD3
pnpm textures:ingest -- --species marble --dir ./ai-output/
```

See [AI_TEXTURES.md](AI_TEXTURES.md) for prompt tips.

## 4. Validate locally

```bash
pnpm test
pnpm build
pnpm dev    # http://localhost:5390
```

**Screenshot checklist**

- Pick a memorable seed (e.g. `424242`)
- Show the species at default settings
- Optional: moss/snow overlay demo for alpine species

## 5. Open a PR

Title format: `species: add Marble (community contribution)`

Include in the PR body:

- Species name and biome
- Seed used for screenshot
- Texture source (procedural / AI model name)
- Screenshot or short clip

Use the PR checklist in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Wanted species

Good first contributions — one species per PR, follow the steps above. Prefer
forms that already exist (`boulder` / `columnar` / `slate` / `crystal`) unless
you're also proposing a new StructureGraph form.

| Species | Suggested form | Why it's interesting |
|---------|----------------|----------------------|
| **Gneiss** | `slate` or `boulder` | Banded metamorphic — foliation + coarse grain |
| **Pumice** | `boulder` | Vesicular volcanic — high porosity, very light look |
| **Conglomerate** | `boulder` | Clast-in-matrix — needs a distinct albedo story |
| **Chalk** | `boulder` | Soft carbonate — high hydraulic, pale albedo |
| **Amethyst** | `crystal` | Purple quartz habit — reuses Worley nucleation |
| **Travertine** | `slate` | Layered spring deposit — horizontal banding |
| **Breccia** | `boulder` | Angular clasts — ridged noise + high edge wear |
| **Peridotite** | `boulder` | Mantle rock — green olivine albedo |

Claim one by opening a draft PR titled `species: add <Name> (community contribution)`.
See [PR #14 Schist](https://github.com/reed-soul/SeedRock/pull/14) for a complete example.

## Naming conventions

| Item | Convention | Example |
|------|------------|---------|
| Registry key | camelCase | `riverCobble` |
| Texture prefix | snake_case | `river_cobble_albedo.png` |
| Preset file | kebab or single word | `river-cobble.js` or `marble.js` |

## Common mistakes

- `id` does not match registry key → `pnpm test` fails validation
- Baked lighting in albedo → looks wrong at different sun angles
- Non-tileable textures → visible seams on large rocks
- Missing `pnpm textures` entry → CI passes but textures are missing in PR

## Questions?

[GitHub Discussions](https://github.com/reed-soul/SeedRock/discussions) · [CONTRIBUTING.md](../CONTRIBUTING.md)
