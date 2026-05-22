## Context

El proyecto Wody usa Prisma con un único archivo `prisma/seed.ts` que se invoca vía `npm run seed`. Hoy ese script asume contexto de desarrollo y **arranca borrando todo** con `prisma.X.deleteMany()` sin filtro (líneas 84-88), luego recrea data de muestra para un solo gym de ejemplo.

Cualquier desarrollador con el `DATABASE_URL` de producción en su `.env` local —situación que ocurrió el 21–22 de mayo de 2026— puede ejecutar el seed y destruir datos reales en segundos. La pérdida no se detectó hasta horas más tarde, cuando ya estaba fuera de la ventana de history del plan Free de Neon (6h).

Adicionalmente, `package.json` declara:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Esto hace que ciertos comandos de Prisma (`prisma migrate reset`, `prisma db push --force-reset`, `prisma migrate dev` después de una reset) ejecuten el seed automáticamente. Aumenta la superficie de ejecución implícita.

Las constraints del entorno:
- No hay tests, así que no podemos cubrir esto con un test de regresión "naturalmente".
- No hay CI configurado, así que no podemos meter un check en pipeline.
- Múltiples agentes (Codex, Cursor, Claude) tocan el repo, no solo humanos.

## Goals / Non-Goals

**Goals:**
- Hacer **estructuralmente imposible** que `npm run seed` borre datos de producción, incluso con `DATABASE_URL` mal configurado.
- Mantener un seed útil para desarrollo local (necesitamos seguir pudiendo resetear el entorno local fácilmente).
- Distinguir claramente entre operaciones idempotentes (seguras siempre) y destructivas (peligrosas, requieren confirmación).
- Documentar el modelo mental para que un humano nuevo o un agente nuevo no pueda volver a tropezar con la misma trampa.

**Non-Goals:**
- Backups automáticos de la DB de producción (es un cambio aparte, mucho más grande; merece su propio change).
- Reescribir los seeds por gym (`seed-atlas-gym.ts`, etc.) — ya son seguros.
- Migración a otro proveedor de DB o plan distinto de Neon.
- Refactor general de cómo se cargan datos iniciales en gyms nuevos (eso está cubierto por `docs/alta-nuevo-gym.md` y funciona bien).
- Tests automáticos del seed (no hay infra de tests en el repo; agregarla excede este cambio).

## Decisions

### Decisión 1: Detectar "producción" por hostname del `DATABASE_URL`, no por `NODE_ENV`

**Elegido:** Parsear el `DATABASE_URL` y rechazar cualquier host que no esté en una allowlist de hostnames locales (`localhost`, `127.0.0.1`, `::1`, `postgres` para docker-compose).

**Alternativas consideradas:**
- *Usar `NODE_ENV === "production"`* — descartado: `NODE_ENV` no se setea cuando corrés `npm run seed` desde la terminal. El default es `undefined`, y aún si lo seteás a `"development"`, no protege porque el `DATABASE_URL` puede ser de prod.
- *Denylist de hostnames de proveedores conocidos (`*.neon.tech`, `*.amazonaws.com`, `*.supabase.co`)* — descartado como única defensa: cualquier nuevo proveedor o un setup self-hosted en una IP cae fuera. Una **allowlist** falla cerrada (default deny), que es lo que queremos para una operación destructiva.
- *Pedir al usuario que escriba "YES" interactivo* — descartado: complica el uso legítimo en scripts (CI local, contenedores) y el riesgo es que el dev escriba "YES" en piloto automático sin mirar a qué DB apunta.

**Rationale:** La allowlist es la defensa más fuerte porque el modo de falla por defecto es "abortar". Si alguien tiene una DB local en un hostname raro, el error de allowlist los obliga a leer el código y entender la guard antes de bypassearla — eso es exactamente lo que queremos. Para casos legítimos fuera de la allowlist (raro, casi nunca), pueden agregar el host explícitamente o usar la flag de override.

### Decisión 2: Defensa en profundidad — segunda guard con `ALLOW_DESTRUCTIVE_SEED=1`

**Elegido:** Incluso si pasaste el check de hostname local, las operaciones `deleteMany` sin filtro requieren `ALLOW_DESTRUCTIVE_SEED=1` en el environment.

**Alternativas consideradas:**
- *Solo la guard de hostname* — descartado: si alguien levanta un docker-compose con `postgres` apuntando vía port-forward a prod por error, la guard de hostname no lo cacha. La segunda flag obliga a un acto explícito.
- *Confirmación interactiva con `readline`* — descartado por los mismos motivos que la decisión 1.

**Rationale:** Defense in depth. La primera capa cubre el 99% de los casos (DATABASE_URL mal seteado a prod). La segunda capa cubre los edge cases raros y obliga a una intención explícita aún en dev. El costo de tipear `ALLOW_DESTRUCTIVE_SEED=1 npm run seed:reset` una vez por reset local es despreciable comparado con el riesgo que mitiga.

### Decisión 3: Separar `npm run seed` (idempotente) de `npm run seed:reset` (destructivo)

**Elegido:** Dos scripts distintos en `package.json`. El idempotente queda como default (`seed`) porque es lo que querés correr "casi siempre" — agregar al estado, no resetearlo.

**Alternativas consideradas:**
- *Un solo script con un flag (`npm run seed -- --reset`)* — descartado: los flags de npm tienen UX confusa (el `--` separador, el args parsing), y un humano apurado puede tipear el flag sin pensar. Un nombre distinto (`seed:reset`) **dice lo que hace** y obliga a una pausa.
- *Mantener un solo script destructivo* — descartado: es justo lo que tenemos hoy y es justo el problema.

