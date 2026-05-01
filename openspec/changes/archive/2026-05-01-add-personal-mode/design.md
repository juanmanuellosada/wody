## Context

Wody hoy es 100% multi-tenant: toda fila de `User`, `Wod`, `RM`, `JoinRequest`, etc. está atada a un `gymId`, y el routing está organizado bajo `[gymSlug]`. La sesión de NextAuth fija el `gymSlug` en el JWT al loguearse (ver `src/lib/auth.ts:31-107`); no existe noción de "super-admin" ni de usuario sin gym.

El flujo de auto-registro existente (`src/actions/join-request.ts`) ya resuelve el patrón "formulario público → email → User creado" con anti-enumeración. Vamos a apoyarnos en él en lo conceptual pero el destino es distinto: en vez de crear un `JoinRequest` que un admin de gym aprueba, el alta personal queda gobernada por una whitelist precargada (no hay bandeja de aprobación).

Constraints del producto:
- No abrir registro masivo. Solo emails preautorizados.
- No exponer si un email está o no en la whitelist (anti-enumeración).
- Mínima fricción para el usuario: el email de bienvenida es la única confirmación.
- Reusar todo lo posible (auth, schema, soft-delete, push, server actions de WOD/RM).

## Goals / Non-Goals

**Goals:**
- Permitir a usuarios individuales registrarse y usar Wody sin pertenecer a un gimnasio o box, dentro del invariante multi-tenant existente.
- Gestionar el acceso vía whitelist en BD; el formulario público responde igual con email autorizado o no.
- Reusar el modelo `User`, las server actions de `wod` y `rm`, y el flujo de activación por token (`VerificationToken` tipo `INVITE`).
- Habilitar a un operador de plataforma a gestionar la whitelist desde la UI (no por seed).
- Mantener cero impacto en gyms `GYM` y `BOX` existentes.

**Non-Goals:**
- Pagos / cuotas / billing para usuarios personales (no hay nada que cobrar; el tenant personal no tiene `nextPaymentDate` operativo).
- Múltiples tenants personales (un solo gym `PERSONAL` compartido, no un gym por usuario).
- Switcher de gym en runtime para usuarios que sean a la vez personales y de un gym tradicional. Si el mismo email existe en ambos, NextAuth ya resuelve por `gymSlug` opcional al login (`src/lib/auth.ts:36-42`).
- Migrar usuarios existentes de un gym tradicional al modo personal.
- Notificaciones push diferenciadas (push existente sirve sin cambios, ya está acotado por `pushSubscriptions` por usuario).
- Control de accesos, kiosk, cupones, grupos, profes en el tenant personal.

## Decisions

### D1: Un único gym `PERSONAL` compartido, no uno por usuario

**Decisión:** Crear un único registro en `Gym` con `kind = PERSONAL` y un slug reservado (propuesta: `personal`). Todos los usuarios personales tienen `gymId` apuntando a esa fila.

**Por qué:**
- Mantiene intactos los índices y constraints actuales (`@@index([email, gymId])`, `@@index([gymId, memberNumber])`).
- Las queries existentes que filtran por `gymId` siguen funcionando sin cambios.
- Crear un gym por usuario explotaría innecesariamente la cardinalidad de `Gym` (mil usuarios = mil gyms) y rompería supuestos en seeds, en consultas de listado, y en `nextMemberNumber`.

**Alternativas consideradas:**
- *`gymId` nullable*: invasivo (rompe unicidad compuesta, requiere revisar cada query). Descartado.
- *Un gym por usuario*: cardinalidad explosiva y sin valor real (no comparten nada entre sí). Descartado.

### D2: Slug reservado `personal` y validación de slugs reservados

**Decisión:** El slug del gym personal es `personal`. Crear un módulo `src/lib/reserved-slugs.ts` con un `Set<string>` que incluya al menos `personal`, `admin`, `api`, `app`, `validar`, `demo`, `instalar`, `registro-personal`. La creación o renombre de gyms (hoy solo por seed, pero a futuro) debe validar contra este set.

**Por qué:**
- Hoy no hay validación de slugs (ningún archivo del repo lo bloquea); cualquier seed podría intentar crear un gym con slug `personal`. Mejor proteger el invariante desde ya.
- El set queda en código (no en BD) porque cambia con el roadmap (cada nueva ruta pública potencialmente reserva un slug).

