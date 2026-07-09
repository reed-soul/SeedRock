# SeedRock — Promo Copy

All copy below is ready to paste. Each section names the platform, the media to attach, and the text.
**You do the posting** — this is the part that should stay human (and keeps your accounts safe).

Live demo: https://reed-soul.github.io/SeedRock/
Repo: https://github.com/reed-soul/SeedRock
Media folder: `promo/video/` and `promo/social/`

---

## 1. Hacker News — Show HN

**When:** Tue–Thu, 9–11 AM ET (= 9–11 PM Beijing time). Avoid Fri/Mon.
**Media:** none (HN text only) — put the demo link as the URL.
**Where:** https://news.ycombinator.com/submit → choose "Show HN"

**Title:**
```
Show HN: SeedRock – Open-source procedural rock & cliff generator (Three.js/WebGPU)
```

**Text:**
```
Hi HN. I've been building SeedRock, a fully procedural rock and cliff generator
that runs in the browser on WebGPU. Pick a species (granite, basalt, obsidian,
crystal, ice… 15 total), tune the parameters, and get a textured, erosion-
sculpted mesh you can drop into a scene or export to glTF.

Live demo (Chrome/Edge 113+): https://reed-soul.github.io/SeedRock/
Source: https://github.com/reed-soul/SeedRock

What it actually does under the hood:

- Four geometry primitives drive the silhouettes: boulder, columnar (hex-prism
  colonnades like real basalt), slate (foliated slabs), and crystal (radiating
  shard clusters).
- Every rock gets hydraulic + thermal erosion and edge-wear passes — thermal
  transport specifically runs along the true 3D gradient, not just the Y axis
  (this was a subtle bug to chase down).
- Three render styles on the same seed: PBR, flat-shaded low-poly, and toon
  (cel shading + ink outline). Useful because the same rock can go from a
  realistic cliff to a stylized game asset without regenerating geometry.
- PBR textures are 1024px AI-derived albedo (Gemini) with Sobel-derived
  normal/roughness/AO — so each species ships with a believable texture set
  without an artist in the loop.
- LOD chain + off-thread billboard impostor bake, and glTF export with the
  MSFT_lod extension and a separate _collider physics proxy so the exported
  GLB drops straight into Unity/Godot/Unreal.

I built it because procedural rock generation is one of those things that
sounds solved but in practice every game either ships hand-placed rocks or a
generic noise blob. The middle ground — believable, species-specific geology
that's reproducible from a seed and exportable — was missing.

It's MIT, open source, and I'd love feedback on the erosion math and the
WebGPU material pipeline in particular. What would make this useful in your
own projects?
```

**First comment (yours, immediately after posting):** the 30s video is great
as a top comment but HN doesn't host video — link the demo's examples gallery:
```
Gallery with one-click deep links per species:
https://reed-soul.github.io/SeedRock/examples.html
```

---

## 2. Reddit — r/gamedev and r/webdev

**When:** weekday morning US time, post on Tue/Wed for best reach.
**Rules:** check each subreddit's sidebar first — r/gamedev has "self-promotion" rules; don't post the same thing to more than 2 subs in a week.

### r/gamedev

**Title:** `I built an open-source procedural rock generator that exports to glTF with LODs + colliders`

**Body:**
```
I wanted rocks in my game that were believable and species-specific (real
basalt columns, foliated slate, radiating crystal clusters) without hand-
modelling each one — so I built SeedRock. It's browser-based (WebGPU),
MIT-licensed, and exports glTF with the MSFT_lod extension and a separate
physics collider proxy, so the output drops straight into Unity/Godot/Unreal.

[30-second demo video — same rock in PBR / low-poly / toon]

What's in it:
- 15 species across rocks, crystal clusters, and translucent ice
- hydraulic + thermal erosion passes on every rock
- 1024px PBR textures (AI albedo + Sobel-derived normal/roughness/AO)
- terrain scatter-painting — brush rocks onto terrain, they survive species
  changes and export with the scene
- LOD chain + billboard impostor bake

Live demo (Chrome/Edge 113+): https://reed-soul.github.io/SeedRock/
Source: https://github.com/reed-soul/SeedRock

The thing I'm proudest of: the same seed gives you three styles — realistic,
stylized low-poly, and toon — from the same geometry. So one generator serves
both a realism-focused and a stylized project.

Happy to answer questions about the erosion implementation or the export
pipeline. What rock types are people currently hand-modelling that I should
add next?
```
**Media:** attach `promo/video/seedrock-30s.mp4` (Reddit hosts video inline).

