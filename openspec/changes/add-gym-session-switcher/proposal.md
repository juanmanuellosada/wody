## Why

Un alumno (rol `STUDENT`) que entrena en más de un gym se registra con el mismo email en cada uno, pero hoy no tiene forma de moverse entre ellos sin desloguearse y volver a iniciar sesión a mano en el otro gym. La sesión es un único JWT global: loguearse a un gym pisa la sesión del otro y el proxy expulsa de cualquier gym ajeno al de la sesión. Queremos que el alumno vea, desde el banner, todos los gyms donde existe su email y pueda saltar entre ellos de un toque.

## What Changes

- El banner (`Navbar`) muestra un **switcher de gyms**: los logos de todos los gyms donde el email del alumno tiene una cuenta activa (`User` con ese email, `deletedAt = null`, `role = STUDENT`).
- El switcher **solo aparece cuando hay 2 o más gyms** para ese email. Con un solo gym, el banner queda igual que hoy.
- Tocar el logo del **gym actual** no hace nada (ya estás ahí).
- Tocar el logo de **otro gym** hace un **switch instantáneo de sesión sin reingresar contraseña**: se re-firma el JWT para el `User` de ese gym y se navega a su `gymSlug`.
- **Piso de seguridad (obligatorio):** el switch instantáneo solo se permite si el email de la **sesión actual** tiene `emailVerifiedAt`. Si no está verificado, tocar el logo lleva al **login de ese gym con el email precargado** en vez de switch directo.
- El switcher resuelve los logos desde **`Gym.logo` (DB)** con **fallback a inicial/nombre** del gym (el banner hoy usa un mapa estático que solo cubre 4 gyms; el switcher necesita logos arbitrarios).
- Nuevo endpoint server bajo `src/app/api/auth/` que ejecuta el switch (cambia la cookie de sesión antes de redirigir, porque los server components no pueden mutar cookies y el proxy expulsaría si se navega antes de cambiar la cookie).

## Capabilities

### New Capabilities
- `gym-session-switching`: Permite a un alumno con el mismo email en varios gyms ver esos gyms en el banner y cambiar de sesión entre ellos, con switch instantáneo gated por verificación de email y fallback a login.

### Modified Capabilities
<!-- Ninguna: el cambio no altera requisitos de specs existentes (user-roles, etc.). -->

## Impact

- **UI:** `src/components/layout/Navbar.tsx` (switcher junto al bloque de usuario, desktop y mobile). `src/app/[gymSlug]/layout.tsx` (pasar al Navbar la lista de gyms del email y el flag de email verificado).
- **Auth/sesión:** `src/lib/auth.ts` (posible helper de re-firma del JWT). Nuevo endpoint `src/app/api/auth/switch-gym/` (estilo `src/app/api/auth/kick/route.ts`).
- **Datos:** lectura de `User` (`email`, `gymId`, `role`, `deletedAt`, `emailVerifiedAt`) y `Gym` (`slug`, `logo`, `name`). Sin cambios de schema. Respetar la unicidad parcial `(email, gymId) WHERE deletedAt IS NULL`: el mismo humano tiene N filas `User`, una por gym.
- **Proxy:** el cross-gym guard de `src/proxy.ts` debe seguir funcionando; el switch cambia la cookie antes de navegar al nuevo `gymSlug`.
- **Logos:** consumo de `Gym.logo` desde DB (campo ya existente, hoy sin uso en el header) con fallback; `src/lib/gym-logos.ts` se mantiene para el logo principal del gym actual.