**Alternativas consideradas:**
- *Tabla `ReservedSlug` en BD*: overhead innecesario para una lista corta y estática.
- *Validar solo al crear nuevos gyms*: no protege gyms creados por seed antes de la validación. Mejor centralizar en una constante consultada desde cualquier seed nuevo.

### D3: Whitelist como tabla `PersonalAccessWhitelist`

**Decisión:** Nueva tabla con esta forma:

```prisma
model PersonalAccessWhitelist {
  id          String   @id @default(cuid())
  email       String   @unique  // siempre lowercase
  note        String?           // texto libre del operador (origen, contexto)
  createdAt   DateTime @default(now())
  createdById String?           // User.id del operador que la agregó
  consumedAt  DateTime?         // marca cuando un User personal fue creado con este email
  createdBy   User?    @relation("WhitelistCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
}
```

**Por qué:**
- `email @unique` garantiza idempotencia y simplifica queries.
- `consumedAt` da auditoría: sabemos qué entradas ya se usaron y cuáles esperan.
- Conservamos la entrada después del consumo (no se borra) por si hay que rastrear quién autorizó qué.
- `createdById` con `SetNull` evita perder la entrada si el operador es soft-deleted.

**Alternativas consideradas:**
- *Borrar la entrada al consumirla*: pierde auditoría y dificulta detectar reusos.
- *Boolean `consumed` en vez de timestamp*: menos información, mismo costo.

### D4: Operador de plataforma — flag `User.isPlatformAdmin`, no rol nuevo

**Decisión:** Agregar `User.isPlatformAdmin: Boolean @default(false)` y autorizar la gestión de whitelist solo a usuarios con ese flag. El flag se setea manualmente en BD (no hay UI para promover a platform admin desde la app).

**Por qué:**
- `Role` actual es per-gym (ADMIN, TEACHER, STUDENT, ACCESS) y semánticamente no calza con "operador global". Agregar un valor `PLATFORM_ADMIN` al enum mezclaría dos ortogonales (rol dentro del gym vs alcance plataforma).
- Un flag booleano es ortogonal y minimamente invasivo. Un user puede ser `ADMIN` de un gym y a la vez `isPlatformAdmin = true`, sin contradicción.
- Limitar la promoción a "manual en BD" mantiene la superficie de ataque chica para una capacidad sensible.

**Alternativas consideradas:**
- *Nuevo `Role.PLATFORM_ADMIN`*: rompe la asunción de que `Role` es per-gym y obligaría a casos especiales en cada check de autorización existente.
- *Tabla separada `PlatformAdmin(userId)`*: sobrediseño para una flag.
- *Env var con lista de emails*: difícil de mantener, cambia despliegue por cada alta/baja.

### D5: Routing del modo personal — `/personal/*` y registro en `/registro-personal`

**Decisión:**
- **Registro público:** `/registro-personal` — fuera de `[gymSlug]`. Página estática con formulario, sin Navbar.
- **Activación:** `/registro-personal/confirmar/[token]` — consume el `VerificationToken` (tipo `INVITE`) y redirige a `/login`.
- **App del usuario personal:** `/personal/*` — el slug `personal` cae naturalmente en el segmento `[gymSlug]` existente. El layout de `[gymSlug]/layout.tsx` ya tiene infraestructura para detectar el gym; agregamos un branch para `gym.kind === "PERSONAL"` que monte un Navbar reducido.
- **Admin de whitelist:** `/admin/personal-whitelist` — fuera de `[gymSlug]`, gated por `session.user.isPlatformAdmin === true`.

**Por qué:**
- Usar `[gymSlug]` con `slug = "personal"` evita duplicar todo el árbol de rutas (`dashboard/rms`, `dashboard/timers`, etc.). Las páginas existentes que viven bajo `[gymSlug]` se reciclan.
- El registro vive fuera de `[gymSlug]` porque conceptualmente no pertenece a un gym (similar a `/demo` y `/validar/[codigo]`).
- El admin de plataforma no es admin de un gym; mantenerlo fuera de `[gymSlug]` evita confusiones de scope.

**Alternativas consideradas:**
- *Nuevo árbol `/app/*` paralelo a `[gymSlug]`*: duplicaría layouts y páginas; mucho más código, sin ganancia.
- *Login dedicado `/registro-personal/login`*: innecesario, el `/login` global o `/personal/login` ya sirven (la lógica de NextAuth busca por email globalmente cuando no hay gymSlug).

