# lite-student-accounts Specification

## Purpose
TBD - created by archiving change add-lite-student-accounts. Update Purpose after archive.
## Requirements
### Requirement: Modelo de cuenta `LITE` en `User`

El sistema SHALL incorporar un enum `AccountKind` con valores `FULL` y `LITE`, y un campo `User.accountKind` de tipo `AccountKind` con valor por defecto `FULL`. El campo `User.email` SHALL pasar a ser nullable. El campo `User.password` SHALL seguir siendo nullable (sin cambios).

La unicidad parcial `(email, gymId) WHERE deletedAt IS NULL` SHALL mantenerse: en PostgreSQL `NULL != NULL`, por lo cual múltiples filas con `email = NULL` en el mismo gym no colisionan.

La unicidad parcial `(memberNumber, gymId) WHERE deletedAt IS NULL` SHALL mantenerse y SHALL seguir siendo el identificador estable de cualquier `User` dentro de un gym, sin importar su `accountKind`.

#### Scenario: Creación de fila lite no colisiona con otra lite

- **GIVEN** un gym G con un usuario lite L1 (`email=null`, `accountKind=LITE`, `memberNumber=42`)
- **WHEN** se inserta L2 con `email=null`, `accountKind=LITE`, `memberNumber=43`, mismo `gymId=G`
- **THEN** el INSERT tiene éxito sin violar índices únicos

#### Scenario: Lite y full con mismo nombre en mismo gym

- **GIVEN** un gym G con un usuario full F (`email="ana@x.com"`, `name="Ana"`, `memberNumber=10`)
- **WHEN** el admin crea un lite L (`email=null`, `name="Ana"`, `memberNumber=11`) en G
- **THEN** la creación tiene éxito y ambos coexisten — el `memberNumber` los distingue

### Requirement: Crear alumno lite vía `UserForm`

El `UserForm` SHALL ofrecer tres modos mutuamente exclusivos: `invite`, `password`, y `lite`. Los modos `invite` y `password` SHALL conservar su comportamiento actual. El modo `lite` SHALL:

- No mostrar campos de `email` ni `password`.
- Mantener visible el campo `name` (obligatorio).
- Mantener visible el selector opcional de profe (`teacherId`).
- Mostrar un campo **obligatorio** `nextPaymentDate` (DatePicker) que SHALL precargarse con la fecha de hoy en Argentina (UTC-3) y SHALL aceptar únicamente fechas `>= hoy`. El input HTML SHALL tener `min={today}` para la validación de cliente.
- Crear `User` con `role="STUDENT"`, `studentType="GENERAL"`, `accountKind="LITE"`, `canCreateOwnRoutines=false`, `email=null`, `password=null`, `emailVerifiedAt=null`, y `nextPaymentDate` igual al valor enviado por el formulario (no al default `now()` del schema).

La Server Action `createUser` (rama lite) SHALL:

- Leer `nextPaymentDate` del `FormData` como string `YYYY-MM-DD`.
- Validar formato y rango con el mismo patrón que `parseJoinRequestPaymentDate` en `src/lib/dates.ts`: regex `/^\d{4}-\d{2}-\d{2}$/`, parseo a `Date` UTC, y comprobación de que la fecha sea `>= getTodayArgentina()`.
- Si la validación falla, devolver `{ success: false, error: <mensaje en español> }` **antes** de iniciar la transacción de creación, de modo que no se incremente `Gym.nextMemberNumber` ni se cree ninguna fila.
- Pasar la fecha parseada al `prisma.user.create` dentro de la misma transacción atómica que ya incrementa `Gym.nextMemberNumber` y opcionalmente crea `TeacherStudent`.

Los tres modos SHALL mostrar el `memberNumber` estimado antes de crear, calculado como `MAX(memberNumber WHERE deletedAt IS NULL) + 1` por gym. El número mostrado SHALL identificarse explícitamente como **estimado**; el valor real asignado SHALL aparecer en el toast de éxito post-creación.

El sistema SHALL exponer una env var `NEXT_PUBLIC_ENABLE_LITE_USERS` que actúe como kill-switch: si su valor es `"false"`, el modo `lite` SHALL ocultarse del `UserForm` (los otros dos modos siguen disponibles). Para cualquier otro valor, incluido ausencia, el modo `lite` SHALL estar visible.

#### Scenario: Admin crea lite exitosamente

