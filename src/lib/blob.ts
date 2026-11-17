import { randomBytes } from "node:crypto";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

// Almacenamiento compatible con S3 (MinIO en el VPS o en local, o S3 de AWS).
// El bucket tiene lectura pública: las imágenes se sirven directo desde
// S3_PUBLIC_URL, sin pasar por la app.
interface StorageConfig {
  bucket: string;
  publicUrl: string;
  client: S3Client;
}

const globalForStorage = globalThis as unknown as {
  storage: StorageConfig | undefined;
};

function getStorage(): StorageConfig {
  if (globalForStorage.storage) return globalForStorage.storage;

  const {
    S3_ENDPOINT,
    S3_REGION,
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_PUBLIC_URL,
  } = process.env;

  if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_PUBLIC_URL) {
    throw new Error(
      "Almacenamiento no configurado: faltan S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY o S3_PUBLIC_URL."
    );
  }

  const client = new S3Client({
    region: S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
    // Con un endpoint propio (MinIO) se usa path-style: http://host/bucket/key.
    ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT, forcePathStyle: true } : {}),
  });

  globalForStorage.storage = {
    bucket: S3_BUCKET,
    publicUrl: S3_PUBLIC_URL.replace(/\/$/, ""),
    client,
  };
  return globalForStorage.storage;
}

/** Nombre de archivo seguro para usar en la key del objeto. */
function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "archivo";
}

/** Agrega un sufijo aleatorio antes de la extensión, como hacía Vercel Blob. */
function withRandomSuffix(fileName: string): string {
  const suffix = randomBytes(8).toString("hex");
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return `${fileName}-${suffix}`;
  return `${fileName.slice(0, dot)}-${suffix}${fileName.slice(dot)}`;
}

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

  const { bucket, publicUrl, client } = getStorage();
  const pathname = `${prefix}/${withRandomSuffix(safeFileName(file.name))}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: pathname,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return { url: `${publicUrl}/${pathname}`, pathname };
}

/**
 * Elimina un archivo del almacenamiento por su URL pública.
 * Si la URL no es del almacenamiento configurado (un path local como
 * "/logos/..." o una URL vieja de Vercel Blob), retorna sin hacer nada para
 * no romper gyms con logos viejos.
 */
export async function deleteBlobByUrl(url: string): Promise<void> {
  const { bucket, publicUrl, client } = getStorage();

  if (!url.startsWith(`${publicUrl}/`)) {
    return;
  }

  const key = decodeURIComponent(url.slice(publicUrl.length + 1));
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