### D6: Filtrado de UI — un helper `isPersonalGym(gymKind)` y branches en Navbar

**Decisión:** Agregar `isPersonalGym(kind: GymKind): boolean` en `src/lib/gym.ts`. En `src/components/layout/Navbar.tsx`, antes de armar `getNavLinks()`, evaluar el kind y devolver un menú reducido si es personal. La lista permitida para personal:
- Mis WODs (las que el usuario crea — siempre habilitado, sin depender de `canCreateOwnRoutines`)
- Mis RMs
- Cronómetros

Lo que **no** se muestra para personal: Panel Admin, Invitaciones, Dashboard Profe, Pagos, Ingresos, Beneficios (cupones), WhatsApp FAB, PaymentStatusBanner. "Mi WOD" (la rutina del día asignada por el profe) tampoco aplica.

**Por qué:**
- El Navbar ya bifurca por rol (`Navbar.tsx:31-89`); agregar una bifurcación más por `kind` mantiene el patrón.
- `isPersonalGym` se vuelve un helper reusable para condicionar componentes en server components y layouts.

**Alternativas consideradas:**
- *Crear un Navbar separado `PersonalNavbar.tsx`*: razonable si la divergencia crece; por ahora el branch interno alcanza y evita duplicación.
- *Marcar cada item del menú con `availableInPersonal: true/false`*: sobreingeniería para una lista corta.

### D7: Reuso del flujo de activación con `VerificationToken` tipo `INVITE`

**Decisión:** El email de bienvenida del modo personal usa el mismo `VerificationToken` con `type = INVITE` que ya existe (`src/actions/account.ts → activateAccount`). El usuario hace click → cae en `/registro-personal/confirmar/[token]` → la action consume el token (que valida, marca `emailVerifiedAt = now()`, y opcionalmente revoca el token).

**Por qué:**
- Reusa toda la infra existente (generación, hashing, expiración, anti-replay).
- En el flujo personal el password ya viene seteado desde el formulario, así que la activación solo confirma el email — la action de activación deberá aceptar este caso (no requerir nuevo password si ya hay uno).

**Alternativas consideradas:**
- *Nuevo `VerificationTokenType.PERSONAL_CONFIRM`*: más explícito pero duplica lógica. Si el comportamiento diverge en el futuro, lo agregamos entonces.

### D8: Anti-enumeración — respuesta uniforme y sin side effects observables

**Decisión:** El server action `submitPersonalRegistration({ name, email, password })`:
1. Valida formato de email y largo de password (>= 6 chars, igual al join-request).
2. Normaliza email a lowercase.
3. Hace una sola query a `PersonalAccessWhitelist` por email.
4. Si existe entrada con `consumedAt = null`: corre la transacción (crear User en gym personal, marcar whitelist consumida, generar token, encolar email).
5. Si **no** existe (o ya está consumida, o el User ya existe): no hace nada.
6. **Siempre** retorna `{ ok: true }` con el mismo timing (no exponer la diferencia por latencia perceptible).

**Por qué:** Idéntico patrón al de `submitJoinRequest` (`src/actions/join-request.ts:17-104`).

**Riesgo:** El timing puede filtrar señal (la rama "encolar email" tarda más). Mitigación: encolar el envío de email es asíncrono (delegar a `sendEmail` que ya existe en `src/actions/account.ts`), así que el response al cliente vuelve antes del envío. Si el envío fuera síncrono, considerar `Promise.race` con un timeout simulado en la rama negativa — no implementarlo ahora; documentarlo si surge.

### D9: `User` personal — defaults y campos no aplicables

**Decisión:** Al crear un User personal:
- `role = STUDENT`
- `gymId = <id del gym personal>`
- `studentType = PERSONALIZED`
- `canCreateOwnRoutines = true`
- `nextPaymentDate = '9999-12-31'` (fecha tope que nunca dispara bloqueo automático en `src/lib/auth.ts`)
- `memberNumber`: igual que el resto, auto-asignado vía `Gym.nextMemberNumber` (no rompe nada).
- `emailVerifiedAt = null` hasta que el usuario confirma.
- `password` ya viene seteado (hash bcrypt) — no es invitación pendiente, solo email no verificado.

