# ANIK Block Racers — Samsung Galaxy Edition (v1.1)

A **real 3D** voxel kart-racing game, adapted from Sprint 1 for modern Samsung Galaxy phones, tablets and other recent Android devices. Built with React 19, React Three Fiber, Three.js and Rapier, using the original Higgsfield 3D Jutsu Voxel Valley GLB asset scene.

**Delivery:** ready-to-build source code + installable PWA configuration. This repository is not an Android `.apk`, `.aab`, or a signed Play Store release. To install it on a Galaxy home screen, first build and host the site over HTTPS.

## What changed for Samsung

- Landscape-first screen layout using dynamic viewport units, cutout/safe-area padding, oversized two-thumb controls and a persistent Start button.
- Touch and mouse/keyboard support; simultaneous left/right steering + acceleration, brake/reverse and dedicated DRIFT button, with per-pointer capture and automatic release on cancellation, blur and page hide.
- Samsung graphics menu: Auto, Eco, Balanced and High. Auto chooses conservatively from available Android device memory/CPU hints; Eco renders at 0.8× DPR without shadow maps and High at up to 1.35× on touch screens with shadows.
- Pause automatically when the app is hidden; wake lock and short vibrations are used when supported and permitted by the browser. Fullscreen and landscape-lock requests are optional and may be denied without preventing play.
- Android install manifest with standalone/fullscreen display preferences, landscape preference, original launch icons, splash colors and a game shortcut.
- Generated PWA service worker caches versioned JS/CSS/HTML/icons and warms/caches the 3D GLB after the first network connection. Cached 3D assets can work offline on later launches **after successful download**; browser eviction or cleared storage can require internet again.
- GitHub Pages deployment workflow to avoid relying on the Vercel account where previous project creation was denied.

## Run the game locally (computer)

Requires Node.js 22+ and a recent browser with WebGL 2:

```bash
npm install
npm test
npm run dev
```

Visit the local Vite address, usually `http://localhost:5173`.

To produce the mobile-installable static website:

```bash
npm run build
npm run preview
```

The build generates `dist/index.html`, optimized JS/CSS chunks, `dist/manifest.webmanifest`, original launcher icons and `dist/sw.js`. HTTPS is required for installation on your phone (localhost is an exception for testing on the same device). Upload **the contents of `dist/`** to a static HTTPS web host.

## Publish for Samsung with GitHub Pages

A complete build/deploy workflow is included under `.github/workflows/pages.yml`.

1. Create a new GitHub repository and upload/push the **contents of this project folder** onto its `main` branch (not the ZIP itself).
2. In the repository, go to **Settings → Pages** and choose **GitHub Actions** as the build/deployment source.
3. The included workflow installs dependencies, runs 21 source-level checks, generates the game bundle and PWA service worker, and publishes the `dist/` folder. If Pages was configured after the first push, re-run the workflow from the Actions tab.
4. Open your actual `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/` URL in Samsung Internet or Chrome. The URL is an illustration — use the real link returned by GitHub Actions.

The build automatically uses the repository's GitHub Pages path; deploying normally to Vercel/Netlify uses root `/` paths.

## Install on a Samsung Galaxy phone

1. Open your hosted **HTTPS** game URL on the phone with **Samsung Internet** or **Chrome**.
2. In Samsung Internet, use the install icon or browser menu → **Install app / Add page to Apps screen** (wording varies by browser version). In Chrome, use menu → **Install app / Add to Home screen**.
3. Launch **ANIK Racers** from the Apps screen or home screen, rotate your phone horizontally and tap **START RACE**.
4. Use **← / →** to steer; hold **GAS** to accelerate; **↓** to brake/reverse; hold **DRIFT** while steering for tighter turns. Use the upper-right **gear** for graphics preferences, fullscreen, vibration and installation help.
5. The first play needs internet for the Higgsfield 3D asset. Later offline launches are supported when the browser has successfully cached the game, assets and app shell.

For a computer preview on the same Wi-Fi, start `npm run dev` on the computer and open `http://COMPUTER-LAN-IP:5173` on the phone. This tests touch gameplay, but installability and some device APIs require HTTPS. Allow the development port through your local firewall only on trusted networks.

## Desktop controls

| Keyboard | Function |
| --- | --- |
| W or ↑ | Accelerate |
| S or ↓ | Brake / reverse |
| A or ← | Steer left |
| D or → | Steer right |
| Space | Drift |
| C | Chase / aerial camera |
| P or Esc | Pause / resume |
| R | Restart |
| Enter | Start |

Three laps require checkpoints 1 and 2 **in order** before crossing the finish gate. Coins, boosts, track barriers and collision volumes are retained from Sprint 1.

## Assets

The game uses the original Higgsfield GLB:

https://higgsfield.ai/3d-jutsu/6e4c8faf-89eb-4667-a05b-5762ab96b85a

The 3D scene is loaded from a publicly accessible Higgsfield asset CDN over HTTPS. The GLB is **not included in this source ZIP**, because it is cached from its remote source. For an entirely self-hosted site, obtain `ANIK_Block_Racers.glb` from the separately delivered original Higgsfield asset ZIP, put it in `public/assets/`, change `MODEL_URL` in `src/game/World.jsx` to `import.meta.env.BASE_URL + 'assets/ANIK_Block_Racers.glb'`, and rebuild.

## QA and limits

- **PASS** — 21 automated Node tests: 11 race/physics tests + 10 Samsung touch/quality/install checks.
- **PASS** — React JSX syntax parsed with TypeScript; service worker generation and syntax checked with Node.
- **PASS** — simulated mobile CSS layout and button visibility on 915×412, 780×330, 960×440, 412×915 and 360×740 screens; introduction and settings actions visible.
- **NOT RUN HERE** — a complete `npm run build`, because dependencies were unavailable in the isolated environment's offline npm cache. The GitHub Actions workflow performs the full build in the connected environment.
- **NOT VERIFIED** — physical Samsung Galaxy hardware testing, measured FPS, battery impact, offline device launch, Samsung Internet install, and Play Store/APK signing.
- **NOT DEPLOYED** — no public game URL was created in this run. The previously connected Vercel account refused project creation (HTTP 403), so GitHub Pages is prepared as an alternative.

This is an original block-inspired game, **not officially affiliated with Minecraft, Mojang or Samsung**.
