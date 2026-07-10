# point-ops

Desktop workbench for manipulating point cloud files. Built with Vite + React, shadcn/ui, and Tauri 2.0. All processing operators run in Rust.

## Stack

| Layer | Technology |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Desktop shell | Tauri 2.0 |
| Operators | Rust (via Tauri commands) |
| 3D preview | Three.js |

## Development

```bash
just install        # pnpm install
just tauri-dev       # full app with hot-reload
just dev             # Vite frontend only
just typecheck
just lint
just format
```

Run `just --list` for the full recipe list (grouped: setup, dev, quality, build). Requires [Rust](https://rustup.rs), [`just`](https://github.com/casey/just), and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

## Batch mode

Selecting more than one `.ply` file in the file picker switches to batch mode: pick an output folder once and the chosen operation runs across all selected files, with output filenames derived automatically per input.

## Operators

### Splat → Sketchfab

Converts a Gaussian Splat PLY file (exported from SuperSplat or similar) to a Sketchfab-compatible PLY with standard `red`, `green`, `blue` uint8 vertex attributes.

Spherical harmonics DC coefficients (`f_dc_0/1/2`) are converted to sRGB using:

```
rgb = clamp(f_dc * 0.28209 + 0.5, 0, 1) × 255
```

### Mip-Splat Fuse

Bakes mip-splatting's per-vertex 3D smoothing filter (`filter_3D`) into `opacity` and `scale_*`, matching `GaussianModel.save_fused_ply` from the [mip-splatting](https://github.com/autonomousvision/mip-splatting) repo. Turns a mip-splatting training-output PLY (`iteration_*/point_cloud.ply`) into a standard Gaussian-splat PLY loadable in SuperSplat and similar viewers, without needing a Python/CUDA environment.

## Releases

Versioning and releases are automated with [release-please](https://github.com/googleapis/release-please) — no manual tagging:

1. Merge commits to `main` using [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, …).
2. release-please keeps a "chore(main): release X.Y.Z" PR up to date with the next version (computed from those commit types) and an auto-generated changelog.
3. Merging that PR creates the `vX.Y.Z` tag and a published GitHub Release with the changelog as its body.
4. That tag push triggers `release.yml`, which builds `.dmg` (Apple Silicon) and `.msi` (Windows 11) and attaches them to the release release-please just created.

You can also trigger `release.yml` manually (`workflow_dispatch`) for an ad-hoc build — it gets a `<base>.<run_number>` version and uploads as a plain workflow artifact instead of a release, since there's no tag on that path.

## Project layout

```
src/                        React frontend
  components/ui/            shadcn/ui components
  components/               app components (PointCloudViewer, …)
  App.tsx                   root workbench layout
src-tauri/
  src/
    operators/              one Rust module per operator
    lib.rs                  Tauri command registration
.github/workflows/
  release-please.yml        version bump PR + tag/release creation
  release.yml               cross-platform build pipeline
release-please-config.json  release-please package config
.release-please-manifest.json  current version per package
```

## Roadmap

See [`~/rhizomatic-preset/guidance/projects/point-ops/roadmap.md`](../../../guidance/projects/point-ops/roadmap.md).
