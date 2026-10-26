# Asset credits and licenses

## Camera feed

- **Asset:** warehouse aisle camera clip
- **Source:** Pexels, video ID **20591258**
- **Creator:** **SHUBHAM MALAV**
- **Link:** https://www.pexels.com/video/20591258/
- **License:** Pexels License — https://www.pexels.com/license/
- **File:** `apps/web/public/media/camera-feed.mp4` (18 s, 1280×720, 24 fps, H.264) and `apps/web/public/media/camera-poster.jpg`
- **Changes:** trimmed/transcoded for web delivery and colour-graded in the UI. The clip is looped and treated as a simulated robot camera feed.

## Fonts

- **Inter Variable** by Rasmus Andersson.
- **License:** SIL Open Font License 1.1 — https://github.com/rsms/inter/blob/master/LICENSE.txt
- **Delivery:** self-hosted via `@fontsource-variable/inter` (no runtime CDN).

## Icons

- **Lucide** icon set.
- **License:** ISC — https://lucide.dev/license
- **Delivery:** `lucide-react` package.

## Map data

- `apps/web/public/map/insight-floor.pcd` is generated from the synthetic facility geometry in `packages/shared/src/floorplan.ts` by `scripts/generate-pcd.ts`.
- It does not contain data from a third-party point-cloud dataset.
- The navigation graph, zones, goals, and PCD share the same coordinate system.

## Reference design

- The Insight.IO reference GIF and assignment brief were supplied by ERIC Robotics for this evaluation.
- They are local reference material and are not redistributed as part of the application build.

## Demo media

- `docs/demo.gif`, `docs/demo.mp4`, `docs/screenshots/*.webp`, and the poster are screen recordings/screenshots of this implementation.
- No third-party music or stock footage is used in the demo beyond the camera clip above.

## Libraries

This project uses open-source packages declared in the workspace `package.json` files, including React, Vite, Tailwind CSS, Motion, Three.js, Zustand, Fastify, Zod, Vitest, Playwright, ESLint, Prettier, and tsup. Their licenses remain with their respective authors and are available in `node_modules/<package>/LICENSE` after installation.
