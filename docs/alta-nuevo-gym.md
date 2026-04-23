# Prompt para dar de alta un nuevo gym en WODY

Copiar, completar los datos, y pegar en una nueva conversación de Claude Code en el directorio del proyecto.

Este prompt es para **gimnasios tradicionales** (`kind: "GYM"`). Si vas a dar de alta un box de CrossFit / funcional, usá [`docs/alta-nuevo-box.md`](./alta-nuevo-box.md).

---

## Prompt

```
Necesito dar de alta un nuevo gym en WODY. Estos son los datos:

## Datos del gimnasio
- **Nombre completo:** [NOMBRE DEL GYM]
- **Slug (URL):** [slug-en-minusculas-con-guiones]
- **Tipo de instalación:** GYM (gimnasio tradicional — se guarda en el enum `GymKind`, campo `kind` del modelo `Gym`). La UI cambia automáticamente su terminología visible según este campo: con `kind: "GYM"` muestra "Rutina" en vez de "WOD", "PR" en vez de "RM", "gym" en vez de "box". Por debajo los datos se guardan igual (modelo `Wod` y modelo `RM` en la DB) — es solo terminología visible al usuario.
- **Color de acentuación (hex):** [#HEXCOLOR]
- **Ubicación:** [Ciudad, Provincia]
- **Tipo de actividad:** [Entrenamiento funcional / Musculación / Entrenamiento personalizado / etc.]
- **Instagram del gimnasio:** [URL completa + @handle]

## Datos del admin (es admin y profe)
- **Nombre:** [Nombre Apellido]
- **Email:** [email@ejemplo.com]
- **Contraseña:** [contraseña]
- **WhatsApp:** [+54 9 XX XXXX-XXXX]

El admin tiene doble rol: es ADMIN y también actúa como profe (crea rutinas, se le asignan alumnos vía TeacherStudent).
Crearlo con role: ADMIN — el sistema ya permite que los ADMIN funcionen como profes.

## Estado en la landing
- **Habilitado** o **Próximamente**

---

Hacé todo lo necesario para que el gym quede operativo:

1. **Base de datos:** Crear un script separado en `prisma/` para correrlo una sola vez (ej: `prisma/seed-[slug].ts`) que inserte el Gym con **`kind: "GYM"`** y su `primaryColor`, el Admin, y opcionalmente rutinas y PRs de ejemplo. El `kind` va al enum `GymKind` y acepta `"BOX"` o `"GYM"` — para este alta es `"GYM"`. El color de acentuación se guarda en `primaryColor` y el theming dinámico lo aplica automáticamente a toda la UI del gym (botones, acentos, bordes, imágenes compartibles).

2. **Landing page (`src/app/page.tsx`):**
   - Importar el logo del nuevo gym
   - Si está "Habilitado": agregar un `<Link>` clickeable al slug del gym (igual que los activos)
   - Si está "Próximamente": agregar un `<div>` con opacidad reducida y el label "Proximamente" (igual que los existentes)

El logo cargado es src/logos/[NOMBRE-DEL-LOGO].png

3. **Logo mapping:** Los logos de los gyms están **centralizados en un solo archivo**: `src/lib/gym-logos.ts`. Agregar el nuevo slug+logo en los diccionarios que correspondan:
   - `GYM_LOGOS_SQUARE` — logo vertical/cuadrado. Se usa en la landing del gym, en el login, y en las imágenes compartibles de PRs.
   - `GYM_LOGOS_HORIZONTAL` — logo horizontal/wordmark. Se usa en el navbar.

Si el gym no tiene alguno de los dos tipos de logo, no lo agregues a ese map — la app cae automáticamente a mostrar el nombre del gym como texto (incluidas las imágenes de PRs compartibles).

4. **Verificar** que no se rompa nada: correr `npx prisma generate` y `npm run build` para asegurarte de que compila.

No modifiques el schema de Prisma (ya soporta multi-gym y los dos kinds). No modifiques `src/lib/gym-terms.ts` (el helper ya maneja ambas terminologías). No borres datos existentes. Si creo alumnos, asignalos a sus profes correspondientes con TeacherStudent.
```

---

## Bloquear / desbloquear un gym

El bloqueo de gym es manual vía SQL (no hay UI). Cuando `Gym.blockedAt` no es null, ningún usuario del gym puede loguearse y cualquier ruta bajo `/{slug}/*` redirige a `/`. Las sesiones vivas se firman fuera en el primer request después del bloqueo.

```sql
-- Bloquear
UPDATE "Gym" SET "blockedAt" = NOW() WHERE slug = 'slug-del-gym';

-- Desbloquear
UPDATE "Gym" SET "blockedAt" = NULL WHERE slug = 'slug-del-gym';
```

## Tolerancia de auto-bloqueo por mora

Cada gym tiene su propio umbral de días de atraso antes de que un alumno quede auto-bloqueado (`Gym.autoBlockAfterDays`, default `5` → se bloquea a partir del día 6). Se edita a mano:

```sql
UPDATE "Gym" SET "autoBlockAfterDays" = 10 WHERE slug = 'slug-del-gym';
```

## Cómo funciona la terminología GYM vs BOX

La UI resuelve en runtime qué palabras mostrar según `Gym.kind`, vía el helper `gymTerms(kind)` en `src/lib/gym-terms.ts`:

| `kind: "BOX"` | `kind: "GYM"` |
|---|---|
| WOD / WODs | Rutina / Rutinas |
| RM / RMs | PR / PRs |
| "Pasá por tu box" | "Pasá por tu gym" |
| "el WOD" / "los WODs" | "la Rutina" / "las Rutinas" |

No hace falta tocar código al dar de alta un gym — basta con setear `kind: "GYM"` en el seed y todos los textos visibles cambian automáticamente (dashboards de alumno y profe, navbar, formularios, mensajes de error, notificaciones push, share de PRs, etc.). Por debajo siguen siendo las mismas tablas de DB (`Wod`, `RM`).

## Notas

- El WhatsApp del profe e Instagram del gym no se guardan en la DB actualmente (no hay campo en el schema), pero quedan documentados para cuando se agregue esa funcionalidad.
- El logo tiene que estar previamente en `src/logos/`. Si no lo tenés, el gym funciona igual mostrando el nombre como texto en la landing, login, navbar y en la imagen compartible de PRs.
- El color de acentuación se guarda en `primaryColor` de la DB y se aplica automáticamente. El layout `src/app/[gymSlug]/layout.tsx` sobreescribe las CSS custom properties (`--color-red`, `--color-red-dark`, `--color-red-hover`) con el `primaryColor` del gym. Todos los componentes usan theme tokens de Tailwind (`brand-red`, `brand-red-dark`, `brand-red-active`) que resuelven a estas variables, así que cada gym tiene su propio color de acentuación sin cambios adicionales en el código.

---

## Template genérico para futuros gyms

Para dar de alta otro gym, copiar el prompt de arriba y reemplazar los valores entre corchetes `[...]` con los datos reales del gym.
