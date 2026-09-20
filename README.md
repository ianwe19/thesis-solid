# Thesis Solid

A bold, interactive, and narrative single-page website for my BFA thesis in Graphic Design.

Built with React 19, TypeScript, Vite, Tailwind CSS v4, and Three.js via React Three Fiber.

## Getting started

```bash
npm install
npm run dev # start the dev server at http://localhost:5173
```

## Scripts

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start the Vite dev server with HMR            |
| `npm run build`   | Type-check, then build for production to `dist/` |
| `npm run preview` | Serve the production build locally            |
| `npm run lint`    | Run ESLint over the project                   |

## Project structure

```
src/
├── sections/
│   ├── 01hero/    # DOM + 3D for section
│   ├── 02second/  # Ditto
├── components/
│   └── ui/        # shared pieces reused across sections (nav, buttons…)
├── assets/        # Images and other assets imported by code
├── App.tsx        # Page composition
└── main.tsx       # Entry point

public/
└── models/        # GLTF models served as-is (e.g. bulb_test.glb)
```

## Stack

- **React 19 + TypeScript** — UI and app logic
- **Vite 8** — dev server, HMR, production builds
- **Tailwind CSS v4** — styling via the `@tailwindcss/vite` plugin
- **Three.js + @react-three/fiber + drei** — 3D scenes
- **Staged for later:** GSAP, Framer Motion, Lenis (smooth scroll), Zustand, @react-three/postprocessing
