## Why

Hoy Wody solo permite usar la plataforma como miembro de un gimnasio o box (ruta `[gymSlug]`, fila en `User` ligada a un `gymId`). Hay personas que entrenan por su cuenta y quieren llevar sus rutinas y récords sin pertenecer a una instalación, pero no tenemos un flujo para eso. Queremos abrirles el producto sin romper el invariante multi-tenant ni habilitar registro masivo: solo entran emails que un operador haya aprobado previamente en una whitelist.

## What Changes

- Nuevo `GymKind` value: `PERSONAL`. Existirá un único registro de tipo `PERSONAL` con slug reservado `personal` que actúa como tenant compartido para todos los usuarios individuales. No es un gym real: no tiene profes, grupos, ingresos, cupones ni billing.
- Nueva tabla `PersonalAccessWhitelist` con `email` único y metadatos (`createdAt`, `note`, `createdById`). Solo emails presentes en esta tabla pueden completar el registro personal.
- Nuevo flujo público de registro fuera de `[gymSlug]` (ej. `/registro-personal`): el usuario carga sus datos (nombre, email, contraseña) y el sistema **siempre responde igual** ("si tu email está autorizado te llegará un mail de bienvenida para confirmar tu cuenta") para evitar enumeración de la whitelist. Si el email está en la whitelist, el sistema crea un `User` con `role = STUDENT`, `gymId = <gym personal>`, sin `teacherId`, sin `groupId`, **con `password` ya cargado pero `emailVerifiedAt = null`**, y dispara un email de confirmación con token tipo `INVITE` (reutilizando `VerificationToken`). Al hacer click en el link, la cuenta queda activada (`emailVerifiedAt` seteado) y el usuario puede loguearse. Si el email no está en la whitelist, no se hace nada (no se crea User, no se manda mail).
- Pantallas de personal mode bajo `/personal/...`: la app reutiliza la UI existente de STUDENT pero **oculta**: "Mi rutina" (la solicitud de rutina al profe), grupos, profes, ingresos / control de accesos, cupones, billing.
- Habilitar a usuarios personales a crear sus propias rutinas (`Wod`) y RMs sin necesidad de un profe asignado. Conceptualmente equivale a `canCreateOwnRoutines = true` para todo usuario personal.
- Nueva sección de admin global (no admin de gym) para gestionar la whitelist: agregar / quitar / listar emails. Acceso restringido por rol o flag específico — no es el ADMIN de cada gym.

No hay BREAKING para tenants existentes: gyms `GYM` y `BOX` siguen funcionando igual.

## Capabilities

### New Capabilities
- `personal-mode`: usuarios individuales que usan Wody sin pertenecer a un gimnasio ni box, viviendo en un tenant especial `PERSONAL`, gestionando sus propias rutinas y RMs. Incluye la whitelist de acceso, el flujo de registro público, las restricciones de UI (qué ven y qué no), y la administración global de la whitelist.

### Modified Capabilities
<!-- Ninguna. user-roles y user-soft-delete no cambian sus requirements: los usuarios personales son STUDENT estándar dentro del tenant personal. -->

## Impact

- **Schema (Prisma)**: nuevo valor en enum `GymKind`, nueva tabla `PersonalAccessWhitelist`, posible flag o enum nuevo para distinguir admin global de admin de gym (a definir en design.md).
- **Seed**: seed de inicialización del gym personal único con slug reservado.
- **Routing (App Router)**: nuevas rutas fuera de `[gymSlug]` para el registro personal y para la app personal (`/yo/...` o equivalente). Layout que no muestra navbar de gym tradicional cuando el usuario es personal.
- **Auth (NextAuth)**: el flujo de login funciona igual (email + password), pero la sesión necesita resolver hacia el gym personal cuando el usuario pertenece a él. Posible ajuste en `auth()` y en `lib/`.
- **Server actions**: nuevo action de registro personal. Reuso de actions existentes de `wod` y `rm` para usuarios personales (deben aceptar al usuario auto-creando sus propias rutinas).
- **UI**: filtrado condicional en componentes de navegación, dashboard, sidebar, etc. para esconder secciones que no aplican.
- **Admin global**: nueva sección/página de gestión de whitelist. Define quién puede acceder (probablemente un sub-rol de ADMIN o flag a nivel User).
- **Sin impacto** en: billing/MercadoPago, control de accesos, cupones, grupos, TeacherStudent, push notifications (los usuarios personales pueden recibir push de su propia actividad, sin cambios en el subsistema).
- **Reservar slug**: `personal` no debe poder ser registrado por un gym normal — crear una lista de slugs reservados (no existe hoy).
