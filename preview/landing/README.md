# Wody landing preview

Standalone, visual-only static preview of the Wody landing. It shares presentational components from `src/components/landing` but does not import Prisma, auth, API routes, server actions, or operational application modules.

## Safe local build

1. From this directory, install this app's declared dependencies only: `npm install`.
2. Build the static export: `npm run build`.
3. Deploy the generated `out/` directory as a separate static Vercel project.

The root application's build is intentionally not used here. Do not copy or symlink dependencies from another worktree.

## Limitations

- This preview contains fictional, explicitly labeled product data; it is not a real product screenshot.
- The request form is simulated. Its confirmation states that no request was sent, and it never calls the production signup endpoint.
- Account access, login, signup, payments, analytics, API routes, authentication, and database-backed data are unavailable in this static preview.
- The preview must be deployed as an independent project from `preview/landing/out`, not as the root Wody application.
