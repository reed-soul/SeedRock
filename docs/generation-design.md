# Procedural Generation — Design Brief

Architecture decisions for the SeedRock noise + erosion + form pipeline. This is a
**hybrid** document: the first half is a research synthesis (with citations and
confidence flags), the second half maps those decisions back to the code you'll
read in `src/`.

Confidence is flagged where sources are thin or the design is a pragmatic
compromise rather than a faithful model — same convention as SeedThree's
`generation-design.md`. **Every citation has a verifiable URL/DOI; see
[References](#references) at the end.** All URLs verified July 2026.

## TL;DR

- **Primary method: noise-based mesh displacement + vertex-domain erosion
  simulation**, dispatched over four geometry "form primitives" (boulder /
  columnar / slate / crystal).
- This is the *opposite* design choice from [SeedThree](https://github.com/SkyeShark/SeedThree),
  which uses the [Weber & Penn 1995](https://dl.acm.org/doi/10.1145/218380.218427)
  parametric model. Trees have a **botanical blueprint** (a recursive branching
  grammar with a century of dendrology behind it); rocks do not. Rocks have a
  **geological history** (stress, fracture, weathering). So SeedThree builds a
  skeleton; SeedRock sculpts a surface.
- Secondary inputs come from real geomorphology: hillslope diffusion
  ([Culling 1960](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/JZ065i004p01561)),
  particle hydraulic erosion ([Musgrave 1989](http://www.kenmusgrave.com/dissertation.pdf);
  [Mei et al. 2007](https://inria.hal.science/inria-00402079/PDF/FastErosion_PG07.pdf)),
  and Domokos–Firey pebble abrasion
  ([Domokos et al. 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3922984/))
  for the `riverCobble` species (`erosion.pebbleAbrade`).

---

## PART A — Research synthesis

### 1. Why not Weber–Penn / L-systems?

[Weber & Penn 1995](https://dl.acm.org/doi/10.1145/218380.218427) [1] models trees
as a **hierarchical branching skeleton** with per-level parameters (curve, taper,
down-angle, phyllotactic child placement, the Da Vinci pipe-model radius law).
That works because a tree *is* a branching skeleton — the paper encodes a real
botanical blueprint.

A rock has no such skeleton. Its visible form is the *result* of:
1. An initial mass (magma → crystallization, sediment → lithification, etc.),
2. Fracture under stress (joints, foliation, crystal habits),
3. Surface weathering (thermal cycling, water, biological action).

So the SeedRock pipeline mirrors that order: **base geometry (the mass) → form
primitives (the fracture structure) → erosion simulation (the weathering).**
There is no analogue of `generateSkeleton()`; the "structure" is the geometry
itself, sculpted by noise and erosion. *(This is also why the Phase 5 roadmap
explores an explicit structure-skeleton layer for the structural forms — see
[Future: structure skeleton](#future-structure-skeleton).)*

### 2. Noise as the primary shape driver

The boulder form (the dominant form, used by 10 of 15 species) gets its silhouette
from **3D gradient noise sampled radially** along each vertex's direction from the
shape origin. The noise function is a compact implementation of **Perlin gradient
noise** ([Perlin 1985](https://dl.acm.org/doi/10.1145/325165.325247) [2];
[Perlin 2002](https://dl.acm.org/doi/10.1145/566570.566636) [3] for the improved
polynomial fade `6t⁵−15t⁴+10t³`), fractal-summed as **fBm** (fractional Brownian
motion — [Mandelbrot 1982](https://link.springer.com/book/10.1007/978-1-4757-4017-2) [4]).

Two samplers are exposed:
- `fbm()` — smooth fractal sum, the default for most rocks.
- `ridged()` — `(1−|n|)²` per octave, producing sharp ridges; used for volcanic /
  angular species. This is the ridged-multifractal variant documented in
  *Texturing & Modeling: A Procedural Approach* (Ebert et al.), the same family
  SeedThree cites for terrain.

Why hand-rolled rather than a library? Three reasons: (a) SeedRock needs the noise
**seeded per (species, seed)** — the permutation table is filled by a Fisher–Yates
shuffle driven by the same `Rng` (`xmur3` → `splitmix32`) that threads through the
whole generator, so the same `(species, seed)` is byte-reproducible; (b) it's ~80
lines; (c) we need both `fbm` and `ridged` in the same seeded table. *(Pragmatic
choice, not a claim the hand-rolled noise is better than `simplex-noise` etc.)*

### 3. Erosion simulation — the geomorphology layer

After the base geometry is displaced, three erosion passes operate **directly on
mesh vertices** via adjacency lists (vertices are first welded with
`mergeVertices`). Each maps to a real geomorphological process:

#### 3.1 Thermal erosion → hillslope diffusion

Steep vertices shed material to lower neighbors, conserving mass. This is the
mesh-domain analogue of **hillslope soil creep modeled as linear diffusion**
([Culling 1960](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/JZ065i004p01561) [5]),
where sediment flux is proportional to local slope — the "talus angle" threshold
in the code is the discrete rest-angle of granular material. The classic
computer-graphics formulation for terrain comes from
[Musgrave, Kolb & Mace 1989](http://www.kenmusgrave.com/dissertation.pdf) [6].

> **Update (no longer a limitation).** `thermalErode()` now transports material
> symmetrically along the true 3D steepest-descent direction (the i→j vector),
> not just the world-Y axis. On a height-field mesh this degenerates to the
> classic Y-only behavior; on fully-3D rocks with overhangs or horizontal
> slopes, material flows along the surface gradient. See
> [`src/generator/erosion.js`](../src/generator/erosion.js) and the lateral-slope
> transport test in [`tests/erosion.test.js`](../tests/erosion.test.js).
>
> *(Earlier text, kept for context: the Y-axis-only form was the height-field
> variant of Culling's diffusion model — fine for near-convex boulders but it
> underplayed talus aprons on overhangs. Fixed in the Phase 5 erosion pass.)*

#### 3.2 Hydraulic erosion → droplet particle simulation

Droplets are dropped onto the mesh, walk downhill to the lowest neighbor, carry
sediment with inertia, evaporate (`water *= 0.96`), erode based on height-drop ×
water capacity, and deposit in pits. This is the **particle-based "virtual
droplet" hydraulic erosion** family introduced to CG by
[Musgrave 1989](http://www.kenmusgrave.com/dissertation.pdf) [6] and widely
disseminated in its fast-GPU form by
[Mei, Decaudin & Hu 2007](https://inria.hal.science/inria-00402079/PDF/FastErosion_PG07.pdf)
[7]. The SeedRock implementation runs on the CPU over vertex adjacency rather
than on a 2D height-field grid (the standard Mei et al. setup), because a rock is
a closed 3D surface, not a terrain.

#### 3.3 Edge wear → curvature-driven smoothing

High-curvature vertices (convex corners, edges) are pushed slightly inward along
the radial normal. Curvature is measured as the average of `1 − n·n_neighbor` — a
discrete mean-curvature proxy. This rounds chips and sharpens weathered edges; it
is a generic mesh-processing operation rather than a named geomorphic process,
but it captures the **mechanical weathering** that rounds exposed corners faster
than flat faces.

#### 3.4 Pebble abrasion → Domokos–Firey curvature flow

`riverCobble` adds a fourth pass: **collisional pebble abrasion**. River rocks
do not primarily round by hillslope diffusion or droplet carving — they round by
repeated impacts. [Domokos et al. 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3922984/)
[15] (building on Firey 1974 / Bloore 1977) showed that abrasion against a large
abrader is a **curvature-driven flow**: local wear speed ∝ Gaussian curvature,
and two phases emerge spontaneously —

1. **Phase I** — high-curvature edges/corners abrade; axis ratios stay roughly
   constant (the "untouched faces" stage Kuenen observed).
2. **Phase II** — once the body is convex, axis ratios evolve toward a sphere
   (the Firey attractor for infinitely large abraders).

`pebbleAbrade()` in [`erosion.js`](../src/generator/erosion.js) is the mesh-
domain approximation: positive discrete curvature wears inward along the radial
from the centroid (Phase I), then a `sphericity` blend pulls radii toward the
mean-radius sphere (Phase II). It is **opt-in** via
`erosion.pebbleAbrade.enabled` — only `riverCobble` turns it on, so other
species keep their prior silhouettes.

### 4. Form primitives — geology, not just geometry

The four form factories correspond to four real geological modes of occurrence.
Currently boulder is the only one that's truly noise-driven; the other three are
**structural geometry assembly**. *(This asymmetry is the explicit motivation for
the Phase 5 structure-skeleton refactor.)*

| Form | Geological reference | Current implementation | Confidence |
|---|---|---|---|
| **boulder** | glacial erratics, granitic exfoliation domes | `IcosahedronGeometry` + radial fBm/ridged displacement | **High** — the noise-driven path is faithful |
| **columnar** | [columnar jointing](https://en.wikipedia.org/wiki/Columnar_jointing) in basalt (Giant's Causeway, Devils Tower) | hex-prism cylinders in hex close-pack, jittered | **Medium** — looks right, but the jointing *topology* (the fracture network) is hand-placed, not grown. The physics is in [Goehring, Morris & Lin 2006](https://link.aps.org/doi/10.1103/PhysRevE.74.036115) [8] / [Goehring 2009](https://ar5iv.labs.arxiv.org/html/0904.4055) [9]: columnar joints emerge from a desiccation/cooling front where drying and cracking timescales separate. A faithful model would simulate the cracking front, not place prisms. |
| **slate** | [foliation](https://www.files.ethz.ch/structuralgeology/jpb/files/english/9foliation.pdf) in low-grade metamorphic rock (slate→phyllite→schist→gneiss, [PSGT9](https://psgt.earth.lsa.umich.edu/chapter/9/fabrics.html)) | stacked `BoxGeometry` slabs offset in Y/XZ | **Medium** — reads as strata, but foliation is a *tectonic fabric* (aligned platy minerals), not just layering. |
| **crystal** | [radiating crystal clusters](https://opengeology.org/Mineralogy/14-mineral-descriptions/) — quartz geodes, acicular aragonite, prismatic goethite ([Mindat](https://www.mindat.org/gl/16896)) | central `ConeGeometry` + satellites from [Worley 1996](https://dl.acm.org/doi/10.1145/237170.237267) [10] cellular feature points (`shape.nucleation: 'worley'`; legacy angular `fan` retained for golden baselines) | **High** — nucleation sites are now a real cellular lattice, not a clock-face fan. Habit still uses cone proxies rather than lattice-true prism faces. |

### 5. Why not marching cubes / SDF / voxel?

For comparison, the alternatives we explicitly rejected:

- **Marching Cubes** ([Lorensen & Cline 1987](https://www.cs.toronto.edu/~jacobson/seminar/lorenson-and-cline-1987.pdf) [11]):
  extracting an iso-surface from a dense scalar field gives beautiful organic
  shapes, but for a *rock* it over-tessellates (you pay for volume resolution you
  don't see) and the erosion passes become field operations rather than the
  intuitive vertex-domain simulation we have. Better for caves than rocks.
- **Signed distance fields**: same trade-off, plus the boolean operations (carve,
  chip) are natural but the runtime cost in a WebGPU browser context is steep for
  a single-rock preview.
- **Pure height-field**: can't represent overhangs, and a boulder is a closed 3D
  solid, not a terrain.

The chosen "primitive + noise + vertex erosion" path keeps the mesh count
controllable (LOD-friendly), runs the erosion as direct mesh operations (easy to
reason about), and stays WebGPU-first without volume textures. *(Engineering
judgment, medium confidence.)*

### 6. Materials — triplanar, no UVs

There are **no UV coordinates** on SeedRock meshes. All textures (albedo, normal,
roughness, AO, moss/snow overlays) are sampled via **triplanar projection** from
`three/tsl` — three orthogonal planar samples blended by the dominant axis of the
world-space normal. This is the standard approach for rocks/terrain where you
cannot author UVs by hand and where seams are unacceptable; it trades a bit of
shader cost for seamless, scale-independent texturing on any closed surface.

AO is wired in as a custom TSL `aoNode` rather than a fixed material slot, and
moss/snow overlays are blended by **slope masks** computed from
`normalWorld.dot(up)` via `smoothstep` — moss on moderate slopes, snow on flatter
surfaces. This is a *phenomenological* model (moss grows where light and moisture
allow, snow sticks where slope permits), not a biological one.

### 7. Determinism — the `(species, seed)` contract

Every visible feature of a rock is a deterministic function of its `(species,
seed)` pair. The pattern, inherited from SeedThree's `rng.js`, is:

1. String seed `${preset.id}:${seed}` → `xmur3` hash → `splitmix32`-seeded
   counter (`src/core/rng.js`).
2. **One** `Rng` instance is threaded through generation in a fixed traversal
   order, and seeds the noise permutation table (`makeNoise3D(rng.int(...))`).
3. Adding features later must not shift existing output — the RNG draw order is
   part of the contract.

This is what makes the live viewer's deep-link URLs shareable, what makes the
Headless API round-trippable, and what lets the test suite assert seed
determinism.

---

## PART B — Mapping to the code

Read these files in this order to understand the pipeline end-to-end.

### B.1 Entry point — `src/generator/mesh.js`

`generateRockGeometry(preset, seed, opts)` ([mesh.js:27](../src/generator/mesh.js)):

1. Seed `Rng` from `${preset.id}:${seed}`.
2. Seed the noise table from `rng.int(1, 1_000_000)`.
3. **Dispatch by `preset.shape.form`** to one of four form factories
   ([mesh.js:36–49](../src/generator/mesh.js)). `STRUCTURAL_FORMS` (columnar /
   slate / crystal) skip the primary radial displacer — their character comes
   from the base geometry. Only `boulder` runs `displaceRadial()` as its primary
   shape driver.
4. `computeVertexNormals()`.
5. `applyErosion(geo, erosion, rng)` — mutates positions in place.
6. For `lowpoly` style: delete the `normal` attribute so flat-shading derives
   per-face normals ([mesh.js:54–59](../src/generator/mesh.js)).

The `STRUCTURAL_FORMS` guard at [mesh.js:18](../src/generator/mesh.js) is the
single most important architectural comment in the repo — it explains why boulder
is *special*. Phase 5 is essentially about making that asymmetry go away.

### B.2 Noise — `src/core/noise.js`

80 lines. `makeNoise3D(seed)` returns `{ noise, fbm, ridged }`:
- `noise(x,y,z)` — gradient noise, 12-gradient table (`GRAD3`, [noise.js:4](../src/core/noise.js)),
  quintic `fade` ([noise.js:10](../src/core/noise.js)), seeded Fisher–Yates
  permutation ([noise.js:22–27](../src/core/noise.js)).
- `fbm(x,y,z, octaves, lacunarity, gain)` — normalized fractal sum
  ([noise.js:54](../src/core/noise.js)).
- `ridged(x,y,z, octaves, lacunarity, gain)` — `(1−|n|)²` ridged multifractal
  ([noise.js:65](../src/core/noise.js)).

### B.3 Erosion — `src/generator/erosion.js`

`applyErosion(geo, erosionParams, rng)` ([erosion.js:197](../src/generator/erosion.js)):

1. Weld vertices (`mergeVertices`) so adjacency is meaningful.
2. `buildAdjacency()` ([erosion.js:14](../src/generator/erosion.js)) — per-vertex
   neighbor lists from the triangle index.
3. Run, in order, gated by `enabled !== false` (pebbleAbrade is opt-in):
   - `thermalErode` ([erosion.js](../src/generator/erosion.js)) — talus-angle
     diffusion along the true 3D gradient.
   - `hydraulicErode` — droplet particle sim with inertia & evaporation.
   - `edgeWear` — curvature-driven inward push along the radial normal.
   - `pebbleAbrade` — Domokos–Firey collisional rounding (riverCobble only).
4. Recompute normals.

### B.4 Forms — `src/generator/forms/`

- **boulder.js** — `IcosahedronGeometry(radius, detail)` welded, then
  `displaceRadial()` ([boulder.js:42](../src/generator/forms/boulder.js)) perturbs
  each vertex along its radial direction from `origin` by `noise.fbm` (or
  `ridged`), plus a high-frequency micro-displacement layer, then applies
  per-axis stretch/squash. *This is where SeedRock's silhouette actually comes
  from for most species.*
- **columnar.js** — hex close-pack (centre + ring + outer ring) of 6-sided
  `CylinderGeometry` columns, each with jittered height/tilt/radius, merged
  ([columnar.js:25](../src/generator/forms/columnar.js)).
- **slate.js** — 3–5 stacked `BoxGeometry` slabs in Y with XY offset and
  per-layer shrink ([slate.js:18](../src/generator/forms/slate.js)).
- **crystal.js** — central tall `ConeGeometry` + 5–9 satellite cones tilted
  outward via `setFromUnitVectors` ([crystal.js:23](../src/generator/forms/crystal.js)).

### B.5 Species — `src/species/`

Species are **data-only preset objects** — no logic, validated at load time by
`validate.js`. Each carries `{ id, name, latin, biome, color, roughness,
metalness, textures, shape: { form, radius, detail, ... }, noise: { scale, octaves,
... }, erosion: { thermal, hydraulic, edgeWear }, lod: {...} }`. Logic lives in
`generator/` and `materials/`. See `_template.js` for the schema and
[`COMMUNITY_SPECIES.md`](COMMUNITY_SPECIES.md) for the contribution recipe.

### B.6 Materials — `src/materials/rock-material.js`

`makeRockMaterial(preset, maps, overlay, overlayMaps, { style })` branches on
style: PBR (`MeshStandardNodeMaterial`, or `MeshPhysicalNodeMaterial` with
`transmission` for ice), Toon (`MeshToonNodeMaterial` + 4-band DataTexture ramp),
Low Poly (standard + `flatShading`). All textures sampled via TSL `triplanarTexture()`;
moss/snow blended by slope masks from `normalWorld.dot(up)`.

### B.7 Export — `src/export/glb.js`

`GLTFExporter` binary. Emits the `MSFT_lod` extension (groups `*_LOD0/1/2/3`
nodes, attaches screen-coverage hints) and an auto-generated `*_collider` proxy
mesh (reduced-LOD geometry, position-only, `visible:false`) for engine physics
import.

---

## Structure skeleton (implemented)

SeedRock now has the topology-first intermediate representation that SeedThree's
`stems[]` provides for trees. Each form produces a `StructureGraph` before
meshing: displacement nodes for boulder, joint sets for columnar, foliation
planes for slate, nucleation points for crystal. The mesher consumes any graph,
so the same structure can be meshed at multiple LOD levels. See
[`docs/structure-skeleton.md`](structure-skeleton.md) for the schema and the
byte-for-byte regression gate.

The geological references behind each form's structure: columnar jointing physics
[8][9], foliation fabrics ([ETH Zurich structural geology notes](https://www.files.ethz.ch/structuralgeology/jpb/files/english/9foliation.pdf)
[12]; [PSGT9](https://psgt.earth.lsa.umich.edu/chapter/9/fabrics.html) [13]),
crystal habit ([OpenGeology Mineralogy](https://opengeology.org/Mineralogy/14-mineral-descriptions/) [14]),
and Domokos–Firey pebble abrasion for `riverCobble`
([Domokos et al. 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC3922984/) [15]).

---

## References

All URLs verified July 2026.

1. **Weber, J. & Penn, J. (1995).** *Creation and Rendering of Realistic Trees.* SIGGRAPH '95 Proceedings, 119–128. DOI: [10.1145/218380.218427](https://dl.acm.org/doi/10.1145/218380.218427). *(Used as the methodological counterpoint — what SeedRock deliberately does NOT do.)*
2. **Perlin, K. (1985).** *An Image Synthesizer.* ACM SIGGRAPH Computer Graphics, 19(3), 287–296. DOI: [10.1145/325165.325247](https://dl.acm.org/doi/10.1145/325165.325247). *(Original gradient noise; basis of `src/core/noise.js`.)*
3. **Perlin, K. (2002).** *Improving Noise.* ACM TOG 21(3), 681–682. DOI: [10.1145/566570.566636](https://dl.acm.org/doi/10.1145/566570.566636). *(The quintic `fade` we use.)*
4. **Mandelbrot, B. B. (1982).** *The Fractal Geometry of Nature.* W. H. Freeman. [Springer edition](https://link.springer.com/book/10.1007/978-1-4757-4017-2). *(Origin of fBm, the fractal sum in `fbm()`.)*
5. **Culling, W. E. H. (1960).** *Analytical theory of land slopes.* Journal of Geophysical Research 65(4), 1561–1566. DOI: [10.1029/JZ065i004p01561](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/JZ065i004p01561). *(Seminal hillslope-diffusion model — the science behind `thermalErode`.)*
6. **Musgrave, F. K., Kolb, C. & Mace, R. (1989).** *The Synthesis and Rendering of Erosion Fractals.* SIGGRAPH '89. Expanded in Musgrave's dissertation [*Methods for Realistic Landscape Imaging*](http://www.kenmusgrave.com/dissertation.pdf), George Washington University. *(The CG origin of thermal + hydraulic erosion on procedural surfaces.)*
7. **Mei, X., Decaudin, P. & Hu, B.-G. (2007).** *Fast Hydraulic Erosion Simulation and Visualization on GPU.* Pacific Graphics '07, 16–. [PDF](https://inria.hal.science/inria-00402079/PDF/FastErosion_PG07.pdf). *(The droplet-particle hydraulic model `hydraulicErode` follows, adapted to 3D mesh adjacency.)*
8. **Goehring, L., Morris, S. W. & Lin, Z. (2006).** *Experimental investigation of the scaling of columnar joints.* Physical Review E 74, 036115. DOI: [10.1103/PhysRevE.74.036115](https://link.aps.org/doi/10.1103/PhysRevE.74.036115). *(Corn-starch analog proves columnar jointing scales the same in desiccating starch and cooling basalt — the physics behind the `columnar` form.)*
9. **Goehring, L. (2009).** *Drying and cracking mechanisms in a starch slurry.* Physical Review E 80, 036116. [ar5iv](https://ar5iv.labs.arxiv.org/html/0904.4055). *(Timescale separation that grows the columns.)*
10. **Worley, S. (1996).** *A Cellular Texture Basis Function.* SIGGRAPH '96, 291–294. DOI: [10.1145/237170.237267](https://dl.acm.org/doi/10.1145/237170.237267). *(Crystal nucleation seeding via `src/core/worley.js` — feature points, not just F1 distance.)*
11. **Lorensen, W. E. & Cline, H. E. (1987).** *Marching Cubes: A High Resolution 3D Surface Construction Algorithm.* SIGGRAPH '87, 163–169. [PDF](https://www.cs.toronto.edu/~jacobson/seminar/lorenson-and-cline-1987.pdf). *(The iso-surface method we explicitly did NOT choose — see §5.)*
12. **Burg, J.-P.** *Secondary Planar Structural Elements* (foliation chapter), ETH Zurich structural geology course. [PDF](https://www.files.ethz.ch/structuralgeology/jpb/files/english/9foliation.pdf). *(Foliation/bedding reference for the `slate` form.)*
13. **PSGT9: Fabrics.** *Processes in Structural Geology and Tectonics*, University of Michigan. [web](https://psgt.earth.lsa.umich.edu/chapter/9/fabrics.html). *(The slate→phyllite→schist→gneiss metamorphic-grade sequence.)*
14. **Perkins, D. & Henke, K.** *Mineral Descriptions*, OpenGeology Mineralogy. [web](https://opengeology.org/Mineralogy/14-mineral-descriptions/). *(Crystal habits — radiating cluster, acicular, prismatic — behind the `crystal` form.)*
15. **Domokos, G., Jerolmack, D. J., Sipos, A. Á. & Török, A. (2014).** *How River Rocks Round: Resolving the Shape-Size Paradox.* PLoS ONE 9(2): e88657. [PMC3922984](https://pmc.ncbi.nlm.nih.gov/articles/PMC3922984/). *(Curvature-driven two-phase abrasion — the model behind `pebbleAbrade` for `riverCobble`.)*
16. **Sobel, I. & Feldman, G. (1968).** *A 3×3 Isotropic Gradient Operator for Image Processing.* Unpublished talk, Stanford Artificial Intelligence Laboratory (SAIL); documented only via secondary sources (e.g. [Wikipedia: Sobel operator](https://en.wikipedia.org/wiki/Sobel_operator)). *(Used in the texture pipeline's Sobel normal derivation, `scripts/texture/derive-pbr.mjs`. Cited as unpublished because it is.)*

### Companion open-source projects (for reference, not code derivation)

- **[Arbaro](https://arbaro.sourceforge.net/)** — Java, GPL, faithful Weber–Penn implementation with per-species XML param files. Read-only reference for the tree algorithm SeedRock deliberately diverges from. [GitHub mirror](https://github.com/wdiestel/arbaro).
- **[ez-tree](https://github.com/dgreenheck/ez-tree)** (`@dgreenheck/ez-tree`, MIT) — Three.js Weber–Penn library, the closest analogue to SeedThree and the reference SeedThree's docs cite.
- **[SeedThree](https://github.com/SkyeShark/SeedThree)** — the sibling project that inspired SeedRock; same RNG pattern, same cross-agent (coding + image) workflow, same derive-PBR approach, but a parametric-tree generator rather than a rock generator.
