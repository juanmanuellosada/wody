# Prompt para dar de alta un nuevo gym en WODY

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

1. **Base de datos:** Crear un script separado en `prisma/` para correrlo una sola vez (ej: `prisma/seed-[slug].ts`) que inserte el Gym con **`kind: "GYM"`** y su `primaryColor`, el Admin, y opcionalmente rutinas y PRs de ejemplo. El `kind` va al enum `GymKind` y acepta `"BOX"` o `"GYM"` — para este alta es `"GYM"`. El color de acentuación se guarda en `primaryColor` y el theming dinámico lo aplica automáticamente **desde `/{slug}` en adelante** — o sea, empieza a respetarse ya en la landing del propio gym (`/{slug}`), no solo desde el login hacia adentro. Alcanza a la landing del gym, al login, a todos los dashboards (botones, acentos, bordes, gradientes, stripes) y a las imágenes compartibles de PRs. La landing pública de WODY (`/`) mantiene su rojo de marca.

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