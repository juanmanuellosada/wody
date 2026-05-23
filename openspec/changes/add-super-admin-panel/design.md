## Context

Wody es una plataforma multi-tenant en Next.js 16 + Prisma + Neon. Cada gym es un tenant aislado por `gymId`, y los roles existentes (`ADMIN`, `TEACHER`, `STUDENT`, `ACCESS`) viven dentro de un gym. No existe hoy un rol que cruce tenants ni un panel global de operaciones — todo se hace por DB o seeds locales.

El modelo `Coupon` ya es global (sin `gymId`), pero su gestión es manual: se editan filas a mano. El modelo `Gym` se crea con `prisma/seed-[slug].ts` (un archivo por gym, commiteado al repo). `PersonalAccessWhitelist` se gestiona también con SQL directo.

La landing pública (`src/app/page.tsx`) tiene los 4 gyms hardcodeados con imports estáticos desde `src/logos/`. No hay storage de archivos: no existe ningún cliente de uploads en el repo (`@vercel/blob`, S3, Cloudinary). Los logos de gyms viven en `/public/logos/{slug}.png`, lo cual no funciona en producción para gyms nuevos (filesystem de Vercel es efímero).

Constraints relevantes:
- Neon sin shadow DB → todas las migraciones usan `migrate deploy` (no `migrate dev`).
- Sin tests automatizados ni CI.
- Convenciones de seeds (ver `prisma/README.md`): `deleteMany()` sin where solo en `seed-reset.ts`; no correr seeds contra producción; no agregar seed al build de Vercel.
- NextAuth v5 beta: la sesión hoy asume `gymId` no-null para casi todos los flujos.

Stakeholder único: el owner de Wody (Juan Manuel). Su pain point es la fricción operativa.

## Goals / Non-Goals

**Goals:**
- Eliminar la necesidad de tocar la DB a mano para alta/edición de gyms, cupones y whitelist de Wody Personal.
- Tener visibilidad consolidada de cuándo cobrar la suscripción a cada gym.
- Que la landing refleje automáticamente cualquier alta hecha desde el panel, sin redeploy.
- Introducir `SUPERADMIN` con el menor impacto posible en el código existente (no romper flujos de `ADMIN`/`TEACHER`/`STUDENT`/`ACCESS`).

**Non-Goals:**
- Cobro automático de suscripciones, integración con Mercado Pago para gyms, recordatorios por email o push. Las fechas de suscripción son informativas en este cambio.
- Generar el archivo `seed-[slug].ts` desde el panel. El seed sigue siendo respaldo manual auditable; se escribe a mano cuando se quiere preservar el alta en git.
- Multi-super-admin con permisos granulares (ej. uno que solo gestiona cupones). Por ahora el rol es binario: sos super admin o no.
- Auditoría / log de cambios del panel.
- UI mobile-first del panel. Es una herramienta de uso interno, alcanza con que sea usable en desktop.
- Internacionalización. Todo en español como el resto del producto.

## Decisions

### Decisión 1: `SUPERADMIN` como rol nuevo en `Role` y `User.gymId` opcional

**Alternativas consideradas:**
- (A) Flag booleano `isSuperAdmin` en `User`, manteniendo rol del gym.
- (B) Hardcodear emails super admin en una env var (sin cambios de schema).
- (C) Rol `SUPERADMIN` en el enum + `gymId` opcional. **Elegida.**

**Por qué (C):**
- La fuente de verdad de permisos en este proyecto es `User.role` (revisado en `auth.ts` y en cada server action). Agregar un flag paralelo introduce una segunda dimensión de permisos que hay que sincronizar y validar en todos lados — más superficie de bug.
- Una env var es rígida: no permite revocar/agregar super admins desde el panel mismo, y obliga a redeploy.
- El cambio de schema es chico (1 valor de enum + 1 columna a `String?`). El costo se paga una vez.

**Por qué `User.gymId` opcional vs un "gym sintético":**
- Un gym sintético (ej. el `personal` existente) implica que el super admin aparece como miembro de un gym, y que hay que filtrar el rol en todas las queries que listan usuarios por gym. Más fricción a largo plazo.
- `gymId String?` con regla: si `role === 'SUPERADMIN'`, `gymId` debe ser null; si no, debe ser no-null. La regla se valida en server actions y se documenta en la spec.