### r/webdev (or r/SideProject)

**Title:** `SeedRock – procedural rock generator running on WebGPU in the browser`
**Body:** shorter variant of the above, lean into the WebGPU + Three.js angle:
```
A side project I've been working on: a fully procedural rock & cliff generator
that runs in the browser on WebGPU (Three.js). No assets shipped — every mesh,
texture, and erosion scar is generated at runtime from a seed.

[30s demo video]

Live: https://reed-soul.github.io/SeedRock/
Code: https://github.com/reed-soul/SeedRock

Tech highlights for the web folks: WebGPU renderer, off-thread billboard
impostor baking, lil-gui control panel, glTF export with LOD extension,
1024px PBR textures derived from a single AI albedo per species via Sobel.

Curious what people think about building "real" 3D content tools on WebGPU vs
the old WebGL2 ceiling.
```
**Media:** `promo/video/seedrock-30s.mp4`

---

## 3. Twitter / X

**Media:** `promo/social/seedrock-twitter.gif` (672KB, autoplays in timeline).
**Hashtags:** keep to 2–3 — `#threejs #webgpu` is enough. Don't tag-spam.
**Optionally @mention:** `@threejs` (only if it genuinely showcases the lib).

### English thread

**Tweet 1 (hook, with GIF):**
```
Spent the last few weeks building SeedRock — an open-source procedural rock &
cliff generator that runs in the browser on WebGPU.

15 species, three render styles, hydraulic + thermal erosion, glTF export with
LODs + physics colliders.

Demo + source ↓
```
Append: `https://reed-soul.github.io/SeedRock/` and `https://github.com/reed-soul/SeedRock`

**Tweet 2 (reply, with `seedrock-styles.gif`):**
```
Same seed, three looks — PBR / low-poly / toon. The geometry doesn't
regenerate; only the material + shading swaps. One generator, realistic AND
stylized output.
```

**Tweet 3 (reply, link to a deep view):**
```
Each species has its own erosion profile and noise scales — real basalt
columns, foliated slate, radiating crystal clusters:

https://reed-soul.github.io/SeedRock/?species=basalt&seed=88&scene=living

MIT licensed. Would love to know what rock types to add next. 🪨
```

### 中文版（同图）

**推文 1（带 GIF）：**
```
最近做了 SeedRock —— 一个开源的程序化岩石/悬崖生成器，跑在浏览器的 WebGPU 上。

15 种岩石 + 水晶 + 冰，三种渲染风格，水力/热力侵蚀模拟，导出 glTF 自带 LOD 和物理碰撞体。

在线 demo + 源码 ↓
https://reed-soul.github.io/SeedRock/
https://github.com/reed-soul/SeedRock
```

**推文 2（带 styles GIF）：**
```
同一颗种子，三种风格：PBR / 低多边形 / 卡通。几何体不用重算，只换材质和着色。一个生成器，同时喂写实和风格化项目。
```

---

## 4. V2EX

**Where:** https://www.v2ex.com/?tab=creative → 分享创造
**Media:** V2EX 不直接托管视频，贴 demo 链接 + 一张 karst 截图 (`promo/shots/karst.16x9.png`)。

**标题：** `[分享创造] SeedRock —— 开源的程序化岩石生成器（WebGPU + Three.js）`

