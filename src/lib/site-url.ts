/**
 * Resolves the canonical site URL used for `metadataBase`.
 *
 * Precedence (see PR 1 review WARNING — metadataBase must never silently
 * fall back to localhost in a deployed environment):
 *   1. `SITE_URL` — explicit override, set once at the real production
 *      cutover (or any environment that wants full control).
 *   2. `STAGING_HOST` — derived into an `https://` URL for staging deploys.
 *   3. `http://localhost:3000` — local dev only.
 */
export function getSiteUrl(): string {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL;
  }

  if (process.env.STAGING_HOST) {
    return `https://${process.env.STAGING_HOST}`;
  }

  return "http://localhost:3000";
}
