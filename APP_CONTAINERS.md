# App Containers Architecture

This workspace now supports an app catalog with container metadata via `src/providers/apps.tsx`.

## Goal

Run each app as an isolated service (Docker-like model) while keeping Gh3spOS as the shell.

## Current model

- UI shell and windows are still rendered in the main frontend.
- App metadata can declare `runtime: 'container-service'` with image/port/endpoint.
- App install/enable/pin lifecycle is managed in App Store (`app-store`).

## Next step for full isolation

To make each app truly standalone:

1. Package each app as a web micro-frontend service (one Docker image per app).
2. Expose each app by HTTP endpoint (`http://localhost:41xx`).
3. In `Window` rendering, detect container apps and mount them inside an iframe/webview.
4. Exchange events with the shell via `postMessage` (open window, notifications, file pickers).

## Compose template

Use `docker-compose.apps.yml` as baseline and replace image names with real builds.
