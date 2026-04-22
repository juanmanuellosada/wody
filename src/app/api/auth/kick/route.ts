import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

// Signs out the current session and redirects to `next`.
// Used by the gym layout to eject a blocked user from an active session —
// server components cannot mutate cookies, so the redirect goes through here.
export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next") || "/";
  await signOut({ redirect: false });
  return NextResponse.redirect(new URL(next, req.url));
}
