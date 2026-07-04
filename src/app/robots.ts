import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/blog/seo";

/**
 * Allow crawling of public content; keep the internal SMS admin surface and
 * affiliate redirects out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/blog",
      disallow: ["/dashboard", "/api", "/go", "/rd", "/login"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
