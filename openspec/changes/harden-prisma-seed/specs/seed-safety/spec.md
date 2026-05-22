## ADDED Requirements

### Requirement: Hard guard contra DATABASE_URL no-local

El script de seed destructivo (`npm run seed:reset`) SHALL abortar inmediatamente con código de salida distinto de 0 si el hostname extraído de `DATABASE_URL` no pertenece a una allowlist explícita de hostnames considerados "locales".

La allowlist mínima incluye: `localhost`, `127.0.0.1`, `::1`, `postgres` (hostname típico de docker-compose), `db` (otro hostname típico de docker-compose).

El mensaje de error MUST identificar el hostname detectado y explicar exactamente cómo bypassear la guard si el usuario está seguro de que es un entorno local no-estándar.

#### Scenario: DATABASE_URL apunta a Neon prod

- **WHEN** el usuario ejecuta `npm run seed:reset` con `DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.aws.neon.tech/wody`
- **THEN** el script aborta con código 1 antes de ejecutar cualquier operación de DB
- **AND** el mensaje de error contiene el hostname `ep-xxx-pooler.aws.neon.tech` y lo identifica como no-local

#### Scenario: DATABASE_URL apunta a localhost

- **WHEN** el usuario ejecuta `npm run seed:reset` con `DATABASE_URL=postgresql://user:pass@localhost:5432/wody_dev` y la segunda guard satisfecha
- **THEN** la guard de hostname pasa y el script continúa a la siguiente validación

#### Scenario: DATABASE_URL ausente

- **WHEN** el usuario ejecuta `npm run seed:reset` sin `DATABASE_URL` definido
- **THEN** el script aborta con código 1 y mensaje explicando que se requiere `DATABASE_URL`

#### Scenario: DATABASE_URL malformado

- **WHEN** el usuario ejecuta `npm run seed:reset` con un `DATABASE_URL` no parseable como URL válida
- **THEN** el script aborta con código 1 y mensaje explicando el error de parseo

### Requirement: Confirmación explícita via env var

El script de seed destructivo SHALL requerir la variable de entorno `ALLOW_DESTRUCTIVE_SEED=1` para ejecutar cualquier operación `deleteMany`. Esta es una capa adicional independiente de la guard de hostname.

#### Scenario: Falta ALLOW_DESTRUCTIVE_SEED

- **WHEN** el usuario ejecuta `npm run seed:reset` con hostname local válido pero sin `ALLOW_DESTRUCTIVE_SEED=1`
- **THEN** el script aborta con código 1 antes de ejecutar `deleteMany`
- **AND** el mensaje de error indica que se requiere `ALLOW_DESTRUCTIVE_SEED=1` y muestra el comando completo correcto a ejecutar

#### Scenario: ALLOW_DESTRUCTIVE_SEED con valor distinto de "1"

- **WHEN** el usuario ejecuta `npm run seed:reset` con `ALLOW_DESTRUCTIVE_SEED=true` o `ALLOW_DESTRUCTIVE_SEED=yes`
- **THEN** el script aborta — solo el valor literal `"1"` es aceptado

#### Scenario: Ambas guards satisfechas

- **WHEN** el usuario ejecuta `ALLOW_DESTRUCTIVE_SEED=1 npm run seed:reset` con `DATABASE_URL` apuntando a localhost
- **THEN** las dos guards pasan y el script ejecuta el reset completo

### Requirement: Seed por defecto es idempotente

El comando `npm run seed` SHALL ser idempotente: ejecutarlo N veces produce el mismo estado final que ejecutarlo 1 vez. NUNCA debe contener llamadas a `deleteMany` sin clausula `where`, ni `truncate`, ni operaciones que dependan de un estado de DB vacío para no fallar.

#### Scenario: Primera ejecución sobre DB vacía

- **WHEN** el usuario ejecuta `npm run seed` sobre una DB local vacía
- **THEN** la DB queda con los datos base creados (gym, admin, etc.)
- **AND** el script termina con código 0

#### Scenario: Re-ejecución sobre DB ya seedeada

- **WHEN** el usuario ejecuta `npm run seed` sobre una DB que ya fue seedeada
- **THEN** el script termina con código 0 sin errores
- **AND** los datos base no se duplican ni se pierden

#### Scenario: Re-ejecución después de modificar datos base manualmente

- **WHEN** el usuario modifica un atributo de un gym/user seedeado (ej. cambia `primaryColor`) y luego ejecuta `npm run seed`
- **THEN** el seed actualiza los atributos al estado canónico (`upsert`)
- **AND** no se pierden datos no-seedeados (otros gyms, otros users, WODs, RMs, etc.)

### Requirement: Separación de scripts npm

`package.json` SHALL definir dos scripts separados con semántica clara: `seed` (idempotente, seguro) y `seed:reset` (destructivo, protegido por guards).

`package.json` MUST NOT contener el bloque `prisma.seed` que dispara ejecución implícita del seed por comandos de Prisma.

#### Scenario: Inspección de package.json

- **WHEN** un agente lee `package.json`
- **THEN** encuentra `"seed": "tsx prisma/seed.ts"` para el script idempotente
- **AND** encuentra `"seed:reset": "tsx prisma/seed-reset.ts"` (o equivalente) para el destructivo
- **AND** NO encuentra ninguna entrada `"prisma": { "seed": "..." }`

#### Scenario: Ejecución implícita de seed por Prisma

- **WHEN** el usuario ejecuta `npx prisma migrate reset` (que normalmente dispara el seed declarado en `package.json`)
- **THEN** Prisma NO ejecuta ningún seed automáticamente — el dev debe correr el seed explícitamente después

### Requirement: Documentación del modelo de seeds

El proyecto SHALL incluir documentación accesible (en `prisma/README.md` o equivalente) que explique: qué hace cada comando de seed, cuándo correrlo, el riesgo de mezclar credenciales de prod y dev, y el procedimiento correcto para resetear el entorno local.

`AGENTS.md` SHALL contener una sección "Seguridad de seeds" con las invariantes clave (no `deleteMany` sin filtro, no seeds en build de Vercel, allowlist de hostnames, etc.) y un puntero al README detallado.

#### Scenario: Onboarding de nuevo desarrollador o agente

- **WHEN** un nuevo dev o agente lee `AGENTS.md` para entender el proyecto
- **THEN** encuentra la sección "Seguridad de seeds" con las invariantes y el link al `prisma/README.md`

#### Scenario: Dev quiere resetear entorno local

- **WHEN** el dev consulta `prisma/README.md` buscando cómo resetear su DB local
- **THEN** encuentra instrucciones explícitas del comando exacto: `ALLOW_DESTRUCTIVE_SEED=1 npm run seed:reset`
- **AND** encuentra una advertencia sobre nunca usar el `DATABASE_URL` de Neon prod en `.env.local`
