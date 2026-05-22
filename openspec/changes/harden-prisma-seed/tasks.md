## 1. Módulo de guards

- [x] 1.1 Crear `prisma/seed-guards.ts` con función `assertLocalDatabaseUrl()` que parsea `process.env.DATABASE_URL` con `new URL(...)`, extrae el hostname, y aborta con `process.exit(1)` y mensaje claro si el hostname no está en la allowlist `["localhost", "127.0.0.1", "::1", "postgres", "db"]`
- [x] 1.2 Agregar función `assertDestructiveSeedAllowed()` en el mismo archivo que verifica `process.env.ALLOW_DESTRUCTIVE_SEED === "1"` y aborta con mensaje que muestra el comando completo correcto si falta
- [x] 1.3 Exportar ambas funciones y agregar un comentario al tope del archivo explicando el rol del módulo y la invariante "default deny" (allowlist, no denylist)

## 2. Refactor de seed.ts a idempotente

- [x] 2.1 Reemplazar `prisma.gym.create` por `prisma.gym.upsert` usando `where: { slug: "unidos-garage" }`
- [x] 2.2 Reemplazar `prisma.user.create` por `prisma.user.upsert` usando la clave compuesta `where: { email_gymId: { email, gymId } }` para admin, teacher, y los dos students
- [x] 2.3 Reemplazar `prisma.teacherStudent.createMany` por loop de `prisma.teacherStudent.upsert` usando `where: { teacherId_studentId: { teacherId, studentId } }`
- [x] 2.4 Para `prisma.wod.createMany`: cambiar a loop de `prisma.wod.upsert` usando la clave natural disponible (revisar schema; si no hay `@@unique`, usar `findFirst` + `create` para mantener idempotencia)
- [x] 2.5 Para `prisma.rM.createMany`: idem WOD — usar `findFirst` por `(studentId, exercise, date)` + `create` para mantener idempotencia (RM no tiene `@@unique` natural)
- [x] 2.6 Eliminar las líneas 82-88 actuales (`console.log("Limpiando base de datos...")` y los cinco `deleteMany`)
- [x] 2.7 Actualizar el `console.log` final para que refleje "Seed idempotente completado" en vez de "Seed completado"
- [ ] 2.8 Verificar manualmente que correr `npm run seed` dos veces seguidas sobre una DB local no falla ni duplica datos

## 3. Script de reset destructivo

- [x] 3.1 Crear `prisma/seed-reset.ts` que importa las dos guards de `seed-guards.ts` y las invoca al inicio (orden: hostname primero, flag después)
- [x] 3.2 En `seed-reset.ts`, después de las guards, ejecutar los `deleteMany()` sobre Wod, RM, TeacherStudent, User, Gym
- [x] 3.3 Después del reset, invocar el seed idempotente: opción A — extraer la lógica de creación de `seed.ts` a una función exportada `seedBaseData()` que ambos archivos importan; opción B — `seed-reset.ts` invoca directamente el script `seed.ts` por su default export. Elegir A para evitar ejecución de side-effects al importar
- [x] 3.4 Refactorizar `prisma/seed.ts` para exportar `seedBaseData()` y llamarla desde su propio `main()` cuando se ejecuta como script directo
- [ ] 3.5 Verificar manualmente que `npm run seed:reset` sin guards aborta, con guards completas funciona

## 4. Configuración de package.json

- [x] 4.1 En `package.json`, agregar `"seed:reset": "tsx prisma/seed-reset.ts"` al bloque `scripts`
- [x] 4.2 Verificar que `"seed": "tsx prisma/seed.ts"` sigue presente (no cambia el path, solo cambia el comportamiento interno)
- [x] 4.3 Eliminar completamente el bloque `"prisma": { "seed": "tsx prisma/seed.ts" }` para deshabilitar la ejecución implícita
- [ ] 4.4 Verificar manualmente que `npx prisma migrate reset --force` (en un entorno local) NO dispara el seed automáticamente

## 5. Documentación

- [x] 5.1 Crear `prisma/README.md` con secciones: "Comandos disponibles" (seed vs seed:reset), "Variables de entorno requeridas" (DATABASE_URL, ALLOW_DESTRUCTIVE_SEED), "Procedimiento de reset local" (paso a paso), "Por qué NUNCA usar DATABASE_URL de prod en .env.local", "Cómo agregar un hostname a la allowlist", y "Seeds por gym" (puntero a docs/alta-nuevo-gym.md y docs/alta-nuevo-box.md)
- [x] 5.2 En `AGENTS.md`, agregar una sección "Seguridad de seeds" después de "Reglas operativas" con: las dos invariantes core (no `deleteMany` sin where, no seeds en prod), el comando correcto de reset (`ALLOW_DESTRUCTIVE_SEED=1 npm run seed:reset`), y un puntero a `prisma/README.md`
- [x] 5.3 Agregar a `AGENTS.md` en la lista de "Punteros a docs/" el nuevo `prisma/README.md`
- [x] 5.4 Verificar que `prisma/README.md` no duplica contenido de `docs/alta-nuevo-gym.md` o `docs/alta-nuevo-box.md` — solo linkea cuando aplica

## 6. Auditoría de seeds existentes

- [x] 6.1 Re-leer `prisma/seed-atlas-gym.ts`, `seed-mila-fit.ts`, `seed-rompiendo-limites.ts`, `seed-personal.ts`, `seed-atlas-gym-student.ts`, `seed-coupons.ts` y confirmar que ninguno tiene `deleteMany` sin where o lógica destructiva latente
- [x] 6.2 Si alguno tiene riesgo (improbable según auditoría previa pero verificar): aplicarle el mismo patrón de guards
- [x] 6.3 Documentar el resultado de la auditoría en una línea de `prisma/README.md` ("Los seeds per-gym son safe-by-design: solo `create` con check de existencia o `upsert`")

## 7. Verificación final

- [x] 7.1 Correr `npm run lint` y resolver cualquier warning nuevo introducido
- [ ] 7.2 Correr `npm run build` para confirmar que el cambio no rompe la build de Next.js (incluye `prisma generate`)
- [ ] 7.3 Probar manualmente en una DB local cada una de las 4 combinaciones: `seed` sobre DB vacía, `seed` sobre DB ya seedeada, `seed:reset` sin guards (debe abortar), `seed:reset` con guards completas (debe resetear y reseedear)
- [ ] 7.4 Probar manualmente la guard de hostname: setear `DATABASE_URL` apuntando a un hostname no-local (NO ejecutar contra prod real — usar una URL de prueba tipo `postgresql://user:pass@ep-fake.neon.tech/db`) y verificar que `seed:reset` aborta antes de tocar la DB
- [ ] 7.5 Verificar que el commit final sigue Conventional Commits en español con scope claro (sugerencia: `feat(seed): blindar seed contra ejecuciones destructivas en prod`)
