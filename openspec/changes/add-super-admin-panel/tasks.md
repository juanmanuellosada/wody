## 1. Schema y migración Prisma

- [x] 1.1 Editar `prisma/schema.prisma`: agregar `SUPERADMIN` al enum `Role`
- [x] 1.2 Editar `prisma/schema.prisma`: cambiar `User.gymId` a `String?` (opcional) y la relación `User.gym` a opcional acorde
- [x] 1.3 Editar `prisma/schema.prisma`: agregar `subscriptionNextPaymentDate DateTime?` y `subscriptionMonthlyAmount Int?` al modelo `Gym`
- [x] 1.4 Generar la migración con `npx prisma migrate dev --create-only --name add_super_admin_and_gym_subscription` (en DB local efímera) — migración SQL escrita manualmente siguiendo el patrón de migraciones existentes, en `prisma/migrations/20260522000000_add_super_admin_and_gym_subscription/migration.sql`
- [x] 1.5 Revisar el SQL generado: confirmar que `User.gymId` se altera a NULLable sin tocar datos existentes y que el enum agrega el valor sin reescribir la columna
- [x] 1.6 Correr `npx prisma generate` localmente y compilar TypeScript del proyecto. Listar y resolver todos los errores donde `User.gymId` se asumía no-null
- [x] 1.7 Auditar `src/lib/auth.ts`, `src/actions/payment.ts`, `src/actions/user.ts`, `src/actions/access.ts`, `src/actions/wod.ts`, `src/actions/group.ts`, `src/actions/join-request.ts` y middleware/pages: agregar guards para rechazar acciones intra-gym cuando `session.user.gymId === null`

## 2. Storage con Vercel Blob

- [x] 2.1 Instalar `@vercel/blob` (`npm i @vercel/blob`)
- [x] 2.2 Conectar Vercel Blob al proyecto en el dashboard de Vercel y verificar que `BLOB_READ_WRITE_TOKEN` aparece en las envs de production y preview
- [x] 2.3 Agregar `BLOB_READ_WRITE_TOKEN` a `.env.example` (sin valor) y documentar en `docs/`
- [x] 2.4 Crear `src/lib/blob.ts` con un helper `uploadPublicImage(file: File, prefix: string)` que valide MIME (`image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`), tamaño máximo 2 MB, y haga `put(filename, file, { access: 'public', addRandomSuffix: true })`
- [x] 2.5 Agregar helper `deleteBlobByUrl(url: string)` para limpieza al eliminar un cupón

## 3. Auth: soporte para SUPERADMIN

- [x] 3.1 Editar `src/lib/auth.ts`: en el provider de credentials, si el user encontrado tiene `role === 'SUPERADMIN'`, ignorar `gymSlug` de la request y autenticar igual
- [x] 3.2 Editar el callback `session`/`jwt`: cuando `role === 'SUPERADMIN'`, propagar `gymId: null`, `gymSlug: null`, `gymKind: null`
- [x] 3.3 Editar el redirect post-login: si `role === 'SUPERADMIN'`, redirigir a `/admin` — implementado en `src/app/page.tsx` (el redirect post-login va via la landing)
- [x] 3.4 Editar `src/app/page.tsx` (parte de redirect de sesión activa, líneas ~32–44): agregar caso `SUPERADMIN` → `/admin`

## 4. Layout y auth del panel `/admin`

- [x] 4.1 Crear `src/app/admin/layout.tsx` (Server Component): leer sesión con `auth()`. Si no hay sesión o `role !== 'SUPERADMIN'`, `redirect('/')`
- [x] 4.2 Crear nav lateral con links a `/admin` (dashboard), `/admin/coupons`, `/admin/gyms`, `/admin/personal-whitelist`
- [x] 4.3 Crear `src/app/admin/page.tsx`: vista de suscripciones — query `prisma.gym.findMany({ where: { blockedAt: null }, orderBy: [{ subscriptionNextPaymentDate: 'asc' }, { name: 'asc' }] })` con nulls al final. Renderizar tabla con nombre, slug, fecha, monto, indicador de vencido

## 5. CRUD de cupones

- [x] 5.1 Crear `src/actions/super-admin/coupon.ts` con server actions: `listAllCoupons`, `createCoupon`, `updateCoupon`, `deleteCoupon`, `uploadCouponLogo`. Cada una valida `role === 'SUPERADMIN'` y rechaza si no
- [x] 5.2 Implementar `createCoupon` con upload de logo: si viene un file, subir a Blob primero y guardar la URL en `Coupon.logoKey`. Validar slug único antes de crear
- [x] 5.3 Implementar `updateCoupon`: si llega un file de logo nuevo, subirlo y borrar el viejo en Blob; si no, dejar `logoKey` igual
- [x] 5.4 Implementar `deleteCoupon`: chequear que no haya `CouponRedemption` antes de borrar; borrar logo en Blob al eliminar el cupón
- [x] 5.5 Crear `src/app/admin/coupons/page.tsx`: listar cupones con `sortOrder` y `createdAt`
- [x] 5.6 Crear `src/app/admin/coupons/new/page.tsx`: formulario de alta con todos los campos del modelo `Coupon`
- [x] 5.7 Crear `src/app/admin/coupons/[id]/page.tsx`: formulario de edición

