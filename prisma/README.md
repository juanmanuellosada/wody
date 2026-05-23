# Prisma — Seeds y seguridad de datos

Este documento explica el modelo de seeds del proyecto, cómo correrlos correctamente, y por qué existen las guards de seguridad.

---

## Comandos disponibles

### `npm run seed` — Seed idempotente (seguro)

```bash
npm run seed
```

- **Qué hace:** crea o actualiza los datos base del gym de muestra "Unidos Garage" usando `upsert` y `findFirst+create`. Nunca borra nada.
- **Cuándo usarlo:** para inicializar una DB local vacía, o para restaurar los datos base si fueron modificados manualmente.
- **Idempotente:** se puede correr N veces, el resultado es siempre el mismo.
- **No requiere variables adicionales:** solo necesita `DATABASE_URL`.

### `npm run seed:reset` — Reset destructivo (requiere confirmación)

```bash
ALLOW_DESTRUCTIVE_SEED=1 npm run seed:reset
```

- **Qué hace:** borra TODOS los datos de `Wod`, `RM`, `TeacherStudent`, `User` y `Gym`, luego ejecuta el seed idempotente.
- **Cuándo usarlo:** para resetear completamente tu entorno local de desarrollo.
- **Guards obligatorias (en orden):**
  1. `DATABASE_URL` debe apuntar a un host local (ver allowlist abajo).
  2. `ALLOW_DESTRUCTIVE_SEED=1` debe estar presente en el environment.
- **Si cualquiera de las guards falla:** el script aborta con código 1 antes de tocar la DB.

---

## Variables de entorno requeridas

| Variable | Requerida por | Descripción |
|---|---|---|
| `DATABASE_URL` | Ambos scripts | URL de conexión a PostgreSQL. **Solo debe apuntar a tu DB local.** |
| `ALLOW_DESTRUCTIVE_SEED` | Solo `seed:reset` | Debe ser exactamente `"1"`. Cualquier otro valor aborta. |

---

## Procedimiento de reset de entorno local

1. Asegurate de que `DATABASE_URL` en tu `.env.local` apunte a tu DB local (ver sección abajo).
2. Corré:
   ```bash
   ALLOW_DESTRUCTIVE_SEED=1 npm run seed:reset
   ```
3. El script verifica los guards, limpia la DB y recrea los datos base.
4. Credenciales de los usuarios de muestra creados:
   - Admin: `admin@unidosgarage.com` / `admin123`
   - Profe: `lucas@unidosgarage.com` / `profe123`
   - Alumno1: `martin@ejemplo.com` / `alumno123`
   - Alumno2: `valeria@ejemplo.com` / `alumno123`

---

## Por qué NUNCA usar `DATABASE_URL` de Neon producción en `.env.local`

El 21–22 de mayo de 2026, un `npm run seed` corrido con `DATABASE_URL` apuntando a la DB de producción ejecutó `deleteMany()` sin filtros y borró todos los datos reales. La recuperación requirió soporte de Neon.

**Regla:** el `.env.local` de desarrollo solo debe contener credenciales de DBs locales o de entornos efímeros de desarrollo (ej. Neon branch de dev). Nunca el `DATABASE_URL` del proyecto de producción.

Para conectarte a producción solo cuando sea estrictamente necesario (inspección, migraciones), usá una variable separada (ej. `PROD_DATABASE_URL`) que ningún script ejecute por defecto.

---

## Allowlist de hosts locales

La guard `assertLocalDatabaseUrl()` (en `prisma/seed-guards.ts`) acepta estos hosts como "locales":

- `localhost`
- `127.0.0.1`
- `::1`
- `postgres` (nombre típico de servicio Docker Compose)
- `db` (otro nombre típico de servicio Docker Compose)

Si tu DB local usa un hostname diferente (ej. una VM con hostname custom), podés agregarlo a la constante `LOCAL_HOSTS_ALLOWLIST` en `prisma/seed-guards.ts`. La guard te indicará exactamente el hostname detectado cuando falle, para que sepas qué agregar.

---

## Seeds por gym (seeds individuales)

Para dar de alta un gym nuevo, se usan seeds individuales (`prisma/seed-[slug].ts`). Estos son **safe-by-design**: solo usan `create` con check de existencia o `upsert`, nunca `deleteMany` sin filtro.

- Alta de gimnasio tradicional: ver `docs/alta-nuevo-gym.md`
- Alta de box de CrossFit: ver `docs/alta-nuevo-box.md`

---

## Crear super admin inicial

Para crear el primer usuario con rol `SUPERADMIN` en producción (o en un entorno nuevo), corré el script one-off:

```bash
SUPERADMIN_EMAIL=admin@wody.com.ar SUPERADMIN_PASSWORD=tupassword npx tsx prisma/scripts/seed-superadmin.ts
```

- **Cuándo correrlo:** una sola vez, después del primer deploy con el cambio `add-super-admin-panel`.
- **Idempotente:** si el super admin ya existe (mismo email, `gymId null`), actualiza la password. Si existe con otro rol, falla explícitamente.
- **No se incluye en `npm run seed`** ni en ningún flujo automático. Solo se corre de forma manual.
- **Contraseña mínima:** 8 caracteres.
- **Importante:** no uses `DATABASE_URL` de producción en `.env.local`. Para correr este script contra producción, seteá `DATABASE_URL` en la shell directamente, sin tocarlo en el archivo de entorno local.

---

## Nota sobre el build de Vercel

El script `build` en `package.json` es:

```
prisma generate && next build
```

Esto solo genera el cliente de Prisma y compila Next.js — **no ejecuta ningún seed**. El bloque `prisma.seed` fue eliminado de `package.json` para que ningún comando de Prisma (`prisma migrate reset`, `prisma db push --force-reset`) pueda disparar el seed automáticamente. Los seeds siempre se corren de forma explícita con `npm run seed` o `npm run seed:reset`.
