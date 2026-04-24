---
paths:
  - "remotion/**"
---

# Subproyecto `remotion/`

`remotion/` es un **subproyecto independiente** con su propio `package.json` y lockfile (no es un workspace ni un paquete del monorepo — no existe `pnpm-workspace.yaml` ni `turbo.json` en el repo).

## Reglas

- Correr `npm install` **dentro de `remotion/`**, no en la raíz.
- Agregar dependencias de video (Remotion, ffmpeg wrappers, etc.) **solo** al `package.json` de `remotion/`. Nunca al `package.json` raíz.
- Los scripts de Remotion se ejecutan desde ese directorio (`cd remotion && npm run ...`).
- Si necesitás compartir tipos o utilidades con la app principal, consultá antes — por ahora no hay un patrón establecido para eso.
