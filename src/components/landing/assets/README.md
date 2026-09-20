# Payment-demo captures

- **Source:** `https://www.wody.com.ar/demo/admin/pagos` returned HTTP 200 in a clean, unauthenticated context (no cookies, interactions, or POST requests).
- **Capture time:** 2026-09-20T01:07:14.657Z–2026-09-20T01:07:15.468Z.
- **Desktop crop:** `wody-demo-pagos-desktop.webp`, 1440 × 608; header, payment summary, and the first three fictional payment rows.
- **Mobile crop:** `wody-demo-pagos-mobile.webp`, 390 × 1004; header, payment summary, and the first four fictional payment cards.
- **Fixture-only:** the visible names and `@demo.com` emails match the fictional fixtures in `src/components/demo/demoPagosData.ts`. The capture includes the DemoBanner and contains no real customer data.
- **Non-interactive:** these are local static WebP assets, not an iframe or live demo. They contain no secrets and do not call runtime, API, authentication, or database services.

The original PNG captures remain only in the approved scratch directory; this folder intentionally contains no additional screenshot variants.
