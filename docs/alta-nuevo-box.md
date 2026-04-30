# Prompt para dar de alta un nuevo box en WODY

Necesito dar de alta un nuevo box en WODY. Estos son los datos:

## Datos del gimnasio
- **Nombre completo:** [NOMBRE DEL GYM]
- **Slug (URL):** [slug-en-minusculas-con-guiones]
- **Tipo de instalación:** BOX (CrossFit / funcional — se guarda en el enum `GymKind`, campo `kind` del modelo `Gym`). Con `kind: "BOX"` la UI muestra "WOD", "RM", "box". Si es un gimnasio tradicional usá el prompt de `alta-nuevo-gym.md` en su lugar.
- **Color de acentuación (hex):** [#HEXCOLOR]
- **Ubicación:** [Ciudad, Provincia]
- **Tipo de actividad:** [CrossFit / Funcional / Entrenamiento personalizado / etc.]
- **Instagram del gimnasio:** [URL completa + @handle]

## Datos del admin (es admin y profe)
- **Nombre:** [Nombre Apellido]
- **Email:** [email@ejemplo.com]
- **Contraseña:** [contraseña]
- **WhatsApp:** [+54 9 XX XXXX-XXXX]

El admin tiene doble rol: es ADMIN y también actúa como profe (crea WODs, se le asignan alumnos vía TeacherStudent).
Crearlo con role: ADMIN — el sistema ya permite que los ADMIN funcionen como profes.

## Estado en la landing
- **Habilitado** o **Próximamente**

---

Hacé todo lo necesario para que el box quede operativo:

1. **Base de datos:** Crear un script separado en `prisma/` para correrlo una sola vez (ej: `prisma/seed-[slug].ts`) que inserte el Gym con **`kind: "BOX"`** y su `primaryColor`, el Admin, y opcionalmente WODs y RMs de ejemplo. El `kind` va al enum `GymKind` y acepta `"BOX"` o `"GYM"` — para este alta es `"BOX"`. El color de acentuación se guarda en `primaryColor` y el theming dinámico lo aplica automáticamente a toda la UI del gym (botones, acentos, bordes, imágenes compartibles, etc.).

2. **Landing page (`src/app/page.tsx`):**
   - Importar el logo del nuevo gym
   - Si está "Habilitado": agregar un `<Link>` clickeable al slug del gym (igual que los activos). La localidad que aparece en la card **no se hardcodea inline** — se interpola desde `GYM_LOCATIONS` (ver paso 3).
   - Si está "Próximamente": agregar un `<div>` con opacidad reducida y el label "Proximamente" (igual que los existentes)

El logo cargado es src/logos/[NOMBRE-DEL-LOGO].png

3. **Mappings centralizados:** Hay dos archivos en `src/lib/` que funcionan como diccionarios por slug y deben actualizarse al dar de alta un gym nuevo:

   **`src/lib/gym-logos.ts`** — logos de cada gym. Agregar el nuevo slug+logo en los diccionarios que correspondan:
   - `GYM_LOGOS_SQUARE` — logo vertical/cuadrado. Se usa en la landing del gym, en el login, y en las imágenes compartibles de RMs.
   - `GYM_LOGOS_HORIZONTAL` — logo horizontal/wordmark. Se usa en el navbar.

   Si el gym no tiene alguno de los dos tipos de logo, no lo agregues a ese map — la app cae automáticamente a mostrar el nombre del gym como texto (incluidas las imágenes de RMs compartibles).

   **Logo en mails transaccionales (opcional):** Si querés que el logo aparezca en los mails de reset de contraseña y otros mails del sistema, copiá el logo a `public/logos/{slug}.png` y seteá el campo `logo` del gym a `'${APP_URL}/logos/{slug}.png'` (URL absoluta, ej: `https://wody.com.ar/logos/atlas-gym.png`). Podés hacerlo vía SQL en Neon: `UPDATE "Gym" SET logo = 'https://wody.com.ar/logos/{slug}.png' WHERE slug = '{slug}';`. Si `logo` queda en `null`, el mail muestra el nombre del gym como texto — comportamiento válido y sin errores.

   **`src/lib/gym-locations.ts`** — localidad de cada gym. Shape: `Record<string, string>`, valores con el formato `"Ciudad, Provincia"` (provincia con nombre completo, no abreviada). Agregar el nuevo slug con su localidad. Consumido por la landing general (`src/app/page.tsx`) y por la landing del propio gym (`src/app/[gymSlug]/page.tsx`). Si el slug no está en el map, la landing del gym omite la línea de localidad sin romper.

4. **Verificar** que no se rompa nada: correr `npx prisma generate` y `npm run build` para asegurarte de que compila.

No modifiques el schema de Prisma (ya soporta multi-gym y los dos kinds). No modifiques `src/lib/gym-terms.ts` (el helper ya maneja ambas terminologías). No borres datos existentes. Si creo alumnos, asignalos a sus profes correspondientes con TeacherStudent.