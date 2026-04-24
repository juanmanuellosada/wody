# Skills disponibles — Wody

> Visibility aid. Claude Code auto-loads skills via su campo `description` en el frontmatter — este archivo es para el humano, no para el agente. No modifica comportamiento; solo te muestra de un vistazo qué skills aplican a este stack.

Stack del proyecto: Next.js 16 + React 19 + TypeScript strict + Tailwind 4 + Prisma 6 + NextAuth 5 beta + Postgres (Neon) + Remotion (subproyecto).

## Relevantes a este stack

| Skill | Trigger (cuándo se activa) | Path | Source |
|---|---|---|---|
| `vercel-react-best-practices` | Escribir/revisar/refactorizar código React o Next.js: componentes, data fetching, bundle, performance | `~/.claude/skills/vercel-react-best-practices` | Global (vercel-labs/agent-skills, oficial Vercel) |
| `prisma-database-setup` | Configurar Prisma/providers, troubleshooting de conexión, cambiar DB | `~/.claude/skills/prisma-database-setup` | Global (prisma/skills, oficial Prisma) |
| `prisma-client-api` | Queries Prisma: `findMany`, `create`, `update`, filtros, `$transaction` | `~/.claude/skills/prisma-client-api` | Global (prisma/skills, oficial Prisma) |
| `ui-ux-pro-max` | UI/UX en Tailwind/shadcn/HTML, paletas, tipografía, a11y, responsive, dark mode | Plugin (no copiado a `~/.claude/skills/`) | Plugin habilitado en `.claude/settings.json` — se usa la versión del plugin |
| `simplify` | Revisar código modificado para detectar duplicación, reuso y calidad | Plugin | Plugin |
| `security-review` | Revisar cambios pendientes en la branch actual desde la óptica de seguridad | Plugin (slash command) | Plugin |
| `openspec-propose` · `openspec-apply-change` · `openspec-explore` · `openspec-archive-change` | Flow SDD para cambios sustanciales (ver `CLAUDE.md` del proyecto) | Plugin | Plugin |
| `opsx:propose` · `opsx:apply` · `opsx:explore` · `opsx:archive` | Variante experimental del flow SDD (comandos activos en este proyecto, `.claude/commands/opsx/`) | Plugin | Plugin |
| `find-skills` | Descubrir e instalar skills nuevas desde skills.sh | `~/.claude/skills/find-skills` | Global |

## No relevantes para este proyecto

- `claude-api` (plugin) — Anthropic SDK. Wody no usa la API de Claude.
- `init` (plugin) — útil solo si el proyecto no tuviera CLAUDE.md; acá ya existe.
- Comandos de infra: `update-config`, `keybindings-help`, `fewer-permission-prompts`, `loop`, `schedule` — disponibles si los necesitás, pero no específicos a Wody.

## Nota sobre `ui-ux-pro-max`

Se dejó referenciada desde el plugin en vez de copiarla a `~/.claude/skills/`. La versión activa sigue siendo la del plugin habilitado en `.claude/settings.json`. Si alguna vez querés fork-earla para customizar (ej: agregar reglas propias de diseño de Wody), copiala con:

```
cp -r ~/.claude/plugins/marketplaces/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max ~/.claude/skills/
```

## Mantener este archivo

Se regenera cuando instalás/desinstalás skills globales. Pedile a Claude "actualizá el skills-registry".
