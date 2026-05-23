import { put, del } from "@vercel/blob";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export async function uploadPublicImage(
  file: File,
  prefix: string
): Promise<{ url: string; pathname: string }> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(
      `Tipo de archivo no permitido: ${file.type}. Permitidos: PNG, JPEG, WebP, SVG.`
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(
      `El archivo supera el tamaño máximo de 2 MB (es ${(file.size / 1024 / 1024).toFixed(1)} MB).`
    );
  }

  const blob = await put(`${prefix}/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return { url: blob.url, pathname: blob.pathname };
}

/**
 * Elimina un archivo de Vercel Blob por su URL.
 * Si la URL no es de Blob (ej. un path local como "/logos/..."),
 * retorna sin hacer nada para no romper gyms con logos viejos.
 */
export async function deleteBlobByUrl(url: string): Promise<void> {
  // Blob URLs siempre tienen el dominio de Vercel Blob.
  // Si la URL no empieza con "https://", es un path local — no tocar.
  if (!url.startsWith("https://")) {
    return;
  }

  // Vercel Blob URLs tienen el formato:
  // https://<store-id>.public.blob.vercel-storage.com/<pathname>
  if (!url.includes("blob.vercel-storage.com")) {
    return;
  }

  await del(url);
}
