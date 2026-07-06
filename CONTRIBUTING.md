# Contributing to SeedRock

Thank you for helping grow the procedural rock library. The easiest contribution is a **new rock species preset** with matching PBR textures.

**Full walkthrough:** [docs/COMMUNITY_SPECIES.md](docs/COMMUNITY_SPECIES.md) · **Example PR:** [#14 Schist](https://github.com/reed-soul/SeedRock/pull/14)

## Quick start

```bash
git clone https://github.com/reed-soul/SeedRock.git
cd SeedRock
npm install
npm run textures
npm run dev
```

## Adding a rock species

### 1. Copy the template

```bash
cp src/species/_template.js src/species/my-rock.js
```

Edit the preset: `id`, `name`, `shape`, `noise`, and `erosion` parameters. Match the style of existing files like `granite.js` or `schist.js`.

### 2. Register the species

```js
// src/species/index.js
import { myRock } from './my-rock.js';

export const SPECIES = {
  // ...existing
  myRock,
};
```

The registry key (`myRock`) must match `preset.id`.

### 3. Add PBR textures

**Option A — procedural placeholder**

Add an entry to `scripts/texture/generate-procedural.mjs` and run `npm run textures` (generates albedo, normal, roughness, and AO).

**Option B — AI-generated (recommended)**

```bash
npm run textures:prompts -- --species my_rock   # print prompts (incl. AO)
# generate images with Flux / gpt-image / SD3 → save as my_rock_albedo.png etc.
npm run textures:ingest -- --species myRock --dir ./ai-output/
```

See [docs/AI_TEXTURES.md](docs/AI_TEXTURES.md) for the full AI workflow.

### 4. Validate

```bash
npm test
npm run build
```

### 5. Open a PR

- One species per PR (see PR #14 for a complete example: **Schist**)
- Use the [PR template](.github/pull_request_template.md)
- Include a screenshot or short clip of the rock in the viewer
- List the seed you used for the hero screenshot

## PR checklist

- [ ] Preset registered in `src/species/index.js`
- [ ] `id` matches registry key
- [ ] Textures in `public/assets/textures/` (or procedural entry added)
- [ ] AO map included when possible (`*_ao.png`)
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No unrelated refactors

## Code style

- ES modules, no build step for `src/`
- Match existing naming: camelCase ids, `snake_case` texture filenames
- Keep presets data-only — logic belongs in `generator/` or `materials/`
- Comments explain *why*, not *what*

## Architecture reference

```
src/species/     ← you add presets here
public/assets/textures/  ← PBR maps land here
src/generator/   ← mesh + erosion (rarely touched)
src/materials/   ← triplanar material (rarely touched)
```

## Questions?

Open a [GitHub Discussion](https://github.com/reed-soul/SeedRock/discussions) or issue.