**Costo:** revisar el código que asume `User.gymId` not null (TypeScript va a marcar los lugares al cambiar el schema). La mayoría son server actions que ya filtran por rol y no se cruzan con SUPERADMIN.

### Decisión 2: Panel en `/admin` (sin gymSlug) y auth con redirect en page

**Alternativas consideradas:**
- (A) Introducir `middleware.ts` para proteger `/admin/*`.
- (B) Layout `src/app/admin/layout.tsx` que valida la sesión y hace redirect. **Elegida.**

**Por qué (B):**
- El resto del repo no usa `middleware.ts` (la auth se hace en pages con `redirect()`). Mantener consistencia es más valioso que adoptar un patrón nuevo solo para esta sección.
- Un layout server-side chequea la sesión una vez para toda la subárbol de `/admin/*` y redirige a `/` si el rol no es SUPERADMIN. No requiere middleware ni edge runtime.

### Decisión 3: `@vercel/blob` para uploads

**Alternativas consideradas:**
- (A) Guardar en `/public` (filesystem). No funciona en Vercel para archivos creados en runtime.
- (B) Base64 en la DB. Pesa en queries y satura backups.
- (C) S3 / Cloudinary externos. Más setup, más costo, requiere claves de terceros.
- (D) `@vercel/blob`. **Elegida.**

**Por qué (D):**
- Es nativo de Vercel (la plataforma ya usada), free tier suficiente para el volumen actual (decenas de logos), un solo token de env var (`BLOB_READ_WRITE_TOKEN`), y la URL retornada es servible directamente sin proxy.
- No requiere CDN aparte ni configuración de CORS.

**Patrón de upload:** server action que recibe el file (FormData), llama a `put()` con `access: 'public'` y `addRandomSuffix: true`, y devuelve la URL para guardar en `Gym.logo` o `Coupon.logoKey`. No usamos client uploads firmados (no hace falta para archivos chicos de logos).

### Decisión 4: Suscripción como columnas informativas en `Gym`, no tabla nueva

**Alternativas consideradas:**
- (A) Modelo `GymSubscription` con historial de pagos, montos, fechas.
- (B) Columnas `subscriptionNextPaymentDate` y `subscriptionMonthlyAmount` en `Gym`. **Elegida.**

**Por qué (B):**
- El requisito explícito del owner es "saber cuándo tengo que ir a cobrarles", no auditar historial ni vincular con Mercado Pago. Sobre-modelar ahora es premature abstraction.
- Si más adelante se necesita historial, se puede agregar el modelo `GymSubscriptionPayment` sin migrar datos (las dos columnas actuales siguen sirviendo como vista "próximo cobro").

### Decisión 5: Landing DB-driven sin cambiar URL ni layout

- `src/app/page.tsx` pasa a `await prisma.gym.findMany({ where: { blockedAt: null }, orderBy: { createdAt: 'asc' } })`.
- Los 4 gyms hardcodeados ya existen en DB (vinieron por seed). Hay que verificar que su campo `Gym.logo` apunte al path correcto en `/public/logos/{slug}.png` para no romper la UI actual. Si está vacío, lo seteamos en una migración de datos (no de schema) corriendo un `prisma db execute` o un script una sola vez.
- Para gyms nuevos creados desde el panel, `Gym.logo` apunta a la URL pública de Vercel Blob. La landing usa `<Image src={gym.logo} />` indistintamente.

### Decisión 6: Alta de gym desde el panel crea un usuario ADMIN inicial

- El panel pide: nombre del gym, slug (auto desde el nombre, editable), kind, logo, primaryColor, **email del admin inicial**, **password temporal del admin inicial**.
- La server action crea en transacción: `Gym` + `User { role: 'ADMIN', gymId: gym.id, email, password: hash }`. Si la transacción falla, rollback.
- El admin inicial recibe sus credenciales fuera de banda (el owner se las pasa por WhatsApp o lo que sea). No mandamos email en este cambio.

### Decisión 7: Migración Prisma única, con `migrate deploy`

- Una sola migración con: agregar `SUPERADMIN` a enum, `User.gymId` a opcional, `Gym.subscriptionNextPaymentDate` y `Gym.subscriptionMonthlyAmount`.
- Generar localmente con `npx prisma migrate dev --create-only --name add_super_admin_and_gym_subscription` apuntando a una DB local efímera, ajustar el SQL si hace falta, commitear.
- Aplicar en prod con `npx prisma migrate deploy` (sin shadow DB, según convención del proyecto registrada en memoria).

