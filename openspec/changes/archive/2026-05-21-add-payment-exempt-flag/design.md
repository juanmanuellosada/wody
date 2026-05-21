## Context

Wody trata a cada alumno como un payer recurrente: el `nextPaymentDate` corre mes a mes y es la única señal de "está al día". Toda la cobranza, los recordatorios push y el check-in en la puerta se apoyan en ese campo. Algunos casos reales —familiares del dueño, staff que entrena gratis, becados— no pagan nunca, y hoy la única forma de blanquearlos es moverles `nextPaymentDate` a futuro indefinidamente, lo que ensucia la sección de pagos y dispara recordatorios falsos.

La capability afectada es `payment-tracking`. El modelo `User` es per-gym (`@@unique([email, gymId])`), así que la exención vive naturalmente a nivel usuario.

## Goals / Non-Goals

**Goals:**

- Marcar a un alumno como exento de pago de forma persistente, con motivo opcional.
- Excluir a los exentos de la cobranza diaria: estadísticas de "Atrasados"/"Por vencer", recordatorios push y check-in en `PENDING`.
- Mantener la exención visible (badge, banner, filtro dedicado) para que admin y profe sepan por qué un alumno no aparece en mora.
- Permitir que un `ADMIN` registre un pago a un alumno exento si quiere (no bloquearlo, solo advertir).
- Multi-tenant: la exención es del alumno en ese gym; el mismo email en otro gym sigue su flujo normal.

**Non-Goals:**

- Exenciones temporales con `startDate`/`endDate` (becas por 3 meses): se evalúa solo si aparece la necesidad. Mientras tanto, el `ADMIN` togglea cuando arranca/termina.
- Estados intermedios tipo "paga menos" / descuento porcentual.
- Que un `TEACHER` pueda togglear la exención de sus alumnos.
- Cambios en estadísticas de recaudación: siguen mirando `Payment`, no estado de cuota.
- Migración / backfill heurístico de alumnos ya existentes (todos arrancan `paymentExempt = false`, el `ADMIN` marca a mano).

## Decisions

### Schema: flag booleano + motivo opcional, no tabla aparte

```prisma
model User {
  // ...
  paymentExempt        Boolean @default(false)
  paymentExemptReason  String?
  // ...
}
```

- **Por qué `Boolean` y no tabla `PaymentExemption`**: YAGNI. Una tabla aparte habilita historial de exenciones y rangos de fecha, pero hoy no se necesita ninguno de los dos. Si aparece la necesidad de exenciones temporales, se migra entonces — el flag se reemplaza por `paymentExemptUntil DateTime?` o se introduce la tabla; mientras tanto, el costo de cambio es bajo.
- **Por qué `paymentExemptReason String?` y no enum**: los casos reales son heterogéneos ("hijo del dueño", "staff", "comodato hasta diciembre"). Texto libre da flexibilidad sin overhead.
- **Default `false`**: backfill trivial, no afecta a usuarios existentes.

### Una sola función de verdad: `isPaymentExempt(user)` no se necesita

El flag es lo bastante simple para chequear inline (`user.paymentExempt`). No vale la pena un helper. La lógica de _qué significa_ ser exento sí queda en pocos puntos (ver siguiente decisión).

### Puntos de inyección de la regla

| Lugar | Cambio | Razón |
|---|---|---|
| `src/lib/checkin.ts` `isUserAlDia` | `if (user.paymentExempt) return !user.blockedAt;` antes del check de fecha | El alumno entra normal por la puerta |
| `src/lib/push.ts` `sendDueReminderIfNeeded` | early return `{ sent: false, reason: "exempt" }` | No spamear con recordatorios |
| `src/app/api/cron/notify-due-today/route.ts` | `where: { ..., paymentExempt: false }` | Filtrado en DB, no en memoria |
| `src/app/[gymSlug]/pagos/page.tsx` | Excluir exentos de contadores "Atrasados"/"Por vencer", agregar pestaña/filtro "Exentos" | Limpieza visual de la sección de cobranza |
| `src/components/PaymentStatusBanner.tsx` | Branch `if (paymentExempt) → "Exento de pago"` | Visibilidad para el alumno y el operador |
| `src/components/EditStudentButton.tsx` | Toggle + textarea de motivo (solo `ADMIN`) | Punto de control para marcar/desmarcar |
| `src/components/RegisterPaymentDialog.tsx` | Banner informativo "Este alumno es exento" cuando se selecciona uno; permite igual confirmar | Trade-off: bloquear sería más estricto pero deja sin solución el caso "el exento aporta una vez" |
| `src/actions/user.ts` | Nueva `setStudentPaymentExempt(studentId, exempt, reason)` | Single source of write |

