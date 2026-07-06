<div align="center">

# SeedRock

**Open-source procedural rock & cliff generator for the web, built on Three.js (WebGPU).**

**▶ [Live Demo](https://reed-soul.github.io/SeedRock/)** &nbsp;(WebGPU-capable browser required — Chrome/Edge 113+)

</div>

A fully procedural rock and cliff generator: pick a rock type, tune its parameters, and get a unique, textured, erosion-sculpted 3D rock you can drop into a scene or export to glTF.

> **Status: `beta`.** Five rock types, PBR textures, moss/snow overlays, LOD, living cliff scene, and GitHub Pages deploy.

## What's planned

- **Multiple rock types** — Granite, Sandstone, Limestone, Basalt, Volcanic, Glacial, River Cobble, Karst — each with distinct erosion patterns and surface characteristics.
- **Erosion simulation** — Hydraulic and thermal erosion sculpt realistic cracks, ridges, overhangs, and talus slopes.
- **PBR textures** — AI-generated albedo, normal, roughness, and ambient-occlusion maps for each rock type.
- **Moss / lichen / snow cover** — Optional biome overlays driven by slope angle and ambient parameters.
- **LOD chain** — Full geometry → reduced → baked-impostor for efficient scene placement.
- **glTF export** — One-click `.glb` export with merged meshes and standard material extensions.
- **Living scene** — Procedural cliff face with scatter boulders, debris, and environmental context.

## Requirements

- **Node.js** 18+
- A **WebGPU-capable browser** (Chrome 113+ / Edge). WebGL2 fallback will be included.

## Run it

```bash
npm install
npm run textures   # generate procedural PBR maps (first time / after species changes)
npm run dev        # http://localhost:5390
```

```bash
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
```

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
2. **Generate textures** with an AI image model (gpt-image-2 / Flux / SD3) and place them in `assets/textures/`.
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

## License

[MIT](LICENSE)

## Acknowledgements

Inspired by [SeedThree](https://github.com/SkyeShark/SeedThree) and the procedural generation community.
