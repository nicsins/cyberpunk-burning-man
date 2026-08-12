# Cyberpunk Burning Man — Playable 3D Game World

**An actual playable interactive 3D environment** of a cyberpunk Burning Man festival (Black Rock City 2077).

## Play as Dragon or Panda

- Choose your avatar on the title screen (or switch with keys 1 / 2)
- Free-roam first-person exploration of the Playa
- Approach **The Man** (cybernetic neon effigy) and press **E** for lore
- Talk to **NPCs** (neon burners) scattered around
- Art cars circle the outer ring, floating holographic pyramids, fiber-optic light forests
- Dust storms, stars, neon point lights, minimap

## Controls
- **WASD** / Arrows — move
- **Mouse** — look (click canvas to lock pointer)
- **E** — interact / talk
- **Space** — jump
- **1** / **2** — switch Dragon / Panda
- **Esc** — unlock mouse / close dialogue

## Run Locally
```bash
cd cyberpunk-burning-man-game
python3 -m http.server 8765
# open http://localhost:8765
```
(Requires modern browser; Three.js via CDN)

## Assets
- Custom AI-generated cyberpunk dragon & panda avatars
- Playa ground texture
- NPC burner character
- Concept art for the world

## Tech
Three.js r160, PointerLockControls, procedural neon installations, particle dust, sprite characters.

Built for Dragon & Panda showcase — radical self-expression in the digital desert.

Repo: https://github.com/nicsins/cyberpunk-burning-man

To complete assets, clone and add the PNGs/JPGs from the generation session, or run the full local package in artifacts.