**Por qué:** Reusamos los defaults existentes y desactivamos billing con la fecha tope, evitando agregar nullable a `nextPaymentDate` (BREAKING para el resto del sistema). La verificación de bloqueo por fecha vencida (`auth.ts:69`) ya hace la cuenta y nunca disparará para esta fecha.

**Alternativas consideradas:**
- *Hacer `nextPaymentDate` nullable*: cambio invasivo, impacta a todos los gyms.
- *Saltar `auth.ts` para PERSONAL*: agregar branch en login. Funciona pero es lógica adicional para algo que la fecha tope ya resuelve.

### D10: Reuso de server actions de `wod` y `rm`

**Decisión:** No duplicar actions. Las existentes en `src/actions/wod.ts` y `src/actions/rm.ts` ya operan con el `User` autenticado. Para `createWod` puntualmente, hoy escribe `teacherId` con el id del profe; en personal el "teacher" es el propio usuario (es su rutina, no asignada por nadie). Validar:
- En personal, `createWod` debe permitir `teacherId === session.user.id` aunque el rol sea STUDENT.
- `targetType` debe quedar `STUDENT` con `targetStudentId === session.user.id` (es para sí mismo).

Si las actions actuales gatean por rol estrictamente (`role === TEACHER || ADMIN`), agregar un branch que permita `STUDENT` cuando `canCreateOwnRoutines = true` (que por el flujo anterior ya está habilitado para usuarios personales). Esto puede que ya funcione tal cual — verificar al implementar.

**Por qué:** Duplicar acciones es costoso y propenso a divergir. La feature `canCreateOwnRoutines` ya cubre el caso de "STUDENT que crea sus propias rutinas".

## Risks / Trade-offs

- **[Riesgo] Filtrar la existencia de un email en la whitelist por timing del response.** → Mitigación: enviar el email asincrónicamente, fuera del path de respuesta. Aceptamos que un atacante muy paciente podría detectar diferencias estadísticas; la whitelist no es un secreto crítico (no contiene datos del usuario).
- **[Riesgo] Que un seed accidentalmente cree un gym con slug `personal`.** → Mitigación: módulo `reserved-slugs.ts` y validación en cualquier creación futura de gyms. Adicionalmente, la migración crea el gym personal primero, y `slug @unique` lo protege.
- **[Riesgo] Un `isPlatformAdmin` que entra a `/personal/*` ve la UI personal aunque no sea su tenant.** → Mitigación: el flag controla `/admin/personal-whitelist`, no afecta la sesión normal. Si el operador también es usuario personal, vive bajo `/personal` con su `User` personal. Si no tiene `User` en el gym personal, no tiene sesión ahí; debe loguearse a su gym normal.
- **[Riesgo] Mismo email en gym tradicional + en personal genera dos `User` distintos.** → Aceptado: es el modelo multi-tenant actual. Al login sin `gymSlug` NextAuth toma el primero que matchee password. Documentar en `/login` que para forzar uno u otro hay que ir vía la URL del gym (o `/personal/login`).
- **[Riesgo] La whitelist crece sin orden y sin auditoría suficiente.** → Mitigación: `createdById`, `note`, y `consumedAt` cubren lo mínimo. Si más adelante hace falta audit log completo, se agrega después.
- **[Trade-off] Reusar `[gymSlug]` para `/personal` mezcla "tenant real" y "tenant pseudo".** Aceptado a cambio de no duplicar el árbol de rutas. Toda divergencia (UI, autorización) se resuelve con `isPersonalGym(kind)`.
- **[Trade-off] No tenemos tests automatizados.** El proyecto no tiene suite de tests (ver `AGENTS.md`). El plan de migración compensa con verificación manual exhaustiva.

## Migration Plan

1. **Schema:**
   - Agregar `PERSONAL` al enum `GymKind`.
   - Agregar tabla `PersonalAccessWhitelist`.
   - Agregar columna `User.isPlatformAdmin Boolean @default(false)`.
   - `prisma migrate dev` localmente, `prisma migrate deploy` en producción.
2. **Seed:**
   - Crear seed `prisma/seed-personal.ts` que inserta el gym personal con slug `personal`, `kind = PERSONAL`, `name = "Wody Personal"` (o el nombre que se elija), idempotente (skip si ya existe).
   - Documentar en `docs/alta-gym-personal.md` cómo correrlo (paralelo a `docs/alta-nuevo-gym.md`).
