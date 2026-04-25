# Agent Guide

## Project Overview

Paper Squeeze — browser-based local compression for PDF, PPTX, and DOCX. Pure static site (Cloudflare Pages). All processing happens in a Web Worker via WASM; nothing is uploaded to a server.

## Tech Stack

- Vite (build)
- Vanilla JS (ES modules, no framework)
- Cloudflare Pages + Wrangler
- WASM: Ghostscript, QPDF, MozJPEG, OxiPNG
- JSZip for Office documents

## Commands

| Command | Purpose |
|---|---|
| `npm install` | Install deps |
| `npm run dev` | Vite dev server (`http://localhost:5173`) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview `dist/` with Wrangler locally |
| `npm run check` | Syntax check (`node --check`) + build verification |
| `npm run deploy` | Build and deploy to Cloudflare Pages |

## Architecture

- `app.js` — main thread UI and queue orchestration
- `workers/pdf-worker.js` — **all** compression logic (PDF + Office), despite the filename
- `index.html` — single static entry page
- `wrangler.toml` — Cloudflare Pages config

## Critical Constraints

- **Serial processing only**: Ghostscript and QPDF WASM modules use a singleton in-memory file system (Emscripten FS). Parallel instances cause path conflicts and state corruption. The queue in `app.js` processes files one at a time by design.
- **Worker singleton**: `pdf-worker.js` is instantiated once in `app.js`. It handles both `compress-pdf` and `compress-office` messages via `MessageChannel` ports.
- **WASM loading**: WASM binaries are imported with Vite's `?url` suffix (e.g., `import ghostscriptWasmUrl from "@okathira/ghostpdl-wasm/gs.wasm?url"`). Do not remove `?url`.
- **No test framework**: The project has no unit tests. Verification is `npm run check` (syntax + build) plus manual browser testing.
- **Modern browser APIs required**: `OffscreenCanvas`, `createImageBitmap`, `FileSystemAccess` (optional fallback to anchor download). Worker code assumes these exist.

## File Type Detection

Detection is in `app.js` `getFileKind()`. It checks both `file.type` and filename extension. Do not rely on MIME type alone — some OS/browsers send generic types for Office files.

## Style / Conventions

- ES modules everywhere (`"type": "module"` in `package.json`)
- No semicolons enforced in existing code — follow the dominant style
- Chinese UI strings — keep user-facing text in Chinese
- Worker uses camelCase; `app.js` uses camelCase

## Deployment

- Target: Cloudflare Pages
- Output dir: `dist/` (configured in `wrangler.toml` and `package.json` scripts)
- Project name: `localcompress`

## License

AGPL-3.0-or-later. If modifying, ensure compliance.
