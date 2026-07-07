# Structure Skeleton — Design (not yet implemented)

> **Status: design only.** This document specifies a `StructureGraph` intermediate
> representation that the four form factories would produce before meshing. It is
> **not implemented** — the current forms go straight primitive → geometry. This is
> the Phase 5 roadmap entry from [`generation-design.md`](generation-design.md) §
> "Future: structure skeleton", expanded to a concrete schema.
>
> References here re-use citations already verified in `generation-design.md`
> (Weber–Penn, Goehring, Culling, Worley, Domokos–Gibbons) — see that file's
> [References](generation-design.md#references) for URLs.

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

### `BoulderGraph` — displacement nodes

The boulder's "structure" is its **displacement field**: a set of noise feature
points that the radial displacer samples. Today this is implicit (the noise
function itself). The graph makes it explicit so the same field can be sampled at
any mesh resolution.

```ts
interface BoulderGraph {
  origin: [number, number, number];
  baseRadius: number;
  stretch: [number, number, number];
  squash: number;
  // The noise field is identified by its seed + params; the graph does NOT
  // store samples (that would defeat LOD). The mesher re-evaluates the seeded
  // noise at whatever vertex density the LOD demands.
  field: {
    seed: number;          // permutation-table seed (from Rng)
    scale: number;
    offset: [number, number, number];
    octaves: number;
    lacunarity: number;
    gain: number;
    amplitude: number;
    microAmplitude: number;
    ridged: boolean;       // fBm vs ridged multifractal
  };
}
```

**Migration** ([boulder.js](../src/generator/forms/boulder.js)): `buildBoulder`
returns a `BoulderGraph` instead of a geometry. `displaceRadial` becomes a method
on the mesher that takes `(geo, graph)` and samples `graph.field`. The seeded
noise is reconstructed from `graph.field.seed` so the same graph reproduces at any
LOD — same contract as today, just reified.

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
habit it grew. Today this is the central cone + satellite fan in `buildCrystal`.
[Worley 1996](https://dl.acm.org/doi/10.1145/237170.237267) cellular noise is the
natural way to seed the nucleation points (candidate for the graph builder).

```ts
interface CrystalGraph {
  shards: Array<{
    base: [number, number, number];     // nucleation point
    direction: [number, number, number]; // growth axis (unit)
    length: number;
    radius: number;
    facets: number;                      // 4 = shard, 6 = hex prism habit
  }>;
  habit: 'radiating' | 'drusy' | 'geode';  // drives shard placement
}
```

**Migration** ([crystal.js](../src/generator/forms/crystal.js)): `buildCrystal`
returns a `CrystalGraph`; the mesher creates `ConeGeometry` per shard. The central
+ satellite pattern moves into the graph builder. A future Worley-seeded
nucleation layer would slot into the builder without touching the mesher.

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
  fewer verts. (Already true today, but now the field is explicit data.)
- **columnar/slate/crystal** — lower per-element geometry resolution (fewer
  cylinder sides, fewer box segments) **without rebuilding the topology**. The
  cluster looks identical at distance, just lower-poly per element.

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
- Worley-seeded crystal nucleation — candidate, not in the initial schema.
- Generalizing `thermalErode` from Y-axis-only to true 3D gradient transport
  (see [`generation-design.md` §3.1](generation-design.md#31-thermal-erosion--hillslope-diffusion)
  honest limitation) — orthogonal to this design; would happen in `erosion.js`.
- `reuse`-style in-place buffer rewriting to dodge WebGPU recompiles
  ([SeedTree's edit-freeze optimization](https://github.com/SkyeShark/SeedThree/blob/master/src/core/tree.js))
  — separate performance task; the graph makes it easier but doesn't require it.
