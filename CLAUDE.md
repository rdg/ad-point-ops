# point-ops

A desktop workbench for manipulating point cloud files. Built with Vite + React, shadcn/ui, and Tauri 2.0. Operators run in Rust via Tauri commands.

## Stack

- **Frontend**: Vite + React 19, TypeScript, Tailwind CSS v4, shadcn/ui (radix-ui primitives)
- **Desktop shell**: Tauri 2.0 (`src-tauri/`)
- **Operators**: Rust — all point cloud processing logic lives in `src-tauri/src/`
- **3D preview**: Three.js (`THREE.Points` + `BufferGeometry`) rendered in the frontend

## Project layout

```
src/                      # React frontend
  components/ui/          # shadcn/ui generated components — do not hand-edit
  components/             # app-specific components
src-tauri/
  src/
    lib.rs                # Tauri command registrations
    main.rs               # entry point
    operators/            # one module per operator (create as needed)
```

## UI conventions

- All UI uses shadcn/ui components. Do not reach for raw HTML elements where a shadcn component exists.
- NZ English in user-visible strings (`colour`, `organisation`). Identifiers stay in US English.
- Layout: single-window workbench — file picker on the left, operation config in the centre, 3D preview filling the right pane.

## Operators (Rust)

Each operator is a Tauri command exposed via `#[tauri::command]`. Add new operators as modules under `src-tauri/src/operators/`.

### splat-to-sketchfab (first operator)

Converts a Gaussian Splat PLY (`f_dc_0`, `f_dc_1`, `f_dc_2` spherical-harmonics fields) to a Sketchfab-compatible PLY with standard `red`, `green`, `blue` uint8 vertex attributes.

Algorithm (ported from `alfred-python/main.py`):
```
SH_C0 = 0.28209479177387814
r = clamp(f_dc_0 * SH_C0 + 0.5, 0.0, 1.0) * 255
g = clamp(f_dc_1 * SH_C0 + 0.5, 0.0, 1.0) * 255
b = clamp(f_dc_2 * SH_C0 + 0.5, 0.0, 1.0) * 255
```

Recommended Rust crates: `ply-rs` for PLY I/O, `rayon` for parallel vertex processing.

### Future operators (planned)

- **Tweak point cloud** — filter, subsample, transform (scale/rotate/translate)
- **Mesh conversion** — wrap external tools (e.g. Open3D CLI, CloudCompare CLI) to convert point cloud to mesh

## Core workflows

### Load a file
1. User clicks "Load PLY" → Tauri `dialog::open` filter `*.ply`
2. Frontend receives path, calls `read_point_cloud` Tauri command
3. Rust reads header + vertex data, returns summary (vertex count, available fields) + a downsampled preview payload
4. Frontend renders preview in Three.js viewport

### Run an operation
1. User selects operation from dropdown, configures params
2. User clicks "Save As" → Tauri `dialog::save` to pick output path
3. Frontend calls the operator's Tauri command with `{input_path, output_path, ...params}`
4. Frontend shows spinner; command runs synchronously in Rust thread pool
5. On completion: success toast with output path, or error toast with message

### 3D preview
- Render `THREE.Points` with a `BufferGeometry`; colour from RGB fields if present, else flat grey
- Preview uses a downsampled point set (max ~500k points) for responsiveness
- Camera: `OrbitControls`

## GitHub Actions

Two workflows, split by concern:

- **`.github/workflows/release-please.yml`** — runs on every push to `main`. Uses [release-please](https://github.com/googleapis/release-please) to read Conventional Commits (`feat:`, `fix:`, etc.) since the last release, and keeps a "chore(main): release X.Y.Z" PR up to date with the next version + changelog. Merging that PR is what actually creates the `vX.Y.Z` tag and the GitHub Release (with the changelog as its body) — nothing to do by hand.
- **`.github/workflows/release.yml`** — builds on push to `v*` tags (or manually via `workflow_dispatch`):
  - **mac-silicon**: `macos-14` runner → `.dmg`
  - **windows-11**: `windows-2022` runner → `.msi`

  On a tag push it just builds and attaches installers to the release release-please already created for that tag (`gh release upload`) — it does not create or manage the release itself. On `workflow_dispatch` (no tag) it stamps a synthetic `<base>.<run_number>` version and uploads as a plain workflow artifact instead.

Version source of truth: release-please's manifest (`.release-please-manifest.json`) drives `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` (see `release-please-config.json`'s `extra-files`) — bump commit types, not files by hand.

## Roadmap

Lives in the guidance repo: `~/rhizomatic-preset/guidance/projects/point-ops/roadmap.md`

## Dev commands

Use `just <recipe>` (see `justfile`, grouped: setup, dev, quality, build) rather than calling `pnpm` directly:

```bash
just install          # pnpm install
just dev              # Vite dev server only
just tauri-dev        # full Tauri dev build (frontend + Rust)
just build            # production frontend build
just tauri-build      # production Tauri bundle
just lint
just format
just typecheck
```
