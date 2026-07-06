<div align="center">

# SeedRock

**Open-source procedural rock & cliff generator for the web, built on Three.js (WebGPU).**

**▶ [Live Demo](https://reed-soul.github.io/SeedRock/)** · **[Examples Gallery](https://reed-soul.github.io/SeedRock/examples.html)** &nbsp;(WebGPU-capable browser required — Chrome/Edge 113+)

![Karst canyon living scene — procedural cliff, scatter boulders, moss overlay, erosion-sculpted rock](docs/images/hero-karst.png)

</div>

A fully procedural rock and cliff generator: pick a rock type, tune its parameters, and get a unique, textured, erosion-sculpted 3D rock you can drop into a scene or export to glTF. **Paint rocks directly onto terrain** with the brush tool, or generate a full living scene in one click.

The live viewer opens to a **curated Karst canyon** — cliff face, scattered boulders, moss, and atmospheric terrain — not a debug grid on a gray plane.

> **Status: `1.2`.** Nine rock types, terrain scatter-painting, moss & snow overlays, optional AO maps, full LOD + impostor pipeline, AI texture workflow, tests, and community docs.

### Nine rock types

<div align="center">
<table>
<tr>
<td align="center"><a href="https://reed-soul.github.io/SeedRock/?species=granite&seed=42&scene=living&moss=0.15"><img src="docs/images/shots/granite.png" width="200"><br><sub>Granite</sub></a></td>
<td align="center"><a href="https://reed-soul.github.io/SeedRock/?species=sandstone&seed=117&scene=living"><img src="docs/images/shots/sandstone.png" width="200"><br><sub>Sandstone</sub></a></td>
<td align="center"><a href="https://reed-soul.github.io/SeedRock/?species=basalt&seed=88&scene=living"><img src="docs/images/shots/basalt.png" width="200"><br><sub>Basalt</sub></a></td>
</tr>
<tr>
<td align="center"><a href="https://reed-soul.github.io/SeedRock/?species=limestone&seed=204&scene=living&moss=0.10"><img src="docs/images/shots/limestone.png" width="200"><br><sub>Limestone</sub></a></td>
<td align="center"><a href="https://reed-soul.github.io/SeedRock/?species=volcanic&seed=13&scene=living"><img src="docs/images/shots/volcanic.png" width="200"><br><sub>Volcanic</sub></a></td>
<td align="center"><a href="https://reed-soul.github.io/SeedRock/?species=glacial&seed=3310&scene=living&moss=0.30"><img src="docs/images/shots/glacial.png" width="200"><br><sub>Glacial</sub></a></td>
</tr>
<tr>
<td align="center"><a href="https://reed-soul.github.io/SeedRock/?species=river_cobble&seed=77&scene=living&moss=0.20"><img src="docs/images/shots/river-cobble.png" width="200"><br><sub>River Cobble</sub></a></td>
<td align="center"><a href="https://reed-soul.github.io/SeedRock/?species=karst&seed=3310&scene=living&moss=0.18"><img src="docs/images/shots/karst.png" width="200"><br><sub>Karst</sub></a></td>
<td align="center"><a href="https://reed-soul.github.io/SeedRock/?species=schist&seed=256&scene=living&moss=0.12"><img src="docs/images/shots/schist.png" width="200"><br><sub>Schist</sub></a></td>
</tr>
</table>
</div>

*Click any rock to open it in the live viewer.* Each type has its own erosion profile (granite fractures differently from karst dissolution), noise scales, and a 1024px AI-derived PBR set.

## Features

- **Nine rock types** — Granite, Sandstone, Limestone, Basalt, Volcanic, Glacial, River Cobble, Karst, Schist
- **Terrain scatter-painting** — switch to Paint mode and brush rocks directly onto the terrain; painted rocks survive species changes and export with the scene
- **Erosion simulation** — hydraulic, thermal, and edge-wear passes on every rock
- **PBR textures** — 1024px AI albedo (Gemini) + Sobel-derived normal/roughness/AO per species
- **Moss / snow overlays** — slope-driven biome cover with dedicated PBR texture sets
- **LOD chain** — mesh LODs + off-thread billboard impostor bake
- **glTF export** — MSFT_lod extension with `_LOD0`…`_LOD3` naming
- **Living scene** — cliff face + scatter boulders + atmospheric terrain

## What's next

- Community-submitted species presets ([CONTRIBUTING.md](CONTRIBUTING.md) · [docs/COMMUNITY_SPECIES.md](docs/COMMUNITY_SPECIES.md))

## Requirements

- **Node.js** 18+
- A **WebGPU-capable browser** (Chrome 113+ / Edge). WebGL2 fallback will be included.

## Run it

```bash
pnpm install
pnpm textures        # procedural PBR maps (fallback; 512px)
pnpm textures:prompts  # print AI generation prompts for each species
# Generate AI albedo with your image model, then derive + ingest the full PBR set:
pnpm textures:derive ai-output/granite_albedo.png        # → normal/roughness/ao from albedo
pnpm textures:ingest -- --species granite --dir ./ai-output/  # copy into public/assets/textures/
pnpm dev               # http://localhost:5390  ·  examples at /examples.html
pnpm test              # unit tests
```

```bash
pnpm build    # production bundle in dist/
pnpm preview  # serve the built bundle
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [docs/COMMUNITY_SPECIES.md](docs/COMMUNITY_SPECIES.md), and [docs/AI_TEXTURES.md](docs/AI_TEXTURES.md).

## Architecture

```
src/
├── core/           # Three.js scene setup, camera, renderer
├── generator/      # Rock mesh generation (noise + erosion)
├── species/        # Rock type presets (granite, basalt, etc.)
├── materials/      # PBR material pipeline
├── export/         # glTF export
├── ui/             # lil-gui control panel
└── main.js         # Entry point
assets/
└── (legacy)        # use public/assets/textures for generated PBR maps
public/
└── assets/textures/  # PBR maps (pnpm textures)
scripts/
└── texture/        # Texture generation pipeline
```

## Adding a rock type

New rocks are added by dropping in a **preset** and a set of **generated textures** — no engine changes:

1. **Write the preset** in `src/species/<name>.js` — define erosion params, noise scales, texture bindings, and LOD thresholds. Add a `roughBase` entry to `derive-pbr.mjs` so derived roughness matches the species.
2. **Generate the albedo** with an AI image model (gpt-image-2 / Flux / Gemini via `opencli`), then derive the rest of the PBR set and ingest:
   ```bash
   pnpm textures:derive ai-output/<id>_albedo.png        # → normal/roughness/ao (Sobel + cavity)
   pnpm textures:ingest -- --species <id> --dir ./ai-output/
   ```
3. **Register** in `src/species/index.js`.

## Tech stack

| Component | Tool |
|-----------|------|
| 3D Engine | Three.js 0.184+ (WebGPU) |
| Build | Vite 8 |
| UI | lil-gui |
| Textures | AI-generated (gpt-image-2 / Flux) |
| Export | glTF / GLB |

## AI-assisted workflow

Following the same cross-agent collaboration model as [SeedThree](https://github.com/SkyeShark/SeedThree):

- **Coding agent** (Claude Code / Codex) — engine, erosion algorithms, material pipeline, scene
- **Image generation** (Gemini via `opencli`) — one 1024px albedo per species; `pnpm textures:derive` derives normal/roughness/AO from each albedo
- **Community** — rock type presets and textures submitted as PRs

## Roadmap

- [x] Repo init & architecture design
- [x] Core noise-based mesh generator
- [x] Hydraulic erosion simulation
- [x] First rock type: Granite
- [x] PBR material pipeline (procedural fallback; texture-ready triplanar)
- [x] lil-gui control panel
- [x] glTF export
- [x] Additional rock types (5+)
- [x] Moss / lichen overlay system
- [x] Snow overlay textures
- [x] Optional ambient-occlusion maps
- [x] LOD chain + impostor baking
- [x] Living scene (cliff face + scatter)
- [x] GitHub Pages live demo
- [x] Glacial rock type
- [x] AI texture prompts + ingest pipeline
- [x] Full AI PBR set for all 9 species (Gemini albedo + Sobel-derived normal/roughness/AO)
- [x] Terrain scatter-painting (brush rocks directly onto the ground)
- [x] Community contribution docs + CI tests

## License

[MIT](LICENSE)

## Acknowledgements

Inspired by [SeedThree](https://github.com/SkyeShark/SeedThree) and the procedural generation community.
