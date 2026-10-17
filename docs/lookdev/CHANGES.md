# Look-dev pass: Cyberpunk Burning Man Ω (patch for Kiln)

> **DRAFT for Nic's OK.** Work is on a copy only: `panda-cyber/lookdev/cyberpunk-burning-man/`. Nothing has been committed, pushed or deployed, and `_src/` is untouched (`git status` there is clean). Built against `v2-art-direction.md` v2.1 and `palette.md`.
> All detail is procedural or code-side (canvas textures, shaders, instancing). No AI image generation and no new image files.

## Files
| File | Change |
|---|---|
| `game.js` | Surgical edits (+103 / −90 lines): lights, materials, palette remap, ground, sky, post chain, per-frame updates. Gameplay logic, quests and phases are unchanged. |
| `lookdev.js` | **New** (418 lines). Procedural look-dev module: palette and remap table, ground generators, sky and stars, env map, dust, glow pools, Man glow, set dressing, light pool, post chain. |
| `index.html` | Unchanged. It already maps `three/addons/` on unpkg, which is where the post-processing imports come from. |

Apply with `patch -p1 < lookdev.patch` from the game root, or copy the two files over.

## What changed
### Lighting (v2 §1.3)
- **74 PointLights + 3 directionals + ambient + hemi (79 lights) → 5 real lights:** 1 moon directional `#4b7caf` (the only shadow light: 1 cascade, 2048², PCF soft), 1 hemisphere (`#8d91ac` / `#837b76`), 1 Man light (`#30b0d0`), and a **LightPool of 2** point lights that move every 0.25 s to the 2 neon installations nearest the camera (station pads and art cars). The burn-phase blaze adds 1 (`#eb6e37`), for a peak of 6, under the 8 cap.
- Lights that were removed and what replaces them: 16 ambient neon → ground light pools. Art-car lights → moving underglow pools. Temple/station/NPC/ZPEG lights → emissive trims plus pools. About 28 item lights → an accent ring under **every** pickup (the v2 §3 pickup rule).
- All pools and rings are drawn as **2 InstancedMeshes plus 1 for cars** (an additive shader that fades into the fog). Pool brightness stays under the bloom threshold, so it reads as light on the ground, not glow.
- `scene.environment` = a **procedural dark night-playa PMREM** with cyan, violet and gold neon streaks, so the metals have something to reflect.

### Post (bloom carries the neon)
`RenderPass → UnrealBloomPass(strength 0.85, radius 0.55, threshold 0.9) → OutputPass (ACES, exposure 1.15) → palette grade`.
- Neon is HDR emissive (palette hex × 2.4–3.4), so only emissives cross 0.9 and bloom. Matte bodies don't.
- The grade pass, in display space, does four things: lifts blacks toward `#0c1329`; pulls chroma 16% toward the nearest of the 20 `palette.md` swatches while keeping luminance; adds a 0.32 vignette; and adds light grain, which also dithers the sky gradient.

### Sky and atmosphere
- **Sky dome shader:** gradient from `#06060d` at the zenith to `#0c1329` at the horizon, a `#423e79` haze band, faint **aurora curtains in violet `#7050b0` / frost `#4299bc`** (these replace the 5 flat aurora planes in green, pink and cyan), and a faint milky-way dust band.
- **Stars:** 3,200 round, twinkling points in ice, fur-white, violet and gold. About 3% are bright enough to bloom. They're centred on the camera and not fogged, replacing the 4,500 square, fogged Points.
- **Fog:** `FogExp2` at density 0.006 in the sky's horizon colour (`#0c1329` + haze), so the playa melts into the sky without a seam (it was `0x08001c` purple-black).
- **Dust:** 2,600 drifting motes (`#aba49c`) plus 260 large, soft low-haze sprites. They're **animated on the GPU**: wind plus a wrap-around box that follows the camera. This also removes the old per-frame CPU loop over 2,200 particles.
- **The Man:** an additive **light shaft** (an open cone with view-dependent falloff and slow upward streaks, cyan to violet). There's also a two-layer halo behind the effigy, a big cyan ground pool, and an HDR-boosted holo sprite so its highlights bloom.

### Playa ground
- `ground.jpg` stays as the albedo but at a larger tile (repeat 22 → 10, so the repetition shows less). It's multiplied by a **macro dust tint** in vertex colours on a 140×140 grid (dust highlight `#aba49c` / shadow `#4d4a69`), plus a darker scorch ring around the plinth.
- **Procedural tileable crack map (1024²):** periodic Voronoi at 2 scales, masked by noise so the crack network is broken and irregular, plus fbm grain and slight plate curl. It's turned into a **normal map** and an **ORM map** (R = AO in the cracks, G = roughness 0.74–0.94), repeated 35× (about 12 m per tile).
- **Tire tracks:** merged ribbon decals in 1 draw with a procedural chevron tread alpha. There are 7 art-car loops (two wheels each) on the art cars' orbit radii, plus 14 wandering bike tracks.

