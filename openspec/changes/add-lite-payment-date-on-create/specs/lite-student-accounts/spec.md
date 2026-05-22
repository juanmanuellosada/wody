## MODIFIED Requirements

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
