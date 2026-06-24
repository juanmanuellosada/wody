import { NextRequest, NextResponse } from "next/server";
import { auth, signIn } from "@/lib/auth";
import { gymPath } from "@/lib/gym";

// Switches the active gym session for a STUDENT who has accounts in multiple gyms.
// Must be called via POST (the Navbar GymSwitcher does a form POST).
//
// Security model:
// 1. This route verifies the current session is a STUDENT with emailVerifiedAt.
// 2. The actual token mint happens inside `authorize` in src/lib/auth.ts (switch branch),
//    which re-verifies the session from the cookie — so a direct POST to the
//    NextAuth callback without a valid session cannot forge a token.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const targetSlug = formData.get("targetSlug");

  if (typeof targetSlug !== "string" || !targetSlug.trim()) {
    return new NextResponse("Missing targetSlug", { status: 400 });
  }

  const session = await auth();

  // Not a STUDENT → reject.
  if (!session?.user || session.user.role !== "STUDENT" || !session.user.email) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const email = session.user.email;

  if (!session.user.isEmailVerified) {
    // Unverified email: fall back to login with email prefilled.
    const loginUrl = gymPath(targetSlug, `/login?email=${encodeURIComponent(email)}`);
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }

  // Already at this gym — redirect to dashboard (no-op).
  if (session.user.gymSlug === targetSlug) {
    return NextResponse.redirect(new URL(gymPath(targetSlug, "/dashboard/athlete"), req.url));
  }

  const targetPath = gymPath(targetSlug, "/dashboard/athlete");

  try {
    // signIn with redirect: false sets the new session cookie via Next.js cookies()
    // and returns the redirect URL. The cookie is flushed automatically with our
    // subsequent NextResponse.redirect().
    await signIn("credentials", {
      gymSlug: targetSlug,
      __switchMode: "1",
      redirectTo: targetPath,
      redirect: false,
    });
  } catch {
    // authorize returned null (account not found / not a STUDENT / deleted).
    const loginUrl = gymPath(targetSlug, `/login?email=${encodeURIComponent(email)}`);
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }

  // Cookie is already set by signIn. Redirect to the target gym.
  return NextResponse.redirect(new URL(targetPath, req.url));
}
