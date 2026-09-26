# Payment-demo captures

- **Source:** the branch's own static export (`preview/landing/out`) served locally at
  `http://localhost:4173/demo/admin/pagos/`, captured with Playwright at a device scale factor of 2
  and downscaled. Earlier versions of these files were captured from `https://www.wody.com.ar`, but
  production does not carry this branch, so capturing there would have reproduced the stale image.
- **Capture time:** 2026-09-25, after the demo gained the fees edit/block/exemption/assignment
  controls.
- **Desktop crop:** `wody-demo-pagos-desktop.webp`, 1440 × 800; demo banner, navbar, fee summary,
  the fictional-data notice, and the first three payment rows.
- **Mobile crop:** `wody-demo-pagos-mobile.webp`, 390 × 1470; the same, with the first four payment
  cards.
- **Dimensions are load-bearing.** `LandingExperience.tsx` declares them on the `<source>` and
  `<Image>`, and `LandingExperience.module.css` repeats them as `aspect-ratio` on `.demoPicture`,
  once for mobile and once inside the `min-width: 700px` media query. Re-cropping means updating all
  four, or the image letterboxes inside a wrongly proportioned box.
- **Fixture-only:** the visible names and `@demo.com` emails come from the fictional fixtures in
  `src/components/demo/finance/fees-fixtures.ts`. The capture includes the DemoBanner and contains no
  real customer data. That banner is why these can honestly be shown as a real capture of the demo,
  so crops start at the top of the page rather than scrolling past it.
- **Non-interactive:** these are local static WebP assets, not an iframe or live demo. They contain
  no secrets and do not call runtime, API, authentication, or database services.

The original PNG captures remain only in the approved scratch directory; this folder intentionally
contains no additional screenshot variants.
