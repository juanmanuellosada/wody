/**
 * Build a gym-prefixed path.
 * gymPath("unidos-garage", "/dashboard/athlete") → "/unidos-garage/dashboard/athlete"
 */
export function gymPath(slug: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/${slug}${normalizedPath}`;
}
