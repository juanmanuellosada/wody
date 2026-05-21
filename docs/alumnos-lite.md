# Alumnos Lite

## ¿Qué es un alumno lite?

Un alumno lite es un registro en el sistema que **no tiene email ni contraseña**. Existe solo para que el staff del gym pueda registrarle pagos, controlarle los accesos y asignarle un profe. No puede abrir la app ni la web.

Es útil para alumnos que pagan en efectivo, vienen de vez en cuando, o simplemente no quieren/necesitan usar la app.

## Cómo se identifica un alumno lite

Por su **número de socio** (igual que cualquier otro alumno). En el kiosko de ingreso se lo busca por ese número.

## Cómo crear un alumno lite

1. Ir a **Admin → Crear Usuario**.
2. Seleccionar el modo **"Alumno lite"** (el tercer toggle).
3. Completar el **nombre** (obligatorio).
4. Opcionalmente asignarle un **profe**.
5. Hacer clic en **"Crear Alumno Lite"**.

El sistema le asigna un número de socio automáticamente y muestra el número real en el mensaje de éxito.

> Antes de crear, la pantalla muestra el **próximo número estimado**. Es una estimación — si dos admins crean alumnos al mismo tiempo, el número real puede diferir.

## Qué puede y qué no puede hacer un alumno lite

| Acción | ¿Disponible? |
|---|---|
| Login en la app o web | ❌ No |
| Registro de pagos | ✅ Sí |
| Control de accesos (kiosko) | ✅ Sí (búsqueda por número de socio) |
| Asignación de profe | ✅ Sí |
| Soft-delete / bloqueo | ✅ Sí |
| Marcado como exento de pago | ✅ Sí |
| Recibir rutinas (WODs) asignadas | ❌ No |
| Cambiar tipo de alumno (General/Personalizado) | ❌ No (hasta convertir a cuenta completa) |

## Cómo convertir a cuenta completa

Cuando un alumno lite quiere empezar a usar la app:

1. Ir al **panel de alumnos** en Admin.
2. Encontrar al alumno lite (tiene badge "Lite" en su fila).
3. Hacer clic en **"Convertir"**.
4. En el diálogo:
   - Elegir modo: **Con contraseña** (el admin le asigna una) o **Por invitación** (el alumno recibe un mail para activar).
   - Completar el email.
   - Elegir el tipo de alumno (General o Personalizado).
5. Confirmar.

**El historial de pagos y accesos del alumno se preserva completamente.** Solo cambian el email, la contraseña y el `accountKind`.

## Kill-switch (uso interno)

La env var `NEXT_PUBLIC_ENABLE_LITE_USERS` controla si el modo lite aparece en el formulario de alta:

- Sin definir o cualquier valor que no sea `"false"` → modo lite visible.
- `NEXT_PUBLIC_ENABLE_LITE_USERS="false"` → solo se muestran los modos "Por invitación" y "Con contraseña".

Los alumnos lite ya existentes en la base de datos siguen operando normalmente aunque se apague el flag.

## Rollback de schema (solo si se decide revertir completamente)

Si se necesita restaurar `email` a `NOT NULL` en la base de datos, primero hay que rellenar un email sintético en todos los lites existentes:

```sql
UPDATE "User"
SET email = 'lite-' || id || '@no-email.local'
WHERE "accountKind" = 'LITE' AND email IS NULL;
```

Luego restaurar el `NOT NULL` con la migración de rollback. Tomar snapshot de Neon antes de cualquier operación destructiva.
