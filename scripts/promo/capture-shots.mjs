#!/usr/bin/env node
/**
 * Batch-capture demo screenshots via opencli browser bridge.
 *
 * Drives the live dev server (http://localhost:5390) through curated deep links,
 * waits for WebGPU to render, and saves PNGs at 16:9 and 1:1.
 *
 * Output: promo/shots/<name>.16x9.png  and  <name>.1x1.png
 *
 * Run:  node scripts/promo/capture-shots.mjs
 *
 * Prereqs:
 *   - pnpm dev running on :5390
 *   - opencli browser bridge connected (run `opencli doctor` to verify)
 *
 * NOTE: This automates *material generation* (screenshots for promo), NOT posting.
 *       Publishing to social platforms is left to the human — by design, since
 *       automated posting violates Twitter/Reddit/HN TOS and risks account bans.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { resolve } from "node:path";

const SESSION = "seedrock";
const BASE = "http://localhost:5390";
const OUT_DIR = resolve("promo/shots");
const WAIT_MS = 4500; // time given to WebGPU render after ready signal

mkdirSync(OUT_DIR, { recursive: true });

/** Curated deep links — picked for visual variety + the species README already showcases. */
const SCENES = [
  // (a) Species carousel — each species in its hero config, living scene, PBR.
  { name: "granite",    url: "/?species=granite&seed=42&scene=living&moss=0.15" },
  { name: "sandstone",  url: "/?species=sandstone&seed=117&scene=living" },
  { name: "basalt",     url: "/?species=basalt&seed=88&scene=living" },
  { name: "limestone",  url: "/?species=limestone&seed=204&scene=living&moss=0.10" },
  { name: "volcanic",   url: "/?species=volcanic&seed=13&scene=living" },
  { name: "glacial",    url: "/?species=glacial&seed=3310&scene=living&moss=0.30" },
  { name: "river_cobble", url: "/?species=riverCobble&seed=77&scene=living&moss=0.20" },
  { name: "karst",      url: "/?species=karst&seed=3310&scene=living&moss=0.18" },
  { name: "schist",     url: "/?species=schist&seed=256&scene=living&moss=0.12" },
  { name: "slate",      url: "/?species=slate&seed=512&scene=living&moss=0.05" },
  { name: "marble",     url: "/?species=marble&seed=200&scene=living" },
  { name: "obsidian",   url: "/?species=obsidian&seed=13&scene=living" },
  { name: "crystal",    url: "/?species=crystal&seed=88&scene=living" },
  { name: "ore",        url: "/?species=ore&seed=64&scene=living" },
  { name: "ice",        url: "/?species=ice&seed=3310&scene=living&moss=0.10" },
  // (b) Three-style comparison on the same seed — the "one seed, three looks" hook.
  { name: "style_pbr",     url: "/?species=granite&seed=42&scene=single&style=pbr" },
  { name: "style_lowpoly", url: "/?species=granite&seed=42&scene=single&style=lowpoly" },
  { name: "style_toon",    url: "/?species=granite&seed=42&scene=single&style=toon" },
];

const RATIO_W = { "16x9": 1600, "1x1": 1200 };
const RATIO_H = { "16x9": 900,  "1x1": 1200 };

function run(args) {
  return execFileSync("opencli", ["browser", SESSION, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function checkDevServer() {
  try {
    execFileSync("curl", ["-sf", "--max-time", "3", BASE + "/"], { stdio: "pipe" });
  } catch (e) {
    const msg = e.stderr?.toString?.() || e.message || String(e);
    throw new Error(
      `Dev server not reachable at ${BASE} — run: pnpm dev\n  ${msg.trim()}`
    );
  }
}

function capture(name, urlPath, ratio) {
  const out = resolve(OUT_DIR, `${name}.${ratio}.png`);
  console.log(`  → ${name} [${ratio}]`);
  // open the deep link; bridge returns JSON
  run(["open", BASE + urlPath]);
  // poll until the app signals ready and the canvas has a non-trivial size
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const raw = run(["eval",
        "JSON.stringify({ready: window.__SEEDROCK_READY===true,canvas:(document.querySelector('canvas')?.width||0)})"]);
      const state = JSON.parse(raw.trim());
      if (state.ready && state.canvas > 0 && state.canvas !== 300) {
        ready = true;
        break;
      }
    } catch (e) {
      console.warn(`    poll ${i + 1}/30 failed for ${name}: ${e.message}`);
    }
    sleep(200);
  }
  if (!ready) console.warn(`    ! scene not ready for ${name}, capturing anyway`);
  sleep(WAIT_MS);
  // capture at requested viewport
  const tmp = `/tmp/sr-${name}-${ratio}.png`;
  run(["screenshot", "--width", String(RATIO_W[ratio]),
       "--height", String(RATIO_H[ratio]), tmp]);
  // move into project
  if (existsSync(tmp)) {
    renameSync(tmp, out);
    return out;
  }
  throw new Error(`screenshot not produced for ${name} ${ratio}`);
}

function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

// ---- main ----
console.log("SeedRock promo capture — driving opencli browser bridge");
console.log(`session=${SESSION}  base=${BASE}  out=${OUT_DIR}`);
checkDevServer();
console.log(`dev server OK at ${BASE}`);
console.log(`${SCENES.length} scenes × 2 ratios = ${SCENES.length * 2} shots\n`);

let ok = 0, fail = 0;
for (const { name, url } of SCENES) {
  for (const ratio of ["16x9", "1x1"]) {
    try {
      capture(name, url, ratio);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${name} ${ratio}: ${e.message}`);
      fail++;
    }
  }
}
console.log(`\nDone. ok=${ok} fail=${fail}  → ${OUT_DIR}`);
