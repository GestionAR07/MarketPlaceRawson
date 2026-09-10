import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

/**
 * Transport ceiling for Server Actions (multipart overhead included).
 * App product-image business limit remains 5 MB in src/lib/product-image.ts.
 */
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "7mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: "kodestudio",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
