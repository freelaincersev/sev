/**
 * Canonical public origin for SEO (metadataBase, canonical, OG, sitemap, robots).
 *
 * Resolution order:
 *  1. NEXT_PUBLIC_SITE_URL — set this once the final domain is decided (e.g. sev.app).
 *  2. VERCEL_PROJECT_PRODUCTION_URL — Vercel injects the stable production domain
 *     (e.g. "sev-eight.vercel.app") on every deploy, so canonical always points at
 *     production even from preview deploys. No protocol, so we prepend https://.
 *  3. localhost — local dev fallback.
 *
 * No hardcoded guess: if a domain isn't set, we use whatever Vercel actually serves.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");
