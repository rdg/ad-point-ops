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
- The app is bilingual (German default, English NZ) via i18next — see "Internationalisation" below. Never hardcode user-visible strings in components; add a key to `src/i18n/index.ts` with both `de` and `en` translations instead. Identifiers stay in US English regardless of UI language.
- Layout: single-window workbench — file picker on the left, operation config in the centre, 3D preview filling the right pane.

## Internationalisation

- `src/i18n/index.ts` — i18next + react-i18next, inline `de`/`en` resource objects (no external translation files/service). Default language is German; `en` is the fallback.
- Language choice persists to `localStorage` (`point-ops-language`) and is changed via the Settings dialog (`src/components/SettingsDialog.tsx`), not by browser/OS locale detection.
- Locale-aware number formatting (e.g. point counts) should use `LOCALES[i18n.language]` (`de-DE` / `en-NZ`) from `src/i18n/index.ts`, not a hardcoded locale string.
- The native menu bar's "Settings…" item (`Cmd+,` on macOS) is built in `src-tauri/src/lib.rs` (`build_menu`, inserted into `Menu::default` rather than a hand-rolled tree, so standard Edit/Window/Help items are preserved) and emits an `open-settings` event the frontend listens for.

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

Single workflow (`.github/workflows/release.yml`), two jobs, triggered on push to `main` or manually via `workflow_dispatch`:

1. **`release-please`** — uses [release-please](https://github.com/googleapis/release-please) to read Conventional Commits (`feat:`, `fix:`, etc.) since the last release, and keeps a "chore(main): release X.Y.Z" PR up to date with the next version + changelog. Merging that PR is what creates the `vX.Y.Z` tag and the GitHub Release (with the changelog as its body) — nothing to do by hand.
2. **`build`** — `needs: release-please`; only runs when that job's `release_created` output is `true`, or on `workflow_dispatch`.
   - **mac-silicon**: `macos-14` runner → `.dmg`
   - **windows-11**: `windows-2022` runner → `.msi`

   On a release it just builds and attaches installers to the release release-please already created (`gh release upload`) — it doesn't create or manage the release itself. On `workflow_dispatch` (no release) it stamps a synthetic `<base>.<run_number>` version and uploads as a plain workflow artifact instead.

Deliberately **not** two separate workflows gated by a `push: tags: v*` trigger: release-please creates its tag/release using the default `GITHUB_TOKEN`, and GitHub Actions never fires other workflows from `GITHUB_TOKEN`-authored pushes (anti-recursion safeguard) — a tag-triggered `release.yml` would simply never run. Chaining via `needs:`/job outputs inside one workflow run sidesteps that entirely.

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