## 6. CRUD de gyms

- [x] 6.1 Crear `src/actions/super-admin/gym.ts` con server actions: `listAllGyms`, `createGym`, `updateGym`, `blockGym`, `unblockGym`, `uploadGymLogo`. Cada una valida `role === 'SUPERADMIN'`
- [x] 6.2 Implementar `createGym`: validar `slug` único, no reservado (no igual a `"personal"`), `kind !== 'PERSONAL'`, email del admin válido, password mínima 8 chars. Subir logo a Blob si viene. Crear `Gym` + `User { role: ADMIN, gymId: gym.id, password: bcrypt(adminPassword), memberNumber: 1 }` en `prisma.$transaction`
- [x] 6.3 Implementar `updateGym`: aceptar solo los campos editables del spec (`name`, `kind`, `logo`, `primaryColor`, `autoBlockAfterDays`, `subscriptionNextPaymentDate`, `subscriptionMonthlyAmount`). Ignorar o rechazar cambios de `slug`
- [x] 6.4 Implementar `blockGym`/`unblockGym`: toggle de `blockedAt`
- [x] 6.5 Crear `src/app/admin/gyms/page.tsx`: listar todos los gyms (activos y bloqueados, diferenciados visualmente)
- [x] 6.6 Crear `src/app/admin/gyms/new/page.tsx`: formulario de alta con upload de logo y datos del admin inicial
- [x] 6.7 Crear `src/app/admin/gyms/[id]/page.tsx`: formulario de edición + acciones de block/unblock
- [x] 6.8 Documentar en `docs/alta-nuevo-gym.md` y `docs/alta-nuevo-box.md` que el flujo recomendado es ahora el panel; el seed queda como respaldo manual

## 7. CRUD de PersonalAccessWhitelist

- [x] 7.1 Crear `src/actions/super-admin/personal-whitelist.ts` con: `listWhitelist`, `createEntry`, `updateEntry`, `deleteEntry`. Cada una valida `role === 'SUPERADMIN'`
- [x] 7.2 Implementar `createEntry`: validar email único, formato válido
- [x] 7.3 Implementar `updateEntry`: si la entrada tiene `consumedAt != null`, rechazar cambio de `email`; permitir cambio de `note`
- [x] 7.4 Implementar `deleteEntry`: si `consumedAt != null`, rechazar (preservar registro de auditoría)
- [x] 7.5 Crear `src/app/admin/personal-whitelist/page.tsx`: listar entradas con `consumedAt` visible, formulario inline de alta, acciones de edición y borrado por fila

## 8. Landing DB-driven

- [x] 8.1 Editar `src/app/page.tsx`: reemplazar el array hardcodeado por `await prisma.gym.findMany({ where: { blockedAt: null }, orderBy: { createdAt: 'asc' }, select: { slug: true, name: true, logo: true, primaryColor: true, kind: true } })`
- [x] 8.2 Verificar que los 4 gyms existentes en DB tengan `Gym.logo` apuntando al path correcto (`/logos/{slug}.png`). Si está vacío, correr un script puntual una sola vez para setearlos (no agregar a `seed.ts`)
- [x] 8.3 Adaptar el componente de la landing para tolerar `logo` como path absoluto (`/logos/...`) o URL externa (Blob). Mantener `<Image>` de Next sin lógica condicional
- [ ] 8.4 Verificar manualmente que la landing renderiza igual antes y después del cambio (visual smoke test)

## 9. Seed del super admin inicial

- [x] 9.1 Crear `prisma/scripts/seed-superadmin.ts` (script one-off, fuera del flujo de `npm run seed`): leer `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` de env, hashear password con `bcryptjs`, hacer `prisma.user.upsert` con `role: 'SUPERADMIN'`, `gymId: null`
- [x] 9.2 Documentar en `prisma/README.md` cómo correrlo (`npx tsx prisma/scripts/seed-superadmin.ts`) y que no se incluye en `npm run seed`

## 10. Deploy y verificación

- [ ] 10.1 Mergear el PR a main
- [ ] 10.2 Verificar build de Vercel exitoso
- [x] 10.3 Correr `npx prisma migrate deploy` contra la DB de prod desde una shell separada con `DATABASE_URL` de prod (no usar `.env.local`)
- [x] 10.4 Correr `npx tsx prisma/scripts/seed-superadmin.ts` contra prod para crear el super admin inicial — hecho vía INSERT SQL directo equivalente
- [ ] 10.5 Smoke test en prod: login del super admin, navegar las tres secciones del panel, crear un gym de prueba, eliminarlo (soft delete), confirmar que aparece y desaparece de la landing
- [ ] 10.6 Verificar que los logins de ADMIN/TEACHER/STUDENT/ACCESS existentes siguen funcionando sin regresión
