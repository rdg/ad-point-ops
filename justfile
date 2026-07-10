default:
    @just --list

[group('setup')]
install:
    pnpm install

[group('dev')]
dev:
    pnpm dev

[group('dev')]
tauri-dev:
    pnpm tauri dev

[group('quality')]
typecheck:
    pnpm typecheck

[group('quality')]
lint:
    pnpm lint

[group('quality')]
format:
    pnpm format

[group('build')]
build:
    pnpm build

[group('build')]
tauri-build:
    pnpm tauri build
