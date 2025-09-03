# Lagori (Seven Stones) — Vite + React + TypeScript

This project reconstructs your Slider.ai export into a standard Vite setup so you can run it locally.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Notes

- Your original project was missing `scripts/build.mjs`. This setup replaces it with Vite.
- If imports reference paths like `src/components/...`, they now live at `src/components/...` (flattened).
- If you see import errors, search for `from "src/` and change to relative (e.g., `from "@/components/..."`). The tsconfig path alias `@/*` is configured.
