# Prompt para dar de alta un nuevo box en WODY

Copiar, completar los datos, y pegar en una nueva conversación de Claude Code en el directorio del proyecto.

---

## Prompt

```
Necesito dar de alta un nuevo box en WODY. Estos son los datos:

## Datos del gimnasio
- **Nombre completo:** [NOMBRE DEL GYM]
- **Slug (URL):** [slug-en-minusculas-con-guiones]
- **Tipo de instalación:** [BOX o GYM] — BOX para CrossFit / funcional, GYM para gimnasio tradicional. Se guarda en el enum `GymKind` (campo `kind` del modelo `Gym`) y define cómo se refiere la app al lugar en los mensajes al usuario (ej: "contactá con tu box" vs "contactá con tu gym").
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

1. **Base de datos:** Crear un script o migration que inserte el Gym (con su `primaryColor` **y su `kind: GymKind`**),
el Admin, y opcionalmente WODs y RMs de ejemplo. Podés crear un script separado en `prisma/` para correrlo una sola
vez (ejemplo: `prisma/seed-[slug].ts`). El `kind` va al enum `GymKind` y acepta `"BOX"` o `"GYM"` — setearlo según el
tipo de instalación de arriba. El color de acentuación se guarda en `primaryColor` y el theming dinámico lo aplica
automáticamente a toda la UI del gym (botones, acentos, bordes, imágenes compartibles, etc.).

2. **Landing page (`src/app/page.tsx`):**
   - Importar el logo del nuevo gym
   - Si está "Habilitado": agregar un `<Link>` clickeable al slug del gym (igual que los activos)
   - Si está "Próximamente": agregar un `<div>` con opacidad reducida y el label "Proximamente" (igual que los existentes)

El logo cargado es src/logos/[NOMBRE-DEL-LOGO].png

3. **Logo mapping:** Agregar el nuevo slug+logo en todos los diccionarios de logos:
   - `GYM_LOGOS` en `src/app/[gymSlug]/page.tsx` (landing del gym)
   - `GYM_LOGOS` en `src/app/[gymSlug]/login/page.tsx` (página de login)
   - `GYM_NAV_LOGOS` en `src/components/layout/Navbar.tsx` (barra de navegación)

4. **Verificar** que no se rompa nada: correr `npx prisma generate` y `npm run build` para asegurarte de que compila.

No modifiques el schema de Prisma (ya soporta multi-gym). No borres datos existentes. Si creo alumnos, asignalos a
sus profes correspondientes con TeacherStudent.
```

---

## Notas

- El WhatsApp del profe e Instagram del gym no se guardan en la DB actualmente (no hay campo en el schema), pero quedan documentados para cuando se agregue esa funcionalidad.
- El logo tiene que estar previamente en `src/logos/`. Si no lo tenés, el gym funciona igual mostrando el nombre en texto.
- Si el gym ya estaba como "Próximamente" en la landing (como Rompiendo Limites o Agustin), el prompt se encarga de activarlo cambiando el `<div>` por un `<Link>`.
- El color de acentuación se guarda en `primaryColor` de la DB y se aplica automáticamente. El layout `src/app/[gymSlug]/layout.tsx` sobreescribe las CSS custom properties (`--color-red`, `--color-red-dark`, `--color-red-hover`) con el `primaryColor` del gym. Todos los componentes usan theme tokens de Tailwind (`brand-red`, `brand-red-dark`, `brand-red-active`) que resuelven a estas variables, así que cada gym tiene su propio color de acentuación sin cambios adicionales en el código.

---

## Template genérico para futuros boxes

Para dar de alta otro box, copiar el prompt de arriba y reemplazar los valores entre corchetes `[...]` con los datos reales del gym.