3. **Reserved slugs:**
   - Crear `src/lib/reserved-slugs.ts` antes de cualquier nuevo seed o creación dinámica de gyms.
4. **Backend (server actions):**
   - `src/actions/personal-registration.ts`: `submitPersonalRegistration`, `confirmPersonalAccount(token)`.
   - `src/actions/personal-whitelist.ts`: `addToWhitelist`, `removeFromWhitelist`, `listWhitelist` (gated por `isPlatformAdmin`).
   - Ajustes en `src/actions/wod.ts` y `src/actions/rm.ts` solo si las validaciones de rol no permiten hoy a un STUDENT con `canCreateOwnRoutines` operar.
5. **Email:**
   - Plantilla nueva "bienvenida personal" en el sistema de email existente (mismo motor que el de "cuenta aprobada" en join-requests).
6. **UI:**
   - Página `/registro-personal/page.tsx` (formulario + estado de éxito uniforme).
   - Página `/registro-personal/confirmar/[token]/page.tsx` (consume token, redirige a `/login`).
   - Página `/admin/personal-whitelist/page.tsx` (gated por flag).
   - Branch en `src/components/layout/Navbar.tsx` para `kind === PERSONAL`.
   - Branch en `src/app/[gymSlug]/layout.tsx` para no mostrar PaymentStatusBanner ni WhatsAppFab cuando es personal.
   - Helper `isPersonalGym` en `src/lib/gym.ts`.
7. **Auth:**
   - Sin cambios en `src/lib/auth.ts` (la fecha tope `9999-12-31` evita el branch de bloqueo por cuota).
8. **Verificación manual:**
   - Registrar un email no whitelisted → no llega mail, no se crea User, response uniforme.
   - Agregar a whitelist, registrar → llega mail → confirmar → loguear → ver `/personal/dashboard/mis-rutinas` y `/personal/dashboard/rms`.
   - Crear un WOD propio, crear un RM, ver que aparecen.
   - Verificar que NO aparecen Pagos, Ingresos, Beneficios, Admin, etc.
   - Verificar que el navbar de un usuario de gym tradicional no cambió.
   - Loguear como `isPlatformAdmin` y agregar/quitar emails en la whitelist.
9. **Rollback:**
   - El feature es aditivo. Si algo sale mal, deshabilitar las rutas nuevas (eliminar los `page.tsx`) deja el resto intacto. La tabla y el enum value quedan vivos sin uso, sin afectar tenants existentes.

## Copy / Texto

### Mensaje de éxito del formulario (anti-enumeración)

Después del submit, mostrar **siempre** el mismo bloque, independientemente de si el email estaba o no en la whitelist:

> **Listo.**
> Si tu email está autorizado, en los próximos minutos te va a llegar un mail de bienvenida con un link para confirmar tu cuenta.
> Si no lo recibís, revisá la carpeta de spam o escribinos.

### Email de bienvenida (solo se envía si el email estaba en la whitelist)

**Asunto:** `Confirmá tu cuenta de Wody Personal`

**Cuerpo (texto plano + HTML, mismo motor que `cuenta aprobada` de join-requests):**

> Hola {nombre},
>
> Te damos la bienvenida a Wody Personal — la versión de Wody para entrenar por tu cuenta, llevar tus rutinas y récords sin pertenecer a un gimnasio.
>
> Para activar tu cuenta hacé click en el siguiente link:
>
> **[Confirmar mi cuenta]({URL_CONFIRMACION})**
>
> El link es válido por 48 horas. Si expiró o tenés problemas, podés volver a registrarte en {URL_REGISTRO} con el mismo email.
>
> Una vez confirmada la cuenta vas a poder:
> - Crear y editar tus propias rutinas (WODs).
> - Registrar tus récords personales (PRs/RMs).
> - Usar los cronómetros para tus entrenamientos.
>
> Si no fuiste vos quien se registró, ignorá este mail.
>
> ¡A entrenar!
> El equipo de Wody

## Open Questions

- **Restricciones de cantidad de WODs/RMs por usuario personal:** ninguna en este alcance; revisar si surge abuso.
- **Cobro futuro:** no se implementa nada hoy. Si se cobra a futuro, se agrega `nextPaymentDate` real y branch en auth — la fecha tope `9999-12-31` se cambia por la real.

(Cerrado: slug `personal`, sin self-service de borrado, copy del email/form propuesto arriba.)
