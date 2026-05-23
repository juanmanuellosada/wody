# Vercel Blob — Storage de imágenes

Wody usa Vercel Blob para almacenar logos de gyms y cupones subidos desde el panel de super admin.

## Cómo conectar el store (una sola vez por proyecto)

1. Ir al dashboard de Vercel → proyecto Wody → pestaña **Storage**.
2. Hacer clic en **Connect Store** → seleccionar **Blob**.
3. Crear un nuevo store (ej. `wody-blob`) o conectar uno existente.
4. Vercel inyecta automáticamente `BLOB_READ_WRITE_TOKEN` en los environments `production` y `preview`.
5. Para desarrollo local: copiar el valor del token desde Vercel → Local Environment Variables → `.env.local`.

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Sí (en runtime) | Token generado por Vercel al conectar el store. No establecer manualmente. |

## Uso en el código

El helper en `src/lib/blob.ts` expone dos funciones:

- `uploadPublicImage(file, prefix)` — valida MIME y tamaño, sube el archivo y retorna `{ url, pathname }`.
- `deleteBlobByUrl(url)` — elimina un archivo por URL. Si la URL no es de Blob (ej. `/logos/...`), retorna sin hacer nada.

## Notas

- Los logos existentes de los 4 gyms actuales siguen en `/public/logos/`. No se migran automáticamente.
- Para gyms nuevos creados desde el panel, el logo se sube a Blob y la URL se guarda en `Gym.logo`.
- Si `BLOB_READ_WRITE_TOKEN` no está configurado, los uploads fallan con error explícito.