- **GIVEN** un ADMIN autenticado en gym G donde el próximo memberNumber estimado es 45
- **WHEN** el ADMIN abre `UserForm`, ve "Próximo nº de socio (estimado): 45", elige modo `lite`, escribe `name="Carlos"`, deja la fecha de próximo pago en el valor por defecto (hoy) y envía
- **THEN** se crea un `User` con `email=null`, `password=null`, `accountKind="LITE"`, `role="STUDENT"`, `studentType="GENERAL"`, `canCreateOwnRoutines=false`, `gymId=G`, un `memberNumber` asignado atómicamente, y `nextPaymentDate` igual a hoy
- **AND** el toast muestra el `memberNumber` real asignado (p. ej. "Alumno Carlos creado con número 45")

#### Scenario: Admin elige fecha futura para próximo pago

- **GIVEN** un ADMIN autenticado en gym G y la fecha de hoy es 2026-05-22
- **WHEN** el ADMIN elige modo `lite`, escribe `name="Lucía"` y selecciona próximo pago `2026-06-22`
- **THEN** se crea el `User` con `nextPaymentDate=2026-06-22`
- **AND** no es necesario abrir la sección de pagos para corregir la fecha

#### Scenario: Fecha de próximo pago en el pasado es rechazada

- **GIVEN** un ADMIN autenticado en gym G y la fecha de hoy es 2026-05-22
- **WHEN** el ADMIN envía el formulario lite con `nextPaymentDate=2026-05-21`
- **THEN** `createUser` devuelve `{ success: false, error: <mensaje indicando que la fecha no puede ser pasada> }`
- **AND** no se crea ningún `User`
- **AND** `Gym.nextMemberNumber` no se incrementa

#### Scenario: Fecha de próximo pago con formato inválido es rechazada

- **WHEN** el ADMIN envía el formulario lite con `nextPaymentDate="22/05/2026"` o `nextPaymentDate=""`
- **THEN** `createUser` devuelve `{ success: false, error: <mensaje indicando formato inválido> }`
- **AND** no se crea ningún `User`

#### Scenario: Preview de memberNumber es estimado, no reservado

- **GIVEN** dos ADMINs A1 y A2 viendo "Próximo nº de socio: 50" simultáneamente
- **WHEN** A1 envía el formulario primero
- **THEN** A1 obtiene `memberNumber=50`
- **AND** cuando A2 envía, A2 obtiene `memberNumber=51` (asignado atómicamente, no 50)
- **AND** la creación de A2 no falla por colisión

#### Scenario: Kill-switch oculta el modo lite

- **GIVEN** el deploy con `NEXT_PUBLIC_ENABLE_LITE_USERS="false"`
- **WHEN** un ADMIN abre `UserForm`
- **THEN** solo se ofrecen los modos `invite` y `password`; el toggle de `lite` no se renderiza

### Requirement: Restricciones de operación sobre alumnos lite

El sistema SHALL impedir, mediante guards en los server actions correspondientes (no solo en UI), que un alumno con `accountKind="LITE"`:

- Sea target de un `Wod` (`targetType="STUDENT"` con `targetStudentId` apuntando a un lite SHALL ser rechazado por `validateTarget`).
- Tenga su `studentType` cambiado vía `toggleStudentType`.
- Tenga su `canCreateOwnRoutines` cambiado vía `setCanCreateOwnRoutines`.
- Reciba updates de `email` o `password` vía `updateStudent` (esos cambios solo SHALL ocurrir a través de `upgradeLiteUser`).

Los servidores SHALL devolver errores explícitos en español cuando se intente cualquiera de esas operaciones sobre un lite (no SHALL aceptar silenciosamente como no-op).

El sistema NO SHALL crear `RM` asociados a lites por construcción (un lite no posee sesión y la creación de RM requiere `session.user.id === student.id`). El spec NO requiere guard adicional en `src/actions/rm.ts`.

#### Scenario: Asignar Wod a lite falla

- **GIVEN** un lite L en gym G
- **WHEN** un TEACHER intenta crear un `Wod` con `targetType="STUDENT"`, `targetStudentId=L.id`
- **THEN** `validateTarget` rechaza con error "no se pueden asignar rutinas a un alumno lite"

#### Scenario: `updateStudent` rechaza email/password en lite

- **WHEN** se invoca `updateStudent` sobre un lite con `email` o `password` no vacíos
- **THEN** el servidor responde con error indicando que para asignar email/password al lite hay que usar el flujo de conversión a cuenta completa

#### Scenario: `toggleStudentType` rechaza lite

