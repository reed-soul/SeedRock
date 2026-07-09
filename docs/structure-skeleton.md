# Structure Skeleton — Implemented

> **Status: implemented + LOD reuse.** The four form factories (`boulder`,
> `columnar`, `slate`, `crystal`) produce a `StructureGraph` before meshing.
> `buildRockLOD` builds the graph **once** and remeshes it at each LOD detail
> (`meshRockFromStructure`) — the SeedThree `stems[]` pattern. Gated by
> byte-for-byte regression tests at full detail plus
> [`tests/lod-reuse.test.js`](../tests/lod-reuse.test.js).
>
> References here re-use citations already verified in `generation-design.md`
> (Weber–Penn, Goehring, Culling, Worley, Domokos–Gibbons) — see that file's
> [References](generation-design.md#references) for URLs.

## What landed

| Form | Graph schema | Implementation |
|---|---|---|
| **boulder** | displacement **field** — origin + stretch/squash + noise params; mesher samples at any icosahedron detail | [`src/generator/structure/boulder.js`](../src/generator/structure/boulder.js) |
| **columnar** | joint set — hex close-pack column topology (centre, height, radius, tilt); radial segments scale with detail | [`src/generator/structure/columnar.js`](../src/generator/structure/columnar.js) |
| **slate** | foliation planes — stack of slab footprints; box segments scale with detail | [`src/generator/structure/slate.js`](../src/generator/structure/slate.js) |
| **crystal** | nucleation pattern — central + satellite shards; radial sides scale with detail | [`src/generator/structure/crystal.js`](../src/generator/structure/crystal.js) |

Dispatch: [`src/generator/structure/graph.js`](../src/generator/structure/graph.js)
(`buildStructureGraph` / `meshStructureGraph`). [`mesh.js`](../src/generator/mesh.js)
exposes `buildRockStructure` + `meshRockFromStructure` so
[`lod.js`](../src/generator/lod.js) remeshes one graph at full / reduced /
impostor detail. `generateRockGeometry` keeps its public signature.

## Regression gate

[`tests/structure.test.js`](../tests/structure.test.js) compares the meshed
output of all four forms against pre-refactor baselines in
[`tests/golden/`](../tests/golden/) (captured by
[`scripts/capture-baseline.mjs`](../scripts/capture-baseline.mjs)) at **8-decimal
vertex precision**. All four pass — the refactor is byte-identical to the legacy
implementation for the same `(species, seed)`.

[`tests/forms.test.js`](../tests/forms.test.js) keeps its original bbox/determinism
assertions via the [`forms/`](../src/generator/forms/) compatibility shims, which
now delegate to `structure/`.

## Why a structure skeleton?

The clearest architectural gap vs. SeedThree is the **absence of a topology-first
intermediate representation**. SeedThree generates `stems[]` (points / radii /
orients / winds — pure structure) and *then* meshes them, so LOD, wind, export
all reuse one skeleton ([branch-mesh.js in SeedThree](https://github.com/SkyeShark/SeedThree/blob/master/src/core/branch-mesh.js)).

SeedRock currently goes **primitive → geometry** in one step for each form:

```
boulder:   IcosahedronGeometry → displaceRadial()        (noise drives shape)
columnar:  CylinderGeometry[] hex-pack → merge            (placement is structure)
slate:     BoxGeometry[] stack → merge                     (layering is structure)
crystal:   ConeGeometry central + satellites → merge       (radiation is structure)
```

Only **boulder** uses its noise as the primary shape driver. The other three bake
their *structure* (joint topology, foliation planes, nucleation pattern) directly
into `CylinderGeometry`/`BoxGeometry`/`ConeGeometry` parameters at construction
time. There is no shared "structure graph" the mesher consumes.

This matters for three reasons:

1. **LOD can't reuse one skeleton.** SeedThree meshes the same `stems[]` at
   multiple cylinder resolutions. SeedRock's LODs rebuild geometry from scratch.
2. **Structure is implicit, not examinable.** A columnar cluster's joint network
   is invisible as data — it only exists as the byproduct of where cylinders were
   placed. You cannot query "how many columns" or "what's the spacing" without
   reverse-engineering the merged mesh.
3. **The structure can't evolve separately from the mesh.** Want to grow joints
   from a cracking front ([Goehring, Morris & Lin 2006][gml]) rather than hand-place
   prisms? You'd have to rewrite the mesher too.

[gml]: https://link.aps.org/doi/10.1103/PhysRevE.74.036115

## Proposed layering

```
                 ┌─────────────────────────┐
   preset + ───▶ │  StructureGraph builder │  ← per-form, pure data
    seed         │  (Phase 5, NEW)         │     (no triangles)
                 └────────────┬────────────┘
                              │  StructureGraph { nodes / columns / slabs / shards }
                              ▼
                 ┌─────────────────────────┐
                 │  Mesher                 │  ← shared, consumes any graph
                 │  (existing geometry     │     (emits triangles)
                 │   code, refactored)     │
                 └────────────┬────────────┘
                              │  BufferGeometry
                              ▼
                 ┌─────────────────────────┐
                 │  Erosion passes         │  ← unchanged
                 └─────────────────────────┘
```

The StructureGraph is the rock analogue of SeedThree's `stems[]`: pure topology
and per-element geometry attributes, **no triangles**. The mesher turns it into a
`BufferGeometry` at any LOD; erosion runs on the mesh as today.

## Schema (per form)

A `StructureGraph` is a tagged union. Each form produces one variant. All variants
share a header.

```ts
interface StructureGraph {
  form: 'boulder' | 'columnar' | 'slate' | 'crystal';
  seed: number;            // the (species, seed) that produced this graph
  species: string;
  // Form-specific payload (exactly one of the below):
  boulder?:  BoulderGraph;
  columnar?: ColumnarGraph;
  slate?:    SlateGraph;
  crystal?:  CrystalGraph;
}
```

### `BoulderGraph` — displacement field

The boulder's "structure" is its **displacement field**: origin, stretch/squash,
and the noise parameters the radial displacer samples. The graph does **not**
store per-vertex samples (that would defeat LOD). The mesher re-evaluates the
seeded noise at whatever icosahedron `detail` the LOD demands.

```ts
interface BoulderGraph {
  origin: [number, number, number];
  baseRadius: number;
  stretch: [number, number, number];
  squash: number;
  detail: number;          // build-time detail (full LOD)
  field: {
    scale: number;
    offset: [number, number, number];
    octaves: number;
    lacunarity: number;
    gain: number;
    amplitude: number;
    microAmplitude: number;
    ridged: boolean;       // fBm vs ridged multifractal
  };
  // Live sampler from the (species, seed) noise table — kept on the graph so
  // remeshing does not reconstruct the permutation.
  noise: Noise3D;
}
```

**LOD** ([boulder.js](../src/generator/structure/boulder.js)): `meshBoulder(graph,
{ detail })` builds a fresh icosahedron at the requested detail and samples
`graph.field` per vertex. Same field, fewer verts at distance.

### `ColumnarGraph` — joint set

The structure is the **column topology**: where each hex prism sits, how tall it
is, how it leans. Today this is computed inside `buildColumnar` and immediately
turned into `CylinderGeometry`. The graph exposes it.

```ts
interface ColumnarGraph {
  columns: Array<{
    center: [number, number, number];   // XZ position (y = 0 base)
    height: number;
    radius: number;
    tilt: [number, number, number];     // Euler-angle lean
  }>;
  packMode: 'hex-close';                // documents the placement rule
}
```

**Migration** ([columnar.js](../src/generator/forms/columnar.js)): split
`buildColumnar` into `buildColumnarGraph(shape, rng)` (returns the graph — the hex
close-pack loop moves here, unchanged) + the mesher's `meshColumnar(graph, { detail })`
which creates the cylinders from the graph. LOD varies cylinder radial segments
via `detail`; the topology is stable.

**Aspirational** (not in the initial schema): grow the joint network from a
cracking-front simulation rather than hand-placing the hex pack — the physics in
[Goehring, Morris & Lin 2006](https://link.aps.org/doi/10.1103/PhysRevE.74.036115)
/ [Goehring 2009](https://ar5iv.labs.arxiv.org/html/0904.4055). Marked future.

### `SlateGraph` — foliation planes

The structure is the **layer stack**: each slab's footprint, position, and
orientation. Foliation is a tectonic fabric ([ETH Zurich structural geology
notes](https://www.files.ethz.ch/structuralgeology/jpb/files/english/9foliation.pdf);
[PSGT9](https://psgt.earth.lsa.umich.edu/chapter/9/fabrics.html)), so the schema
uses foliation terms.

```ts
interface SlateGraph {
  slabs: Array<{
    center: [number, number, number];
    size: [number, number, number];     // width, thickness, depth
    rotation: [number, number, number]; // foliation-plane dip / strike
  }>;
  foliationDip: number;                 // dominant dip angle (radians)
}
```

**Migration** ([slate.js](../src/generator/forms/slate.js)): `buildSlate` returns
a `SlateGraph`; the mesher creates `BoxGeometry` per slab from the graph. The
layer-count and per-layer shrink move into the graph builder; the mesher is dumb.

### `CrystalGraph` — nucleation pattern

The structure is the **nucleation pattern**: where each crystal seeded and what
habit it grew. Two builders share the same `shards[]` schema and mesher:

| `shape.nucleation` | Placement | Notes |
|---|---|---|
| `'fan'` (default if unset) | Uniform angular ring + jitter | Legacy path; golden-baseline gate |
| `'worley'` | [Worley 1996](https://dl.acm.org/doi/10.1145/237170.237267) cellular feature points in a disk, thinned for spacing | Default for `crystal` / `ice` species |

```ts
interface CrystalGraph {
  shards: Array<{
    base: [number, number, number];     // nucleation point (stored as `pos`)
    direction: [number, number, number]; // growth axis (unit, stored as `dir`)
    length: number;                      // stored as `h`
    radius: number;                      // stored as `r`
    facets: number;                      // stored as `sides` — 4 = shard, 6 = hex
  }>;
  habit: 'radiating' | 'drusy' | 'geode';
  nucleation: 'fan' | 'worley';
}
```

**Worley path** ([worley.js](../src/core/worley.js) + [crystal.js](../src/generator/structure/crystal.js)):
`shape.nucleationDensity` controls lattice fineness. Feature points are collected
in a disk, nearest-first, then Poisson-thinned so satellites keep a minimum
separation. Growth axes radiate from the cluster origin through each site.
The mesher is unchanged — it only reads `shards[]`.

## How the mesher consumes it

The mesher becomes a single dispatch:

```js
function meshStructureGraph(graph, { detail, style }) {
  switch (graph.form) {
    case 'boulder':  return meshBoulder(graph, { detail, style });
    case 'columnar': return meshColumnar(graph, { detail });
    case 'slate':    return meshSlate(graph);
    case 'crystal':  return meshCrystal(graph);
  }
}
```

Each `meshXxx` is the geometry-creation half of the current `buildXxx`, refactored
to read from the graph instead of constructing parameters inline. The result
replaces the `geo` returned by today's factories; `applyErosion` and the rest of
[mesh.js](../src/generator/mesh.js) work unchanged because they operate on a
`BufferGeometry`.

## LOD benefits

With a StructureGraph, LOD becomes:

- **boulder** — sample `graph.field` at lower icosahedron `detail`. Same field,
  fewer verts.
- **columnar** — same joint centres; fewer cylinder radial segments
  (`columnarRadialSegments`: 6 → 5 → 4).
- **slate** — same slab footprints; fewer box segments
  (`slateSegmentsForDetail`).
- **crystal** — same nucleation pattern; fewer radial sides
  (`crystalRadialSides`: habit preserved at detail ≥ 3, then 4 → 3).

`buildRockLOD` calls `buildRockStructure` once, then `meshRockFromStructure` per
level with a fresh `erosionRng.clone()` so hydraulic erosion stays deterministic
per level without cross-talk.

This is exactly how SeedTree shares one `stems[]` skeleton across LOD levels.

## What the structure skeleton does NOT change

- **Erosion** still runs on the meshed `BufferGeometry` (thermal / hydraulic /
  edge-wear in [erosion.js](../src/generator/erosion.js)). The graph is
  pre-erosion; erosion stays a vertex-domain simulation.
- **Materials** (triplanar PBR / toon / lowpoly in
  [rock-material.js](../src/materials/rock-material.js)) consume the same
  attribute set. No UVs are introduced.
- **Export** ([glb.js](../src/export/glb.js)) consumes the meshed geometry
  unchanged.
- **Determinism** — the `(species, seed)` contract is preserved because the graph
  builders use the same `Rng` draw order as today's factories. A given
  `(species, seed)` produces the same `StructureGraph`, which meshes to the same
  geometry.

## Migration risk & sequencing

1. **Lowest risk: `slate` first.** It's the simplest graph (a list of slabs) and
   the current `buildSlate` is already almost a graph builder — the loop that
   computes per-layer size/offset just needs to emit records instead of
   `BoxGeometry`. Validate that the same seed produces byte-identical geometry
   before/after.
2. **`crystal` next** — similar story (central + satellites → shards array).
3. **`columnar`** — the hex-pack loop is more intricate, but still a clean split.
4. **`boulder` last** — it's the dominant form (10 species) and the "structure"
   (the noise field) is already LOD-friendly, so the gain is smallest and the
   risk highest. Defer until the other three prove the pattern.

Each migration is gated by a **seed-determinism test**: for every species × a
fixed seed list, the meshed geometry before and after must match (same vert
count, same bbox). The existing `forms.test.js` bounding-box assertions are the
seed for these tests.

## Out of scope (explicitly)

- Growing columnar joints from a cracking front (Goehring) — aspirational, not in
  the initial schema.
- Generalizing `thermalErode` from Y-axis-only to true 3D gradient transport
  (see [`generation-design.md` §3.1](generation-design.md#31-thermal-erosion--hillslope-diffusion)
  honest limitation) — orthogonal to this design; would happen in `erosion.js`.
- `reuse`-style in-place buffer rewriting to dodge WebGPU recompiles
  ([SeedTree's edit-freeze optimization](https://github.com/SkyeShark/SeedThree/blob/master/src/core/tree.js))
  — separate performance task; the graph makes it easier but doesn't require it.