**Rationale:** El nombre del comando comunica intención. Si querés "agregar datos base", el comando se llama `seed`. Si querés "borrar todo y rearmar", el comando se llama `seed:reset` — y esa palabra ya te obliga a pensar dos veces.

### Decisión 4: Refactorizar a `upsert` con claves naturales

**Elegido:** Para gym usar `upsert` por `slug` (ya es `@unique`). Para users usar `upsert` por la clave compuesta `email + gymId` (ya es `@@unique`). Para `TeacherStudent` usar `upsert` por la clave compuesta `teacherId + studentId`. Para `Wod` y `RM` usar `create` con check previo de existencia (las claves naturales son menos obvias: `date + teacherId` para Wod, no hay clave natural única para RM).

**Alternativas consideradas:**
- *Mantener todo como `create` y dejar que falle si ya existe* — descartado: rompe la promesa de idempotencia.
- *Hacer `deleteMany` con filtro por gym y después recrear* — descartado: sigue siendo destructivo, solo más limitado. Va contra el espíritu del cambio.

**Rationale:** Idempotencia real requiere `upsert` o equivalente. Las claves naturales ya existen en el schema, así que el refactor es mecánico.

### Decisión 5: Remover el bloque `prisma.seed` de `package.json`

**Elegido:** Eliminar:
```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

**Alternativas consideradas:**
- *Dejarlo apuntando al seed idempotente nuevo* — descartado: si Prisma invoca el seed automáticamente (en `migrate reset`, `db push --force-reset`), aunque sea idempotente sigue siendo una ejecución implícita. Preferimos cero ejecuciones implícitas.

**Rationale:** Los seeds en este proyecto **siempre** deberían correrse explícitamente con `npm run seed` o `npm run seed:reset`. No queremos que `prisma migrate reset` los dispare sin que el dev lo pida.

### Decisión 6: Módulo separado `prisma/seed-guards.ts`

**Elegido:** Mover la lógica de detección de entorno y validación de flags a un archivo separado, importado por `seed.ts` y por cualquier futuro `seed:reset`.

**Rationale:** Las guards son pieza crítica. Tenerlas en un archivo dedicado las hace fáciles de auditar, fáciles de testear si en algún momento agregamos tests, y reutilizables por seeds futuros sin copiar lógica.

## Risks / Trade-offs

**[Riesgo] Falsos positivos de la allowlist en setups de desarrollo no-estándar (ej. DB en una VM con hostname custom).** → Mitigación: la guard reporta el hostname detectado y sugiere cómo agregarlo a la allowlist o usar el override `ALLOW_DESTRUCTIVE_SEED=1` con una verificación adicional. Documentado en `prisma/README.md`.

**[Trade-off] El nuevo `npm run seed` siendo idempotente requiere cambiar la mentalidad de "seed = reset".** → Mitigación: `seed:reset` queda disponible y documentado. La rotura es deliberada: el comportamiento viejo era peligroso por default. AGENTS.md lo aclara para que ningún agente nuevo lo asuma.

**[Riesgo] Bypass trivial: alguien puede leer la guard, ver que `localhost` está allowlisted, y crear un tunnel SSH `localhost:5432` → prod.** → Mitigación: ningún sistema de guards es infalible contra alguien activamente intentando bypassearlas. La protección está pensada contra **accidentes**, no contra acciones deliberadas. La segunda guard (`ALLOW_DESTRUCTIVE_SEED`) sigue siendo barrera adicional incluso en ese caso.

**[Trade-off] Más fricción para resetear el entorno local (hay que tipear la flag).** → Aceptado: es exactamente la fricción que queremos para una operación destructiva. Un dev puede agregar un alias en su shell si lo hace seguido.

## Migration Plan

Como este cambio no toca el schema ni datos productivos, no hay migración de datos. Solo:

1. Implementar el código + docs (orden de tasks).
2. Mergear a `main`.
3. Avisar al equipo del cambio de semántica de `npm run seed`. Mensaje sugerido: *"Si antes corrías `npm run seed` para resetear tu DB local, ahora usá `ALLOW_DESTRUCTIVE_SEED=1 npm run seed:reset`. El `npm run seed` solo upsertea datos base."*

**Rollback:** revertir el commit. El cambio es puramente código y configuración; no hay state en DB que rollbackear.

## Open Questions

1. **¿Vale la pena un test mínimo de las guards?** El repo no tiene infra de tests. Agregar un único test unitario para `seed-guards.ts` con `vitest` o `node:test` sería barato pero introduce una dependencia nueva. **Propuesta:** dejarlo para un cambio futuro si/cuando se decida agregar tests al proyecto. Por ahora, las guards son código simple y auditable.

2. **¿Deberíamos sumar un linter check (ej. ESLint custom rule) que prohíba `deleteMany()` sin `where` en archivos seed?** Idea interesante pero ESLint custom rules son trabajo no trivial y agregan mantenimiento. **Propuesta:** documentar la invariante en `AGENTS.md` y dejarlo a code review por ahora.

3. **`docs/alta-nuevo-gym.md` y `docs/alta-nuevo-box.md` actualmente piden correr seeds per-gym.** ¿Algún seed per-gym tiene lógica destructiva latente que también deberíamos blindar?** Según la auditoría previa, todos los `seed-<gym>.ts` son seguros (solo `create` con check `if (existing)`), pero conviene confirmarlo como parte de las tasks.
