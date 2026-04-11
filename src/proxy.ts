import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { gymPath } from "@/lib/gym";

/**
 * Module-scope cache of valid gym slugs.
 * Populated on first request after cold start via /api/gyms/slugs.
 * Small in practice (<100 gyms), and invalidated by redeploying.
 */
let gymSlugsCache: Set<string> | null = null;
let gymSlugsFetchedAt = 0;
const GYM_SLUGS_TTL_MS = 60 * 1000; // refresh every 60 seconds

async function getValidGymSlugs(request: NextRequest): Promise<Set<string>> {
  const now = Date.now();
  if (gymSlugsCache && now - gymSlugsFetchedAt < GYM_SLUGS_TTL_MS) {
    return gymSlugsCache;
  }

  try {
    const origin = request.nextUrl.origin;
    const res = await fetch(`${origin}/api/gyms/slugs`, {
      // Internal API call — bypass any auth
      headers: { "x-internal-proxy": "1" },
      next: { revalidate: 60 },
    });

    if (res.ok) {
      const data = (await res.json()) as { slugs: string[] };
      gymSlugsCache = new Set(data.slugs);
      gymSlugsFetchedAt = now;
      return gymSlugsCache;
    }
  } catch {
    // On failure, fall through to return empty cache or previous cache
  }

  // Return previous stale cache if available, empty set otherwise
  return gymSlugsCache ?? new Set();
}

export async function proxy(request: NextRequest) {
  const { nextUrl } = request;
  const segments = nextUrl.pathname.split("/").filter(Boolean);

  // Pass through: root "/", static assets, and non-gym routes
  if (
    segments.length === 0 ||
    segments[0] === "api" ||
    segments[0] === "demo" ||
    segments[0] === "manifest.webmanifest"
  ) {
    return NextResponse.next();
  }

  const gymSlug = segments[0];
  const subPath = "/" + segments.slice(1).join("/");

  // Validate gym slug — on cache miss, let Next.js handle it
  // (the layout will call notFound() if the slug is truly invalid)
  const validSlugs = await getValidGymSlugs(request);
  if (validSlugs.size > 0 && !validSlugs.has(gymSlug)) {
    return new NextResponse(null, { status: 404 });
  }

  // Get the current session
  const session = await auth();
  const isAuthenticated = !!session?.user;
  const role = session?.user?.role;

  // Gym landing + login page: public (no auth required)
  if (subPath === "/login" || subPath === "/" || subPath === "") {
    if (isAuthenticated) {
      let destination: string;
      if (role === "ADMIN") {
        destination = gymPath(gymSlug, "/admin");
      } else if (role === "TEACHER") {
        destination = gymPath(gymSlug, "/dashboard/teacher");
      } else {
        destination = gymPath(gymSlug, "/dashboard/athlete");
      }
      return NextResponse.redirect(new URL(destination, nextUrl));
    }
    return NextResponse.next();
  }

  // Protected routes: unauthenticated → redirect to gym login
  if (!isAuthenticated) {
    return NextResponse.redirect(
      new URL(gymPath(gymSlug, "/login"), nextUrl)
    );
  }

  // Role-based access control
  if (subPath.startsWith("/admin")) {
    if (role !== "ADMIN") {
      const destination =
        role === "TEACHER"
          ? gymPath(gymSlug, "/dashboard/teacher")
          : gymPath(gymSlug, "/dashboard/athlete");
      return NextResponse.redirect(new URL(destination, nextUrl));
    }
    return NextResponse.next();
  }

  if (subPath.startsWith("/dashboard/teacher")) {
    if (role !== "TEACHER" && role !== "ADMIN") {
      return NextResponse.redirect(
        new URL(gymPath(gymSlug, "/dashboard/athlete"), nextUrl)
      );
    }
    return NextResponse.next();
  }

  if (subPath.startsWith("/dashboard/athlete")) {
    if (role !== "STUDENT") {
      const destination =
        role === "ADMIN"
          ? gymPath(gymSlug, "/admin")
          : gymPath(gymSlug, "/dashboard/teacher");
      return NextResponse.redirect(new URL(destination, nextUrl));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icon.png, and other static assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|.*\\.svg$|.*\\.png$).*)",
  ],
};
