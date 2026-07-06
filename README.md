<div align="center">

# SeedRock

**Open-source procedural rock & cliff generator for the web, built on Three.js (WebGPU).**

**▶ [Live Demo](https://reed-soul.github.io/SeedRock/)** &nbsp;(WebGPU-capable browser required — Chrome/Edge 113+)

</div>

A fully procedural rock and cliff generator: pick a rock type, tune its parameters, and get a unique, textured, erosion-sculpted 3D rock you can drop into a scene or export to glTF.

> **Status: `1.0`.** Eight rock types, full LOD + impostor pipeline, AI texture workflow, tests, and community docs.

## Features

- **Eight rock types** — Granite, Sandstone, Limestone, Basalt, Volcanic, Glacial, River Cobble, Karst
- **Erosion simulation** — hydraulic, thermal, and edge-wear passes
- **PBR textures** — procedural defaults + AI ingest pipeline
- **Moss / snow overlays** — slope-driven biome cover
- **LOD chain** — mesh LODs + off-thread billboard impostor bake
- **glTF export** — MSFT_lod extension with `_LOD0`…`_LOD3` naming
- **Living scene** — cliff face + scatter boulders

## What's next

- Community-submitted species presets ([CONTRIBUTING.md](CONTRIBUTING.md))
- Optional ambient-occlusion maps
- Snow dedicated overlay textures

## Requirements

- **Node.js** 18+
- A **WebGPU-capable browser** (Chrome 113+ / Edge). WebGL2 fallback will be included.

## Run it

```bash
npm install
npm run textures        # procedural PBR maps
npm run textures:ingest -- --species granite --dir ./ai-output/  # AI maps
npm run textures:prompts  # AI generation prompts
npm run dev               # http://localhost:5390
npm test                  # unit tests
```

```bash
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/AI_TEXTURES.md](docs/AI_TEXTURES.md).

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
└── assets/textures/  # PBR maps (npm run textures)
scripts/
└── texture/        # Texture generation pipeline
```

## Adding a rock type

New rocks are added by dropping in a **preset** and a set of **generated textures** — no engine changes:

1. **Write the preset** in `src/species/<name>.js` — define erosion params, noise scales, texture bindings, and LOD thresholds.
2. **Generate textures** with an AI image model (gpt-image-2 / Flux / SD3) and place them via `npm run textures:ingest -- --species <id> --dir <folder>`.
3. **Register** in `src/species/index.js`.

## Tech stack

| Component | Tool |
|-----------|------|
| 3D Engine | Three.js 0.184+ (WebGPU) |
| Build | Vite 6 |
| UI | lil-gui |
| Textures | AI-generated (gpt-image-2 / Flux) |
| Export | glTF / GLB |

## AI-assisted workflow

Following the same cross-agent collaboration model as [SeedThree](https://github.com/SkyeShark/SeedThree):

- **Coding agent** (Claude Code / Codex) — engine, erosion algorithms, material pipeline, scene
- **Image generation** (gpt-image-2 / Flux) — rock surface textures, moss/snow overlays
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
- [x] LOD chain + impostor baking
- [x] Living scene (cliff face + scatter)
- [x] GitHub Pages live demo
- [x] Glacial rock type
- [x] AI texture prompts + ingest pipeline
- [x] Community contribution docs + CI tests

## License

[MIT](LICENSE)

## Acknowledgements

Inspired by [SeedThree](https://github.com/SkyeShark/SeedThree) and the procedural generation community.
