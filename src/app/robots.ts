import type { MetadataRoute } from "next";

/**
 * Staging protection: only allow indexing once the production cutover is
 * complete. We treat the deploy as production-ready only when NODE_ENV is
 * "production" AND STAGING_HOST is no longer set (it is removed from the
 * environment as part of the cutover to the real domain). Any other case
 * (local dev, staging deploys with STAGING_HOST configured, previews)
 * defaults to noindex.
 */
function isProductionCutoverComplete(): boolean {
  return process.env.NODE_ENV === "production" && !process.env.STAGING_HOST;
}

export default function robots(): MetadataRoute.Robots {
  if (!isProductionCutoverComplete()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