### Permisos: solo `ADMIN` puede togglear

Coherente con `setUserBlocked` y `promoteTeacherToAdmin` (acciones administrativas, no docentes). Un `TEACHER` podría querer marcar a un alumno propio, pero abre puerta a abusos (becarse a sí mismo es trivial dado que un teacher puede crear alumnos). Manteniendo `ADMIN`-only se evita esa clase de error.

### Aislamiento multi-tenant

La server action `setStudentPaymentExempt` SHALL verificar `student.gymId === session.user.gymId` exactamente igual que `updateStudent`. Sin esto, un admin de otro gym podría togglear exención por ID. No es nuevo: es la misma regla que el resto del módulo.

### UI: pestaña "Exentos" vs filtro

La sección `/[gymSlug]/pagos` ya tiene filtros tipo pills ("Atrasados", "Por vencer"). Se agrega una pill más, "Exentos". Reusa el patrón existente, no requiere layout nuevo.

## Risks / Trade-offs

- **[Riesgo: ADMIN marca exento por error y deja al alumno entrando gratis indefinidamente]** → Mitigación: el badge "Exento" es visible en banner, listado y editor. Cualquier admin que abra la ficha lo ve. El motivo opcional ayuda a justificar.
- **[Riesgo: el flag y `nextPaymentDate` divergen y confunden]** → Mitigación: no se toca `nextPaymentDate` al marcar exento; el flag _gana_ por encima de la fecha en `isUserAlDia` y en el panel. Si luego se desmarca, el alumno vuelve a regirse por su `nextPaymentDate` actual (que puede haber quedado viejo). Aceptado: si el admin desmarca, ajusta la fecha si hace falta, igual que hoy.
- **[Riesgo: registrar un pago a un exento desactualiza la intuición]** → Mitigación: el dialog muestra warning pero permite. El pago queda registrado en `Payment` (cuenta para recaudación), el flag NO se desactiva automáticamente. Si el admin quería desmarcar, lo hace explícito.
- **[Trade-off: motivo es texto libre, no estructurado]** → Acepta inconsistencia ("hijo del dueño" vs "Hijo del dueño") a cambio de flexibilidad. Si emerge un patrón claro de motivos, se evalúa enum más adelante.
- **[Riesgo: el cron `notify-due-today` ya tiene un filtro complejo; agregar `paymentExempt: false` se podría olvidar al cambiar el cron]** → Mitigación: el test manual del cron debe verificar que un alumno exento con `nextPaymentDate` en hoy NO recibe push. Documentado en `tasks.md`.

## Migration Plan

1. Editar `prisma/schema.prisma` para agregar `paymentExempt Boolean @default(false)` y `paymentExemptReason String?`.
2. Generar migration manual en `prisma/migrations/<timestamp>_add_user_payment_exempt/` (Neon no tiene shadow DB — la regla está en `memory/prisma-migrations-neon.md`). SQL:
   ```sql
   ALTER TABLE "User"
     ADD COLUMN "paymentExempt" BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN "paymentExemptReason" TEXT;
   ```
3. Correr `prisma migrate deploy` contra el ambiente (no `migrate dev`).
4. Desplegar los cambios de código en el mismo PR. El default `false` mantiene el comportamiento actual para todos los alumnos existentes hasta que un admin marque a alguno.
5. **Rollback**: si hay que revertir, el ALTER inverso elimina las columnas. No hay datos críticos en `paymentExemptReason` (texto libre opcional). Las columnas son no-nulables solo en el sentido del default, así que dropearlas es seguro.

## Open Questions

_(ninguna bloqueante — las dudas razonables están resueltas en Decisions y Trade-offs.)_
