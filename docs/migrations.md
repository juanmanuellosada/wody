# Migraciones con Prisma + Neon

Neon no permite que Prisma cree una shadow database automáticamente en su plan serverless. Sin `shadowDatabaseUrl`, `prisma migrate dev` falla.

## Configurar shadow database

1. En el dashboard de Neon, crear un branch nuevo (ej. `shadow`). Es gratuito; los branches de Neon son livianos.
2. Copiar el connection string del branch `shadow`.
3. Agregar en `.env.local`:
   ```
   SHADOW_DATABASE_URL="postgresql://user:password@shadow-host/dbname?sslmode=require"
   ```
4. `prisma migrate dev` ya funciona normalmente a partir de ese punto.

> `SHADOW_DATABASE_URL` solo se usa en desarrollo local. En producción (`prisma migrate deploy`) no se necesita.
