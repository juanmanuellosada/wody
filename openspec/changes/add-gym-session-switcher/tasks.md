## 1. Verificación previa (Next 16 + NextAuth 5)

- [x] 1.1 Leer la firma real de `authorize(credentials, request)` y cómo decodificar la cookie de sesión actual dentro de `authorize`/route en `node_modules/next-auth` (NextAuth 5 beta). No asumir APIs de versiones previas.
- [x] 1.2 Confirmar contra `node_modules/next/dist/docs/` el patrón para setear cookies y devolver redirect desde un route handler (Next 16), tomando `src/app/api/auth/kick/route.ts` como referencia existente.
- [x] 1.3 Revisar el formato real de los valores de `Gym.logo` en DB (URL absoluta vs path) para decidir entre `next/image` y `<img>` en el switcher.

## 2. Backend: resolución de gyms del alumno

- [x] 2.1 En `src/app/[gymSlug]/layout.tsx`, cuando `session.user.role === "STUDENT"`, consultar `prisma.user.findMany({ where: { email, deletedAt: null, role: "STUDENT" }, select: { gym: { select: { slug, name, logo } } } })` y derivar la lista de gyms (slug, name, logo).
- [x] 2.2 Pasar al `Navbar` la lista de gyms y el flag `emailVerified` (derivado de `emailVerifiedAt` del usuario actual). Pasar `[]`/omitir cuando no sea STUDENT o haya <2 gyms.

## 3. Backend: switch de sesión seguro

- [x] 3.1 Agregar al provider Credentials en `src/lib/auth.ts` una rama de "switch" que NO compara password y que mintea el token del `User` destino solo tras verificar, del lado del servidor, que existe una sesión actual válida del mismo email con `emailVerifiedAt`. Mantener intacto el flujo de login normal con password.
- [x] 3.2 Asegurar que los callbacks `jwt`/`session` sigan poblando `gymId`, `gymSlug`, `gymKind`, `role`, `studentType`, `canCreateOwnRoutines` para la cuenta destino igual que en el login normal.
- [x] 3.3 Crear el route handler `POST /api/auth/switch-gym` (estilo `src/app/api/auth/kick/route.ts`): valida sesión (STUDENT + `emailVerifiedAt`), resuelve el `User` destino (`email` igual, `deletedAt: null`, `role: STUDENT`, `gym.slug = target`), ejecuta el switch (setea nueva cookie) y redirige a `gymPath(targetSlug, "/")`. Si el email no está verificado, redirige al login del gym destino con `?email=` precargado. Si la cuenta destino no existe, no emite sesión.
- [x] 3.4 Verificar que la cookie de sesión nueva quede seteada ANTES del redirect, de modo que el cross-gym guard de `src/proxy.ts:90` no expulse al llegar al gym destino.

## 4. Frontend: switcher en el banner

- [x] 4.1 En `src/components/layout/Navbar.tsx`, agregar el switcher (junto al bloque de usuario / `onSignOut`) que recibe la lista de gyms y `emailVerified` por props. Renderizar solo si hay 2+ gyms.
- [x] 4.2 Cada ítem muestra el logo del gym desde `gym.logo` con fallback a inicial/nombre cuando es null. Marcar visualmente el gym actual.
- [x] 4.3 Comportamiento al tocar un ítem: gym actual = no-op; otro gym con `emailVerified === true` = POST a `/api/auth/switch-gym`; otro gym con `emailVerified === false` = navegar al login de ese gym con email precargado.
- [x] 4.4 Implementar el switcher en desktop y en el menú mobile (hamburguesa) del `Navbar`.

## 5. Verificación

- [ ] 5.1 Probar manualmente: alumno con email verificado en 2 gyms hace switch directo y no es expulsado por el proxy al aterrizar en el gym destino.
- [ ] 5.2 Probar: alumno con email NO verificado cae al login del gym destino con email precargado.
- [ ] 5.3 Probar: usuario no-STUDENT no ve el switcher; alumno con un solo gym no ve el switcher.
- [ ] 5.4 Probar bypass: POST directo a `/api/auth/switch-gym` sin sesión verificada del mismo email no emite sesión.
- [x] 5.5 `npm run lint` y `npm run build` sin errores.
