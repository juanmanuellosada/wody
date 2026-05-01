# Guía de agente — Wody

Este archivo orienta a cualquier agente (Codex, Cursor, Claude Code, etc.) sobre qué es el proyecto, por qué está diseñado así y cómo trabajar sobre él.

---

## WHAT — Qué es este proyecto

Wody es una plataforma multi-tenant SaaS para gimnasios tradicionales y boxes de CrossFit. Gestiona rutinas (WODs), récords máximos (RM/PR), control de ingresos (accesos), pagos y notificaciones push. Cada instalación (gym o box) tiene sus propios usuarios, datos y configuración dentro de la misma base de datos.

### Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js **16.2.2** (App Router) |
| UI | React **19.2.4** · TypeScript 5 · Tailwind CSS **4** (`@tailwindcss/postcss` v4) |
| ORM / DB | Prisma **6.19.3** + PostgreSQL (Neon) |
| Auth | NextAuth **5.0.0-beta.30** |
| Editor | TipTap 3.22.1 |
| QR | `@zxing/browser` + `qrcode` |
| Push | `web-push` 3.6.7 |
| Otros | `bcryptjs`, `lucide-react`, `html-to-image`, `modern-screenshot` |
| Runtime | Node.js (sin `.nvmrc` ni campo `engines`) |
| Gestor de paquetes | npm — `package-lock.json` raíz. Sin `packageManager` pinneado. |

### Mapa del repo

```
src/
  app/          — App Router. Multi-tenancy en segmentos [gymSlug].
  actions/      — Server Actions ("use server"): auth, wod, user, payment, etc.
  components/   — React, organizado por feature.
  lib/          — helpers (auth, prisma, gym utilities).
  types/
  logos/
prisma/
  schema.prisma
  seed.ts
  seed-[slug].ts  — seed por gym (ver alta de gyms más abajo)
docs/           — guías de producto (altas, billing, accesos, push)
remotion/       — subproyecto independiente con su propio package.json (videos)
public/
.claude/
openspec/
```

Alias de imports: `@/*` → `./src/*` (definido en `tsconfig.json`).

### Jerga del dominio

| Concepto | Significado |
|---|---|
| WOD | Workout of the Day — rutina diaria publicada por un profe |
| RM / PR | Récord máximo / personal record (peso levantado por un alumno) |
| Box / Gym | Instalación: `kind: "BOX"` (CrossFit) vs `kind: "GYM"` (tradicional) vs `kind: "PERSONAL"` (tenant compartido único, slug reservado `personal`; un usuario STUDENT con `canCreateOwnRoutines=true` gestiona sus propias rutinas y RMs sin profe asignado) |
| isPlatformAdmin | `User.isPlatformAdmin`: flag reservado para operador de plataforma (Wody). Hoy sin uso en código; queda disponible para gating futuro. La `PersonalAccessWhitelist` se administra directamente vía DB. |
| Ingresos | Control de accesos (check-in a la puerta) + historial |
| Cupón | Beneficio / descuento con regla (`ONCE_PER_USER`, `ONCE_GLOBAL`, `UNLIMITED`) |
| Group | Grupo de alumnos asignado a un profe |
| Member number | Número de socio, único por gym |

---

## WHY — Decisiones de diseño no derivables del código

### Multi-tenancy por `[gymSlug]`

Un mismo email puede existir en varios gyms. El schema tiene `@@unique([email, gymId])`. `memberNumber` es local al gym. Toda query sobre usuarios, WODs, RMs, ingresos, cupones o grupos debe filtrarse por `gymId` o `gymSlug` — nunca asumir que el email es globalmente único.

### `GymKind`: `"GYM"` vs `"BOX"`

Misma base de datos, misma lógica de negocio. Solo cambia la terminología visible al usuario (Rutina/WOD, PR/RM, gym/box). Los modelos `Wod` y `RM` se usan en ambos casos sin bifurcación de lógica.

### Roles

`ADMIN` · `TEACHER` · `STUDENT` · `ACCESS`. Un `ADMIN` puede actuar como profe (crear rutinas, recibir alumnos vía `TeacherStudent`).

### `remotion/` es un subproyecto separado

Tiene su propio `package.json` y lockfile. `npm install` se corre dentro de ese directorio. No es workspace ni monorepo — no hay `pnpm-workspace.yaml` ni `turbo.json`. Sus dependencias no deben mezclarse con las del raíz.

### Next.js 16 tiene cambios breaking

Esta versión tiene cambios en APIs, convenciones y estructura de archivos que pueden diferir del training data del agente. Antes de tocar cualquier API de Next.js, leer la guía relevante en `node_modules/next/dist/docs/`. Respetar los avisos de deprecación — no asumir que el comportamiento conocido de versiones anteriores aplica aquí.

---

## HOW — Cómo trabajar sobre el proyecto

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | `next dev` |
| `npm run build` | `prisma generate && next build` |
| `npm start` | `next start` |
| `npm run lint` | ESLint |
| `npm run seed` | `tsx prisma/seed.ts` |

No hay suite de tests. No hay `.github/workflows/`. Deploy en Vercel (`vercel.json`). Cron de producción en `src/app/api/cron/`.

### Alta de gyms

Para dar de alta un gym nuevo se crea un seed propio `prisma/seed-[slug].ts`. El procedimiento completo está en:

- `docs/alta-nuevo-gym.md` — kind GYM (gimnasio tradicional)
- `docs/alta-nuevo-box.md` — kind BOX (CrossFit)

### Migraciones de schema

No editar `prisma/schema.prisma` sin entender el impacto en datos existentes de todos los tenants. Preferir migraciones graduales. Las relaciones multi-tenant (`gymId`, unicidades compuestas) son críticas.

### Convenciones de commits

Conventional Commits en español, scope por feature.

Ejemplos del historial:
- `feat(ingresos): permitir filtrar historial por día`
- `chore(mila-fit): cambiar primaryColor`
- `feat(opsx): add commands`

### Reglas operativas

- Filtrar siempre las queries por `gymId` o `gymSlug` cuando los datos son de usuarios, WODs, RMs, ingresos, cupones o grupos.
- Respetar la unicidad compuesta `(email, gymId)` al crear usuarios.
- No mezclar dependencias de `remotion/` con las del `package.json` raíz.
- No duplicar contenido de `docs/` — linkear por path relativo.
- No editar `prisma/schema.prisma` sin entender el impacto en datos existentes.
- Leer la guía en `node_modules/next/dist/docs/` antes de usar cualquier API de Next.js 16.

### Punteros a `docs/`

- `docs/alta-nuevo-gym.md` — alta de gimnasio tradicional
- `docs/alta-nuevo-box.md` — alta de box de CrossFit
- `docs/billing-mercadopago.md` — cobros con Mercado Pago
- `docs/control-accesos.md` — check-in / puerta
- `docs/notificaciones-push.md` — web-push