## Risks / Trade-offs

- **[Riesgo] Hacer `User.gymId` opcional puede romper queries que asumen not-null.** → Mitigación: TypeScript va a marcar todos los call sites al regenerar tipos con `prisma generate`. Resolver uno por uno antes de mergear. Auditar especialmente `auth.ts`, `payment.ts`, `user.ts`, `access.ts`. En la mayoría de los casos la query ya filtra por `gymId` con un valor concreto (no se cruza con super admins).
- **[Riesgo] Super admin con `gymId: null` no puede loguearse por el flujo normal `(email, gymSlug)`.** → Mitigación: agregar un caso en el provider de credentials: si el email pertenece a un user con `role === 'SUPERADMIN'`, ignorar `gymSlug` y autenticar. El redirect post-login va a `/admin` en vez de `/{gymSlug}/...`.
- **[Riesgo] Logos de Blob vs logos de `/public` conviven y son fácil de confundir.** → Mitigación: el campo `Gym.logo` siempre guarda una URL completa o un path absoluto desde `/`. La UI usa `<Image src={gym.logo} />` sin lógica condicional. Si en el futuro se quieren unificar, se migran los 4 logos viejos a Blob con un script.
- **[Riesgo] Alta de gym desde el panel no actualiza `gym-locations.ts` / `gym-logos.ts`.** → Mitigación: esos mapeos hardcodeados se vuelven legacy. El panel los reemplaza para gyms nuevos. Documentar en `docs/alta-nuevo-gym.md` que el panel es ahora el flujo recomendado, y que el seed + los mapeos hardcodeados son respaldo manual.
- **[Riesgo] Sin auditoría, un super admin puede borrar un gym o un cupón por error.** → Mitigación: confirmación modal explícita en delete + soft-delete (usar `blockedAt`) en lugar de hard-delete para gyms. Cupones sí pueden hard-delete porque tienen `active` boolean.
- **[Riesgo] `BLOB_READ_WRITE_TOKEN` no configurado en prod rompe uploads.** → Mitigación: la server action de upload chequea la presencia del token y devuelve error explícito. Documentar en `docs/` el paso de instalación de Vercel Blob.
- **[Trade-off] Suscripción informativa sin cobro automático.** → Aceptado: alinea con el alcance pedido. Si más adelante se quiere automatizar, se construye encima sin tirar nada de lo que se hace ahora.

## Migration Plan

1. **Pre-deploy**: instalar `@vercel/blob` (`npm i @vercel/blob`), conectar Vercel Blob al proyecto en el dashboard (genera `BLOB_READ_WRITE_TOKEN` en envs).
2. **Schema**: generar migración Prisma localmente, commitear.
3. **Code**: implementar panel + actions + landing DB-driven + cambios en `auth.ts`. Mergeado en un solo PR (cambio cohesivo).
4. **Deploy**: push a main. Vercel build corre `prisma generate && next build`.
5. **Migrate**: en post-deploy, correr `npx prisma migrate deploy` contra la DB de prod (manual desde la máquina del owner, usando `DATABASE_URL` de prod en una shell separada — no en `.env.local`).
6. **Data backfill**: insertar un user `SUPERADMIN` con el email del owner directamente vía Prisma Studio o un script one-off (`prisma/scripts/seed-superadmin.ts`, fuera del flujo de seed normal). Password se hashea con `bcryptjs`.
7. **Verificación manual**: login con el super admin, smoke test de las tres secciones CRUD, verificar landing.
8. **Rollback** (si algo sale mal): revertir el commit y redeploy. La migración Prisma es retrocompatible (agregar columnas opcionales y un valor de enum no rompe el schema viejo). Si se llegó a crear data nueva con el panel, queda en la DB pero no se accede.

## Open Questions

- ¿El owner quiere poder editar `Gym.slug` después de creado, o el slug es inmutable? Default propuesto: inmutable después del alta (cambiar slug rompería URLs cacheadas y bookmarks).
- ¿La UI del panel sigue el design system actual de las páginas de admin de gym, o es una vista propia más austera? Default propuesto: reutilizar componentes existentes (`src/components/admin/*` si los hay) por consistencia visual.