### PBR materials (v2 §1.1 two-tier rule: matte dusty bodies, thin glowing seams)
- A shared procedural **grime albedo** (fbm plus downward streaks and dust on the lower ~30%) and a **roughness-variation** map are used by `LOOK.pbr()`, along with an optional **emissive seam mask**.
- **Plinth:** Holo Steel `#122f41` (metal 0.85) with 3 cyan emissive trim rings. It's now 48 segments (was 24).
- **Man rings:** 8 rings alternating violet and cyan, the same rings as the v2 §4.1 overseer halo. **Core:** ice `#9bd9ed` instead of magenta.
- **Temple:** dust-brick base, playa-wood `#675447` pillars with **violet emissive seams**, a dark neon-glass roof (`#242949`) and bloomed violet edge lines.
- **Station pads:** scrap metal `#1c1c2b` plus an emissive ring in the station's role colour: ZPEG and Auction gold `#d09010`, x402 cyan (was green), Escrow violet (was magenta). Each pad also gets a ground pool and is a light-pool candidate.
- **Octahedra:** wireframe ones are bloomed palette neon. Solid ones are dark neon glass (low roughness, env reflections, faint emissive).
- **Domes:** violet `#7050b0` wireframe with bloom, plus a ground pool.
- **Collectibles:** dark glass with palette emissive. Gold rings for value items (`token-chip`, `zpeg-kit`, spark).
- **Fibre forest:** 70 meshes → **1 InstancedMesh**, with a dark base fading to a bright tip.

### Set dressing (instanced, about 6 draws in total)
- 19 **lamp posts** (merged pole, arm and base) on an Esplanade ring at r = 30 and a short avenue toward the Temple. Lamp heads are cyan, violet or gold, each with a ground pool.
- **Catenary cables** (one merged tube mesh) with 119 **string-light bulbs** in gold and ice, in 1 instanced draw.
- 40 **scrap-metal crates** in 8 clusters, some stacked. They use a procedural texture (gunmetal plates, rivets, edge wear `#66789f`, rust chips `#ce4531`, playa dust on the lower 30%) and a cyan emissive strip, cast shadows, and are 1 draw.
- An avoid-list keeps them off the plinth, the spawn point, the Temple and the 4 pads.

### Palette remap (v2 §1.3 table)
`LOOK.pal()` / `REMAP`:
- `0xff00ff`, `0xaa00ff`, `0xff00aa`, `0x8800ff` → violet `#7050b0`
- `0x00ffff`, `0x00aaff` → cyan `#30b0d0`
- `0xff6600` → fire `#eb6e37`; `0xff4400` → `#ce4531`
- `0xffff00`, `0xffaa00`, `0xff8800` → gold `#d09010`
- `0xff2200` → hostile `#d01010` (used only for the rogue-drone fallback; red stays sacred)
- **Removed hues:** green `0x00ff88` → ice `#9bd9ed`, lime `0x88ff00` → frost `#4299bc`, hot pink `0xff0088` → violet.

The arsonist tint is softened (`0xff6666` → `0xff9a9a`).

## Performance (headless Chrome, SwiftShader, 1280×720, same seeded layout)
| View | Main-pass draws before → after | Shadow draws | Post passes | Triangles before → after | Real lights before → after | FPS (SwiftShader) before → after |
|---|---|---|---|---|---|---|
| 1-hero | 133 → **103** | 12 | 15 | 11.4k → 77.9k | 79 → **5** | 3.3 → 2.6 |
| 2-man | 103 → **84** | 12 | 15 | 10.9k → 76.5k | 79 → **5** | 4.6 → 3.3 |
| 3-aerial | 202 → **145** | 12 | 15 | 12.2k → 78.1k | 79 → **5** | 2.9 → 3.0 |
| 4-playa | 66 → **50** | 12 | 15 | 0.8k → 59.1k | 79 → **5** | 2.3 → 2.5 |

- Every view is inside the budgets: ≤ 250 main draws (worst 145), ≤ 60 shadow draws (12), ≤ 600k tris (worst 78k), ≤ 8 real lights (5, or 6 during the burn).
- Most of the new triangles are the 140×140 ground grid (39k), which exists for the macro tint and can drop to 80×80 if needed.
- **FPS caveat:** SwiftShader rasterises on the CPU, so these numbers measure CPU fill rate, not GPU behaviour. The 15 fullscreen bloom and grade passes cost a lot there, and the 74 per-pixel lights they replace cost a lot too, so the two builds come out about even. On a real GPU the removal of 69 per-pixel point lights from the forward shader should dominate, but that is **unmeasured here**. Kiln should profile on an integrated GPU.
- Method: `tools/capture.mjs` (puppeteer-core plus `/usr/bin/google-chrome --use-angle=swiftshader`). It measures `renderer.info` for one full frame, then the main pass alone (shadow map frozen), then the shadow pass. `Math.random` is seeded in two streams, one for calls from `game.js` and one for everything else, so the world layout is identical in both builds. The harness appends a `window.__dbg` getter **at serve time only**; it isn't in the patch.

## Screenshots
`shots/before-*.png`, `shots/after-*.png`, stats JSON, and the side-by-side **`compare.png`**.

## Known gaps / notes for Kiln and Nic
- **Billboard art keeps its off-palette pixels:** the Man, the heroes and the NPCs are still billboard sprites, so magenta in `the_man.png` and the dragon wings `#8b2fa4` (still Nic's call) remain in the textures. The grade pass only nudges them.
- Sprites don't cast or receive moon shadows, and fixing that needs the v2 3D meshes. Shadow casters today: plinth, Temple, pads, lamp posts and crates.
- **Title screen and HUD CSS** still use `#f0f` / `#0ff` / `#0f8`. That's UI, not in this pass, and is noted for the UI restyle (v2 §5.2).
- Orange fibre poles and octahedra come from `0xff6600 → #eb6e37` per the v2 table. If fire should be reserved for actual fire, change that `REMAP` entry to violet or gold.
- Set dressing has no collision, the same as everything else in the current build.
- Startup cost: the ground and surface textures are generated on the main thread at load (about 0.3–0.6 s on a laptop, estimated). These could be pre-baked to KTX2 later (v2 §1.2).
- `composer.render(delta)` now replaces `renderer.render`. The resize handler also resizes the composer.

