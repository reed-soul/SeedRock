# SeedRock promo materials

This folder holds everything needed to promote SeedRock. **The publishing step
is intentionally left manual** — automated posting to Twitter/Reddit/HN violates
their TOS and risks account bans. What's automated here is the boring part:
capturing screenshots and stitching them into video/GIF assets.

## What's here

```
promo/
├── README.md                         ← you are here
├── COPY.md                           ← copy-paste posts for each platform
├── shots/                            ← 36 raw screenshots (15 species × {16:9, 1:1} + 3 styles)
│   ├── karst.16x9.png  karst.1x1.png
│   └── ...
├── video/
│   └── seedrock-30s.mp4              ← MAIN ASSET: 30s 1920×1080 Ken Burns, 5 MB
└── social/
    ├── seedrock-twitter.gif          ← 6s 800px teaser (timeline autoplay)
    ├── seedrock-square.gif           ← 1:1 8-species slideshow (IG / 小红书)
    └── seedrock-styles.gif           ← PBR→low-poly→toon swap (tweet reply)
```

## Quickstart

Capture + video assume the dev server is running (`pnpm dev` → :5390) and the
opencli browser bridge is connected (`opencli doctor`).

```bash
pnpm promo:capture   # drive opencli → 36 screenshots into promo/shots/
pnpm promo:video     # ffmpeg → 30s mp4 + 3 GIFs (takes ~8 seconds)
```

Then open `COPY.md` and post, platform by platform, following the checklist at
the bottom of that file.

**Launch order (recommended):**

1. Confirm GitHub topics are set (already done on this repo).
2. Close issues #1–#8 (scaffold trackers — see COPY.md checklist).
3. Show HN (Tue–Thu 9–11 AM ET) with the live demo URL.
4. Same day or next: Reddit r/gamedev + Twitter/X thread with `promo/video/seedrock-30s.mp4`.
5. Chinese platforms (V2EX / 掘金) with the 中文 copy in COPY.md.
6. After a few days of feedback: awesome-list PRs / Product Hunt.

## Regenerating

If you add a species or change the hero shot, edit the `SCENES` array in
`scripts/promo/capture-shots.mjs` and re-run both commands. The build script
reads `promo/shots/*.png` by name, so name new shots accordingly.

## Why no auto-posting?

Three reasons, in order of how much they'd hurt you:

1. **TOS.** Twitter, Reddit, and HN all prohibit automated posting via browser
   automation. The penalty ranges from silent reach-collapse to permanent ban.
2. **Reach.** Algorithmically, tag-stuffed auto-posts rank lower than a single
   human-written post with a good demo video. The video is what carries this
   project — not posting volume.
3. **It's unnecessary.** With copy + media prepped, manual posting to 5
   platforms takes under 5 minutes and lands in the "looks like a real person"
   bucket on every platform.
