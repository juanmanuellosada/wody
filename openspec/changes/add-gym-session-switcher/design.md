## Context

La sesión de Wody es un único JWT global de NextAuth 5 (`strategy: "jwt"`, sin Prisma adapter, sin modelos `Session`/`Account`). El tenant (`gymId`/`gymSlug`) vive dentro del token, no en la cookie ni en la URL. Consecuencias que condicionan este diseño:

- Hay **una sola cookie** (`authjs.session-token`). No se puede estar logueado en dos gyms a la vez: loguearse a un gym pisa al otro.
- El proxy (`src/proxy.ts:90`) **expulsa** de cualquier `/{gymSlug}/*` que no coincida con el gym de la sesión.
- El provider es **Credentials** (`src/lib/auth.ts`), cuyo `authorize` exige `password`. Los server components no pueden mutar cookies, por eso ya existe `src/app/api/auth/kick/route.ts` (route handler que hace `signOut` + redirect).
- El mismo email existe como **N filas `User`**, una por gym (unique parcial `(email, gymId) WHERE deletedAt IS NULL`). Cada fila tiene su propio `id`, `role`, `password`, `emailVerifiedAt`.

## Goals / Non-Goals

**Goals:**
- Mostrar en el banner los gyms donde el email del alumno tiene cuenta activa (`STUDENT`, no borrada), solo si son 2+.
- Switch instantáneo de sesión a otro gym sin reingresar contraseña, **gated por `emailVerifiedAt`** de la sesión actual.
- Fallback a login (con email precargado) cuando el email actual no está verificado.
- Logos desde `Gym.logo` (DB) con fallback a inicial/nombre.

**Non-Goals:**
- No introducir multi-sesión real (varias cookies por path). Seguimos con una sola sesión activa.
- No cambiar el schema de Prisma.
- No habilitar el switcher para `ADMIN`/`TEACHER`/`ACCESS` (solo `STUDENT`).
- No tocar el logo principal del gym actual (sigue saliendo de `src/lib/gym-logos.ts`).

## Decisions

### 1. Endpoint de switch que re-firma el JWT, con la verdadera verificación en `authorize`

Nuevo route handler `POST /api/auth/switch-gym` (estilo `kick`). Recibe el `gymSlug` destino. Hace, en este orden:

1. `const session = await auth()` — debe existir, `role === "STUDENT"` y `emailVerifiedAt` presente. Si no, responde con redirect al **login del gym destino con `?email=` precargado** (no switch).
2. Resuelve el `User` destino: `prisma.user.findFirst({ where: { email: session.user.email, deletedAt: null, role: "STUDENT", gym: { slug: targetSlug } } })`. Si no existe, 404 / redirect.
3. Ejecuta el switch llamando a `signIn` por una **rama de credenciales sin password** que mintea el token para el `User` destino, y luego redirige a `gymPath(targetSlug, "/")`.

**Cómo se mintea sin password (decisión central):** se agrega al provider Credentials una rama de "switch" que **no compara password** pero exige que la request traiga una sesión válida con el **mismo email verificado**. Es decir, la verificación de seguridad NO vive solo en el route (que es UX), sino dentro de `authorize`, de modo que un POST directo al callback no pueda saltearse el gate. `authorize` para esa rama:
- Lee/decodifica la sesión actual desde la cookie de la request.
- Verifica: existe sesión, `emailVerifiedAt` en el usuario actual, y el email actual == email del `User` destino solicitado.
- Solo entonces devuelve el `User` destino (sin chequear password).

*Alternativa considerada:* HMAC de un solo uso generado por el route y validado por `authorize`. Se descarta por agregar estado/secreto extra cuando la sesión actual ya es la prueba de identidad. *Alternativa considerada:* `update()`/`unstable_update` del token en el callback `jwt` con `trigger:"update"`. Se descarta porque reescribir la identidad (otro `userId`/gym) vía session-update es una superficie más opaca que un sign-in explícito.

> Nota de implementación: la firma exacta de `authorize(credentials, request)` y la forma de leer la cookie de sesión dentro de `authorize` deben verificarse contra `node_modules/next-auth` / `node_modules/next/dist/docs/` (Next 16 + NextAuth 5 beta) antes de codificar — no asumir APIs de versiones previas.

### 2. El switch cambia la cookie ANTES de navegar (evita el guard del proxy)

El route handler setea la nueva cookie de sesión y recién entonces hace el `redirect` 3xx a `/{targetSlug}/`. Cuando el navegador llega al nuevo gym, la cookie ya es del gym destino, así que `src/proxy.ts:90` no expulsa. Nunca navegar al `gymSlug` destino antes de re-firmar.

### 3. Resolución de gyms del email: en el layout, no en el cliente

`src/app/[gymSlug]/layout.tsx` ya carga la sesión y el gym. Ahí mismo, si `role === "STUDENT"`, se hace una query `prisma.user.findMany({ where: { email, deletedAt: null, role: "STUDENT" }, select: { gym: { select: { slug, name, logo } } } })` y se pasa al `Navbar` la lista (más el flag `emailVerified`). El `Navbar` (client) solo renderiza; no consulta DB. Si la lista tiene <2 entradas, no se renderiza el switcher.

### 4. Logos: `Gym.logo` (DB) con fallback a inicial/nombre

El switcher usa `gym.logo` cuando está presente; si es `null`, muestra un avatar con la inicial del `name` (o el nombre corto). El logo del gym **actual** en el banner sigue saliendo del mapa estático `src/lib/gym-logos.ts` (no se toca). Se asume `Gym.logo` como URL/path renderizable por `next/image` o `<img>`; verificar el formato real de los registros antes de elegir el componente.

## Risks / Trade-offs

- **[Account takeover vía email no verificado]** Si se permitiera switch desde una cuenta cuyo email no se probó, un admin podría crear una cuenta con el email de un tercero y saltar a la cuenta de esa persona en otro gym. → **Mitigación:** gate duro por `emailVerifiedAt` de la sesión actual, enforced dentro de `authorize` (no solo en el route).
- **[Bypass del route llamando al callback directo]** → **Mitigación:** la rama de switch en `authorize` re-verifica la sesión actual desde la cookie; sin sesión verificada del mismo email, no mintea.
- **[Cambio en `src/lib/auth.ts` es sensible]** Es el corazón de auth de todos los tenants. → **Mitigación:** la rama de switch es aditiva (no toca el flujo de login normal con password); revisar que el `jwt`/`session` callback siga poblando `gymId/gymSlug/role` igual que hoy.
- **[Logos pesados/externos en `Gym.logo`]** → **Mitigación:** fallback a inicial; tamaño acotado en el switcher; lazy.
- **[Fuga de existencia de cuentas]** El switcher revela en qué otros gyms tenés cuenta — pero es tu propia sesión viendo tus propios gyms con tu email, no hay exposición a terceros.
