// Formatea un número de socio con padding a 4 dígitos para consistencia
// visual en el admin, el dashboard del alumno y el kiosk de ingresos.
// Ej: 42 -> "0042", 1234 -> "1234", 12345 -> "12345" (más dígitos si excede).
export function formatMemberNumber(n: number): string {
  return String(n).padStart(4, "0");
}