- **WHEN** se invoca `toggleStudentType` sobre un lite
- **THEN** el servidor responde con error indicando que `studentType` no aplica a alumnos lite

### Requirement: Operaciones permitidas sobre alumnos lite

El sistema SHALL aceptar sobre alumnos lite, sin guards adicionales:

- Registro de pagos vía `registerPayment` (el lite tiene `role="STUDENT"`, pasa el guard existente).
- Asignación / desasignación de profe vía `TeacherStudent`.
- Búsqueda manual en el kiosko vía `lookupForKiosk` por `memberNumber`.
- Registro de `AccessLog` vía `decideCheckin` (con `userId` apuntando al lite y `decidedById` apuntando al operador).
- Soft-delete (`deletedAt`) y bloqueo (`blockedAt`).
- Marcado como `paymentExempt` con su `paymentExemptReason`.

#### Scenario: Registrar pago a lite

- **GIVEN** un lite L y un ADMIN A en gym G
- **WHEN** A registra un pago con `studentId=L.id`, `amount=15000`
- **THEN** el `Payment` se crea con `studentId=L.id`, `recordedById=A.id`, sin error

#### Scenario: Búsqueda en kiosko por memberNumber

- **GIVEN** un lite L con `memberNumber=87` en gym G
- **WHEN** el operador en el kiosko ingresa `"87"` en el campo de búsqueda manual
- **THEN** `lookupForKiosk` devuelve la ficha de L con su nombre, memberNumber, nextPaymentDate, blockedAt
- **AND** la búsqueda por email no encuentra a L (no tiene email)

#### Scenario: Asignar profe a lite

- **GIVEN** un lite L y un TEACHER T en gym G
- **WHEN** se crea la relación `TeacherStudent { teacherId=T.id, studentId=L.id }`
- **THEN** la fila se crea sin error y L aparece en el listado de alumnos de T

### Requirement: Login de alumnos lite deshabilitado

El sistema NO SHALL permitir login a usuarios con `email=null`. El Credentials provider de NextAuth (`src/lib/auth.ts`) SHALL filtrar candidatos con `email: { not: null }` además del filtro `deletedAt: null` ya existente, como defensa en profundidad.

Adicionalmente, el flujo de invitación (envío de email con token) NO SHALL aplicar a lites: el componente `ResendInvitationButton` SHALL no renderizarse en filas cuyo usuario tenga `accountKind="LITE"` o `email=null`.

#### Scenario: Intento de login con email vacío

- **WHEN** un cliente intenta autenticarse con `email=""` o `email=null`
- **THEN** NextAuth rechaza la autenticación sin consultar la DB (la validación previa del provider corta el flujo)

#### Scenario: Intento hipotético de login con email null en DB

- **GIVEN** un lite L con `email=null` en DB
- **WHEN** alguien intenta autenticarse con cualquier email que la query pudiera evaluar como nulo
- **THEN** el filtro `email: { not: null }` excluye a L del result set; el login no encuentra candidato y falla

### Requirement: Conversión de lite a cuenta completa (upgrade)

El sistema SHALL exponer una server action `upgradeLiteUser(userId, { mode, email, password?, studentType, canCreateOwnRoutines? })` que convierte un `User` con `accountKind="LITE"` en un `User` con `accountKind="FULL"`, preservando su `memberNumber`, `paymentExempt`, `paymentExemptReason`, `nextPaymentDate`, `blockedAt`, todos sus `Payment`, `AccessLog`, `TeacherStudent`, y `gymId`.

El parámetro `mode` SHALL ser `"invite"` o `"password"`, replicando los modos de `createUser`:

- `mode="invite"`: setea `email`, deja `password=null`, `emailVerifiedAt=null`, y crea un `VerificationToken` de tipo INVITE con expiración a 7 días. La misma transacción crea el token y actualiza el usuario.
- `mode="password"`: setea `email`, hashea `password` con bcrypt, `emailVerifiedAt=now()`.

La server action SHALL replicar el pre-check de colisiones de `createUser`: si el `email` ya existe en el mismo gym, devolver error diferenciado según el estado del titular existente (activo / pendiente de activación / bloqueado / soft-deleted).

La server action SHALL validar dentro de la transacción que `user.accountKind === "LITE"` antes de aplicar cambios (defensa contra race conditions de dobles invocaciones).

La server action SHALL setear `canCreateOwnRoutines` según las reglas de `createUser`:
- Si `role` final es TEACHER o ADMIN → `true`.
- Si `studentType="PERSONALIZED"` sin profe asignado → `true`.
- Si `studentType="PERSONALIZED"` con profe asignado → según parámetro recibido (default `false`).
- Si `studentType="GENERAL"` → `false`.

