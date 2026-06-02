/**
 * Comprime y redimensiona una imagen en el navegador usando Canvas.
 * Máx 512 px en el lado más largo, calidad 0.85, salida WebP.
 * Si el archivo es SVG, no rasterizable, o falla por cualquier motivo,
 * devuelve el File original sin modificar (degradación segura).
 */
export async function compressImage(file: File): Promise<File> {
  // SVG no pasa por Canvas (es vector); devolver tal cual.
  if (file.type === "image/svg+xml") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);

    const MAX = 512;
    let { width, height } = bitmap;
    if (width > MAX || height > MAX) {
      if (width >= height) {
        height = Math.round((height * MAX) / width);
        width = MAX;
      } else {
        width = Math.round((width * MAX) / height);
        height = MAX;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return new Promise<File>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve(new File([blob], `${baseName}.webp`, { type: "image/webp" }));
        },
        "image/webp",
        0.85
      );
    });
  } catch {
    // createImageBitmap falló (formato no soportado, etc.) — devolver original.
    return file;
  }
}
