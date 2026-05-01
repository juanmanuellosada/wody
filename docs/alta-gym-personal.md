# Alta del gym personal en WODY

Este documento describe cómo inicializar el **único gym de tipo `PERSONAL`** que existe en la plataforma. Es el tenant compartido que aloja a todos los usuarios que usan Wody sin pertenecer a un gimnasio o box.

---

## Qué hace el seed

El script `prisma/seed-personal.ts` crea un único registro en la tabla `Gym` con:

| Campo | Valor |
|---|---|
| `slug` | `personal` |
| `kind` | `PERSONAL` |
| `name` | `Wody Personal` |
| `nextMemberNumber` | `1` |

El script es **idempotente**: si ya existe un gym con `kind = PERSONAL`, termina con un log de skip y sin errores. Si encuentra un gym con `slug = "personal"` pero de otro kind (colisión accidental), **falla con error explícito** para que lo revises antes de continuar.

---

## Cuándo correrlo

Una sola vez por entorno (local y producción). No hace falta repetirlo. Solo existe un gym `PERSONAL` en la plataforma — todos los usuarios personales comparten ese tenant.

---

## Cómo correrlo

Primero cargá las variables de entorno (si no las tenés ya activas en tu shell):

```bash
set -a && . ./.env.local && set +a
```

Luego ejecutá el seed:

```bash
npx tsx prisma/seed-personal.ts
```

Para verificar idempotencia, correlo una segunda vez: debe terminar con "ya existe, skip" sin error.

---

## Diferencias con el alta de un gym tradicional

A diferencia de los seeds de `alta-nuevo-gym.md` y `alta-nuevo-box.md`, este seed **no crea ningún usuario** (ni admin, ni profe, ni alumno). El gym personal no tiene profes ni grupos — los usuarios se registran solos vía el formulario público `/registro-personal` y quedan activos al confirmar su email.

No hace falta agregar el gym personal a `src/lib/gym-logos.ts`, `src/lib/gym-locations.ts` ni a la landing pública de WODY: no aparece en el listado de instalaciones.

---

## Verificación post-seed

En Neon (o con cualquier cliente de Postgres), confirmá que la fila quedó creada:

```sql
SELECT id, name, slug, kind, "nextMemberNumber" FROM "Gym" WHERE kind = 'PERSONAL';
```
