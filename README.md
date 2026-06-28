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
pnpm install
pnpm tauri dev      # full app with hot-reload
pnpm dev            # Vite frontend only
pnpm typecheck
pnpm lint
pnpm format
```

Requires [Rust](https://rustup.rs) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

## Operators

### Splat → Sketchfab

Converts a Gaussian Splat PLY file (exported from SuperSplat or similar) to a Sketchfab-compatible PLY with standard `red`, `green`, `blue` uint8 vertex attributes.

Spherical harmonics DC coefficients (`f_dc_0/1/2`) are converted to sRGB using:

```
rgb = clamp(f_dc * 0.28209 + 0.5, 0, 1) × 255
```

## Releases

GitHub Actions builds `.dmg` (Apple Silicon) and `.msi` (Windows 11) installers on every `v*` tag push:

```bash
git tag v0.1.0 && git push --tags
```

Artifacts are attached as a draft GitHub Release for review before publishing.

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
  release.yml               cross-platform build pipeline
```

## Roadmap

See [`~/rhizomatic-preset/guidance/projects/point-ops/roadmap.md`](../../../guidance/projects/point-ops/roadmap.md).
