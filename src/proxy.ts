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

  // Pass through: root "/", API, demo, and global routes (validar)
  if (
    segments.length === 0 ||
    segments[0] === "api" ||
    segments[0] === "demo" ||
    segments[0] === "validar"
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
  const sessionGymSlug = session?.user?.gymSlug;

  // Cross-gym guard: if authenticated to a different gym than the URL says,
  // bounce to the session's own gym on the same subPath. Prevents the
  // "wrong gym data at wrong URL" bug where a Gym A admin typing /gymB/admin
  // would render Gym A's data under Gym B's URL.
  if (isAuthenticated && sessionGymSlug && sessionGymSlug !== gymSlug) {
    return NextResponse.redirect(
      new URL(gymPath(sessionGymSlug, subPath), nextUrl)
    );
  }

  // Gym landing + login page: public (no auth required)
  if (subPath === "/login" || subPath === "/" || subPath === "") {
    if (isAuthenticated) {
      let destination: string;
      if (role === "ADMIN") {
        destination = gymPath(gymSlug, "/admin");
      } else if (role === "TEACHER") {
        destination = gymPath(gymSlug, "/dashboard/teacher");
      } else if (role === "ACCESS") {
        destination = gymPath(gymSlug, "/ingresos");
      } else {
        destination = gymPath(gymSlug, "/dashboard/athlete");
      }
      return NextResponse.redirect(new URL(destination, nextUrl));
    }
    return NextResponse.next();
  }

  // Account activation + password reset: public (token-based, no session required)
  if (subPath === "/activar" || subPath === "/recuperar") {
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
          : role === "ACCESS"
          ? gymPath(gymSlug, "/ingresos")
          : gymPath(gymSlug, "/dashboard/teacher");
      return NextResponse.redirect(new URL(destination, nextUrl));
    }
    return NextResponse.next();
  }

  if (subPath.startsWith("/ingresos")) {
    if (role !== "ACCESS" && role !== "ADMIN") {
      return NextResponse.redirect(
        new URL(gymPath(gymSlug, "/dashboard/athlete"), nextUrl)
      );
    }
    return NextResponse.next();
  }

  if (subPath.startsWith("/checkin")) {
    // Alumnos y profes hacen ingreso vía QR/manual. ACCESS opera el
    // kiosk y no hace ingreso desde acá (si necesita, usa el manual).
    if (role === "ACCESS") {
      return NextResponse.redirect(
        new URL(gymPath(gymSlug, "/ingresos"), nextUrl)
      );
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
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|sounds/|.*\\.svg$|.*\\.png$|.*\\.js$|.*\\.webmanifest$|.*\\.wav$).*)",
  ],
};
