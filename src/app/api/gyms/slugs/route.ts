import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/gyms/slugs
 * Returns all valid gym slugs. Used by proxy.ts to validate [gymSlug] segment.
 * This runs on the Node.js runtime (not edge) so Prisma works fine.
 */
export async function GET() {
  const gyms = await prisma.gym.findMany({
    select: { slug: true },
  });

  return NextResponse.json({ slugs: gyms.map((g) => g.slug) });
}
