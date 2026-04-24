@AGENTS.md

# Específico de Claude Code

## Flujo para cambios sustanciales — OpenSpec

Este proyecto usa OpenSpec. Los comandos están montados en `.claude/commands/opsx/` y hay skills en `.claude/skills/openspec-*`:

- `/opsx:explore {tema}` — investigar antes de proponer
- `/opsx:propose {change-id} {descripción}` — crear proposal + design + tasks + spec deltas
- `/opsx:apply` — no usar: delegar la implementación al subagente `executor` con punteros a los artefactos bajo `openspec/changes/{change-id}/`
- `/opsx:archive {change-id}` — promover deltas a `openspec/specs/` y mover el cambio a `openspec/changes/archive/`

## Plugins y skills habilitados

- `ui-ux-pro-max` — habilitado en `.claude/settings.json`. Disponible para trabajo de UI/UX.

## Notas de delegación

Cuando delegues a `executor` tareas que tocan Next.js, recordá apuntarlo a `node_modules/next/dist/docs/` — esta versión (16.2.2) tiene breaking changes respecto a versiones previas y la regla ya vive en `AGENTS.md`, pero reforzarla en el prompt ayuda a que no use APIs obsoletas.
