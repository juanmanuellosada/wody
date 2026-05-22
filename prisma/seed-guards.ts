/**
 * seed-guards.ts — Guards de seguridad para scripts de seed destructivos.
 *
 * Invariante de diseño: "default deny" via allowlist, no denylist.
 * El modo de falla es siempre abortar. Si el host no está explícitamente
 * en la lista de hosts locales conocidos, el script para. Esto garantiza
 * que un DATABASE_URL de producción nunca puede disparar operaciones
 * destructivas, incluso si se configura accidentalmente en .env local.
 *
 * Las funciones exportadas aquí son importadas por seed-reset.ts.
 * No tienen dependencias externas: solo APIs nativas de Node y process.env.
 */

/**
 * Hosts considerados "locales" para operaciones destructivas de seed.
 * Incluye los nombres típicos de servicios Docker Compose ("postgres", "db").
 */
const LOCAL_HOSTS_ALLOWLIST = [
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres",
  "db",
];

/**
 * Verifica que DATABASE_URL apunte a un host local antes de ejecutar
 * cualquier operación destructiva.
 *
 * Aborta con código 1 si:
 * - DATABASE_URL no está definida
 * - DATABASE_URL no es una URL válida
 * - El hostname no está en la allowlist LOCAL_HOSTS_ALLOWLIST
 */
export function assertLocalDatabaseUrl(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error(
      "\n[seed-guards] ERROR: DATABASE_URL no está definida.\n" +
        "  Definí DATABASE_URL en tu .env.local apuntando a una DB local antes de continuar.\n"
    );
    process.exit(1);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    console.error(
      "\n[seed-guards] ERROR: DATABASE_URL no es una URL válida.\n" +
        `  Valor recibido: ${databaseUrl}\n` +
        "  Asegurate de que el formato sea postgresql://usuario:contraseña@host:puerto/db\n"
    );
    process.exit(1);
  }

  const hostname = parsedUrl.hostname;

  if (!LOCAL_HOSTS_ALLOWLIST.includes(hostname)) {
    console.error(
      "\n[seed-guards] ABORTADO: El hostname de DATABASE_URL no parece ser local.\n" +
        `  Hostname detectado: ${hostname}\n` +
        "  Hosts locales permitidos: " +
        LOCAL_HOSTS_ALLOWLIST.join(", ") +
        "\n\n" +
        "  Esta guard existe para evitar borrar datos en producción por accidente.\n" +
        "  Si estás seguro de que este host es local (ej. VM o contenedor con hostname custom),\n" +
        "  podés agregarlo a LOCAL_HOSTS_ALLOWLIST en prisma/seed-guards.ts.\n" +
        "  Nunca uses DATABASE_URL de Neon producción para correr seed:reset.\n"
    );
    process.exit(1);
  }
}

/**
 * Verifica que la variable de entorno ALLOW_DESTRUCTIVE_SEED esté seteada
 * exactamente a "1" antes de ejecutar cualquier deleteMany.
 *
 * Esta es una segunda capa de defensa, independiente de la guard de hostname.
 * Solo acepta el valor literal "1" — "true", "yes", "si" u otros valores son
 * rechazados deliberadamente para evitar permisividad accidental.
 *
 * Aborta con código 1 si la variable no está presente o tiene otro valor.
 */
export function assertDestructiveSeedAllowed(): void {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== "1") {
    console.error(
      "\n[seed-guards] ABORTADO: Falta confirmación explícita para seed destructivo.\n" +
        "  Para continuar, corré el comando con la flag de confirmación:\n\n" +
        "    ALLOW_DESTRUCTIVE_SEED=1 npm run seed:reset\n\n" +
        "  Solo se acepta el valor literal \"1\".\n" +
        "  Este comando borra TODOS los datos de la DB antes de reseedear.\n" +
        "  Verificá que DATABASE_URL apunte a tu DB local antes de continuar.\n"
    );
    process.exit(1);
  }
}