**正文：**
```
最近在做一个个人项目 SeedRock，想分享出来听听反馈。

一句话：在浏览器里（WebGPU）程序化生成岩石和悬崖，选个岩种、调调参数，就能得到带 PBR 纹理、被侵蚀过的 3D 网格，可以导出 glTF 直接用到 Unity/Godot/Unreal 里。

在线 demo（需要 Chrome/Edge 113+）：https://reed-soul.github.io/SeedRock/
源码（MIT）：https://github.com/reed-soul/SeedRock

几个我自己觉得有点意思的点：

- 四种几何原型驱动外形：漂砾、柱状（玄武岩那种六棱柱）、板状（片岩）、晶簇。不是单纯加噪声。
- 每块岩石都跑水力 + 热力 + 边缘磨损侵蚀。热力侵蚀这块踩了个坑：要沿真正的 3D 梯度输运物质，不能只沿 Y 轴，否则出来的石头看着不对。
- 同一颗种子可以切三种风格：写实 PBR、低多边形、卡通（cel + 描边）。几何体不重算，只换材质。
- PBR 纹理是 AI 出 albedo（Gemini），再用 Sobel 推导 normal/roughness/AO，省掉美术环节。
- 导出 glTF 带 MSFT_lod 扩展和单独的碰撞体代理，落地引擎开箱即用。

做这个的动机：程序化岩石听起来是个解决了的问题，但实际游戏里要么手动摆，要么就是一坨通用噪声。中间地带——有地质特征、按种子可复现、能导出——其实是缺的。

欢迎拍砖，尤其侵蚀算法和 WebGPU 材质管线。下一步想加社区提交的岩种预设。
```

---

## 5. 掘金

**标题：** `我用 WebGPU 在浏览器里造了一个程序化岩石生成器（Three.js，开源）`

**正文（结构同 V2EX，但技术细节可以再展开一点，掘金读者吃这套）：**

开头放 30s 视频（掘金支持外链视频，可上传到掘金自带图床或贴 bilibili 链接）。
然后用上面 V2EX 的正文，额外加一段"技术实现"小节：

```
## 技术实现要点

- 渲染：Three.js WebGPURenderer，三套材质（PBR / flat / toon ink-outline）共用同一几何体。
- 几何：StructureGraph 把每种形态建模成"节点图"——比如 boulder 是位移节点图，columnar 是节理集合，crystal 是成核图案。好处是物种参数直接映射到图节点。
- 侵蚀：hydraulic 按水量+沉积输运，thermal 沿 3D 梯度（不是 Y 轴）做 talus 坍塌，再加边缘磨损。
- 纹理：每物种一张 1024px AI albedo → Sobel 推法线 → 亮度推 roughness/AO。
- 导出：glTF + MSFT_lod，几何 LOD 命名 _LOD0…_LOD3，外加 _collider 物理代理。

代码都在 src/generator/、src/materials/、src/export/ 下，欢迎去看。
```
文末挂 demo + repo 链接，加标签：`WebGPU`、`Three.js`、`图形学`、`开源项目`、`前端`。

---

## 6. GitHub repo topics (done)

Topics are already set on the repo:

```
threejs  webgpu  procedural-generation  gamedev  rocks  gltf  pbr  three-js
graphics  noise  erosion  webgl  procedural  glb  threejs-webgpu
```

No action needed unless you want to add more.

---

## 7. Awesome-list PRs (long-tail, do after launch week)

Submit PRs to add SeedRock under the relevant category:

- `https://github.com/0xAxiome/awesome-threejs`
- `https://github.com/mikbry/awesome-webgpu`
- `https://github.com/zenparsing/awesome-procedural`
- `https://github.com/sindresorhus/awesome` → `awesome-gamedev`

PR template: "Hi, I'd like to add SeedRock — an open-source procedural rock generator on WebGPU. [demo link]. Happy to make any changes." Keep PR descriptions short.

---

## Publishing checklist

- [x] GitHub topics added (section 6 — already on the repo)
- [ ] Close stale scaffold issues #1–#8 (early Phase tracking; all shipped in 1.3+)
- [ ] HN: post Tue–Thu 9–11 AM ET
- [ ] Reddit r/gamedev (with mp4)
- [ ] Reddit r/webdev OR r/SideProject (with mp4) — not same day as r/gamedev
- [ ] Twitter: English thread + 中文 thread (with GIFs)
- [ ] V2EX 分享创造
- [ ] 掘金长文
- [ ] (optional) Awesome-list PRs
- [ ] (optional) Product Hunt — pick a Tue or Wed, prepare a 60s version of the video

### Manual issue cleanup (owner)

Issues #1–#8 are early scaffold trackers (noise mesh, erosion, PBR, GUI, export,
species). They are all implemented. Close them with a short note pointing at the
README roadmap so newcomers don't think the project is unfinished.