Solo un ADMIN del mismo gym SHALL poder invocar `upgradeLiteUser`.

#### Scenario: Upgrade exitoso con password

- **GIVEN** un lite L (`memberNumber=42`, dos `Payment` históricos, profe T asignado) en gym G
- **WHEN** un ADMIN invoca `upgradeLiteUser(L.id, { mode: "password", email: "carlos@x.com", password: "secret123", studentType: "GENERAL" })`
- **THEN** L pasa a `accountKind="FULL"`, `email="carlos@x.com"`, `password=<hash>`, `studentType="GENERAL"`, `canCreateOwnRoutines=false`, `emailVerifiedAt=<now>`
- **AND** `L.memberNumber` sigue siendo 42
- **AND** las dos filas de `Payment` siguen apuntando a L
- **AND** la relación `TeacherStudent { teacherId=T.id, studentId=L.id }` sigue existiendo
- **AND** L puede loguearse con `email + password`

#### Scenario: Upgrade exitoso con invite

- **GIVEN** un lite L en gym G
- **WHEN** un ADMIN invoca `upgradeLiteUser(L.id, { mode: "invite", email: "ana@x.com", studentType: "PERSONALIZED" })`
- **THEN** L pasa a `accountKind="FULL"`, `email="ana@x.com"`, `password=null`, `emailVerifiedAt=null`
- **AND** se crea un `VerificationToken` de tipo INVITE para "ana@x.com" en G, con expiración a 7 días
- **AND** `canCreateOwnRoutines=true` (PERSONALIZED sin profe asignado)
- **AND** L no puede loguearse aún (password null) — debe activar primero su cuenta

#### Scenario: Upgrade con email ya en uso

- **GIVEN** un lite L en gym G y un usuario full F (`email="ana@x.com"`) activo en G
- **WHEN** un ADMIN invoca `upgradeLiteUser(L.id, { mode: "password", email: "ana@x.com", ... })`
- **THEN** el servidor responde con error diferenciado: "ya existe una cuenta activa con ese email en este gym"
- **AND** L no se modifica

#### Scenario: Upgrade sobre un user ya FULL

- **GIVEN** un usuario F con `accountKind="FULL"`
- **WHEN** un ADMIN invoca `upgradeLiteUser(F.id, ...)`
- **THEN** el servidor responde con error "el usuario no es lite, no aplica conversión"
- **AND** F no se modifica

#### Scenario: Upgrade por TEACHER (no ADMIN)

- **WHEN** un TEACHER invoca `upgradeLiteUser`
- **THEN** el servidor rechaza con error de autorización
- **AND** no se modifica nada

### Requirement: Visualización de alumnos lite en panel admin

La tabla de alumnos en `src/app/[gymSlug]/admin/page.tsx` SHALL:

- Renderizar la columna de email de forma null-safe: para usuarios con `email=null`, mostrar texto "Sin email" o el `memberNumber` formateado (e.g. `#0045`).
- Marcar visualmente las filas de lites (badge, color o columna dedicada).
- Ocultar el botón `ResendInvitationButton` en filas de lites.
- Mostrar un botón "Convertir a cuenta completa" en filas de lites que abra el `UpgradeLiteDialog`.
- Ofrecer un filtro Lite / Full / Todos en la cabecera de la tabla.

Los componentes `ResendInvitationButton`, `EditStudentButton` y `StudentEditor` SHALL aceptar `email: string | null` en sus props tipadas. Cuando `email` es `null`, los inputs y acciones que dependen de email SHALL estar deshabilitados o no renderizados.

#### Scenario: Tabla muestra lites diferenciados

- **GIVEN** un gym G con 3 alumnos: 2 full (uno activo, uno pendiente de invitación) y 1 lite
- **WHEN** un ADMIN abre la tabla de alumnos
- **THEN** las 3 filas se listan; la fila del lite muestra `#nnnn` o "Sin email" en la columna de email y un badge "Lite"
- **AND** los botones de "Reenviar invitación" no aparecen en la fila del lite
- **AND** el botón "Convertir a cuenta completa" aparece solo en la fila del lite

#### Scenario: Filtro Lite

- **GIVEN** un gym G con 5 fulls y 2 lites
- **WHEN** el ADMIN selecciona el filtro "Lite"
- **THEN** la tabla muestra solo las 2 filas con `accountKind="LITE"`

